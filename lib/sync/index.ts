import type { SyncEnv, SyncStats } from "./types";
import { RockRMSClient } from "./rock-client";
import { SupabaseClient } from "./supabase-client";
import { WebflowClient } from "./webflow-client";
import { log, logError } from "./utils";

export async function fullSync(env: SyncEnv): Promise<SyncStats> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  const rock = new RockRMSClient(env.ROCK_API_URL, env.ROCK_REST_KEY);
  const supabase = new SupabaseClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_KEY
  );
  const webflow = new WebflowClient(
    env.WEBFLOW_API_TOKEN,
    env.WEBFLOW_SITE_ID,
    env.WEBFLOW_COLLECTION_ID
  );

  const duration = () => Math.round((Date.now() - startTime) / 1000);

  try {
    // Stage 1: Rock RMS → Supabase
    log("--- Stage 1: Rock RMS → Supabase ---");
    const rockGroups = await rock.fetchGroups();

    const toDelete = rockGroups.filter((g) => g.is_archived);
    const activeGroups = rockGroups.filter((g) => !g.is_archived);
    log(
      `${activeGroups.length} active groups, ${toDelete.length} archived groups to delete`
    );

    await supabase.upsertGroups(activeGroups);
    if (toDelete.length > 0) {
      await supabase.deleteGroups(toDelete.map((g) => g.rock_id));
    }
    await supabase.logSync("rock_to_supabase", "success", {
      processed: activeGroups.length,
      startedAt,
      duration: duration(),
    });

    // Stage 2: Supabase → Webflow (create + update + delete)
    log("--- Stage 2: Supabase → Webflow ---");
    await webflow.initializeReferenceMaps();

    const supabaseGroups = await supabase.getAllGroups();
    const existingItems = await webflow.getExistingItems();

    const existingMap = new Map(
      existingItems.map((item) => [item.fieldData["rock-id"] as number, item])
    );

    const toCreate = supabaseGroups.filter((g) => !existingMap.has(g.rock_id));
    const toUpdate = supabaseGroups
      .filter((g) => existingMap.has(g.rock_id))
      .map((g) => ({ item: existingMap.get(g.rock_id)!, group: g }));

    log(`${toCreate.length} to create, ${toUpdate.length} to update`);

    const { created, itemIds: createdIds } = await webflow.createItems(toCreate);

    const updatedIds: string[] = [];
    let updated = 0;
    for (const { item, group } of toUpdate) {
      try {
        await webflow.updateItem(item.id, group);
        updatedIds.push(item.id);
        updated++;
        if (updated % 10 === 0) log(`Updated ${updated}/${toUpdate.length}`);
      } catch (updateError) {
        logError(
          `Failed to update item ${item.id} (${group.name})`,
          updateError as Error
        );
      }
      if (updated < toUpdate.length)
        await new Promise((r) => setTimeout(r, 200));
    }

    // Delete archived groups from Webflow
    const toDeleteWebflowIds = toDelete
      .map((g) => existingMap.get(g.rock_id)?.id)
      .filter((id): id is string => id !== undefined);
    const deleted = await webflow.deleteItems(toDeleteWebflowIds);

    // Stage 3: Publish all created/updated items
    log("--- Stage 3: Publish ---");
    const allAffectedIds = [...createdIds, ...updatedIds];

    let published = 0;
    try {
      await webflow.publishItems(allAffectedIds);
      published = allAffectedIds.length;
      await webflow.publishSite();
    } catch (publishError) {
      logError(
        "Publish failed — items written but not yet published",
        publishError as Error
      );
      log("Publish manually via Webflow dashboard or wait for next sync");
    }

    await supabase.logSync("supabase_to_webflow", "success", {
      processed: supabaseGroups.length,
      created,
      updated,
      startedAt,
      duration: duration(),
    });

    log(`=== Full sync completed in ${duration()}s ===`);

    return {
      startedAt,
      rockToSupabase: { processed: activeGroups.length, status: "success" },
      supabaseToWebflow: {
        processed: supabaseGroups.length,
        created,
        updated,
        deleted,
        published,
        status: "success",
      },
      duration: duration(),
    };
  } catch (error) {
    logError("Full sync failed", error as Error);

    try {
      await supabase.logSync(
        "full_sync",
        "failed",
        { startedAt, duration: duration() },
        error as Error
      );
    } catch (logErr) {
      console.error("Failed to log sync error:", logErr);
    }

    throw error;
  }
}

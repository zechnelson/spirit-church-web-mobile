import type { OutreachSyncEnv, OutreachSyncStats } from "./types";
import { OutreachRockClient } from "./rock-client";
import { OutreachSupabaseClient } from "./supabase-client";
import { OutreachWebflowClient } from "./webflow-client";
import { log, logError } from "../utils";

export async function fullOutreachSync(
  env: OutreachSyncEnv
): Promise<OutreachSyncStats> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  const rock = new OutreachRockClient(
    env.ROCK_API_URL,
    env.ROCK_REST_KEY,
    parseInt(env.ROCK_SIGNUP_GROUP_TYPE_ID, 10)
  );
  const supabase = new OutreachSupabaseClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_KEY
  );
  const webflow = new OutreachWebflowClient(
    env.WEBFLOW_API_TOKEN,
    env.WEBFLOW_SITE_ID,
    env.WEBFLOW_OUTREACH_COLLECTION_ID
  );

  const duration = () => Math.round((Date.now() - startTime) / 1000);

  try {
    // Stage 1: Rock RMS → Supabase
    log("--- Outreach Stage 1: Rock RMS → Supabase ---");
    const rockProjects = await rock.fetchSignUpGroups();

    const toDelete = rockProjects.filter((p) => p.is_archived);
    const activeProjects = rockProjects.filter((p) => !p.is_archived);
    log(
      `${activeProjects.length} active projects, ${toDelete.length} archived to delete`
    );

    await supabase.upsertProjects(activeProjects);
    if (toDelete.length > 0) {
      await supabase.deleteProjects(toDelete.map((p) => p.rock_group_id));
    }
    await supabase.logSync("outreach_rock_to_supabase", "success", {
      processed: activeProjects.length,
      startedAt,
      duration: duration(),
    });

    // Stage 2: Supabase → Webflow (create + update + delete)
    log("--- Outreach Stage 2: Supabase → Webflow ---");
    const supabaseProjects = await supabase.getAllProjects();
    const existingItems = await webflow.getExistingItems();

    const existingMap = new Map(
      existingItems.map((item) => [
        item.fieldData["rock-opportunity-id"] as number,
        item,
      ])
    );

    const toCreate = supabaseProjects.filter(
      (p) => !existingMap.has(p.rock_opportunity_id)
    );
    const toUpdate = supabaseProjects
      .filter((p) => existingMap.has(p.rock_opportunity_id))
      .map((p) => ({ item: existingMap.get(p.rock_opportunity_id)!, project: p }));

    log(
      `${toCreate.length} to create, ${toUpdate.length} to update, ${toDelete.length} to delete from Webflow`
    );

    const { created, itemIds: createdIds } = await webflow.createItems(toCreate);

    const updatedIds: string[] = [];
    let updated = 0;
    for (const { item, project } of toUpdate) {
      try {
        await webflow.updateItem(item.id, project);
        updatedIds.push(item.id);
        updated++;
        if (updated % 10 === 0) log(`Updated ${updated}/${toUpdate.length}`);
      } catch (updateError) {
        logError(
          `Failed to update item ${item.id} (${project.name})`,
          updateError as Error
        );
      }
      if (updated < toUpdate.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    const toDeleteWebflowIds = toDelete
      .map((p) => existingMap.get(p.rock_opportunity_id)?.id)
      .filter((id): id is string => id !== undefined);
    const deleted = await webflow.deleteItems(toDeleteWebflowIds);

    // Stage 3: Publish
    log("--- Outreach Stage 3: Publish ---");
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

    await supabase.logSync("outreach_supabase_to_webflow", "success", {
      processed: supabaseProjects.length,
      created,
      updated,
      startedAt,
      duration: duration(),
    });

    log(`=== Outreach sync completed in ${duration()}s ===`);

    return {
      startedAt,
      rockToSupabase: { processed: activeProjects.length, status: "success" },
      supabaseToWebflow: {
        processed: supabaseProjects.length,
        created,
        updated,
        deleted,
        published,
        status: "success",
      },
      duration: duration(),
    };
  } catch (error) {
    logError("Outreach sync failed", error as Error);

    try {
      await supabase.logSync(
        "outreach_full_sync",
        "failed",
        { startedAt, duration: duration() },
        error as Error
      );
    } catch (logErr) {
      console.error("Failed to log outreach sync error:", logErr);
    }

    throw error;
  }
}

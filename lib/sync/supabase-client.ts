import type { SyncGroup } from "./types";
import { log, logError } from "./utils";

export class SupabaseClient {
  private url: string;
  private serviceKey: string;

  constructor(url: string, serviceKey: string) {
    this.url = url;
    this.serviceKey = serviceKey;
  }

  private get headers() {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      "Content-Type": "application/json",
    };
  }

  async upsertGroups(groups: SyncGroup[]): Promise<SyncGroup[]> {
    log(`Upserting ${groups.length} groups to Supabase...`);

    const payload = groups.map((g) => ({
      ...g,
      updated_at: new Date().toISOString(),
    }));

    const response = await fetch(`${this.url}/rest/v1/groups`, {
      method: "POST",
      headers: {
        ...this.headers,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase upsert failed: ${response.status} - ${errorText}`);
    }

    const result: SyncGroup[] = await response.json();
    log(`Upserted ${result.length} groups`);
    return result;
  }

  async getAllGroups(): Promise<SyncGroup[]> {
    log("Fetching all groups from Supabase...");

    const response = await fetch(`${this.url}/rest/v1/groups?order=name.asc`, {
      headers: this.headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase fetch failed: ${response.status} - ${errorText}`);
    }

    const groups: SyncGroup[] = await response.json();
    log(`Retrieved ${groups.length} groups`);
    return groups;
  }

  async logSync(
    syncType: string,
    status: "success" | "failed",
    stats: {
      processed?: number;
      created?: number;
      updated?: number;
      startedAt: string;
      duration: number;
    },
    error?: Error
  ): Promise<void> {
    try {
      await fetch(`${this.url}/rest/v1/sync_logs`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          sync_type: syncType,
          status,
          groups_processed: stats.processed ?? 0,
          groups_created: stats.created ?? 0,
          groups_updated: stats.updated ?? 0,
          error_message: error?.message ?? null,
          started_at: stats.startedAt,
          completed_at: new Date().toISOString(),
          duration_seconds: stats.duration,
        }),
      });
      log(`Logged ${syncType} sync: ${status}`);
    } catch (err) {
      logError("Failed to log sync", err as Error);
    }
  }
}

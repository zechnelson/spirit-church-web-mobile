import type { OutreachProject } from "./types";
import { log, logError } from "../utils";

export class OutreachSupabaseClient {
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

  async upsertProjects(projects: OutreachProject[]): Promise<OutreachProject[]> {
    log(`Upserting ${projects.length} outreach projects to Supabase...`);

    const payload = projects.map((p) => ({
      ...p,
      updated_at: new Date().toISOString(),
    }));

    const response = await fetch(
      `${this.url}/rest/v1/outreach_projects?on_conflict=rock_opportunity_id`,
      {
        method: "POST",
        headers: {
          ...this.headers,
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Supabase upsert failed: ${response.status} - ${errorText}`
      );
    }

    const result: OutreachProject[] = await response.json();
    log(`Upserted ${result.length} outreach projects`);
    return result;
  }

  async getAllProjects(): Promise<OutreachProject[]> {
    log("Fetching all outreach projects from Supabase...");

    const response = await fetch(
      `${this.url}/rest/v1/outreach_projects?order=name.asc`,
      { headers: this.headers }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Supabase fetch failed: ${response.status} - ${errorText}`
      );
    }

    const projects: OutreachProject[] = await response.json();
    log(`Retrieved ${projects.length} outreach projects`);
    return projects;
  }

  async deleteProjects(rockGroupIds: number[]): Promise<number> {
    if (rockGroupIds.length === 0) return 0;

    log(`Deleting ${rockGroupIds.length} outreach projects from Supabase...`);

    const idList = rockGroupIds.join(",");
    const response = await fetch(
      `${this.url}/rest/v1/outreach_projects?rock_group_id=in.(${idList})`,
      {
        method: "DELETE",
        headers: {
          ...this.headers,
          Prefer: "return=representation",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Supabase delete failed: ${response.status} - ${errorText}`
      );
    }

    const result: OutreachProject[] = await response.json();
    log(`Deleted ${result.length} outreach projects from Supabase`);
    return result.length;
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

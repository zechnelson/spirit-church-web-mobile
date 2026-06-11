import type { OutreachProject, WebflowOutreachItem } from "./types";
import { log, logError } from "../utils";

export class OutreachWebflowClient {
  private apiToken: string;
  private siteId: string;
  private collectionId: string;
  private baseUrl = "https://api.webflow.com/v2";

  constructor(apiToken: string, siteId: string, collectionId: string) {
    this.apiToken = apiToken;
    this.siteId = siteId;
    this.collectionId = collectionId;
  }

  private get authHeaders() {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };
  }

  transformProjectForWebflow(
    project: OutreachProject
  ): { fieldData: Record<string, unknown> } {
    const fieldData: Record<string, unknown> = {
      name: project.name,
      slug: project.slug,
      "rock-group-id": project.rock_group_id,
      "rock-opportunity-id": project.rock_opportunity_id,
      "kids-welcome": project.kids_welcome,
      "handicap-accessible": project.handicap_accessible,
      "is-active": project.is_active,
    };

    if (project.description) fieldData["description"] = project.description;
    if (project.schedule_display) fieldData["schedule-display"] = project.schedule_display;
    if (project.location_address) fieldData["location-address"] = project.location_address;
    if (project.semester) fieldData["semester"] = project.semester;
    if (project.tools_needed) fieldData["tools-needed"] = project.tools_needed;
    if (project.project_type) fieldData["project-type"] = project.project_type;
    if (project.signup_url) fieldData["signup-url"] = project.signup_url;
    if (project.campus) fieldData["campus"] = project.campus;
    if (project.event) fieldData["event"] = project.event;
    if (project.category) fieldData["category"] = project.category;
    if (project.city) fieldData["city"] = project.city;

    return { fieldData };
  }

  async getExistingItems(): Promise<WebflowOutreachItem[]> {
    log("Fetching existing outreach items from Webflow...");

    const response = await fetch(
      `${this.baseUrl}/collections/${this.collectionId}/items`,
      {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webflow API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const items: WebflowOutreachItem[] = data.items ?? [];
    if (data.pagination?.total != null && data.pagination.total > items.length) {
      log(
        `Warning: Webflow has ${data.pagination.total} total items but only ${items.length} were retrieved. Pagination not implemented.`
      );
    }
    log(`Retrieved ${items.length} existing Webflow outreach items`);
    return items;
  }

  async createItems(
    projects: OutreachProject[]
  ): Promise<{ created: number; itemIds: string[] }> {
    if (projects.length === 0) return { created: 0, itemIds: [] };

    log(`Creating ${projects.length} new outreach items in Webflow...`);

    let created = 0;
    const itemIds: string[] = [];

    for (const project of projects) {
      const payload = this.transformProjectForWebflow(project);

      const response = await fetch(
        `${this.baseUrl}/collections/${this.collectionId}/items`,
        {
          method: "POST",
          headers: this.authHeaders,
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logError(
          `Failed to create item ${project.name}`,
          new Error(errorText)
        );
        continue;
      }

      const data = await response.json();
      if (data.id) {
        itemIds.push(data.id);
        created++;
        log(`Created ${created}/${projects.length}: ${project.name}`);
      } else {
        logError(
          `Create succeeded but no id in response for ${project.name}`,
          new Error(JSON.stringify(data))
        );
      }

      if (created < projects.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    log(`Created ${created} outreach items`);
    return { created, itemIds };
  }

  async updateItem(itemId: string, project: OutreachProject): Promise<void> {
    const payload = this.transformProjectForWebflow(project);

    const response = await fetch(
      `${this.baseUrl}/collections/${this.collectionId}/items/${itemId}`,
      {
        method: "PATCH",
        headers: this.authHeaders,
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update item ${itemId}: ${errorText}`);
    }
  }

  async publishItems(itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) return;

    log(`Publishing ${itemIds.length} outreach items...`);

    const CHUNK_SIZE = 100;
    for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
      const chunk = itemIds.slice(i, i + CHUNK_SIZE);

      const response = await fetch(
        `${this.baseUrl}/collections/${this.collectionId}/items/publish`,
        {
          method: "POST",
          headers: this.authHeaders,
          body: JSON.stringify({ itemIds: chunk }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to publish items (chunk ${Math.floor(i / CHUNK_SIZE) + 1}): ${response.status} - ${errorText}`
        );
      }
    }

    log(`Published ${itemIds.length} outreach items`);
  }

  async publishSite(): Promise<void> {
    log("Publishing Webflow site (outreach sync)...");

    const siteResponse = await fetch(`${this.baseUrl}/sites/${this.siteId}`, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        accept: "application/json",
      },
    });

    let customDomains: string[] = [];
    if (siteResponse.ok) {
      const siteData = await siteResponse.json();
      customDomains =
        siteData.customDomains?.map((d: { url: string }) => d.url) ?? [];
    }

    const response = await fetch(
      `${this.baseUrl}/sites/${this.siteId}/publish`,
      {
        method: "POST",
        headers: this.authHeaders,
        body: JSON.stringify({ customDomains }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to publish site: ${response.status} - ${errorText}`
      );
    }

    log("Site published");
  }

  async deleteItem(itemId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/collections/${this.collectionId}/items/${itemId}`,
      {
        method: "DELETE",
        headers: this.authHeaders,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to delete item ${itemId}: ${response.status} - ${errorText}`
      );
    }
  }

  async deleteItems(itemIds: string[]): Promise<number> {
    if (itemIds.length === 0) return 0;

    log(`Deleting ${itemIds.length} outreach items from Webflow...`);

    let deleted = 0;
    for (let i = 0; i < itemIds.length; i++) {
      try {
        await this.deleteItem(itemIds[i]);
        deleted++;
      } catch (e) {
        logError(`Failed to delete item ${itemIds[i]}`, e as Error);
      }
      if (i < itemIds.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    log(`Deleted ${deleted} outreach items`);
    return deleted;
  }
}

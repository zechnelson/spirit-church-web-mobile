import type { OutreachProject, WebflowOutreachItem } from "./types";
import { log, logError } from "../utils";

type ReferenceMap = Record<string, string>;

export class OutreachWebflowClient {
  private apiToken: string;
  private siteId: string;
  private collectionId: string;
  private baseUrl = "https://api.webflow.com/v2";

  private readonly campusesCollectionId = "6a34b321383e05c75c39e00a";
  private readonly eventsCollectionId = "6a34b3227f7a37ca726a218f";
  private readonly categoriesCollectionId = "6a34b32342f56dbdad8ff50b";
  private readonly citiesCollectionId = "6a34b3248360e1ed0c7190e6";

  // Public so tests can inject maps directly without hitting the API
  campusMap: ReferenceMap | null = null;
  eventMap: ReferenceMap | null = null;
  categoryMap: ReferenceMap | null = null;
  cityMap: ReferenceMap | null = null;

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

  async fetchReferenceCollection(collectionId: string): Promise<ReferenceMap> {
    const response = await fetch(
      `${this.baseUrl}/collections/${collectionId}/items`,
      {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch reference collection ${collectionId}: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    const map: ReferenceMap = {};
    for (const item of data.items ?? []) {
      const name = item.fieldData?.name || item.fieldData?.Name;
      if (name) map[name] = item.id;
    }
    return map;
  }

  mapValuesToIds(values: string[], map: ReferenceMap): string[] {
    return values.flatMap((value) => {
      const id = map[value];
      if (!id) {
        log(`Warning: No matching Webflow item for value: ${value}`);
        return [];
      }
      return [id];
    });
  }

  async upsertReferenceItem(collectionId: string, name: string): Promise<string> {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const response = await fetch(
      `${this.baseUrl}/collections/${collectionId}/items`,
      {
        method: "POST",
        headers: this.authHeaders,
        body: JSON.stringify({ fieldData: { name, slug } }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create reference item "${name}" in collection ${collectionId}: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    if (!data.id) {
      throw new Error(`Created reference item "${name}" but no id in response`);
    }
    return data.id;
  }

  async syncReferenceCollection(
    collectionId: string,
    values: Set<string>
  ): Promise<ReferenceMap> {
    const map = await this.fetchReferenceCollection(collectionId);

    for (const value of values) {
      if (!map[value]) {
        try {
          const id = await this.upsertReferenceItem(collectionId, value);
          map[value] = id;
          log(`Created reference item "${value}" in collection ${collectionId}`);
        } catch (e) {
          log(`Warning: Failed to create reference item "${value}": ${(e as Error).message}`);
        }
      }
    }

    return map;
  }

  async initializeReferenceMaps(projects: OutreachProject[]): Promise<void> {
    log("Initializing outreach reference collection mappings...");

    const campuses = new Set(projects.map((p) => p.campus).filter((v): v is string => v !== null));
    const events = new Set(projects.map((p) => p.event).filter((v): v is string => v !== null));
    const categories = new Set(projects.map((p) => p.category).filter((v): v is string => v !== null));
    const cities = new Set(projects.map((p) => p.city).filter((v): v is string => v !== null));

    const campusMap = await this.syncReferenceCollection(this.campusesCollectionId, campuses);
    const eventMap = await this.syncReferenceCollection(this.eventsCollectionId, events);
    const categoryMap = await this.syncReferenceCollection(this.categoriesCollectionId, categories);
    const cityMap = await this.syncReferenceCollection(this.citiesCollectionId, cities);

    this.campusMap = campusMap;
    this.eventMap = eventMap;
    this.categoryMap = categoryMap;
    this.cityMap = cityMap;

    log(
      `Loaded ${Object.keys(campusMap).length} campuses, ` +
        `${Object.keys(eventMap).length} events, ` +
        `${Object.keys(categoryMap).length} categories, ` +
        `${Object.keys(cityMap).length} cities`
    );
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

    try {
      if (project.campus && this.campusMap) {
        const ids = this.mapValuesToIds([project.campus], this.campusMap);
        if (ids.length > 0) fieldData["campus-2"] = ids;
      }
    } catch (e) {
      log(`Warning: campus mapping failed for ${project.name}: ${(e as Error).message}`);
    }

    try {
      if (project.event && this.eventMap) {
        const ids = this.mapValuesToIds([project.event], this.eventMap);
        if (ids.length > 0) fieldData["event-2"] = ids;
      }
    } catch (e) {
      log(`Warning: event mapping failed for ${project.name}: ${(e as Error).message}`);
    }

    try {
      if (project.category && this.categoryMap) {
        const ids = this.mapValuesToIds([project.category], this.categoryMap);
        if (ids.length > 0) fieldData["category-2"] = ids;
      }
    } catch (e) {
      log(`Warning: category mapping failed for ${project.name}: ${(e as Error).message}`);
    }

    try {
      if (project.city && this.cityMap) {
        const ids = this.mapValuesToIds([project.city], this.cityMap);
        if (ids.length > 0) fieldData["city-2"] = ids;
      }
    } catch (e) {
      log(`Warning: city mapping failed for ${project.name}: ${(e as Error).message}`);
    }

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

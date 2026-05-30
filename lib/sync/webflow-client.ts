import type { SyncGroup, WebflowItem } from "./types";
import { calculateSpotsAvailable, log, logError } from "./utils";

type ReferenceMap = Record<string, string>;

export class WebflowClient {
  private apiToken: string;
  private siteId: string;
  private collectionId: string;
  private baseUrl = "https://api.webflow.com/v2";

  private readonly topicsCollectionId = "696eff5aa4cda76f8c6de386";
  private readonly audiencesCollectionId = "696eff2807ed1fc6a1eb8db0";
  private readonly lifeStagesCollectionId = "696eff96dbc04d12d51b34e1";
  private readonly cityCollectionId = "6970957a11505bf2aa488045";
  private readonly childcareCollectionId = "69719d2a11b310551fda1713";
  private readonly kidsWelcomeCollectionId = "69719e7b17501e7b8c9e9179";

  // Public so tests can inject maps directly without hitting the API
  topicsMap: ReferenceMap | null = null;
  audiencesMap: ReferenceMap | null = null;
  lifeStagesMap: ReferenceMap | null = null;
  cityMap: ReferenceMap | null = null;
  childcareMap: ReferenceMap | null = null;
  kidsWelcomeMap: ReferenceMap | null = null;

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

  async initializeReferenceMaps(): Promise<void> {
    log("Initializing reference collection mappings...");

    const [topics, audiences, lifeStages, city, childcare, kidsWelcome] =
      await Promise.all([
        this.fetchReferenceCollection(this.topicsCollectionId),
        this.fetchReferenceCollection(this.audiencesCollectionId),
        this.fetchReferenceCollection(this.lifeStagesCollectionId),
        this.fetchReferenceCollection(this.cityCollectionId),
        this.fetchReferenceCollection(this.childcareCollectionId),
        this.fetchReferenceCollection(this.kidsWelcomeCollectionId),
      ]);

    this.topicsMap = topics;
    this.audiencesMap = audiences;
    this.lifeStagesMap = lifeStages;
    this.cityMap = city;
    this.childcareMap = childcare;
    this.kidsWelcomeMap = kidsWelcome;

    log(
      `Loaded ${Object.keys(topics).length} topics, ` +
        `${Object.keys(audiences).length} audiences, ` +
        `${Object.keys(lifeStages).length} life stages, ` +
        `${Object.keys(city).length} cities, ` +
        `${Object.keys(childcare).length} childcare, ` +
        `${Object.keys(kidsWelcome).length} kids-welcome options`
    );
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

  async getExistingItems(): Promise<WebflowItem[]> {
    log("Fetching existing items from Webflow...");

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
    const items: WebflowItem[] = data.items ?? [];
    if (data.pagination?.total != null && data.pagination.total > items.length) {
      log(`Warning: Webflow has ${data.pagination.total} total items but only ${items.length} were retrieved. Pagination not implemented — groups above the first 100 will be re-created instead of updated.`);
    }
    log(`Retrieved ${items.length} existing Webflow items`);
    return items;
  }

  transformGroupForWebflow(
    group: SyncGroup
  ): { fieldData: Record<string, unknown> } {
    const spotsAvailable = calculateSpotsAvailable(
      group.capacity,
      group.current_members
    );

    const fieldData: Record<string, unknown> = {
      name: group.name,
      slug: group.slug,
    };

    if (group.rock_id != null) fieldData["rock-id"] = group.rock_id;
    if (group.description) fieldData["description-2"] = group.description;
    if (group.campus) fieldData["campus-2"] = group.campus;
    if (group.group_type) fieldData["group-type-2"] = group.group_type;
    if (group.meeting_time) fieldData["meeting-time"] = group.meeting_time;
    if (group.schedule_description)
      fieldData["schedule-description"] = group.schedule_description;
    if (group.capacity != null) fieldData["capacity"] = group.capacity;
    if (group.current_members != null)
      fieldData["current-members"] = group.current_members;
    if (spotsAvailable != null) fieldData["spots-available"] = spotsAvailable;
    if (group.registration_url)
      fieldData["registration-url"] = group.registration_url;
    if (group.is_active != null) fieldData["is-active"] = group.is_active;
    if (group.is_public != null) fieldData["is-public-2"] = group.is_public;

    try {
      if (group.topics.length > 0 && this.topicsMap) {
        const ids = this.mapValuesToIds(group.topics, this.topicsMap);
        if (ids.length > 0) fieldData["group-topics"] = ids;
      }
    } catch (e) {
      log(`Warning: topics mapping failed for ${group.name}: ${(e as Error).message}`);
    }

    try {
      if (group.audience.length > 0 && this.audiencesMap) {
        const ids = this.mapValuesToIds(group.audience, this.audiencesMap);
        if (ids.length > 0) fieldData["group-audiences"] = ids;
      }
    } catch (e) {
      log(`Warning: audience mapping failed for ${group.name}: ${(e as Error).message}`);
    }

    try {
      if (group.life_stages.length > 0 && this.lifeStagesMap) {
        const ids = this.mapValuesToIds(group.life_stages, this.lifeStagesMap);
        if (ids.length > 0) fieldData["group-life-stages"] = ids;
      }
    } catch (e) {
      log(`Warning: life_stages mapping failed for ${group.name}: ${(e as Error).message}`);
    }

    try {
      if (group.city && this.cityMap) {
        const ids = this.mapValuesToIds([group.city], this.cityMap);
        if (ids.length > 0) fieldData["city"] = ids[0];
      }
    } catch (e) {
      log(`Warning: city mapping failed for ${group.name}: ${(e as Error).message}`);
    }

    try {
      if (group.childcare_provided && this.childcareMap) {
        const ids = this.mapValuesToIds(
          [group.childcare_provided],
          this.childcareMap
        );
        if (ids.length > 0) fieldData["childcare-available"] = ids[0];
      }
    } catch (e) {
      log(`Warning: childcare mapping failed for ${group.name}: ${(e as Error).message}`);
    }

    try {
      if (group.kids_welcome && this.kidsWelcomeMap) {
        const ids = this.mapValuesToIds(
          [group.kids_welcome],
          this.kidsWelcomeMap
        );
        if (ids.length > 0) fieldData["kids-welcome"] = ids[0];
      }
    } catch (e) {
      log(`Warning: kids_welcome mapping failed for ${group.name}: ${(e as Error).message}`);
    }

    return { fieldData };
  }

  async createItems(
    groups: SyncGroup[]
  ): Promise<{ created: number; itemIds: string[] }> {
    if (groups.length === 0) return { created: 0, itemIds: [] };

    log(`Creating ${groups.length} new items in Webflow...`);

    let created = 0;
    const itemIds: string[] = [];

    for (const group of groups) {
      const payload = this.transformGroupForWebflow(group);

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
          `Failed to create item ${group.name}`,
          new Error(errorText)
        );
        continue;
      }

      const data = await response.json();
      if (data.id) {
        itemIds.push(data.id);
        created++;
        log(`Created ${created}/${groups.length}: ${group.name}`);
      } else {
        logError(`Create succeeded but no id in response for ${group.name}`, new Error(JSON.stringify(data)));
      }

      if (created < groups.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    log(`Created ${created} items`);
    return { created, itemIds };
  }

  async updateItem(itemId: string, group: SyncGroup): Promise<void> {
    const payload = this.transformGroupForWebflow(group);

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

  // THE FIX: promote drafted items to published state
  async publishItems(itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) return;

    log(`Publishing ${itemIds.length} items...`);

    const response = await fetch(
      `${this.baseUrl}/collections/${this.collectionId}/items/publish`,
      {
        method: "POST",
        headers: this.authHeaders,
        body: JSON.stringify({ itemIds }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to publish items: ${response.status} - ${errorText}`
      );
    }

    log(`Published ${itemIds.length} items`);
  }

  async publishSite(): Promise<void> {
    log("Publishing Webflow site...");

    // Fetch site info to get custom domains
    const siteResponse = await fetch(`${this.baseUrl}/sites/${this.siteId}`, {
      headers: { Authorization: `Bearer ${this.apiToken}`, accept: "application/json" },
    });

    let customDomains: string[] = [];
    if (siteResponse.ok) {
      const siteData = await siteResponse.json();
      customDomains = siteData.customDomains?.map((d: { url: string }) => d.url) ?? [];
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
}

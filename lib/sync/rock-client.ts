import type { RockRawGroup, SyncGroup } from "./types";
import {
  convertTo12Hour,
  parseMultiSelectAttribute,
  getImageUrl,
  log,
} from "./utils";

export class RockRMSClient {
  private apiUrl: string;
  private restKey: string;

  constructor(apiUrl: string, restKey: string) {
    this.apiUrl =
      apiUrl.replace("/api/v2", "").replace(/\/api$/, "") + "/api";
    this.restKey = restKey;
  }

  async fetchGroups(): Promise<SyncGroup[]> {
    log("Fetching groups from Rock RMS (recursive from parent 85)...");
    const allGroups = await this.fetchGroupDescendants(85);
    log(`Fetched ${allGroups.length} total groups`);

    const spiritGroups = allGroups.filter((g) => g.GroupTypeId === 25);
    log(`Filtered to ${spiritGroups.length} Spirit Groups`);

    return spiritGroups.map((g) => this.transformGroup(g));
  }

  async fetchGroupDescendants(parentId: number): Promise<RockRawGroup[]> {
    const query = new URLSearchParams({
      $filter: `ParentGroupId eq ${parentId}`,
      $expand: "Campus,GroupType,Schedule",
      loadAttributes: "simple",
    });

    const response = await fetch(`${this.apiUrl}/Groups?${query}`, {
      headers: {
        "Authorization-Token": this.restKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Rock RMS API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const children: RockRawGroup[] = await response.json();
    log(`Found ${children.length} children of group ${parentId}`);

    const descendants: RockRawGroup[] = [...children];
    for (const child of children) {
      const grandchildren = await this.fetchGroupDescendants(child.Id);
      descendants.push(...grandchildren);
    }
    return descendants;
  }

  transformGroup(rockGroup: RockRawGroup): SyncGroup {
    const topics = parseMultiSelectAttribute(rockGroup.AttributeValues?.Topic);
    const audience = parseMultiSelectAttribute(
      rockGroup.AttributeValues?.SpiritGroupAudience
    );
    const lifeStages = parseMultiSelectAttribute(
      rockGroup.AttributeValues?.SpiritGroupLifeStage
    );
    const cityArray = parseMultiSelectAttribute(
      rockGroup.AttributeValues?.SpiritGroupLocation
    );

    return {
      rock_id: rockGroup.Id,
      name: rockGroup.Name,
      slug: String(rockGroup.Id),
      description: rockGroup.Description ?? "",
      campus: rockGroup.Campus?.Name ?? null,
      campus_id: rockGroup.CampusId ?? null,
      group_type: rockGroup.GroupType?.Name ?? null,
      group_type_id: rockGroup.GroupTypeId ?? null,
      parent_group_id: rockGroup.ParentGroupId ?? null,
      meeting_time: rockGroup.Schedule?.WeeklyTimeOfDay
        ? convertTo12Hour(rockGroup.Schedule.WeeklyTimeOfDay)
        : null,
      schedule_description: rockGroup.Schedule?.Description ?? null,
      capacity: rockGroup.GroupCapacity ?? null,
      current_members: rockGroup.ActiveMemberCount ?? 0,
      registration_url: `https://rms.spiritchurch.co/GroupRegistration?GroupId=${rockGroup.Id}`,
      is_active: rockGroup.IsActive,
      is_public: rockGroup.IsPublic,
      is_archived: rockGroup.IsArchived ?? false,
      topics,
      audience,
      life_stages: lifeStages,
      city: cityArray[0] ?? null,
      childcare_provided:
        rockGroup.AttributeValues?.ChildcareProvided?.Value ?? null,
      kids_welcome: rockGroup.AttributeValues?.AreKidsWelcome?.Value ?? null,
      group_image: getImageUrl(
        rockGroup.AttributeValues?.GroupImageThumbnail,
        this.apiUrl
      ),
      last_synced_at: new Date().toISOString(),
    };
  }
}

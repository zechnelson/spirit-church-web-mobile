import type { RockRawSignUpGroup, OutreachProject } from "./types";
import { log } from "../utils";

const RMS_BASE_URL = "https://rms.spiritchurch.co";

export class OutreachRockClient {
  private apiUrl: string;
  private restKey: string;
  private groupTypeId: number;

  constructor(apiUrl: string, restKey: string, groupTypeId: number) {
    this.apiUrl =
      apiUrl.replace("/api/v2", "").replace(/\/api$/, "") + "/api";
    this.restKey = restKey;
    this.groupTypeId = groupTypeId;
  }

  private async fetchIdKeyMap(
    endpoint: string,
    ids: number[]
  ): Promise<Map<number, string>> {
    if (ids.length === 0) return new Map();

    const filter = ids.map((id) => `Id eq ${id}`).join(" or ");
    const query = new URLSearchParams({ $filter: filter });

    const response = await fetch(`${this.apiUrl}/${endpoint}?${query}`, {
      headers: {
        "Authorization-Token": this.restKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      log(`Warning: Failed to fetch IdKey map for ${endpoint}: ${response.status}`);
      return new Map();
    }

    const items: { Id: number; IdKey?: string | null }[] = await response.json();
    const map = new Map<number, string>();
    for (const item of items) {
      if (item.IdKey) map.set(item.Id, item.IdKey);
    }
    return map;
  }

  async fetchSignUpGroups(): Promise<OutreachProject[]> {
    log(`Fetching Sign-Up Groups from Rock (GroupTypeId=${this.groupTypeId})...`);

    const query = new URLSearchParams({
      $filter: `GroupTypeId eq ${this.groupTypeId}`,
      $expand: "Campus,GroupLocations,GroupLocations/Location,GroupLocations/Schedules",
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

    const rawGroups: RockRawSignUpGroup[] = await response.json();
    log(`Fetched ${rawGroups.length} Sign-Up Groups`);

    // Rock strips IdKey from OData list responses — batch-fetch them separately
    const groupIds = rawGroups.map((g) => g.Id);
    const locationIds = rawGroups.flatMap((g) => g.GroupLocations?.map((l) => l.Id) ?? []);
    const scheduleIds = rawGroups.flatMap((g) =>
      g.GroupLocations?.flatMap((l) => l.Schedules?.map((s) => s.Id) ?? []) ?? []
    );
    const [groupIdKeys, locationIdKeys, scheduleIdKeys] = await Promise.all([
      this.fetchIdKeyMap("Groups", groupIds),
      this.fetchIdKeyMap("GroupLocations", locationIds),
      this.fetchIdKeyMap("Schedules", scheduleIds),
    ]);

    const projects: OutreachProject[] = [];
    for (const rawGroup of rawGroups) {
      const project = this.transformProject(rawGroup, groupIdKeys, locationIdKeys, scheduleIdKeys);
      if (project) {
        projects.push(project);
      } else {
        log(`Skipping Sign-Up Group ${rawGroup.Id} (${rawGroup.Name}): no opportunities`);
      }
    }

    return projects;
  }

  transformProject(
    rawGroup: RockRawSignUpGroup,
    groupIdKeys?: Map<number, string>,
    locationIdKeys?: Map<number, string>,
    scheduleIdKeys?: Map<number, string>
  ): OutreachProject | null {
    const opportunity = rawGroup.GroupLocations?.[0];

    if (!opportunity) {
      return null;
    }

    const schedule = opportunity.Schedules?.[0] ?? null;

    const groupIdKey = rawGroup.IdKey ?? groupIdKeys?.get(rawGroup.Id) ?? null;
    const locationIdKey = opportunity.IdKey ?? locationIdKeys?.get(opportunity.Id) ?? null;
    const scheduleIdKey = schedule
      ? (schedule.IdKey ?? scheduleIdKeys?.get(schedule.Id) ?? null)
      : null;

    const signupUrl =
      groupIdKey && locationIdKey && scheduleIdKey
        ? `${RMS_BASE_URL}/signups/register/${groupIdKey}/location/${locationIdKey}/schedule/${scheduleIdKey}`
        : null;

    const location = opportunity.Location;
    const assembled = [location?.Street1, location?.City, location?.State, location?.PostalCode]
      .filter(Boolean)
      .join(", ");
    const locationAddress = location?.FormattedAddress ?? (assembled || null);

    const attrs = rawGroup.AttributeValues ?? {};

    return {
      rock_group_id: rawGroup.Id,
      rock_opportunity_id: opportunity.Id,
      rock_schedule_id: schedule?.Id ?? null,
      name: rawGroup.Name,
      slug: String(opportunity.Id),
      description: rawGroup.Description ?? "",
      schedule_display: schedule?.Description ?? null,
      schedule_datetime: schedule?.NextStartDateTime ?? null,
      location_address: locationAddress,
      city: location?.City ?? null,
      campus: rawGroup.Campus?.Name ?? null,
      semester: attrs.Semester?.ValueFormatted ?? null,
      event: attrs.Event?.ValueFormatted ?? null,
      category: attrs.Category?.ValueFormatted ?? null,
      kids_welcome: (attrs.KidsWelcome?.Value ?? "True") === "True",
      handicap_accessible: (attrs.HandicapAccessible?.Value ?? "True") === "True",
      tools_needed: attrs.ToolsSuppliesNeeded?.Value ?? null,
      project_type: attrs.ProjectType?.ValueFormatted ?? null,
      signup_url: signupUrl,
      is_active: rawGroup.IsActive,
      is_archived: rawGroup.IsArchived ?? false,
      webflow_item_id: null,
    };
  }
}

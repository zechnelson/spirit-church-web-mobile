import type { RockRawSignUpGroup, OutreachProject, RockRawGroupMember } from "./types";
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

    // Rock's OData node limit (~100) is hit when the ID list grows large.
    // Chunk into batches of 15 to stay safely under the limit.
    const CHUNK_SIZE = 15;
    const map = new Map<number, string>();

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const filter = chunk.map((id) => `Id eq ${id}`).join(" or ");
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
        continue;
      }

      const items: { Id: number; IdKey?: string | null }[] = await response.json();
      for (const item of items) {
        if (item.IdKey) map.set(item.Id, item.IdKey);
      }
    }

    return map;
  }

  private async fetchLeaderMap(
    groupIds: number[]
  ): Promise<Map<number, { name: string; imageUrl: string | null }[]>> {
    if (groupIds.length === 0) return new Map();

    // Chunk to avoid Rock's OData node limit (~100). Filter IsLeader client-side
    // because combining a large GroupId OR chain with a navigation property filter
    // (GroupRole/IsLeader eq true) also exceeds the limit.
    const CHUNK_SIZE = 15;
    const map = new Map<number, { name: string; imageUrl: string | null }[]>();

    for (let i = 0; i < groupIds.length; i += CHUNK_SIZE) {
      const chunk = groupIds.slice(i, i + CHUNK_SIZE);
      const groupFilter = chunk.map((id) => `GroupId eq ${id}`).join(" or ");
      const query = new URLSearchParams({ $filter: `(${groupFilter})`, $expand: "Person,GroupRole" });

      const response = await fetch(`${this.apiUrl}/GroupMembers?${query}`, {
        headers: {
          "Authorization-Token": this.restKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        log(`Warning: Failed to fetch leader map chunk: ${response.status}`);
        continue;
      }

      const members: RockRawGroupMember[] = await response.json();

      for (const member of members) {
        if (!member.GroupRole?.IsLeader) continue;
        if (!member.Person) continue;
        const existing = map.get(member.GroupId) ?? [];
        if (existing.length >= 2) continue;

        const { FirstName, NickName, LastName, Photo } = member.Person;
        const firstName = NickName?.trim() || FirstName;
        const name = `${firstName} ${LastName}`;
        const imageUrl = Photo?.Guid
          ? `${RMS_BASE_URL}/GetImage.ashx?guid=${Photo.Guid}`
          : null;

        existing.push({ name, imageUrl });
        map.set(member.GroupId, existing);
      }
    }

    return map;
  }

  async fetchSignUpGroups(): Promise<OutreachProject[]> {
    log(`Fetching Sign-Up Groups from Rock (GroupTypeId=${this.groupTypeId})...`);

    const query = new URLSearchParams({
      $filter: `GroupTypeId eq ${this.groupTypeId} and IsActive eq true`,
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
    const locationIds = rawGroups
      .flatMap((g) => g.GroupLocations?.map((l) => l.Location?.Id) ?? [])
      .filter((id): id is number => id != null);
    const scheduleIds = rawGroups.flatMap((g) =>
      g.GroupLocations?.flatMap((l) => l.Schedules?.map((s) => s.Id) ?? []) ?? []
    );
    const [groupIdKeys, locationIdKeys, scheduleIdKeys, leaderMap] = await Promise.all([
      this.fetchIdKeyMap("Groups", groupIds),
      this.fetchIdKeyMap("Locations", locationIds),
      this.fetchIdKeyMap("Schedules", scheduleIds),
      this.fetchLeaderMap(groupIds),
    ]);

    const projects: OutreachProject[] = [];
    for (const rawGroup of rawGroups) {
      const project = this.transformProject(rawGroup, groupIdKeys, locationIdKeys, scheduleIdKeys, leaderMap);
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
    scheduleIdKeys?: Map<number, string>,
    leaderMap?: Map<number, { name: string; imageUrl: string | null }[]>
  ): OutreachProject | null {
    const opportunity = rawGroup.GroupLocations?.[0];

    if (!opportunity) {
      return null;
    }

    const schedule = opportunity.Schedules?.[0] ?? null;

    const groupIdKey = rawGroup.IdKey ?? groupIdKeys?.get(rawGroup.Id) ?? null;
    const locationId = opportunity.Location?.Id;
    const locationIdKey =
      opportunity.Location?.IdKey ??
      (locationId != null ? locationIdKeys?.get(locationId) ?? null : null);
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
      leader_name: leaderMap?.get(rawGroup.Id)?.[0]?.name ?? null,
      leader_name_2: leaderMap?.get(rawGroup.Id)?.[1]?.name ?? null,
      leader_image: leaderMap?.get(rawGroup.Id)?.[0]?.imageUrl ?? null,
      leader_image_2: leaderMap?.get(rawGroup.Id)?.[1]?.imageUrl ?? null,
    };
  }
}

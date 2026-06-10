import type { RockRawSignUpGroup, OutreachProject } from "./types";
import { slugify, log } from "../utils";

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

  async fetchSignUpGroups(): Promise<OutreachProject[]> {
    log(`Fetching Sign-Up Groups from Rock (GroupTypeId=${this.groupTypeId})...`);

    const query = new URLSearchParams({
      $filter: `GroupTypeId eq ${this.groupTypeId}`,
      $expand: "Campus,GroupLocations($expand=Location,Schedules)",
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

    const projects: OutreachProject[] = [];
    for (const rawGroup of rawGroups) {
      const project = this.transformProject(rawGroup);
      if (project) {
        projects.push(project);
      } else {
        log(`Skipping Sign-Up Group ${rawGroup.Id} (${rawGroup.Name}): no opportunities`);
      }
    }

    return projects;
  }

  transformProject(rawGroup: RockRawSignUpGroup): OutreachProject | null {
    const opportunity = rawGroup.GroupLocations?.[0];

    if (!opportunity) {
      return null;
    }

    const schedule = opportunity.Schedules?.[0] ?? null;

    const groupIdKey = rawGroup.IdKey;
    const locationIdKey = opportunity.IdKey;
    const scheduleIdKey = schedule?.IdKey;

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
      slug: slugify(rawGroup.Name),
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

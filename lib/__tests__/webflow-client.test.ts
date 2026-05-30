import { describe, it, expect, beforeEach } from "vitest";
import { WebflowClient } from "../sync/webflow-client";
import type { SyncGroup } from "../sync/types";

let client: WebflowClient;

const baseGroup: SyncGroup = {
  rock_id: 42,
  name: "Test Group",
  slug: "test-group",
  description: "A group",
  campus: "Downtown",
  campus_id: 1,
  group_type: "Spirit Group",
  group_type_id: 25,
  parent_group_id: 85,
  meeting_time: "6:00 PM",
  schedule_description: "Tuesdays at 6pm",
  capacity: 20,
  current_members: 8,
  registration_url: "https://rms.spiritchurch.co/GroupRegistration?GroupId=42",
  is_active: true,
  is_public: true,
  topics: ["Prayer"],
  audience: ["Men"],
  life_stages: ["Young Adults"],
  city: "Phoenix",
  childcare_provided: "Yes",
  kids_welcome: "No",
  group_image: null,
  last_synced_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  client = new WebflowClient("test-token", "site-id", "collection-id");
  client.topicsMap = { Prayer: "topic-1", "Bible Study": "topic-2" };
  client.audiencesMap = { Men: "aud-1", Women: "aud-2" };
  client.lifeStagesMap = { "Young Adults": "ls-1" };
  client.cityMap = { Phoenix: "city-1", Tempe: "city-2" };
  client.childcareMap = { Yes: "cc-yes", No: "cc-no" };
  client.kidsWelcomeMap = { Yes: "kw-yes", No: "kw-no" };
});

describe("transformGroupForWebflow", () => {
  it("maps name, slug, and rock-id", () => {
    const { fieldData } = client.transformGroupForWebflow(baseGroup);
    expect(fieldData["name"]).toBe("Test Group");
    expect(fieldData["slug"]).toBe("test-group");
    expect(fieldData["rock-id"]).toBe(42);
  });

  it("calculates spots-available as capacity minus members", () => {
    const { fieldData } = client.transformGroupForWebflow(baseGroup);
    expect(fieldData["spots-available"]).toBe(12);
  });

  it("maps topics array to Webflow item IDs", () => {
    const { fieldData } = client.transformGroupForWebflow(baseGroup);
    expect(fieldData["group-topics"]).toEqual(["topic-1"]);
  });

  it("maps city to a single Webflow item ID string", () => {
    const { fieldData } = client.transformGroupForWebflow(baseGroup);
    expect(fieldData["city"]).toBe("city-1");
  });

  it("maps childcare to single reference ID", () => {
    const { fieldData } = client.transformGroupForWebflow(baseGroup);
    expect(fieldData["childcare-available"]).toBe("cc-yes");
  });

  it("does NOT include meeting-days field", () => {
    const { fieldData } = client.transformGroupForWebflow(baseGroup);
    expect(fieldData).not.toHaveProperty("meeting-days");
  });

  it("omits optional fields when null or empty string", () => {
    const group: SyncGroup = {
      ...baseGroup,
      description: "",
      campus: null,
      meeting_time: null,
    };
    const { fieldData } = client.transformGroupForWebflow(group);
    expect(fieldData).not.toHaveProperty("description-2");
    expect(fieldData).not.toHaveProperty("campus-2");
    expect(fieldData).not.toHaveProperty("meeting-time");
  });
});

describe("mapValuesToIds", () => {
  it("returns IDs for known values", () => {
    expect(
      client.mapValuesToIds(["Prayer", "Bible Study"], client.topicsMap!)
    ).toEqual(["topic-1", "topic-2"]);
  });

  it("skips unrecognized values silently", () => {
    expect(client.mapValuesToIds(["Unknown"], client.topicsMap!)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(client.mapValuesToIds([], client.topicsMap!)).toEqual([]);
  });
});

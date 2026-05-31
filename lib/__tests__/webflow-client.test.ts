import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
  is_archived: false,
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

  it("does not include capacity/spots fields not in Webflow schema", () => {
    const { fieldData } = client.transformGroupForWebflow(baseGroup);
    expect(fieldData).not.toHaveProperty("spots-available");
    expect(fieldData).not.toHaveProperty("capacity");
    expect(fieldData).not.toHaveProperty("current-members");
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

  it("includes group-image URL when group_image is set", () => {
    const group: SyncGroup = {
      ...baseGroup,
      group_image: "https://rms.spiritchurch.co/GetImage.ashx?guid=abc123",
    };
    const { fieldData } = client.transformGroupForWebflow(group);
    expect(fieldData["group-image"]).toBe(
      "https://rms.spiritchurch.co/GetImage.ashx?guid=abc123"
    );
  });

  it("omits group-image when group_image is null", () => {
    // baseGroup.group_image is already null
    const { fieldData } = client.transformGroupForWebflow(baseGroup);
    expect(fieldData).not.toHaveProperty("group-image");
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

describe("deleteItem", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls DELETE on the correct endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    await client.deleteItem("item-123");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.webflow.com/v2/collections/collection-id/items/item-123",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("throws when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      })
    );

    await expect(client.deleteItem("item-999")).rejects.toThrow("404");
  });
});

describe("deleteItems", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 0 for empty input without calling fetch", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const count = await client.deleteItems([]);
    expect(count).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns count of successfully deleted items", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    );

    const count = await client.deleteItems(["id-1", "id-2", "id-3"]);
    expect(count).toBe(3);
  });

  it("skips failed deletes and returns count of successes only", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Server Error",
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    const count = await client.deleteItems(["id-1", "id-2", "id-3"]);
    expect(count).toBe(2);
  });
});

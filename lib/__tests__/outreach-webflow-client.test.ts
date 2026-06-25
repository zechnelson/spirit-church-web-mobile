import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OutreachWebflowClient } from "../sync/outreach/webflow-client";
import type { OutreachProject } from "../sync/outreach/types";

let client: OutreachWebflowClient;

const baseProject: OutreachProject = {
  rock_group_id: 100,
  rock_opportunity_id: 200,
  rock_schedule_id: 300,
  name: "Feed My Starving Children",
  slug: "200",
  description: "Help pack meals",
  schedule_display: "Once at 7/11/2026 9:00 AM",
  schedule_datetime: "2026-07-11T09:00:00",
  location_address: "1100 W Grove Pkwy Ste 101, Tempe, AZ 85283",
  city: "Tempe",
  campus: "Chandler Campus",
  semester: "Fall 2026",
  event: "Serve Day",
  category: "Food Prep & Distribution",
  kids_welcome: true,
  handicap_accessible: true,
  tools_needed: "Gloves and apron",
  project_type: "In-Person",
  signup_url: "https://rms.spiritchurch.co/signups/register/abc/location/def/schedule/ghi",
  is_active: true,
  is_archived: false,
  webflow_item_id: null,
  leader_name: null,
  leader_name_2: null,
  leader_image: null,
  leader_image_2: null,
};

beforeEach(() => {
  client = new OutreachWebflowClient("test-token", "site-id", "collection-id");
});

describe("transformProjectForWebflow", () => {
  it("maps name, slug, and rock IDs", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["name"]).toBe("Feed My Starving Children");
    expect(fieldData["slug"]).toBe("200");
    expect(fieldData["rock-group-id"]).toBe(100);
    expect(fieldData["rock-opportunity-id"]).toBe(200);
  });

  it("maps schedule-display and location-address", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["schedule-display"]).toBe("Once at 7/11/2026 9:00 AM");
    expect(fieldData["location-address"]).toBe(
      "1100 W Grove Pkwy Ste 101, Tempe, AZ 85283"
    );
  });

  it("maps boolean switches for kids-welcome and handicap-accessible", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["kids-welcome"]).toBe(true);
    expect(fieldData["handicap-accessible"]).toBe(true);
  });

  it("maps false boolean switches correctly", () => {
    const project = { ...baseProject, kids_welcome: false, handicap_accessible: false };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData["kids-welcome"]).toBe(false);
    expect(fieldData["handicap-accessible"]).toBe(false);
  });

  it("maps signup-url", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["signup-url"]).toBe(
      "https://rms.spiritchurch.co/signups/register/abc/location/def/schedule/ghi"
    );
  });

  it("maps semester and project-type as plain text", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["semester"]).toBe("Fall 2026");
    expect(fieldData["project-type"]).toBe("In-Person");
  });

  it("maps campus as MultiRef id array when campusMap is set", () => {
    client.campusMap = { "Chandler Campus": "campus-id-1" };
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["campus-2"]).toEqual(["campus-id-1"]);
  });

  it("maps event as MultiRef id array when eventMap is set", () => {
    client.eventMap = { "Serve Day": "event-id-1" };
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["event-2"]).toEqual(["event-id-1"]);
  });

  it("maps category as MultiRef id array when categoryMap is set", () => {
    client.categoryMap = { "Food Prep & Distribution": "category-id-1" };
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["category-2"]).toEqual(["category-id-1"]);
  });

  it("maps city as MultiRef id array when cityMap is set", () => {
    client.cityMap = { "Tempe": "city-id-1" };
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["city-2"]).toEqual(["city-id-1"]);
  });

  it("omits campus from fieldData when campusMap is null", () => {
    client.campusMap = null;
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData).not.toHaveProperty("campus-2");
  });

  it("omits campus from fieldData when project.campus is null", () => {
    client.campusMap = { "Chandler Campus": "campus-id-1" };
    const project = { ...baseProject, campus: null };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData).not.toHaveProperty("campus-2");
  });

  it("omits campus from fieldData when value has no map entry", () => {
    client.campusMap = {};
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData).not.toHaveProperty("campus-2");
  });

  it("omits city from fieldData when cityMap is null", () => {
    client.cityMap = null;
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData).not.toHaveProperty("city-2");
  });

  it("omits description when empty string", () => {
    const project = { ...baseProject, description: "" };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData).not.toHaveProperty("description");
  });

  it("omits tools-needed when null", () => {
    const project = { ...baseProject, tools_needed: null };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData).not.toHaveProperty("tools-needed");
  });

  it("omits signup-url when null", () => {
    const project = { ...baseProject, signup_url: null };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData).not.toHaveProperty("signup-url");
  });
});

describe("mapValuesToIds", () => {
  it("returns ids for known values", () => {
    const map = { Gilbert: "id-1", Chandler: "id-2" };
    expect(client.mapValuesToIds(["Gilbert", "Chandler"], map)).toEqual(["id-1", "id-2"]);
  });

  it("skips unknown values without throwing", () => {
    const map = { Gilbert: "id-1" };
    expect(client.mapValuesToIds(["Gilbert", "Unknown"], map)).toEqual(["id-1"]);
  });

  it("returns empty array for empty input", () => {
    expect(client.mapValuesToIds([], {})).toEqual([]);
  });
});

describe("fetchReferenceCollection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds name→id map from collection items", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { id: "id-1", fieldData: { name: "Gilbert" } },
          { id: "id-2", fieldData: { name: "Chandler" } },
        ],
      }),
    }));

    const map = await client.fetchReferenceCollection("col-id");
    expect(map).toEqual({ Gilbert: "id-1", Chandler: "id-2" });
  });

  it("throws when response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    }));

    await expect(client.fetchReferenceCollection("col-id")).rejects.toThrow("401");
  });
});

describe("upsertReferenceItem", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs to the collection and returns the new item id", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "new-id-1" }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const id = await client.upsertReferenceItem("col-id", "Gilbert");
    expect(id).toBe("new-id-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.webflow.com/v2/collections/col-id/items",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"name":"Gilbert"'),
      })
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("creates items with isDraft: false so they publish on the next site publish", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "new-id-1" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await client.upsertReferenceItem("col-id", "Gilbert");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.isDraft).toBe(false);
  });

  it("throws when POST fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
    }));

    await expect(client.upsertReferenceItem("col-id", "Gilbert")).rejects.toThrow("400");
  });
});

describe("syncReferenceCollection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns existing map when all values already exist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ id: "id-1", fieldData: { name: "Gilbert" } }],
      }),
    }));

    const map = await client.syncReferenceCollection("col-id", new Set(["Gilbert"]));
    expect(map).toEqual({ Gilbert: "id-1" });
  });

  it("upserts missing values and adds them to the map", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: "id-1", fieldData: { name: "Gilbert" } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "id-2" }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const map = await client.syncReferenceCollection("col-id", new Set(["Gilbert", "Chandler"]));
    expect(map).toEqual({ Gilbert: "id-1", Chandler: "id-2" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("skips a value gracefully when upsert fails", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Server Error",
      });
    vi.stubGlobal("fetch", mockFetch);

    const map = await client.syncReferenceCollection("col-id", new Set(["Gilbert"]));
    expect(map).toEqual({});
  });
});

describe("initializeReferenceMaps", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("populates all 4 maps from project data", async () => {
    const projects: OutreachProject[] = [
      { ...baseProject, campus: "Chandler Campus", event: "Serve Day", category: "Food Prep & Distribution", city: "Tempe" },
    ];

    // 4 fetchReferenceCollection calls return empty → then 4 upsertReferenceItem calls
    const mockFetch = vi.fn()
      // fetch campuses collection
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      // upsert "Chandler Campus"
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "campus-1" }) })
      // fetch events collection
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      // upsert "Serve Day"
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "event-1" }) })
      // fetch categories collection
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      // upsert "Food Prep & Distribution"
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "cat-1" }) })
      // fetch cities collection
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      // upsert "Tempe"
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "city-1" }) });

    vi.stubGlobal("fetch", mockFetch);

    await client.initializeReferenceMaps(projects);

    expect(client.campusMap).toEqual({ "Chandler Campus": "campus-1" });
    expect(client.eventMap).toEqual({ "Serve Day": "event-1" });
    expect(client.categoryMap).toEqual({ "Food Prep & Distribution": "cat-1" });
    expect(client.cityMap).toEqual({ "Tempe": "city-1" });
    expect(mockFetch).toHaveBeenCalledTimes(8);
  });

  it("ignores undefined values (not just null) when collecting unique values", async () => {
    const projects = [
      { ...baseProject, campus: undefined as unknown as null, event: undefined as unknown as null, category: undefined as unknown as null, city: undefined as unknown as null },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await client.initializeReferenceMaps(projects);

    // 4 fetchReferenceCollection calls, 0 upserts (undefined values were filtered out)
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(client.campusMap).toEqual({});
  });

  it("ignores null values when collecting unique values", async () => {
    const projects: OutreachProject[] = [
      { ...baseProject, campus: null, event: null, category: null, city: null },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await client.initializeReferenceMaps(projects);

    // 4 fetchReferenceCollection calls, 0 upserts
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(client.campusMap).toEqual({});
    expect(client.eventMap).toEqual({});
    expect(client.categoryMap).toEqual({});
    expect(client.cityMap).toEqual({});
  });
});

describe("deleteItem", () => {
  afterEach(() => vi.unstubAllGlobals());

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

describe("transformProjectForWebflow — leader fields", () => {
  it("maps all four leader fields when present", () => {
    const project: OutreachProject = {
      ...baseProject,
      leader_name: "JR Martinez",
      leader_name_2: "Pam Martinez",
      leader_image: "https://rms.spiritchurch.co/GetImage.ashx?guid=abc",
      leader_image_2: "https://rms.spiritchurch.co/GetImage.ashx?guid=def",
    };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData["leader-name"]).toBe("JR Martinez");
    expect(fieldData["leader-2-name"]).toBe("Pam Martinez");
    expect(fieldData["leader-profile-image"]).toBe("https://rms.spiritchurch.co/GetImage.ashx?guid=abc");
    expect(fieldData["leader-2-profile-image"]).toBe("https://rms.spiritchurch.co/GetImage.ashx?guid=def");
  });

  it("omits all four leader fields when null", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData).not.toHaveProperty("leader-name");
    expect(fieldData).not.toHaveProperty("leader-2-name");
    expect(fieldData).not.toHaveProperty("leader-profile-image");
    expect(fieldData).not.toHaveProperty("leader-2-profile-image");
  });

  it("includes leader name but omits leader image when image is null", () => {
    const project: OutreachProject = {
      ...baseProject,
      leader_name: "JR Martinez",
      leader_image: null,
    };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData["leader-name"]).toBe("JR Martinez");
    expect(fieldData).not.toHaveProperty("leader-profile-image");
  });
});

describe("deleteItems", () => {
  afterEach(() => vi.unstubAllGlobals());

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

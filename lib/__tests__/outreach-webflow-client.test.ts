import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OutreachWebflowClient } from "../sync/outreach/webflow-client";
import type { OutreachProject } from "../sync/outreach/types";

type RefCollectionIds = {
  campus: string;
  event: string;
  category: string;
  city: string;
};

const refIds: RefCollectionIds = {
  campus: "campus-col-id",
  event: "event-col-id",
  category: "category-col-id",
  city: "city-col-id",
};

let client: OutreachWebflowClient;

const baseProject: OutreachProject = {
  rock_group_id: 100,
  rock_opportunity_id: 200,
  rock_schedule_id: 300,
  name: "Feed My Starving Children",
  slug: "feed-my-starving-children",
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
};

beforeEach(() => {
  client = new OutreachWebflowClient(
    "test-token",
    "site-id",
    "collection-id",
    refIds
  );
  client.campusMap = { "Chandler Campus": "campus-wf-1" };
  client.eventMap = { "Serve Day": "event-wf-1" };
  client.categoryMap = { "Food Prep & Distribution": "cat-wf-1" };
  client.cityMap = { Tempe: "city-wf-1" };
});

describe("transformProjectForWebflow", () => {
  it("maps name, slug, and rock IDs", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["name"]).toBe("Feed My Starving Children");
    expect(fieldData["slug"]).toBe("feed-my-starving-children");
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

  it("maps campus reference ID from campusMap", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["campus"]).toBe("campus-wf-1");
  });

  it("maps event reference ID from eventMap", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["event"]).toBe("event-wf-1");
  });

  it("maps category reference ID from categoryMap", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["category"]).toBe("cat-wf-1");
  });

  it("maps city reference ID from cityMap", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["city"]).toBe("city-wf-1");
  });

  it("omits campus when not in map", () => {
    client.campusMap = {};
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData).not.toHaveProperty("campus");
  });

  it("omits campus when campusMap is null", () => {
    client.campusMap = null;
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData).not.toHaveProperty("campus");
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

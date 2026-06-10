import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/sync/outreach", () => ({
  fullOutreachSync: vi.fn(),
}));

import { GET, POST } from "../../app/api/sync-outreach/route";
import { fullOutreachSync } from "@/lib/sync/outreach";

const mockFullOutreachSync = vi.mocked(fullOutreachSync);

const REQUIRED_ENV = {
  ROCK_API_URL: "https://rms.spiritchurch.co/api",
  ROCK_REST_KEY: "rock-key",
  ROCK_SIGNUP_GROUP_TYPE_ID: "42",
  SUPABASE_URL: "https://db.supabase.co",
  SUPABASE_SERVICE_KEY: "supa-key",
  WEBFLOW_API_TOKEN: "wf-token",
  WEBFLOW_SITE_ID: "site-id",
  WEBFLOW_OUTREACH_COLLECTION_ID: "col-id",
  WEBFLOW_OUTREACH_CAMPUS_COLLECTION_ID: "campus-id",
  WEBFLOW_OUTREACH_EVENT_COLLECTION_ID: "event-id",
  WEBFLOW_OUTREACH_CATEGORY_COLLECTION_ID: "cat-id",
  WEBFLOW_OUTREACH_CITY_COLLECTION_ID: "city-id",
  CRON_SECRET: "test-secret",
};

function makeRequest(method: string, authHeader?: string) {
  return new Request("https://example.com/api/sync-outreach", {
    method,
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

beforeEach(() => {
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    process.env[key] = value;
  }
  mockFullOutreachSync.mockResolvedValue({
    startedAt: "2026-06-09T00:00:00Z",
    rockToSupabase: { processed: 5, status: "success" },
    supabaseToWebflow: {
      processed: 5,
      created: 2,
      updated: 3,
      deleted: 0,
      published: 5,
      status: "success",
    },
    duration: 12,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(REQUIRED_ENV)) {
    delete process.env[key];
  }
});

describe("GET /api/sync-outreach", () => {
  it("returns 401 when authorization header is missing", async () => {
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when token is wrong", async () => {
    const res = await GET(makeRequest("GET", "Bearer wrong-token"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with stats when authorized", async () => {
    const res = await GET(makeRequest("GET", "Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.stats.rockToSupabase.processed).toBe(5);
  });

  it("calls fullOutreachSync when authorized", async () => {
    await GET(makeRequest("GET", "Bearer test-secret"));
    expect(mockFullOutreachSync).toHaveBeenCalledOnce();
  });

  it("returns 500 when fullOutreachSync throws", async () => {
    mockFullOutreachSync.mockRejectedValue(new Error("Rock API down"));
    const res = await GET(makeRequest("GET", "Bearer test-secret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Rock API down");
  });
});

describe("POST /api/sync-outreach", () => {
  it("returns 401 when authorization header is missing", async () => {
    const res = await POST(makeRequest("POST"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with stats when authorized", async () => {
    const res = await POST(makeRequest("POST", "Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

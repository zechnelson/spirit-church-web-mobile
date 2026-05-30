// app/api/sync-groups/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/lib/sync", () => ({
  fullSync: vi.fn().mockResolvedValue({
    startedAt: "2026-01-01T00:00:00Z",
    rockToSupabase: { processed: 10, status: "success" },
    supabaseToWebflow: {
      processed: 10,
      created: 2,
      updated: 8,
      published: 10,
      status: "success",
    },
    duration: 5,
  }),
}));

beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
  process.env.ROCK_API_URL = "https://rock.test/api";
  process.env.ROCK_REST_KEY = "key";
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_KEY = "key";
  process.env.WEBFLOW_API_TOKEN = "token";
  process.env.WEBFLOW_SITE_ID = "site-id";
  process.env.WEBFLOW_COLLECTION_ID = "collection-id";
});

describe("GET /api/sync-groups", () => {
  it("returns 401 without Authorization header", async () => {
    const req = new Request("http://localhost/api/sync-groups");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong secret", async () => {
    const req = new Request("http://localhost/api/sync-groups", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 and success:true with correct secret", async () => {
    const req = new Request("http://localhost/api/sync-groups", {
      headers: { Authorization: "Bearer test-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe("POST /api/sync-groups", () => {
  it("returns 401 without Authorization header", async () => {
    const req = new Request("http://localhost/api/sync-groups", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct secret", async () => {
    const req = new Request("http://localhost/api/sync-groups", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

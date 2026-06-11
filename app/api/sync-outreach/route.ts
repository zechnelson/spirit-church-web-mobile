import { fullOutreachSync } from "@/lib/sync/outreach";
import type { OutreachSyncEnv } from "@/lib/sync/outreach/types";

function getEnv(): OutreachSyncEnv {
  const required = [
    "ROCK_API_URL",
    "ROCK_REST_KEY",
    "ROCK_SIGNUP_GROUP_TYPE_ID",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "WEBFLOW_API_TOKEN",
    "WEBFLOW_SITE_ID",
    "WEBFLOW_OUTREACH_COLLECTION_ID",
    "CRON_SECRET",
  ] as const;

  for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
  }

  return {
    ROCK_API_URL: process.env.ROCK_API_URL!,
    ROCK_REST_KEY: process.env.ROCK_REST_KEY!,
    ROCK_SIGNUP_GROUP_TYPE_ID: process.env.ROCK_SIGNUP_GROUP_TYPE_ID!,
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY!,
    WEBFLOW_API_TOKEN: process.env.WEBFLOW_API_TOKEN!,
    WEBFLOW_SITE_ID: process.env.WEBFLOW_SITE_ID!,
    WEBFLOW_OUTREACH_COLLECTION_ID: process.env.WEBFLOW_OUTREACH_COLLECTION_ID!,
    CRON_SECRET: process.env.CRON_SECRET!,
  };
}

function isAuthorized(request: Request): boolean {
  return (
    request.headers.get("authorization") ===
    `Bearer ${process.env.CRON_SECRET}`
  );
}

async function runSync() {
  const env = getEnv();
  const stats = await fullOutreachSync(env);
  return Response.json({ success: true, stats });
}

// Vercel Cron triggers via GET
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await runSync();
  } catch (error) {
    return Response.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// Manual trigger via POST
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await runSync();
  } catch (error) {
    return Response.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

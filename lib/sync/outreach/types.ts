export interface AttributeValue {
  Value?: string;
  ValueFormatted?: string;
}

export interface RockSchedule {
  Id: number;
  IdKey?: string;
  Description?: string;
  NextStartDateTime?: string;
  EffectiveStartDate?: string;
}

export interface RockOpportunityLocation {
  Id: number;
  IdKey?: string;
  Location?: {
    Street1?: string;
    City?: string;
    State?: string;
    PostalCode?: string;
    FormattedAddress?: string;
  };
  Schedules?: RockSchedule[];
}

export interface RockRawSignUpGroup {
  Id: number;
  IdKey?: string;
  Name: string;
  Description?: string;
  IsActive: boolean;
  IsArchived?: boolean;
  GroupTypeId: number;
  Campus?: { Name: string };
  AttributeValues?: {
    // NOTE: verify these key names against live Rock API before implementing rock-client
    // Run the diagnostic curl in Task 0 Step 5 first
    Semester?: AttributeValue;
    Event?: AttributeValue;
    Category?: AttributeValue;
    KidsWelcome?: AttributeValue;
    HandicapAccessible?: AttributeValue;
    ToolsSuppliesNeeded?: AttributeValue;
    ProjectType?: AttributeValue;
    [key: string]: AttributeValue | undefined;
  };
  GroupLocations?: RockOpportunityLocation[];
}

export interface OutreachProject {
  rock_group_id: number;
  rock_opportunity_id: number;
  rock_schedule_id: number | null;
  name: string;
  slug: string;
  description: string;
  schedule_display: string | null;
  schedule_datetime: string | null;
  location_address: string | null;
  city: string | null;
  campus: string | null;
  semester: string | null;
  event: string | null;
  category: string | null;
  kids_welcome: boolean;
  handicap_accessible: boolean;
  tools_needed: string | null;
  project_type: string | null;
  signup_url: string | null;
  is_active: boolean;
  is_archived: boolean;
  webflow_item_id: string | null;
}

export interface WebflowOutreachItem {
  id: string;
  fieldData: Record<string, unknown>;
}

export interface OutreachSyncEnv {
  ROCK_API_URL: string;
  ROCK_REST_KEY: string;
  ROCK_SIGNUP_GROUP_TYPE_ID: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  WEBFLOW_API_TOKEN: string;
  WEBFLOW_SITE_ID: string;
  WEBFLOW_OUTREACH_COLLECTION_ID: string;
  WEBFLOW_OUTREACH_CAMPUS_COLLECTION_ID: string;
  WEBFLOW_OUTREACH_EVENT_COLLECTION_ID: string;
  WEBFLOW_OUTREACH_CATEGORY_COLLECTION_ID: string;
  WEBFLOW_OUTREACH_CITY_COLLECTION_ID: string;
  CRON_SECRET: string;
}

export interface OutreachSyncStats {
  startedAt: string;
  rockToSupabase: { processed: number; status: string };
  supabaseToWebflow: {
    processed: number;
    created: number;
    updated: number;
    deleted: number;
    published: number;
    status: string;
  };
  duration: number;
}

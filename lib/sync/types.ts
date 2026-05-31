export interface AttributeValue {
  Value?: string;
  ValueFormatted?: string;
}

export interface RockRawGroup {
  Id: number;
  Name: string;
  Description?: string;
  GroupTypeId: number;
  ParentGroupId?: number;
  CampusId?: number;
  IsActive: boolean;
  IsPublic: boolean;
  IsArchived?: boolean;
  GroupCapacity?: number;
  ActiveMemberCount?: number;
  Campus?: { Name: string };
  GroupType?: { Name: string };
  Schedule?: {
    WeeklyDayOfWeek?: number;
    WeeklyTimeOfDay?: string;
    Description?: string;
  };
  AttributeValues?: {
    Topic?: AttributeValue;
    SpiritGroupAudience?: AttributeValue;
    SpiritGroupLifeStage?: AttributeValue;
    SpiritGroupLocation?: AttributeValue;
    ChildcareProvided?: AttributeValue;
    AreKidsWelcome?: AttributeValue;
    GroupImageThumbnail?: AttributeValue;
  };
}

export interface SyncGroup {
  rock_id: number;
  name: string;
  slug: string;
  description: string;
  campus: string | null;
  campus_id: number | null;
  group_type: string | null;
  group_type_id: number | null;
  parent_group_id: number | null;
  meeting_time: string | null;
  schedule_description: string | null;
  capacity: number | null;
  current_members: number;
  registration_url: string;
  is_active: boolean;
  is_public: boolean;
  is_archived: boolean;
  topics: string[];
  audience: string[];
  life_stages: string[];
  city: string | null;
  childcare_provided: string | null;
  kids_welcome: string | null;
  group_image: string | null;
  last_synced_at: string;
}

export interface WebflowItem {
  id: string;
  fieldData: Record<string, unknown>;
}

export interface SyncEnv {
  ROCK_API_URL: string;
  ROCK_REST_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  WEBFLOW_API_TOKEN: string;
  WEBFLOW_SITE_ID: string;
  WEBFLOW_COLLECTION_ID: string;
  CRON_SECRET: string;
}

export interface SyncStats {
  startedAt: string;
  rockToSupabase: { processed: number; status: string };
  supabaseToWebflow: {
    processed: number;
    created: number;
    updated: number;
    published: number;
    status: string;
  };
  duration: number;
}

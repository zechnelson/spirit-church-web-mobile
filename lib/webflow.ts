// Webflow CMS API client — server-side only, never import in client components

const BASE = "https://api.webflow.com/v2";

const COLLECTIONS = {
  events: "68ae1c452c9ac726c7a74617",
  eventCategories: "68ae1c452c9ac726c7a746ee",
  messages: "68ae1c452c9ac726c7a745fd",
  speakers: "68ae1c452c9ac726c7a74691",
  headerCards: "6a068822d95ce2e41e516c89",
  groups: "694eff6ac57ffe6994797761",
} as const;

interface WfImage {
  url: string;
  alt: string | null;
}

interface WfItem {
  id: string;
  isArchived: boolean;
  isDraft: boolean;
  fieldData: Record<string, unknown>;
}

interface WfListResponse {
  items: WfItem[];
  pagination: { limit: number; offset: number; total: number };
}

export interface AppEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  category: string;
  imageSrc?: string;
  href: string;
}

export interface AppSliderCard {
  id: string;
  text: string;
  imageSrc: string;
  href: string;
}

export interface AppMessage {
  title: string;
  speaker: string;
  date: string;
  outlineLines: string[];
}

async function wfFetch<T>(path: string, revalidate = 300): Promise<T> {
  const token = process.env.WEBFLOW_API_TOKEN;
  if (!token) throw new Error("WEBFLOW_API_TOKEN is not set");
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: "application/json",
    },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`Webflow API ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function getEvents(): Promise<AppEvent[]> {
  const [eventsRes, categoriesRes] = await Promise.all([
    wfFetch<WfListResponse>(`/collections/${COLLECTIONS.events}/items?limit=100`),
    wfFetch<WfListResponse>(
      `/collections/${COLLECTIONS.eventCategories}/items?limit=100`,
      3600
    ),
  ]);

  const categoryMap = new Map(
    categoriesRes.items.map((c) => [c.id, c.fieldData.name as string])
  );

  return eventsRes.items
    .filter((item) => !item.isArchived && !item.isDraft && !item.fieldData["unlisted-event"])
    .sort((a, b) => {
      const aDate = new Date(a.fieldData.date as string).getTime();
      const bDate = new Date(b.fieldData.date as string).getTime();
      return aDate - bDate;
    })
    .map((item) => {
      const fd = item.fieldData;
      const categoryIds = fd["category-s"] as string[] | null;
      return {
        id: item.id,
        title: fd.name as string,
        date: formatDate(fd.date as string | null),
        time: (fd.timeframe as string | null) ?? "",
        location:
          (fd["location-name"] as string | null) ??
          (fd.address as string | null) ??
          "",
        category: categoryIds?.[0] ? (categoryMap.get(categoryIds[0]) ?? "") : "",
        imageSrc: (fd["thumbnail-image"] as WfImage | null)?.url,
        href: (fd["event-button-link"] as string | null) ?? "#",
      };
    });
}

export async function getHeaderCards(): Promise<AppSliderCard[]> {
  const res = await wfFetch<WfListResponse>(
    `/collections/${COLLECTIONS.headerCards}/items?limit=10`
  );
  return res.items
    .filter((item) => !item.isArchived && !item.isDraft)
    .map((item) => ({
      id: item.id,
      text: (item.fieldData["card-text"] as string | null) ?? (item.fieldData.name as string),
      imageSrc: (item.fieldData["background-image"] as WfImage | null)?.url ?? "",
      href: (item.fieldData["card-link"] as string | null) ?? "#",
    }));
}

export async function getLatestMessage(): Promise<AppMessage | null> {
  const res = await wfFetch<WfListResponse>(
    `/collections/${COLLECTIONS.messages}/items?limit=1&sortBy=lastPublished&sortOrder=desc`
  );
  const item = res.items[0];
  if (!item) return null;

  const fd = item.fieldData;

  let speaker = "";
  const speakerId = fd.speaker as string | null;
  if (speakerId) {
    try {
      const speakerItem = await wfFetch<WfItem>(
        `/collections/${COLLECTIONS.speakers}/items/${speakerId}`,
        3600
      );
      speaker = speakerItem.fieldData.name as string;
    } catch {
      // speaker resolution is non-critical
    }
  }

  let outlineLines: string[] = [];
  const notesLink = fd["message-notes-link"] as string | null;
  if (notesLink?.includes("docs.google.com")) {
    outlineLines = await fetchGoogleDocLines(notesLink);
  }

  return {
    title: fd.name as string,
    speaker,
    date: formatDate(fd.date as string | null),
    outlineLines,
  };
}

export interface AppGroup {
  id: string;
  title: string;
  category: string;
  href: string;
}

export async function getGroups(): Promise<AppGroup[]> {
  const res = await wfFetch<WfListResponse>(
    `/collections/${COLLECTIONS.groups}/items?limit=100`
  );
  return res.items
    .filter(
      (item) =>
        !item.isArchived &&
        !item.isDraft &&
        item.fieldData["is-active"] !== false &&
        item.fieldData["is-public-2"] !== false
    )
    .map((item) => ({
      id: item.id,
      title: item.fieldData.name as string,
      category: "Small Group",
      href: (item.fieldData["registration-url"] as string | null) ?? "#",
    }));
}

async function fetchGoogleDocLines(docUrl: string): Promise<string[]> {
  const match = docUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return [];
  const exportUrl = `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
  try {
    const res = await fetch(exportUrl, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const text = await res.text();
    return text.split("\n").map((line) => line.trimEnd());
  } catch {
    return [];
  }
}

// Webflow CMS API client — server-side only, never import in client components

const BASE = "https://api.webflow.com/v2";

const COLLECTIONS = {
  events: "68ae1c452c9ac726c7a74617",
  eventCategories: "68ae1c452c9ac726c7a746ee",
  messages: "68ae1c452c9ac726c7a745fd",
  speakers: "68ae1c452c9ac726c7a74691",
  headerCards: "6a068822d95ce2e41e516c89",
  groups: "694eff6ac57ffe6994797761",
  cities: "6970957a11505bf2aa488045",
  nextSteps: "6a06a5f50e11665321904497",
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
  scheduleDay?: string;
  scheduleStartMinutes?: number;
  scheduleEndMinutes?: number;
}

export interface AppMessage {
  id: string;
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
        href: `https://www.spiritchurch.co/events/${item.fieldData.slug as string}`,
      };
    });
}

// Webflow Option fields store the *generated* option id in fieldData, not the
// display label — these maps translate that id back to a usable value.
const SCHEDULE_DAY_OPTIONS: Record<string, string> = {
  "4c280ffb724b8a2e3819cf1876bb4810": "Sun",
  cd1c14242426697c28e6c008d40ddfdf: "Mon",
  "5215ddc256b404b8b5f2a56dc5ce846d": "Tue",
  df1a15f0d1fc0fb4e659f0efe277ccd7: "Wed",
  "57ad78c9470c0a7340a5200f6695a660": "Thu",
  "38d3c6b073fc37db9cbc89a63a5fe2e8": "Fri",
  "979ef5437804419bd34569cd65d8bcc9": "Sat",
};

const SCHEDULE_START_HOUR_OPTIONS: Record<string, number> = {
  "40d2f60835d6f60434cf20ca62a6a5df": 0,
  e9828acd50111a9f7459dc640a2f6240: 1,
  "08db8f667f001dbb210a50e4fdd8d2b2": 2,
  c0cad3d2a0a944509fbb561f59d69187: 3,
  c07d464525c3645a3691237262c68c7b: 4,
  ebe28cd28f670d6c98a8a27b8c0e53c8: 5,
  "1a5e80733a77113b0eec67320ba081f7": 6,
  ca6f67dec82b530180da147df572e1a4: 7,
  a5d4323d0058b63047a3ddf6c1d569a3: 8,
  "21877242e9442a868285f964fa6b4d5b": 9,
  "0e08578d5b7cecb392bdd59b4a725bfb": 10,
  "50296165bc029b0e86208561825b1e37": 11,
  "16f15f4ddc3d23833bd33a041a9e1487": 12,
  "0bfeb51b1a881a1a1c0e11741d6e96aa": 13,
  e1e637f4e1f3699d48f693dd4bfaad30: 14,
  "4bedff8c30687e76205ba1e941894270": 15,
  "9ad11faa423ae32694817ade8984431d": 16,
  ee264c53afba1bdb9e779b53bafdd462: 17,
  be6d84448736c329d3d761d0bcdd3ce2: 18,
  "5d6133aa6c8ac6704b24825cb1752b0f": 19,
  "91cefc2a77413c63181e61409a7425e2": 20,
  "5ce89cac0df27fefded5af50d43e8e45": 21,
  "6122c9dab5e7f041189cdc87ae37ddf9": 22,
  "70f7c119b486bd9a94cd2c3c27a16d7d": 23,
};

const SCHEDULE_END_HOUR_OPTIONS: Record<string, number> = {
  b65c3eb519a410b95649e86061c1381e: 0,
  ba8c89590bd3f718f10ecef4d16563db: 1,
  a7adc4923756b6f92d2da0495c8ddb00: 2,
  "268a3e1faf0ecace85a745d51c5a05d3": 3,
  cc390a2189f5ac035f8737b647125bca: 4,
  "305f2a772e58fb5c8c1423b7d0d52a98": 5,
  eaafc375d6e1fd09e9dbcfe502c72ba5: 6,
  "5080ddefae1f3a20263df11d52313c2d": 7,
  "1e39f4bf70e7374acc7a47a196b84fe2": 8,
  da133ecf31f13eff776a396b29216d32: 9,
  f0cf7ee5b58537d19d57fee4c666f991: 10,
  b7fe4460ed14b968db84ffdc2d781a30: 11,
  afd9fe2a9fab4e1827915e185dd92ad0: 12,
  b3fdf8051aa34eecd2719b5a95e08eb6: 13,
  "6a513e564082caf7dfd1141dfed7af7e": 14,
  "3819aca231589ff18f2a76acf70e3f8b": 15,
  "88a4c7b70bae105d253dfd49b1adf119": 16,
  fd6487eb2530095edbfce0d2dc1c84f7: 17,
  "76e11e600f1f761827a776ba04a9cd03": 18,
  "0f471962055bc455e5c573d7966b208c": 19,
  "6eac92e3f446b437b650d221f44e7558": 20,
  "2ca5ffcd1dc9bd184251a3f2ccc6cd0b": 21,
  "074334119a7c143c7c17de6eb754bc22": 22,
  "2bd1985eaf4ad8be5ea62773c8b67e9a": 23,
};

const SCHEDULE_START_MINUTE_OPTIONS: Record<string, number> = {
  "879aafcee3b8afe142904bf61f92a8e0": 0,
  e7dbd08318fcf0292a227d3cb7caf8e2: 5,
  "0bfd9c6efae644cd2fc4e21ddf50b77e": 10,
  f9c24a5abfeb65107269ae55553481e6: 15,
  "5d0d431914b9763bbab0597ed9bbfa97": 20,
  "1490cc4f404f389bede8184d3be7d71e": 25,
  b2815b17577d6d852179b6f6d24fa0cd: 30,
  "516134d2a1208cbf1b3a2cd1d0120658": 35,
  a15e363d8ec2140c339b70cfa37a8520: 40,
  "0051b9dcb1519a10ac9f59c66f7a46d0": 45,
  "6569f90c25eea027fc0babf8407d8a70": 50,
  "50151242051ac8e93e22e5b6b811fcf0": 55,
};

const SCHEDULE_END_MINUTE_OPTIONS: Record<string, number> = {
  bf5237d03bb6f6e91a95abed5255575b: 0,
  "44c1cd6709ee7b926d7c0cd490d31c89": 5,
  ed11a768fdad9dea5df50f9a62c6ca65: 10,
  "7afc43ba23a2efceaf574bed25aacce0": 15,
  "0401a3633703d01706611cf182e741a9": 20,
  "5820361cd32770631aeeb36f34b9ea97": 25,
  "0103b35eb7d67eaa1225389a8c447f1c": 30,
  a8cf9f2efa604ff5b67ee328e64a0a36: 35,
  "11de4db18f892d5288fc9f839e43bd74": 40,
  "320f7a008ad198644e674b08fbf7194a": 45,
  "6bb641416a2496e7386ef7cc52f48126": 50,
  "583ccebf91df5e99cd5ba069235d2257": 55,
};

function scheduleMinutes(
  hourId: unknown,
  minuteId: unknown,
  hourOptions: Record<string, number>,
  minuteOptions: Record<string, number>
): number | undefined {
  if (typeof hourId !== "string" || typeof minuteId !== "string") return undefined;
  const hour = hourOptions[hourId];
  const minute = minuteOptions[minuteId];
  if (hour === undefined || minute === undefined) return undefined;
  return hour * 60 + minute;
}

export async function getHeaderCards(): Promise<AppSliderCard[]> {
  const res = await wfFetch<WfListResponse>(
    `/collections/${COLLECTIONS.headerCards}/items?limit=10`
  );
  return res.items
    .filter((item) => !item.isArchived && !item.isDraft)
    .map((item) => {
      const fd = item.fieldData;
      const scheduleDay =
        typeof fd["schedule-day"] === "string"
          ? SCHEDULE_DAY_OPTIONS[fd["schedule-day"] as string]
          : undefined;

      return {
        id: item.id,
        text: (fd["card-text"] as string | null) ?? (fd.name as string),
        imageSrc: (fd["background-image"] as WfImage | null)?.url ?? "",
        href: (fd["card-link"] as string | null) ?? "#",
        scheduleDay,
        scheduleStartMinutes: scheduleMinutes(
          fd["schedule-start-hour"],
          fd["schedule-start-minute"],
          SCHEDULE_START_HOUR_OPTIONS,
          SCHEDULE_START_MINUTE_OPTIONS
        ),
        scheduleEndMinutes: scheduleMinutes(
          fd["schedule-end-hour"],
          fd["schedule-end-minute"],
          SCHEDULE_END_HOUR_OPTIONS,
          SCHEDULE_END_MINUTE_OPTIONS
        ),
      };
    });
}

export async function getLatestMessage(): Promise<AppMessage | null> {
  const res = await wfFetch<WfListResponse>(
    `/collections/${COLLECTIONS.messages}/items?limit=1&sortBy=lastUpdated&sortOrder=desc`
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
  const notesLink = fd["sermon-notes-download"] as string | null;
  if (notesLink?.includes("docs.google.com")) {
    outlineLines = await fetchGoogleDocLines(notesLink);
  }

  return {
    id: item.id,
    title: fd.name as string,
    speaker,
    date: formatDate(fd.date as string | null),
    outlineLines,
  };
}

export interface AppGroup {
  id: string;
  title: string;
  location?: string;
  schedule?: string;
  imageSrc?: string;
  href: string;
}

export async function getGroups(): Promise<AppGroup[]> {
  const [groupsRes, citiesRes] = await Promise.all([
    wfFetch<WfListResponse>(`/collections/${COLLECTIONS.groups}/items?limit=100`),
    wfFetch<WfListResponse>(`/collections/${COLLECTIONS.cities}/items?limit=100`),
  ]);

  const cityMap = Object.fromEntries(
    citiesRes.items.map((c) => [c.id, c.fieldData.name as string])
  );

  return groupsRes.items
    .filter(
      (item) =>
        !item.isArchived &&
        !item.isDraft &&
        item.fieldData["is-active"] !== false &&
        item.fieldData["is-public-2"] !== false
    )
    .map((item) => {
      const cityId = item.fieldData["city"] as string | null;
      return {
        id: item.id,
        title: item.fieldData.name as string,
        location: cityId ? cityMap[cityId] : undefined,
        schedule: (item.fieldData["schedule-description"] as string | null) ?? undefined,
        imageSrc: (item.fieldData["group-image-3"] as string | null) ?? undefined,
        href: `https://www.spiritchurch.co/groups/${item.fieldData.slug as string}`,
      };
    });
}

export interface AppNextStep {
  id: string;
  title: string;
  href: string;
  sortOrder: number;
}

export async function getNextSteps(): Promise<AppNextStep[]> {
  const res = await wfFetch<WfListResponse>(
    `/collections/${COLLECTIONS.nextSteps}/items?limit=100`,
    3600
  );
  return res.items
    .filter((item) => !item.isArchived && !item.isDraft)
    .map((item) => ({
      id: item.id,
      title: item.fieldData.name as string,
      href: (item.fieldData.link as string | null) ?? "#",
      sortOrder: (item.fieldData["sort-order"] as number | null) ?? 0,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
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

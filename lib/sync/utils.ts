export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function calculateSpotsAvailable(
  capacity: number | null,
  currentMembers: number | null
): number | null {
  if (capacity == null) return null;
  return Math.max(0, capacity - (currentMembers ?? 0));
}

export function log(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

export function logError(message: string, error: Error): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`, {
    message: error.message,
    stack: error.stack,
  });
}

export function convertTo12Hour(time24: string | null): string | null {
  if (!time24) return null;
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  let hours12 = hours % 12;
  if (hours12 === 0) hours12 = 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export function parseMultiSelectAttribute(
  attributeValue: { Value?: string; ValueFormatted?: string } | undefined
): string[] {
  if (!attributeValue) return [];
  const source = attributeValue.ValueFormatted ?? attributeValue.Value ?? "";
  return source
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function getImageUrl(
  attributeValue: { Value?: string } | undefined,
  rockApiUrl: string
): string | null {
  if (!attributeValue?.Value) return null;
  const baseUrl = rockApiUrl.replace(/\/api\/?$/, "");
  return `${baseUrl}/GetImage.ashx?guid=${attributeValue.Value}`;
}

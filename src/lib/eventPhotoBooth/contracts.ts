import type { Id } from "../../../convex/_generated/dataModel";
import { isRuntimeString } from "../../../convex/lib/runtimeValues";
import { isJsonObject } from "../jsonValue";

const SCENE_ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
export type BoothAvailability = "open" | "closed";
export type BoothCategory = "travel" | "pilgrimage";
export type BoothLanguage = "en" | "hi";
export type BoothText = Record<BoothLanguage, string>;
export const BOOTH_SCENE_KEYS = [
  "paris",
  "bali",
  "dubai",
  "kashi",
  "ayodhya",
  "kedarnath",
] as const;
export type BoothSceneKey = (typeof BOOTH_SCENE_KEYS)[number];
export const BOOTH_ARTWORK_URLS = {
  ayodhya: "/images/event-photo-booth/ayodhya.webp",
  bali: "/images/event-photo-booth/bali.webp",
  dubai: "/images/event-photo-booth/dubai.webp",
  kashi: "/images/event-photo-booth/kashi.webp",
  kedarnath: "/images/event-photo-booth/kedarnath.webp",
  paris: "/images/event-photo-booth/paris.webp",
} satisfies Record<BoothSceneKey, string>;
export const BOOTH_THUMBNAIL_URLS = {
  ayodhya: {
    large: "/images/event-photo-booth/ayodhya-384.webp",
    small: "/images/event-photo-booth/ayodhya-192.webp",
  },
  bali: {
    large: "/images/event-photo-booth/bali-384.webp",
    small: "/images/event-photo-booth/bali-192.webp",
  },
  dubai: {
    large: "/images/event-photo-booth/dubai-384.webp",
    small: "/images/event-photo-booth/dubai-192.webp",
  },
  kashi: {
    large: "/images/event-photo-booth/kashi-384.webp",
    small: "/images/event-photo-booth/kashi-192.webp",
  },
  kedarnath: {
    large: "/images/event-photo-booth/kedarnath-384.webp",
    small: "/images/event-photo-booth/kedarnath-192.webp",
  },
  paris: {
    large: "/images/event-photo-booth/paris-384.webp",
    small: "/images/event-photo-booth/paris-192.webp",
  },
} satisfies Record<BoothSceneKey, { small: string; large: string }>;
export type BoothArtwork =
  | { kind: "bundled"; key: BoothSceneKey }
  | { kind: "upload"; id: Id<"eventPhotoBoothArtwork"> };
export interface BoothSceneDraft {
  artwork: BoothArtwork;
  caption: BoothText;
  category: BoothCategory;
  id: string;
  title: BoothText;
  visible: boolean;
}
export interface BoothScene extends BoothSceneDraft {
  artworkUrl: string;
}
export const BOOTH_METRICS = [
  "visit",
  "creation_completed",
  "download_action",
  "share_attempt",
  "enquiry_entry",
] as const;
export type BoothMetric = (typeof BOOTH_METRICS)[number];
export type BoothMetrics = Record<BoothMetric, number>;
export interface BoothMetricEntry {
  count: number;
  event: BoothMetric;
  sceneId?: string;
}
export interface BoothAccess {
  canManage: boolean;
  canManageAssignments: boolean;
  canParticipateWhenClosed: boolean;
}
export interface BoothParticipantState {
  availability: BoothAvailability;
  canParticipate: boolean;
  privilegedAccess: boolean;
  revision: number;
  scenes: BoothScene[];
}
export interface BoothManagementState {
  availability: BoothAvailability;
  canManageAssignments: boolean;
  draftScenes: BoothScene[];
  metrics: BoothMetrics;
  publishedScenes: BoothScene[];
  revision: number;
}
export interface BoothStaffOption {
  active: boolean;
  assigned: boolean;
  id: Id<"staffUsers">;
  name: string;
  roles: string[];
}
export const EMPTY_BOOTH_METRICS = {
  creation_completed: 0,
  download_action: 0,
  enquiry_entry: 0,
  share_attempt: 0,
  visit: 0,
} satisfies BoothMetrics;
export const DEFAULT_BOOTH_SCENES: BoothSceneDraft[] = [
  {
    artwork: { key: "paris", kind: "bundled" },
    caption: { en: "France", hi: "फ्रांस" },
    category: "travel",
    id: "paris",
    title: { en: "Paris", hi: "पेरिस" },
    visible: true,
  },
  {
    artwork: { key: "bali", kind: "bundled" },
    caption: { en: "Indonesia", hi: "इंडोनेशिया" },
    category: "travel",
    id: "bali",
    title: { en: "Bali", hi: "बाली" },
    visible: true,
  },
  {
    artwork: { key: "dubai", kind: "bundled" },
    caption: { en: "United Arab Emirates", hi: "संयुक्त अरब अमीरात" },
    category: "travel",
    id: "dubai",
    title: { en: "Dubai", hi: "दुबई" },
    visible: true,
  },
  {
    artwork: { key: "kashi", kind: "bundled" },
    caption: { en: "Uttar Pradesh, India", hi: "उत्तर प्रदेश, भारत" },
    category: "pilgrimage",
    id: "kashi",
    title: { en: "Kashi", hi: "काशी" },
    visible: true,
  },
  {
    artwork: { key: "ayodhya", kind: "bundled" },
    caption: { en: "Uttar Pradesh, India", hi: "उत्तर प्रदेश, भारत" },
    category: "pilgrimage",
    id: "ayodhya",
    title: { en: "Ayodhya", hi: "अयोध्या" },
    visible: true,
  },
  {
    artwork: { key: "kedarnath", kind: "bundled" },
    caption: { en: "Uttarakhand, India", hi: "उत्तराखंड, भारत" },
    category: "pilgrimage",
    id: "kedarnath",
    title: { en: "Kedarnath", hi: "केदारनाथ" },
    visible: true,
  },
];

export function isBoothMetricBatch<Value>(
  value: Value
): value is Value & { events: BoothMetricEntry[] } {
  if (
    !isJsonObject(value) ||
    Object.keys(value).some((key) => key !== "events") ||
    !("events" in value) ||
    !Array.isArray(value.events)
  ) {
    return false;
  }
  return (
    value.events.length > 0 &&
    value.events.length <= 20 &&
    value.events.every((entry) => {
      if (!isJsonObject(entry)) {
        return false;
      }
      const item = entry;
      return (
        Object.keys(item).every((key) => ["event", "sceneId", "count"].includes(key)) &&
        BOOTH_METRICS.some((metric) => metric === item.event) &&
        Number.isInteger(item.count) &&
        Number(item.count) >= 1 &&
        Number(item.count) <= 10 &&
        (item.sceneId === undefined ||
          (isRuntimeString(item.sceneId) && SCENE_ID.test(item.sceneId))) &&
        (item.event === "visit" ? item.sceneId === undefined : isRuntimeString(item.sceneId))
      );
    })
  );
}

export const PUBLIC_DESTINATIONS_VERSION = "2026-08-12";

export type PublicDestinationRegion = "domestic" | "international";

export interface PublicDestination {
  description: string;
  id: string;
  name: string;
  percentage: number;
  rank: number;
  region: PublicDestinationRegion;
}

const PUBLIC_INTERNATIONAL_DESTINATIONS = [
  {
    description:
      "Plan conferences in Tokyo, Osaka, or Kyoto, with rail travel, temple visits, regional food, and seasonal festivals around the event.",
    id: "japan",
    name: "Japan",
    percentage: 100,
    rank: 1,
    region: "international",
  },
  {
    description:
      "Phu Quoc and Da Nang offer beachfront resorts for meetings and incentive trips, with golf, dining, and time by the sea.",
    id: "vietnam",
    name: "Vietnam (Phu Quoc & Da Nang)",
    percentage: 95,
    rank: 2,
    region: "international",
  },
  {
    description:
      "Combine meetings in Colombo with visits to tea country, heritage sites, wildlife reserves, or the coast.",
    id: "sri-lanka",
    name: "Sri Lanka",
    percentage: 90,
    rank: 3,
    region: "international",
  },
  {
    description:
      "Phuket offers resort meeting venues, beach stays, island trips, and evening entertainment for incentive groups.",
    id: "phuket",
    name: "Phuket",
    percentage: 85,
    rank: 4,
    region: "international",
  },
  {
    description:
      "Kuala Lumpur offers convention venues, nearby hotels, and a choice of dining and cultural visits for corporate groups.",
    id: "kuala-lumpur",
    name: "Kuala Lumpur",
    percentage: 80,
    rank: 5,
    region: "international",
  },
] as const satisfies readonly PublicDestination[];

const PUBLIC_DOMESTIC_DESTINATIONS = [
  {
    description:
      "Goa combines conference hotels with beaches, water sports, yoga, and evening entertainment.",
    id: "goa",
    name: "Goa",
    percentage: 100,
    rank: 1,
    region: "domestic",
  },
  {
    description:
      "Mussoorie offers hill hotels and nature walks for smaller offsites and leadership meetings.",
    id: "mussoorie",
    name: "Mussoorie",
    percentage: 95,
    rank: 2,
    region: "domestic",
  },
  {
    description:
      "Bangalore offers convention hotels and meeting venues for launches, conferences, and corporate events.",
    id: "bangalore",
    name: "Bangalore",
    percentage: 90,
    rank: 3,
    region: "domestic",
  },
  {
    description:
      "Kashmir offers lakeside stays, houseboat visits, and mountain scenery for smaller incentive groups.",
    id: "kashmir",
    name: "Kashmir",
    percentage: 85,
    rank: 4,
    region: "domestic",
  },
  {
    description:
      "Shillong offers hill stays, local music and crafts, and outdoor activities for team trips.",
    id: "shillong",
    name: "Shillong",
    percentage: 80,
    rank: 5,
    region: "domestic",
  },
] as const satisfies readonly PublicDestination[];

export const PUBLIC_DESTINATIONS = [
  ...PUBLIC_INTERNATIONAL_DESTINATIONS,
  ...PUBLIC_DOMESTIC_DESTINATIONS,
] as const;

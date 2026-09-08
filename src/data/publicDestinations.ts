export const PUBLIC_DESTINATIONS_VERSION = "2026-08-12";

export type PublicDestinationRegion = "domestic" | "international";

export interface PublicDestination {
  description: string;
  id: string;
  name: string;
  region: PublicDestinationRegion;
}

const PUBLIC_INTERNATIONAL_DESTINATIONS = [
  {
    description:
      "Japan pairs bullet-train connectivity with convention venues in Tokyo, Osaka, and Kyoto. Hybrid-ready halls, temple gardens, kaiseki dining, and seasonal festivals suit high-profile conferences and executive retreats.",
    id: "japan",
    name: "Japan",
    region: "international",
  },
  {
    description:
      "Phu Quoc’s island resorts and Da Nang’s beachfront hotels deliver strong MICE capacity with direct flights and growing luxury inventory. Expect incentive-friendly beaches, golf, and vibrant dining—ideal for teams that want tropical energy with improving event infrastructure.",
    id: "vietnam",
    name: "Vietnam (Phu Quoc & Da Nang)",
    region: "international",
  },
  {
    description:
      "Sri Lanka blends Colombo's convention hotels with tea-country escapes and coastal incentives. Favourable seasonality, warm hospitality, and diverse backdrops — from heritage sites to wildlife — work well for conferences with pre- and post-event extensions.",
    id: "sri-lanka",
    name: "Sri Lanka",
    region: "international",
  },
  {
    description:
      "Phuket remains a proven incentives hub: integrated resorts, large ballrooms, and island-hopping add-ons. It works well for sales kick-offs and reward trips where beach time, wellness, and nightlife are part of the programme design.",
    id: "phuket",
    name: "Phuket",
    region: "international",
  },
  {
    description:
      "KL pairs the Petronas-era skyline with efficient international access and strong-value five-star inventory. Convention-adjacent hotels, multicultural dining, and easy side trips to highlands or cultural districts keep programmes flexible for diverse delegate profiles.",
    id: "kuala-lumpur",
    name: "Kuala Lumpur",
    region: "international",
  },
] as const satisfies readonly PublicDestination[];

const PUBLIC_DOMESTIC_DESTINATIONS = [
  {
    description:
      "A beachside MICE favourite where upscale resorts pair large conference facilities with work–leisure add-ons — waterfront ballrooms, water sports, yoga by the sea, and evening entertainment.",
    id: "goa",
    name: "Goa",
    region: "domestic",
  },
  {
    description:
      "Mussoorie offers cool-climate offsites above the Doon Valley—heritage hotels, ridge-line views, and nature walks that suit leadership retreats and compact strategy meets without the heat of the plains.",
    id: "mussoorie",
    name: "Mussoorie",
    region: "domestic",
  },
  {
    description:
      "India’s tech capital delivers scale: large convention hotels, startup energy, and reliable connectivity for product launches, hack weeks, and enterprise summits—with strong F&B and after-hours culture for delegate networking.",
    id: "bangalore",
    name: "Bangalore",
    region: "domestic",
  },
  {
    description:
      "Kashmir suits premium small groups with lakeside stays, houseboat experiences, and alpine scenery — strong for incentive trips where the setting carries the programme.",
    id: "kashmir",
    name: "Kashmir",
    region: "domestic",
  },
  {
    description:
      "Shillong’s rolling hills and mild weather suit creative offsites and cultural immersion across the Northeast—think music, local crafts, and outdoor team moments with a distinctly different Indian landscape.",
    id: "shillong",
    name: "Shillong",
    region: "domestic",
  },
] as const satisfies readonly PublicDestination[];

export const PUBLIC_DESTINATIONS = [
  ...PUBLIC_INTERNATIONAL_DESTINATIONS,
  ...PUBLIC_DOMESTIC_DESTINATIONS,
] as const;

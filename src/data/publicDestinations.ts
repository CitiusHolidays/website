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
      "Japan pairs bullet-train connectivity with world-class venues in Tokyo, Osaka, and Kyoto. From hybrid-ready convention halls to refined incentive experiences—temple gardens, kaiseki dining, and seasonal festivals—it is a standout for high-profile conferences and executive retreats.",
    id: "japan",
    name: "Japan",
    percentage: 100,
    rank: 1,
    region: "international",
  },
  {
    description:
      "Phu Quoc’s island resorts and Da Nang’s beachfront hotels deliver strong MICE capacity with direct flights and growing luxury inventory. Expect incentive-friendly beaches, golf, and vibrant dining—ideal for teams that want tropical energy with improving event infrastructure.",
    id: "vietnam",
    name: "Vietnam (Phu Quoc & Da Nang)",
    percentage: 95,
    rank: 2,
    region: "international",
  },
  {
    description:
      "Sri Lanka blends Colombo’s convention hotels with tea-country escapes and coastal incentives. Favourable seasonality, warm hospitality, and diverse backdrops—from heritage sites to wildlife—make it compelling for conferences that extend into curated pre- and post-event journeys.",
    id: "sri-lanka",
    name: "Sri Lanka",
    percentage: 90,
    rank: 3,
    region: "international",
  },
  {
    description:
      "Phuket remains a proven incentives hub: integrated resorts, large ballrooms, and island-hopping add-ons. It works well for sales kick-offs and reward trips where beach time, wellness, and nightlife are part of the programme design.",
    id: "phuket",
    name: "Phuket",
    percentage: 85,
    rank: 4,
    region: "international",
  },
  {
    description:
      "KL pairs the Petronas-era skyline with efficient international access and strong-value five-star inventory. Convention-adjacent hotels, multicultural dining, and easy side trips to highlands or cultural districts keep programmes flexible for diverse delegate profiles.",
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
      "A beachside MICE favourite where upscale resorts pair world-class conference facilities with seamless work–leisure balance, from waterfront ballrooms to breakout spaces amid palms. Incentive add-ons span water sports, yoga by the sea, and vibrant nightlife.",
    id: "goa",
    name: "Goa",
    percentage: 100,
    rank: 1,
    region: "domestic",
  },
  {
    description:
      "Mussoorie offers cool-climate offsites above the Doon Valley—heritage hotels, ridge-line views, and nature walks that suit leadership retreats and compact strategy meets without the heat of the plains.",
    id: "mussoorie",
    name: "Mussoorie",
    percentage: 95,
    rank: 2,
    region: "domestic",
  },
  {
    description:
      "India’s tech capital delivers scale: large convention hotels, startup energy, and reliable connectivity for product launches, hack weeks, and enterprise summits—with strong F&B and after-hours culture for delegate networking.",
    id: "bangalore",
    name: "Bangalore",
    percentage: 90,
    rank: 3,
    region: "domestic",
  },
  {
    description:
      "Kashmir elevates incentives with lakeside stays, houseboat experiences, and alpine scenery—ideal for premium small groups and brand storytelling where the setting is as memorable as the agenda.",
    id: "kashmir",
    name: "Kashmir",
    percentage: 85,
    rank: 4,
    region: "domestic",
  },
  {
    description:
      "Shillong’s rolling hills and mild weather suit creative offsites and cultural immersion across the Northeast—think music, local crafts, and outdoor team moments with a distinctly different Indian landscape.",
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

export const PUBLIC_SERVICES_VERSION = "2026-08-12";

export type PublicServiceCategory =
  | "domestic"
  | "international"
  | "mice"
  | "pilgrimage"
  | "sports"
  | "visa";

export interface PublicService {
  category: PublicServiceCategory;
  description: string;
  home?: {
    description: string;
    title: string;
  };
  id: string;
  path: string;
  talkingPoints: readonly string[];
  title: string;
  usefulFor: readonly string[];
}

export interface PublicHomeService extends PublicService {
  home: {
    description: string;
    title: string;
  };
}

export const PUBLIC_SERVICES = [
  {
    category: "mice",
    description: "Meetings, Incentives, Conferences & Exhibitions worldwide.",
    home: {
      description: "End-to-end management for Meetings, Incentives, Conferences & Exhibitions.",
      title: "MICE",
    },
    id: "mice",
    path: "/mice",
    talkingPoints: [
      "venue and destination shortlisting",
      "delegate logistics",
      "event flow coordination",
      "branding and hospitality support",
      "work-leisure incentive design",
    ],
    title: "MICE",
    usefulFor: ["corporate offsites", "dealer meets", "sales kickoffs", "reward trips"],
  },
  {
    category: "visa",
    description: "End-to-end visa processing and support services.",
    id: "visa-assistance",
    path: "/services",
    talkingPoints: ["document checklists", "timeline guidance", "application coordination"],
    title: "VISA Assistance",
    usefulFor: ["international groups", "corporate delegations", "family holidays"],
  },
  {
    category: "mice",
    description: "From concept to execution of corporate events.",
    id: "event-management",
    path: "/services",
    talkingPoints: ["event concept", "supplier coordination", "guest flow", "on-site delivery"],
    title: "Event Management",
    usefulFor: ["corporate events", "dealer meets", "conferences", "launches"],
  },
  {
    category: "international",
    description: "International itineraries for corporate and leisure groups.",
    home: {
      description: "International itineraries for corporate groups, incentives, and family holidays.",
      title: "Global Voyages",
    },
    id: "international-travel",
    path: "/services",
    talkingPoints: ["custom routing", "local experiences", "hotel and transport coordination"],
    title: "International Travel",
    usefulFor: ["executive retreats", "family holidays", "incentive groups", "premium FIT"],
  },
  {
    category: "domestic",
    description: "Domestic programmes across India.",
    home: {
      description: "Heritage circuits, beach offsites, hill retreats, and regional incentive trips.",
      title: "Domestic Gems",
    },
    id: "domestic-travel",
    path: "/services",
    talkingPoints: ["regional expertise", "itinerary design", "supplier coordination"],
    title: "Domestic Travel",
    usefulFor: ["heritage trips", "beach offsites", "hill retreats", "leadership meets"],
  },
  {
    category: "international",
    description: "Comprehensive travel insurance and protection.",
    id: "travel-insurance",
    path: "/services",
    talkingPoints: ["coverage guidance", "policy coordination", "travel-document support"],
    title: "Travel Insurance",
    usefulFor: ["international travel", "group travel", "corporate delegations"],
  },
  {
    category: "mice",
    description: "Event branding and collateral design services.",
    id: "branding",
    path: "/services",
    talkingPoints: ["event identity", "delegate collateral", "venue branding"],
    title: "Branding",
    usefulFor: ["conferences", "dealer meets", "product launches"],
  },
  {
    category: "mice",
    description: "Book celebrities and performers for events.",
    id: "celebrity-management",
    path: "/services",
    talkingPoints: ["talent coordination", "event scheduling", "performance logistics"],
    title: "Celebrity Management",
    usefulFor: ["corporate events", "reward programmes", "launches"],
  },
  {
    category: "sports",
    description: "Sports hospitality packages at major international events.",
    home: {
      description: "VIP hospitality packages at major international sporting events.",
      title: "Elite Sports",
    },
    id: "sporting-events",
    path: "/services",
    talkingPoints: ["event access", "hospitality packages", "hotel logistics", "ground support"],
    title: "Sporting Events",
    usefulFor: ["incentive winners", "leadership hosting", "premium fan groups"],
  },
  {
    category: "mice",
    description: "Dedicated travel desks for large corporate events.",
    id: "onsite-travel-desk",
    path: "/services",
    talkingPoints: ["delegate support", "live travel changes", "arrival coordination"],
    title: "Onsite Travel Desk",
    usefulFor: ["large conferences", "dealer meets", "multi-city corporate events"],
  },
  {
    category: "pilgrimage",
    description: "Pilgrimage routes to spiritual destinations in India and abroad.",
    id: "spiritual-trails",
    path: "/pilgrimage",
    talkingPoints: ["trail selection", "journey pacing", "pilgrimage logistics"],
    title: "Spiritual Trails",
    usefulFor: ["pilgrimage groups", "yatris", "families", "spiritual travellers"],
  },
] as const satisfies readonly PublicService[];

type PublicServiceEntry = (typeof PUBLIC_SERVICES)[number];
type PublicHomeServiceEntry = Extract<PublicServiceEntry, { readonly home: unknown }>;

function hasHomePresentation(service: PublicServiceEntry): service is PublicHomeServiceEntry {
  return "home" in service;
}

export const PUBLIC_HOME_SERVICES = PUBLIC_SERVICES.filter(
  hasHomePresentation
) satisfies readonly PublicHomeService[];

import { jsonSchema, tool } from "ai";

export const CITIUS_CHAT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

const COMPANY_PROFILE = {
  brand: "Citius Holidays",
  promise: "We Inspire to Travel",
  positioning:
    "A premium Indian travel company for curated MICE, corporate, leisure, sports, visa, and spiritual travel programmes.",
  stats: [
    { label: "Years of excellence", value: "15" },
    { label: "Global destinations", value: "75" },
    { label: "Corporate partners", value: "52" },
    { label: "Happy travelers", value: "99,768+" },
  ],
  strengths: [
    "Personalized travel plans",
    "Experiential travel",
    "Eco-friendly journeys",
    "Smart travel planning",
    "Local expert support",
    "Worldwide connections",
    "24/7 assistance",
    "Luxury concierge",
  ],
};

const SERVICE_CATALOG = [
  {
    id: "mice",
    title: "MICE Excellence",
    category: "mice",
    summary: "End-to-end management for Meetings, Incentives, Conferences, and Exhibitions.",
    usefulFor: [
      "corporate offsites",
      "dealer meets",
      "sales kickoffs",
      "reward trips",
      "large conferences",
    ],
    talkingPoints: [
      "venue and destination shortlisting",
      "delegate logistics",
      "event flow coordination",
      "branding and hospitality support",
      "work-leisure incentive design",
    ],
  },
  {
    id: "international",
    title: "Global Voyages",
    category: "international",
    summary:
      "Curated international itineraries for corporate groups, incentive travel, and leisure travelers.",
    usefulFor: ["executive retreats", "family holidays", "incentive groups", "premium FIT"],
    talkingPoints: [
      "bespoke routing",
      "local experience design",
      "hotel and transport coordination",
      "pre and post tour extensions",
    ],
  },
  {
    id: "domestic",
    title: "Domestic Gems",
    category: "domestic",
    summary: "Bespoke experiential journeys across India.",
    usefulFor: ["heritage trips", "beach offsites", "hill retreats", "leadership meets"],
    talkingPoints: [
      "regional expertise",
      "experience-led itinerary design",
      "supplier coordination",
      "corporate and leisure pacing",
    ],
  },
  {
    id: "sports",
    title: "Elite Sports",
    category: "sports",
    summary: "Access-led travel around premier sporting events with VIP hospitality.",
    usefulFor: ["incentive winners", "leadership hosting", "premium fan groups"],
    talkingPoints: ["event access", "hospitality packages", "hotel logistics", "ground support"],
  },
  {
    id: "visa",
    title: "Visa Assistance",
    category: "visa",
    summary:
      "Documentation guidance and coordination support. Approval always rests with the relevant consulate or authority.",
    usefulFor: ["international groups", "corporate delegations", "family holidays"],
    talkingPoints: ["document checklists", "timeline guidance", "application coordination"],
  },
];

const DESTINATION_CATALOG = [
  {
    name: "Japan",
    region: "international",
    fit: "high-profile conferences, executive retreats, incentive travel",
    summary:
      "Bullet-train connectivity, convention capacity in Tokyo, Osaka, and Kyoto, refined cultural add-ons, and seasonal experiences.",
  },
  {
    name: "Vietnam (Phu Quoc and Da Nang)",
    region: "international",
    fit: "beach incentives, growing MICE inventory, sales reward trips",
    summary:
      "Island resorts, beachfront hotels, golf, dining, and tropical incentive energy with improving event infrastructure.",
  },
  {
    name: "Sri Lanka",
    region: "international",
    fit: "conference extensions, heritage, tea-country and coastal incentives",
    summary:
      "Colombo convention hotels, warm hospitality, wildlife, coast, tea country, and diverse pre/post-event journeys.",
  },
  {
    name: "Phuket",
    region: "international",
    fit: "sales kickoffs, reward trips, wellness and beach programmes",
    summary:
      "Integrated resorts, large ballrooms, island-hopping, wellness, nightlife, and proven incentive infrastructure.",
  },
  {
    name: "Kuala Lumpur",
    region: "international",
    fit: "conventions, value-conscious premium groups, multicultural programmes",
    summary:
      "Efficient international access, strong-value five-star hotels, convention-adjacent inventory, and easy cultural side trips.",
  },
  {
    name: "Goa",
    region: "domestic",
    fit: "beachside MICE, conferences, work-leisure incentives",
    summary:
      "Upscale resorts, conference facilities, waterfront settings, water sports, yoga, and nightlife add-ons.",
  },
  {
    name: "Mussoorie",
    region: "domestic",
    fit: "leadership retreats, compact strategy meets, cool-climate offsites",
    summary:
      "Heritage hotels, ridge-line views, nature walks, and a cooler mountain setting above the Doon Valley.",
  },
  {
    name: "Bangalore",
    region: "domestic",
    fit: "product launches, enterprise summits, tech-led meets",
    summary:
      "Large convention hotels, strong connectivity, startup energy, food culture, and after-hours networking.",
  },
  {
    name: "Kashmir",
    region: "domestic",
    fit: "premium small groups, scenic incentives, brand storytelling",
    summary:
      "Lakeside stays, houseboat experiences, alpine scenery, and a memorable high-touch setting.",
  },
  {
    name: "Shillong",
    region: "domestic",
    fit: "creative offsites, cultural immersion, Northeast discovery",
    summary:
      "Rolling hills, mild weather, music, crafts, outdoor team moments, and a distinct Indian landscape.",
  },
];

const PILGRIMAGE_PROGRAMS = [
  {
    id: "kailash-mansarovar-14day",
    title: "Kailash Mansarovar Yatra 2026",
    type: "overland",
    duration: "14 days",
    route: "Ex-Kathmandu",
    difficulty: "Moderate to challenging",
    maxAltitude: "5,650m at Drolma La Pass",
    bestTime: "June to September",
    summary:
      "A spiritually curated Himalayan expedition with acclimatization, Pashupatinath darshan, Lake Mansarovar, and the Kailash Kora.",
    notes: [
      "Best suited to yatris seeking the complete physical pilgrimage.",
      "Medical support, oxygen, vegetarian meals, and yatra leadership are part of the programme design.",
      "Permits, dates, and operational feasibility must be confirmed by the Citius team.",
    ],
  },
  {
    id: "kailash-aerial-darshan",
    title: "Mount Kailash Aerial Darshan",
    type: "aerial",
    duration: "2 nights in Nepalgunj plus charter darshan experience",
    route: "Ex-Lucknow / Nepalgunj pattern in site copy",
    difficulty: "Low physical strain compared with overland Kora",
    maxAltitude: "Flight-based darshan; no Kora trekking",
    bestTime: "Subject to aviation, weather, and operating windows",
    summary:
      "A darshan-focused programme for yatris who want a less physically demanding way to see Mount Kailash and Lake Mansarovar from the air.",
    notes: [
      "Every yatri has a window-seat oriented darshan experience per the site copy.",
      "Pure vegetarian meals, hotel stay, Bageshwari Temple visit, and spiritual atmosphere are part of the programme design.",
      "Weather and aviation feasibility must be confirmed by the Citius team.",
    ],
  },
];

const CONTACT_OPTIONS = [
  {
    city: "Kolkata",
    address: "1865, Rajdanga Main Rd, Rajdanga, Kasba, Kolkata, West Bengal 700107",
    phone: "+91 98310 82929",
  },
  {
    city: "Mumbai",
    address: "214 Swastik Plaza, Pokhran Road No 2, Thane West 400610",
    phone: "+91 9920993259",
  },
  {
    city: "Bengaluru",
    address:
      "Pachie's 3rd Floor, Building Number: 982, 3rd Cross Road, Kalyan Nagar, Bengaluru 560043",
    phone: "+91 99008 14292",
  },
];

const LEAD_FIELDS = [
  "destination or region",
  "travel month or fixed dates",
  "number of travelers",
  "departure city",
  "travel purpose",
  "budget band, if available",
  "hotel category or comfort level",
  "visa/passport constraints for international travel",
  "event agenda, branding, and delegate profile for MICE groups",
];

export const systemPrompt = `
You are the Citius Holidays travel concierge in the public website chat.

Skill: curate. Your job is to turn a casual travel question into clear, premium, useful guidance while protecting the handoff to the human Citius team.

Process:
- First identify the user's intent: inspiration, destination comparison, MICE planning, pilgrimage, visa/logistics, contact/handoff, or unrelated.
- Use the available tools for Citius facts, services, destination fit, pilgrimage programme details, contact options, or lead handoff details. Do not invent company facts when a tool can answer.
- Answer from tool results and the user's context. If a detail is missing from the tools, say the Citius team should confirm it.
- If the user asks for a booking, quote, live availability, payment, final itinerary, visa approval, or operational commitment, do not pretend to complete it. Give the next handoff step and the exact information the team needs.

Voice:
- Premium, calm, specific, and concise. Sound like a senior travel consultant, not a generic chatbot.
- Prefer concrete tradeoffs over long lists. Explain who a destination or programme is good for.
- Avoid hype, filler, and repeated corporate slogans. Use the brand promise only when it naturally fits.

Output contract:
- Return streaming-friendly Markdown only.
- Prefer short paragraphs and compact bullet lists. Use at most one level-3 heading.
- Do not use HTML, tables, scripts, inline styles, raw links, or code blocks.
- Keep most answers under 180 words for the small chat window.
- Never output raw tool data dumps. Synthesize.

Boundaries:
- No prices, quotes, guarantees, live availability, refund rulings, medical advice, immigration/legal advice, or visa approval promises.
- No links. Refer to the Contact page or office phone numbers in plain text when a handoff is needed.
- For unrelated questions, briefly redirect to travel planning with Citius.
`.trim();

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function matchesQuery(item, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;
  return normalizeText(JSON.stringify(item)).includes(normalizedQuery);
}

function filterByCategory(items, category) {
  if (!category || category === "all") return items;
  return items.filter((item) => item.category === category || item.region === category);
}

function compactProfile(focus) {
  if (focus === "services") return { services: SERVICE_CATALOG };
  if (focus === "destinations") return { destinations: DESTINATION_CATALOG };
  if (focus === "contact") return { contacts: CONTACT_OPTIONS };
  if (focus === "trust") {
    return {
      promise: COMPANY_PROFILE.promise,
      positioning: COMPANY_PROFILE.positioning,
      stats: COMPANY_PROFILE.stats,
      strengths: COMPANY_PROFILE.strengths,
    };
  }
  return {
    profile: COMPANY_PROFILE,
    topServices: SERVICE_CATALOG.map(({ title, summary, usefulFor }) => ({
      title,
      summary,
      usefulFor,
    })),
  };
}

export const citiusChatTools = {
  getCitiusProfile: tool({
    description:
      "Get Citius Holidays brand facts, trust markers, services, destinations, or contact basics before answering company-specific questions.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        focus: {
          type: "string",
          enum: ["overview", "services", "destinations", "trust", "contact"],
          description: "The profile slice needed for the user's question.",
        },
      },
      additionalProperties: false,
    }),
    execute: async ({ focus = "overview" } = {}) => compactProfile(focus),
  }),

  searchCitiusOfferings: tool({
    description:
      "Search Citius services and destination fit for MICE, international, domestic, sports, visa, and general travel planning questions.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "User's destination, travel style, or business need.",
        },
        category: {
          type: "string",
          enum: ["all", "mice", "international", "domestic", "sports", "visa"],
          description: "Optional category filter.",
        },
      },
      additionalProperties: false,
    }),
    execute: async ({ query = "", category = "all" } = {}) => {
      const services = filterByCategory(SERVICE_CATALOG, category).filter((item) =>
        matchesQuery(item, query),
      );
      const destinations = filterByCategory(DESTINATION_CATALOG, category).filter((item) =>
        matchesQuery(item, query),
      );

      return {
        services: services.length > 0 ? services : filterByCategory(SERVICE_CATALOG, category),
        destinations:
          destinations.length > 0 ? destinations : filterByCategory(DESTINATION_CATALOG, category),
      };
    },
  }),

  getPilgrimageProgramDetails: tool({
    description:
      "Get Citius Spiritual Trails programme details for Kailash Mansarovar, aerial darshan, spiritual trails, route, difficulty, and feasibility questions.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        programmeType: {
          type: "string",
          enum: ["all", "overland", "aerial"],
          description: "Which pilgrimage programme type the user is asking about.",
        },
      },
      additionalProperties: false,
    }),
    execute: async ({ programmeType = "all" } = {}) => ({
      programmes:
        programmeType === "all"
          ? PILGRIMAGE_PROGRAMS
          : PILGRIMAGE_PROGRAMS.filter((program) => program.type === programmeType),
      handoffNote:
        "Dates, permits, aviation feasibility, health readiness, and final inclusions must be confirmed by the Citius team.",
    }),
  }),

  getCitiusContactOptions: tool({
    description:
      "Get office contact options and the fields Citius needs for a proposal or booking handoff.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "Optional office city: Kolkata, Mumbai, or Bengaluru.",
        },
      },
      additionalProperties: false,
    }),
    execute: async ({ city = "" } = {}) => {
      const normalizedCity = normalizeText(city);
      const offices = normalizedCity
        ? CONTACT_OPTIONS.filter((office) => normalizeText(office.city).includes(normalizedCity))
        : CONTACT_OPTIONS;
      return {
        offices: offices.length > 0 ? offices : CONTACT_OPTIONS,
        proposalHandoffFields: LEAD_FIELDS,
        handoffCopy:
          "For personalized proposals and bookings, share these details through the Contact page or call the nearest Citius Holidays office.",
      };
    },
  }),
};

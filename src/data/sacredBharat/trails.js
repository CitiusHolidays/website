/**
 * 12 spiritual trails — completion when all templeIds are visited.
 * bharat-explorer uses region rule instead of fixed temple list.
 */
export const TRAILS = [
  {
    badgeId: "mahadev-explorer",
    badgeName: "Mahadev Explorer",
    completionBonus: 200,
    emoji: "🔱",
    slug: "shiva-trail",
    templeIds: ["kashi-vishwanath", "kedarnath", "somnath", "mahakaleshwar", "ramanathaswamy"],
    title: "Shiva Trail",
  },
  {
    badgeId: "char-dham-conqueror",
    badgeName: "Char Dham Conqueror",
    completionBonus: 500,
    emoji: "🚩",
    slug: "char-dham-trail",
    templeIds: ["badrinath", "dwarka", "jagannath", "ramanathaswamy"],
    title: "Char Dham Trail",
  },
  {
    badgeId: "ramayana-yatri",
    badgeName: "Ramayana Yatri",
    completionBonus: 300,
    emoji: "🏹",
    slug: "ramayana-trail",
    templeIds: ["ayodhya", "chitrakoot", "nashik-panchavati", "ramanathaswamy"],
    title: "Ramayana Trail",
  },
  {
    badgeId: "krishna-bhakta",
    badgeName: "Krishna Bhakta",
    completionBonus: 200,
    emoji: "🦚",
    slug: "krishna-trail",
    templeIds: ["banke-bihari", "prem-mandir", "dwarka"],
    title: "Krishna Trail",
  },
  {
    badgeId: "shakti-seeker",
    badgeName: "Shakti Seeker",
    completionBonus: 300,
    emoji: "🌺",
    slug: "shakti-trail",
    templeIds: ["vaishno-devi", "kamakhya", "meenakshi", "dakshineswar"],
    title: "Shakti Trail",
  },
  {
    badgeId: "vaikuntha-traveller",
    badgeName: "Vaikuntha Traveller",
    completionBonus: 250,
    emoji: "🕉",
    slug: "vishnu-trail",
    templeIds: ["tirupati", "badrinath", "jagannath", "sri-rangam"],
    title: "Vishnu Trail",
  },
  {
    badgeId: "river-pilgrim",
    badgeName: "River Pilgrim",
    completionBonus: 200,
    emoji: "🌊",
    slug: "sacred-rivers-trail",
    templeIds: ["kashi-vishwanath", "haridwar", "prayagraj", "ramanathaswamy"],
    title: "Sacred Rivers Trail",
  },
  {
    badgeId: "moksha-pathfinder-trail",
    badgeName: "Moksha Pathfinder",
    completionBonus: 500,
    emoji: "✨",
    slug: "moksha-cities-trail",
    templeIds: [
      "ayodhya",
      "mathura",
      "haridwar",
      "kashi-vishwanath",
      "ujjain",
      "dwarka",
      "kanchipuram",
    ],
    title: "Moksha Cities Trail",
  },
  {
    badgeId: "dakshin-yatri",
    badgeName: "Dakshin Yatri",
    completionBonus: 250,
    emoji: "🛕",
    slug: "divine-south-trail",
    templeIds: ["tirupati", "meenakshi", "ramanathaswamy", "sri-rangam", "guruvayur"],
    title: "Divine South Trail",
  },
  {
    badgeId: "himalayan-sage",
    badgeName: "Himalayan Sage",
    completionBonus: 400,
    emoji: "🏔",
    slug: "himalayan-awakening-trail",
    templeIds: ["kedarnath", "badrinath", "kailash-mansarovar"],
    title: "Himalayan Awakening Trail",
  },
  {
    badgeId: "heritage-guardian",
    badgeName: "Heritage Guardian",
    completionBonus: 200,
    emoji: "🏛",
    slug: "temple-architecture-trail",
    templeIds: ["konark", "meenakshi", "sri-rangam", "akshardham"],
    title: "Temple Architecture Trail",
  },
  {
    badgeId: "sacred-bharat-explorer",
    badgeName: "Sacred Bharat Explorer",
    completionBonus: 150,
    emoji: "🇮🇳",
    regions: ["north", "south", "east", "west"],
    slug: "bharat-explorer-trail",
    title: "Bharat Explorer Trail",
    type: "region",
  },
];

export const TRAIL_BY_SLUG = Object.fromEntries(TRAILS.map((t) => [t.slug, t]));

export function getTrailBySlug(slug) {
  return TRAIL_BY_SLUG[slug] ?? null;
}

export function getAllTrailSlugs() {
  return TRAILS.map((t) => t.slug);
}

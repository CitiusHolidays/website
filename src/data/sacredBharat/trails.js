/**
 * 12 spiritual trails — completion when all templeIds are visited.
 * bharat-explorer uses region rule instead of fixed temple list.
 */
export const TRAILS = [
  {
    slug: "shiva-trail",
    title: "Shiva Trail",
    emoji: "🔱",
    templeIds: ["kashi-vishwanath", "kedarnath", "somnath", "mahakaleshwar", "ramanathaswamy"],
    completionBonus: 200,
    badgeId: "mahadev-explorer",
    badgeName: "Mahadev Explorer",
  },
  {
    slug: "char-dham-trail",
    title: "Char Dham Trail",
    emoji: "🚩",
    templeIds: ["badrinath", "dwarka", "jagannath", "rameswaram"],
    completionBonus: 500,
    badgeId: "char-dham-conqueror",
    badgeName: "Char Dham Conqueror",
  },
  {
    slug: "ramayana-trail",
    title: "Ramayana Trail",
    emoji: "🏹",
    templeIds: ["ayodhya", "chitrakoot", "nashik-panchavati", "rameswaram"],
    completionBonus: 300,
    badgeId: "ramayana-yatri",
    badgeName: "Ramayana Yatri",
  },
  {
    slug: "krishna-trail",
    title: "Krishna Trail",
    emoji: "🦚",
    templeIds: ["banke-bihari", "prem-mandir", "dwarka"],
    completionBonus: 200,
    badgeId: "krishna-bhakta",
    badgeName: "Krishna Bhakta",
  },
  {
    slug: "shakti-trail",
    title: "Shakti Trail",
    emoji: "🌺",
    templeIds: ["vaishno-devi", "kamakhya", "meenakshi", "dakshineswar"],
    completionBonus: 300,
    badgeId: "shakti-seeker",
    badgeName: "Shakti Seeker",
  },
  {
    slug: "vishnu-trail",
    title: "Vishnu Trail",
    emoji: "🕉",
    templeIds: ["tirupati", "badrinath", "jagannath", "sri-rangam"],
    completionBonus: 250,
    badgeId: "vaikuntha-traveller",
    badgeName: "Vaikuntha Traveller",
  },
  {
    slug: "sacred-rivers-trail",
    title: "Sacred Rivers Trail",
    emoji: "🌊",
    templeIds: ["varanasi", "haridwar", "prayagraj", "rameswaram"],
    completionBonus: 200,
    badgeId: "river-pilgrim",
    badgeName: "River Pilgrim",
  },
  {
    slug: "moksha-cities-trail",
    title: "Moksha Cities Trail",
    emoji: "✨",
    templeIds: ["ayodhya", "mathura", "haridwar", "varanasi", "ujjain", "dwarka", "kanchipuram"],
    completionBonus: 500,
    badgeId: "moksha-pathfinder-trail",
    badgeName: "Moksha Pathfinder",
  },
  {
    slug: "divine-south-trail",
    title: "Divine South Trail",
    emoji: "🛕",
    templeIds: ["tirupati", "meenakshi", "rameswaram", "sri-rangam", "guruvayur"],
    completionBonus: 250,
    badgeId: "dakshin-yatri",
    badgeName: "Dakshin Yatri",
  },
  {
    slug: "himalayan-awakening-trail",
    title: "Himalayan Awakening Trail",
    emoji: "🏔",
    templeIds: ["kedarnath", "badrinath", "kailash-mansarovar"],
    completionBonus: 400,
    badgeId: "himalayan-sage",
    badgeName: "Himalayan Sage",
  },
  {
    slug: "temple-architecture-trail",
    title: "Temple Architecture Trail",
    emoji: "🏛",
    templeIds: ["konark", "meenakshi", "sri-rangam", "akshardham"],
    completionBonus: 200,
    badgeId: "heritage-guardian",
    badgeName: "Heritage Guardian",
  },
  {
    slug: "bharat-explorer-trail",
    title: "Bharat Explorer Trail",
    emoji: "🇮🇳",
    type: "region",
    regions: ["north", "south", "east", "west"],
    completionBonus: 150,
    badgeId: "sacred-bharat-explorer",
    badgeName: "Sacred Bharat Explorer",
  },
];

export const TRAIL_BY_SLUG = Object.fromEntries(TRAILS.map((t) => [t.slug, t]));

export function getTrailBySlug(slug) {
  return TRAIL_BY_SLUG[slug] ?? null;
}

export function getAllTrailSlugs() {
  return TRAILS.map((t) => t.slug);
}

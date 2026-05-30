/** Server-side scoring mirror of src/lib/sacredBharat/scoring.js */

const POINTS_PER_TEMPLE = 25;

const REGIONS = ["north", "south", "east", "west"] as const;

const TEMPLE_REGIONS: Record<string, string> = {
  "kashi-vishwanath": "north",
  kedarnath: "north",
  somnath: "west",
  mahakaleshwar: "west",
  ramanathaswamy: "south",
  badrinath: "north",
  dwarka: "west",
  jagannath: "east",
  rameswaram: "south",
  ayodhya: "north",
  chitrakoot: "north",
  "nashik-panchavati": "west",
  "banke-bihari": "north",
  "prem-mandir": "north",
  "vaishno-devi": "north",
  kamakhya: "east",
  meenakshi: "south",
  dakshineswar: "east",
  tirupati: "south",
  "sri-rangam": "south",
  varanasi: "north",
  haridwar: "north",
  prayagraj: "north",
  mathura: "north",
  ujjain: "west",
  kanchipuram: "south",
  guruvayur: "south",
  "kailash-mansarovar": "north",
  konark: "east",
  akshardham: "north",
};

const VALID_TEMPLE_IDS = new Set(Object.keys(TEMPLE_REGIONS));

type TrailDef =
  | { slug: string; templeIds: string[]; completionBonus: number; type?: undefined }
  | { slug: string; type: "region"; completionBonus: number };

const TRAILS: TrailDef[] = [
  {
    slug: "shiva-trail",
    templeIds: ["kashi-vishwanath", "kedarnath", "somnath", "mahakaleshwar", "ramanathaswamy"],
    completionBonus: 200,
  },
  {
    slug: "char-dham-trail",
    templeIds: ["badrinath", "dwarka", "jagannath", "rameswaram"],
    completionBonus: 500,
  },
  {
    slug: "ramayana-trail",
    templeIds: ["ayodhya", "chitrakoot", "nashik-panchavati", "rameswaram"],
    completionBonus: 300,
  },
  {
    slug: "krishna-trail",
    templeIds: ["banke-bihari", "prem-mandir", "dwarka"],
    completionBonus: 200,
  },
  {
    slug: "shakti-trail",
    templeIds: ["vaishno-devi", "kamakhya", "meenakshi", "dakshineswar"],
    completionBonus: 300,
  },
  {
    slug: "vishnu-trail",
    templeIds: ["tirupati", "badrinath", "jagannath", "sri-rangam"],
    completionBonus: 250,
  },
  {
    slug: "sacred-rivers-trail",
    templeIds: ["varanasi", "haridwar", "prayagraj", "rameswaram"],
    completionBonus: 200,
  },
  {
    slug: "moksha-cities-trail",
    templeIds: ["ayodhya", "mathura", "haridwar", "varanasi", "ujjain", "dwarka", "kanchipuram"],
    completionBonus: 500,
  },
  {
    slug: "divine-south-trail",
    templeIds: ["tirupati", "meenakshi", "rameswaram", "sri-rangam", "guruvayur"],
    completionBonus: 250,
  },
  {
    slug: "himalayan-awakening-trail",
    templeIds: ["kedarnath", "badrinath", "kailash-mansarovar"],
    completionBonus: 400,
  },
  {
    slug: "temple-architecture-trail",
    templeIds: ["konark", "meenakshi", "sri-rangam", "akshardham"],
    completionBonus: 200,
  },
  { slug: "bharat-explorer-trail", type: "region", completionBonus: 150 },
];

const LEVELS = [
  { minScore: 0, maxScore: 250, title: "Seeker", slug: "seeker" },
  { minScore: 251, maxScore: 500, title: "Pilgrim", slug: "pilgrim" },
  { minScore: 501, maxScore: 1000, title: "Yatri", slug: "yatri" },
  { minScore: 1001, maxScore: 1500, title: "Dharma Explorer", slug: "dharma-explorer" },
  {
    minScore: 1501,
    maxScore: 2000,
    title: "Sacred Bharat Ambassador",
    slug: "sacred-bharat-ambassador",
  },
  {
    minScore: 2001,
    maxScore: null as number | null,
    title: "Moksha Pathfinder",
    slug: "moksha-pathfinder",
  },
];

export function normalizeVisitedSet(templeIds: string[]): Set<string> {
  return new Set(templeIds.filter((id) => VALID_TEMPLE_IDS.has(id)));
}

function isBharatExplorerComplete(visitedSet: Set<string>): boolean {
  return REGIONS.every((region) => [...visitedSet].some((id) => TEMPLE_REGIONS[id] === region));
}

function isTrailComplete(trail: TrailDef, visitedSet: Set<string>): boolean {
  if (trail.type === "region") {
    return isBharatExplorerComplete(visitedSet);
  }
  return trail.templeIds.every((id) => visitedSet.has(id));
}

export function computeScore(templeIds: string[]): number {
  const visitedSet = normalizeVisitedSet(templeIds);
  let score = visitedSet.size * POINTS_PER_TEMPLE;
  for (const trail of TRAILS) {
    if (isTrailComplete(trail, visitedSet)) {
      score += trail.completionBonus;
    }
  }
  return score;
}

export function getLevelForScore(score: number) {
  return (
    LEVELS.find(
      (level) => score >= level.minScore && (level.maxScore === null || score <= level.maxScore),
    ) ?? LEVELS[0]
  );
}

export function computeProgressSummary(templeIds: string[]) {
  const visitedSet = normalizeVisitedSet(templeIds);
  const score = computeScore([...visitedSet]);
  const level = getLevelForScore(score);
  let completedTrailCount = 0;
  for (const trail of TRAILS) {
    if (isTrailComplete(trail, visitedSet)) {
      completedTrailCount += 1;
    }
  }
  return {
    templeCount: visitedSet.size,
    score,
    levelTitle: level.title,
    levelSlug: level.slug,
    completedTrailCount,
    totalTrails: TRAILS.length,
  };
}

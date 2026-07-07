/** Server-side scoring mirror of src/lib/sacredBharat/scoring.js */

const POINTS_PER_TEMPLE = 25;

const REGIONS = ["north", "south", "east", "west"] as const;

const TEMPLE_REGIONS: Record<string, string> = {
  akshardham: "north",
  ayodhya: "north",
  badrinath: "north",
  "banke-bihari": "north",
  chitrakoot: "north",
  dakshineswar: "east",
  dwarka: "west",
  guruvayur: "south",
  haridwar: "north",
  jagannath: "east",
  "kailash-mansarovar": "north",
  kamakhya: "east",
  kanchipuram: "south",
  "kashi-vishwanath": "north",
  kedarnath: "north",
  konark: "east",
  mahakaleshwar: "west",
  mathura: "north",
  meenakshi: "south",
  "nashik-panchavati": "west",
  prayagraj: "north",
  "prem-mandir": "north",
  ramanathaswamy: "south",
  rameswaram: "south",
  somnath: "west",
  "sri-rangam": "south",
  tirupati: "south",
  ujjain: "west",
  "vaishno-devi": "north",
  varanasi: "north",
};

const VALID_TEMPLE_IDS = new Set(Object.keys(TEMPLE_REGIONS));

type TrailDef =
  | { slug: string; templeIds: string[]; completionBonus: number; type?: undefined }
  | { slug: string; type: "region"; completionBonus: number };

const TRAILS: TrailDef[] = [
  {
    completionBonus: 200,
    slug: "shiva-trail",
    templeIds: ["kashi-vishwanath", "kedarnath", "somnath", "mahakaleshwar", "ramanathaswamy"],
  },
  {
    completionBonus: 500,
    slug: "char-dham-trail",
    templeIds: ["badrinath", "dwarka", "jagannath", "rameswaram"],
  },
  {
    completionBonus: 300,
    slug: "ramayana-trail",
    templeIds: ["ayodhya", "chitrakoot", "nashik-panchavati", "rameswaram"],
  },
  {
    completionBonus: 200,
    slug: "krishna-trail",
    templeIds: ["banke-bihari", "prem-mandir", "dwarka"],
  },
  {
    completionBonus: 300,
    slug: "shakti-trail",
    templeIds: ["vaishno-devi", "kamakhya", "meenakshi", "dakshineswar"],
  },
  {
    completionBonus: 250,
    slug: "vishnu-trail",
    templeIds: ["tirupati", "badrinath", "jagannath", "sri-rangam"],
  },
  {
    completionBonus: 200,
    slug: "sacred-rivers-trail",
    templeIds: ["varanasi", "haridwar", "prayagraj", "rameswaram"],
  },
  {
    completionBonus: 500,
    slug: "moksha-cities-trail",
    templeIds: ["ayodhya", "mathura", "haridwar", "varanasi", "ujjain", "dwarka", "kanchipuram"],
  },
  {
    completionBonus: 250,
    slug: "divine-south-trail",
    templeIds: ["tirupati", "meenakshi", "rameswaram", "sri-rangam", "guruvayur"],
  },
  {
    completionBonus: 400,
    slug: "himalayan-awakening-trail",
    templeIds: ["kedarnath", "badrinath", "kailash-mansarovar"],
  },
  {
    completionBonus: 200,
    slug: "temple-architecture-trail",
    templeIds: ["konark", "meenakshi", "sri-rangam", "akshardham"],
  },
  { completionBonus: 150, slug: "bharat-explorer-trail", type: "region" },
];

const LEVELS = [
  { maxScore: 250, minScore: 0, slug: "seeker", title: "Seeker" },
  { maxScore: 500, minScore: 251, slug: "pilgrim", title: "Pilgrim" },
  { maxScore: 1000, minScore: 501, slug: "yatri", title: "Yatri" },
  { maxScore: 1500, minScore: 1001, slug: "dharma-explorer", title: "Dharma Explorer" },
  {
    maxScore: 2000,
    minScore: 1501,
    slug: "sacred-bharat-ambassador",
    title: "Sacred Bharat Ambassador",
  },
  {
    maxScore: null as number | null,
    minScore: 2001,
    slug: "moksha-pathfinder",
    title: "Moksha Pathfinder",
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
      (level) => score >= level.minScore && (level.maxScore === null || score <= level.maxScore)
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
    completedTrailCount,
    levelSlug: level.slug,
    levelTitle: level.title,
    score,
    templeCount: visitedSet.size,
    totalTrails: TRAILS.length,
  };
}

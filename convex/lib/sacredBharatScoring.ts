/** Server-side scoring mirror of src/lib/sacredBharat/scoring.js */

import { resolveCanonicalTempleId } from "./sacredBharatAliases";

const TEMPLE_POINTS: Record<string, number> = {
  akshardham: 76,
  ayodhya: 95,
  badrinath: 95,
  "banke-bihari": 84,
  chitrakoot: 80,
  dakshineswar: 80,
  dwarka: 91,
  guruvayur: 79,
  haridwar: 85,
  jagannath: 94,
  "kailash-mansarovar": 100,
  kamakhya: 88,
  kanchipuram: 82,
  "kashi-vishwanath": 98,
  kedarnath: 97,
  konark: 78,
  mahakaleshwar: 90,
  mathura: 81,
  meenakshi: 86,
  "nashik-panchavati": 77,
  prayagraj: 83,
  "prem-mandir": 75,
  ramanathaswamy: 92,
  siddhivinayak: 82,
  somnath: 89,
  "sri-rangam": 87,
  tirupati: 100,
  ujjain: 85,
  "vaishno-devi": 93,
};

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
  siddhivinayak: "west",
  somnath: "west",
  "sri-rangam": "south",
  tirupati: "south",
  ujjain: "west",
  "vaishno-devi": "north",
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
    templeIds: ["badrinath", "dwarka", "jagannath", "ramanathaswamy"],
  },
  {
    completionBonus: 300,
    slug: "ramayana-trail",
    templeIds: ["ayodhya", "chitrakoot", "nashik-panchavati", "ramanathaswamy"],
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
    templeIds: ["kashi-vishwanath", "haridwar", "prayagraj", "ramanathaswamy"],
  },
  {
    completionBonus: 500,
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
  },
  {
    completionBonus: 250,
    slug: "divine-south-trail",
    templeIds: ["tirupati", "meenakshi", "ramanathaswamy", "sri-rangam", "guruvayur"],
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

type ChallengeDef = {
  points: number;
  requiredCount?: number;
  slug: string;
  templeIds?: string[];
  trailSlugs?: string[];
};

const CHALLENGES: ChallengeDef[] = [
  {
    points: 150,
    requiredCount: 2,
    slug: "char-dham-prep",
    templeIds: ["badrinath", "dwarka", "jagannath", "ramanathaswamy"],
  },
  {
    points: 250,
    requiredCount: 4,
    slug: "four-jyotirlingas",
    templeIds: ["kashi-vishwanath", "kedarnath", "somnath", "mahakaleshwar", "ramanathaswamy"],
  },
  {
    points: 300,
    requiredCount: 5,
    slug: "shiva-devotee",
    templeIds: ["kashi-vishwanath", "kedarnath", "somnath", "mahakaleshwar", "ramanathaswamy"],
  },
  { points: 200, slug: "sacred-rivers", trailSlugs: ["sacred-rivers-trail"] },
  { points: 250, slug: "south-temple-circuit", trailSlugs: ["divine-south-trail"] },
  { points: 100, requiredCount: 5, slug: "first-five-darshans", templeIds: [] },
  { points: 300, slug: "bharat-explorer-2026", trailSlugs: ["bharat-explorer-trail"] },
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
  const canonical = templeIds.map((id) => resolveCanonicalTempleId(id));
  return new Set(canonical.filter((id) => VALID_TEMPLE_IDS.has(id)));
}

function getTemplePoints(templeId: string): number {
  return TEMPLE_POINTS[templeId] ?? 0;
}

function computeTemplePointsTotal(visitedSet: Set<string>): number {
  let total = 0;
  for (const templeId of visitedSet) {
    total += getTemplePoints(templeId);
  }
  return total;
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

function isChallengeComplete(challenge: ChallengeDef, visitedSet: Set<string>): boolean {
  if (challenge.trailSlugs?.length) {
    return challenge.trailSlugs.every((slug) => {
      const trail = TRAILS.find((item) => item.slug === slug);
      return trail ? isTrailComplete(trail, visitedSet) : false;
    });
  }

  const templeIds = challenge.templeIds ?? [];
  const requiredCount = challenge.requiredCount ?? templeIds.length;
  const visited =
    templeIds.length > 0 ? templeIds.filter((id) => visitedSet.has(id)).length : visitedSet.size;
  return requiredCount > 0 && visited >= requiredCount;
}

function computeChallengeBonus(visitedSet: Set<string>): number {
  let bonus = 0;
  for (const challenge of CHALLENGES) {
    if (isChallengeComplete(challenge, visitedSet)) {
      bonus += challenge.points;
    }
  }
  return bonus;
}

export function computeScore(templeIds: string[]): number {
  const visitedSet = normalizeVisitedSet(templeIds);
  let score = computeTemplePointsTotal(visitedSet);
  for (const trail of TRAILS) {
    if (isTrailComplete(trail, visitedSet)) {
      score += trail.completionBonus;
    }
  }
  score += computeChallengeBonus(visitedSet);
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

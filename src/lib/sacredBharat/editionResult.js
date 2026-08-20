export const SHARE_STYLES = [
  {
    accent: "var(--color-public-orange)",
    background: "var(--color-public-night)",
    foreground: "var(--color-public-paper)",
    id: "archive",
    label: "Midnight archive",
  },
  {
    accent: "var(--color-public-orange)",
    background: "var(--color-sacred-temple)",
    foreground: "var(--color-public-paper)",
    id: "temple-red",
    label: "Temple red",
  },
  {
    accent: "var(--color-public-lime)",
    background: "var(--color-sacred-monsoon)",
    foreground: "var(--color-public-paper)",
    id: "monsoon",
    label: "Monsoon green",
  },
];

const TITLES = [
  "A first glimpse",
  "The curious eye",
  "Detail seeker",
  "Cultural observer",
  "Almost unmissable",
  "Every detail",
];

function formatLocations(locations) {
  if (locations.length === 1) {
    return `${locations[0]} got you this time.`;
  }

  if (locations.length === 2) {
    return `${locations[0]} and ${locations[1]} are waiting for another look.`;
  }

  return `${locations.slice(0, -1).join(", ")}, and ${locations.at(-1)} are waiting for another look.`;
}

export function deriveEditionResult(questions, correctnessById) {
  const correct = questions.filter(({ id }) => correctnessById[id] === true);
  const missed = questions.filter(({ id }) => correctnessById[id] !== true);
  const correctThemes = new Set(correct.map(({ theme }) => theme));
  const northQuestions = questions.filter(({ region }) => region === "north");
  const recognisedNorth = northQuestions.every(({ id }) => correctnessById[id] === true);

  let insight = "You leave with five new details to notice across Sacred Bharat.";
  if (correct.length === questions.length) {
    insight = "You saw the pattern in every corner — river, mountain, gateway, and stone.";
  } else if (correct.length >= 3 && correctThemes.size === 1 && correctThemes.has("architecture")) {
    insight = "Stone and skyline were your strength; the river scene was the curveball.";
  } else if (recognisedNorth) {
    insight = "The north gave you no trouble; the southern and eastern details shaped the result.";
  } else if (
    correct.some(({ id }) => id === "madurai") &&
    correct.some(({ id }) => id === "konark")
  ) {
    insight = "Sculpted gateways and carved stone were familiar ground.";
  } else if (correct.length > 0) {
    insight = `Your eye found ${correct
      .map(({ location }) => location)
      .slice(0, 2)
      .join(" and ")} first.`;
  }

  return {
    detail:
      missed.length === 0
        ? "Five places, five details, all recognised."
        : formatLocations(missed.map(({ location }) => location)),
    insight,
    missedLocations: missed.map(({ location }) => location),
    score: correct.length,
    title: TITLES[correct.length] ?? TITLES[0],
    total: questions.length,
  };
}

export function getShareStyle(index) {
  const normalizedIndex =
    ((index % SHARE_STYLES.length) + SHARE_STYLES.length) % SHARE_STYLES.length;
  return SHARE_STYLES[normalizedIndex];
}

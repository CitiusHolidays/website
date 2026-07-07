/** Score thresholds → pilgrim title */
export const LEVELS = [
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
  { maxScore: null, minScore: 2001, slug: "moksha-pathfinder", title: "Moksha Pathfinder" },
];

export const POINTS_PER_TEMPLE = 25;

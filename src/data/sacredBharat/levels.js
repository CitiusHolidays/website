/** Score thresholds → pilgrim title */
export const LEVELS = [
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
  { minScore: 2001, maxScore: null, title: "Moksha Pathfinder", slug: "moksha-pathfinder" },
];

export const POINTS_PER_TEMPLE = 25;

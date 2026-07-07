export default {
  fields: [
    {
      description:
        "Optional images for the main /pilgrimage grid. Each trail page uses its own “Trail gallery” document.",
      name: "images",
      of: [
        {
          fields: [
            {
              name: "alt",
              title: "Alternative text",
              type: "string",
            },
          ],
          options: { hotspot: true },
          type: "image",
        },
      ],
      options: { layout: "grid" },
      title: "Hub preview images (optional)",
      type: "array",
    },
  ],
  name: "spiritualtrails",
  title: "Spiritual Trails Main",
  type: "document",
};

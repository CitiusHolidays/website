export default {
  fields: [
    {
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
      title: "Images",
      type: "array",
    },
  ],
  name: "gallery",
  title: "Gallery",
  type: "document",
};

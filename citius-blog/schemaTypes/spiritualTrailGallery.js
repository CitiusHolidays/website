const TRAIL_OPTIONS = [
  { title: "Kailash Mansarovar Yatra (14-day)", value: "kailash-mansarovar-14day" },
  { title: "Kailash Aerial Darshan (2N/3D)", value: "kailash-aerial-3day" },
  { title: "Kora — North trail", value: "kora-north-trail" },
  { title: "Kora — East trail", value: "kora-east-trail" },
  { title: "Kora — West trail", value: "kora-west-trail" },
  { title: "Kora — South trail", value: "kora-south-trail" },
  { title: "Sacred festivals", value: "sacred-festivals" },
  { title: "Corporate retreat", value: "corporate-retreat" },
];

export default {
  fields: [
    {
      description:
        "Pick the route this gallery belongs to. Create a separate Trail gallery document for each trail — images do not carry over between pages.",
      name: "trailSlug",
      options: {
        layout: "dropdown",
        list: TRAIL_OPTIONS,
      },
      title: "Trail",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
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
  name: "spiritualTrailGallery",
  preview: {
    prepare({ slug, alt0, media }) {
      const label = TRAIL_OPTIONS.find((o) => o.value === slug)?.title || slug;
      return {
        media,
        subtitle: alt0 || "Gallery",
        title: label,
      };
    },
    select: {
      alt0: "images.0.alt",
      media: "images.0",
      slug: "trailSlug",
    },
  },
  title: "Trail gallery",
  type: "document",
};

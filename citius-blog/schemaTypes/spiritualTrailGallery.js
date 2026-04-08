const TRAIL_OPTIONS = [
  { title: 'Kailash Mansarovar Yatra (14-day)', value: 'kailash-mansarovar-14day' },
  { title: 'Kailash Aerial Darshan (2N/3D)', value: 'kailash-aerial-3day' },
  { title: 'Kora — North trail', value: 'kora-north-trail' },
  { title: 'Kora — East trail', value: 'kora-east-trail' },
  { title: 'Kora — West trail', value: 'kora-west-trail' },
  { title: 'Kora — South trail', value: 'kora-south-trail' },
  { title: 'Sacred festivals', value: 'sacred-festivals' },
  { title: 'Corporate retreat', value: 'corporate-retreat' },
];

export default {
  name: 'spiritualTrailGallery',
  type: 'document',
  title: 'Trail gallery',
  fields: [
    {
      name: 'trailSlug',
      type: 'string',
      title: 'Trail',
      description:
        'Pick the route this gallery belongs to. Create a separate Trail gallery document for each trail — images do not carry over between pages.',
      options: {
        list: TRAIL_OPTIONS,
        layout: 'dropdown',
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'images',
      type: 'array',
      title: 'Images',
      of: [
        {
          type: 'image',
          options: { hotspot: true },
          fields: [
            {
              name: 'alt',
              type: 'string',
              title: 'Alternative text',
            },
          ],
        },
      ],
      options: { layout: 'grid' },
    },
  ],
  preview: {
    select: {
      slug: 'trailSlug',
      alt0: 'images.0.alt',
      media: 'images.0',
    },
    prepare({ slug, alt0, media }) {
      const label = TRAIL_OPTIONS.find((o) => o.value === slug)?.title || slug;
      return {
        title: label,
        subtitle: alt0 || 'Gallery',
        media,
      };
    },
  },
};

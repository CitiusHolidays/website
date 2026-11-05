import {defineField, defineType} from 'sanity'

const TRAIL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export default defineType({
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
    }),
    defineField({
      name: 'slug',
      options: {
        maxLength: 96,
        source: 'title',
      },
      title: 'Slug',
      type: 'slug',
    }),
    defineField({
      name: 'author',
      title: 'Author',
      to: {type: 'author'},
      type: 'reference',
    }),
    defineField({
      description:
        'One or two sentences shown under the title on the Journal and in search results. If empty, the site uses the opening paragraph.',
      name: 'excerpt',
      rows: 3,
      title: 'Excerpt',
      type: 'text',
      validation: (rule) => [
        rule
          .required()
          .warning('Add a short excerpt so the Journal and search results describe this story.'),
        rule.max(220).warning('Keep the excerpt under 220 characters.'),
      ],
    }),
    defineField({
      description:
        'Shown at its own proportions, never cropped on the story page. Set the hotspot on the part that must stay in view for social cards.',
      fields: [
        defineField({
          description:
            'Describe what the picture shows for people who cannot see it. If the image contains text, include that text.',
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
          validation: (rule) =>
            rule
              .custom((value, context) =>
                context.parent?.asset && !value?.trim()
                  ? 'Add alternative text. Without it the site falls back to the story title.'
                  : true,
              )
              .warning(),
        }),
      ],
      name: 'mainImage',
      options: {
        hotspot: true,
      },
      title: 'Main image',
      type: 'image',
    }),
    defineField({
      name: 'categories',
      of: [{to: {type: 'category'}, type: 'reference'}],
      title: 'Categories',
      type: 'array',
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
      validation: (rule) =>
        rule
          .required()
          .warning('Set a publish date. Without it the site shows the date the draft was created.'),
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'blockContent',
    }),
    defineField({
      description:
        'Optional. The slug of a Spiritual Trail this story is about, e.g. kailash-aerial-3day (the part after /pilgrimage/). The story page links to it when the trail is live.',
      name: 'relatedTrail',
      title: 'Related Spiritual Trail',
      type: 'string',
      validation: (rule) =>
        rule
          .regex(TRAIL_SLUG_PATTERN, {name: 'trail slug'})
          .warning('Use the trail slug: lowercase words separated by hyphens.'),
    }),
  ],
  name: 'post',

  preview: {
    prepare(selection) {
      const {author} = selection
      return {...selection, subtitle: author && `by ${author}`}
    },
    select: {
      author: 'author.name',
      media: 'mainImage',
      title: 'title',
    },
  },
  title: 'Post',
  type: 'document',
})

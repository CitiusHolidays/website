import {defineField, defineType} from 'sanity'

export default defineType({
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
    }),
    defineField({
      name: 'slug',
      options: {
        maxLength: 96,
        source: 'name',
      },
      title: 'Slug',
      type: 'slug',
    }),
    defineField({
      description: 'Shown under the name in the byline, e.g. Director.',
      name: 'role',
      title: 'Role',
      type: 'string',
    }),
    defineField({
      name: 'office',
      options: {
        list: [
          {title: 'Mumbai & Thane', value: 'Mumbai & Thane'},
          {title: 'Bengaluru', value: 'Bengaluru'},
          {title: 'Kolkata', value: 'Kolkata'},
        ],
      },
      title: 'Office',
      type: 'string',
    }),
    defineField({
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
        }),
      ],
      name: 'image',
      options: {
        hotspot: true,
      },
      title: 'Image',
      type: 'image',
    }),
    defineField({
      name: 'bio',
      of: [
        {
          lists: [],
          styles: [{title: 'Normal', value: 'normal'}],
          title: 'Block',
          type: 'block',
        },
      ],
      title: 'Bio',
      type: 'array',
    }),
  ],
  name: 'author',
  preview: {
    select: {
      media: 'image',
      subtitle: 'role',
      title: 'name',
    },
  },
  title: 'Author',
  type: 'document',
})

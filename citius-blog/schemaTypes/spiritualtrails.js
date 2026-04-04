export default {
    name: 'spiritualtrails',
    type: 'document',
    title: 'Spiritual Trails Main',
    fields: [
        {
            name: 'images',
            type: 'array',
            title: 'Hub preview images (optional)',
            description:
                'Optional images for the main /pilgrimage grid. Each trail page uses its own “Trail gallery” document.',
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
}
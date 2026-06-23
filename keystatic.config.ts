// keystatic.config.tsx
import { config, fields, singleton, collection } from '@keystatic/core';

export default config({
  storage: { kind: 'github', repo: 'paolominhas/diorama-homepage' },
  
  singletons: {
    home: singleton({
      label: 'Homepage',
      path: 'src/content/pages/home',
      schema: {
        heroHeading: fields.text({ label: 'Headline' }),
        heroSubheading: fields.text({ label: 'Subheading', multiline: true }),
        ctaText: fields.text({ label: 'Button text' }),
      },
    }),
  },

  collections: {
    blog: collection({
      label: 'Blog Posts',
      slugField: 'title', // auto-generates slug from title; you can customize
      path: 'src/content/blog/*/',
      entryLayout: 'content', // rich markdown editor
      schema: {
        title: fields.text({ label: 'Title', validation: { isRequired: true } }),
        description: fields.text({
          label: 'Description',
          description: 'Short excerpt for previews',
          multiline: true,
        }),
        pubDate: fields.date({ label: 'Published', validation: { isRequired: true } }),
        heroImage: fields.url({
          label: 'Featured Image URL',
          description: 'Link to the featured image (use Pexels/Unsplash for free images)',
        }),
        content: fields.mdx({ label: 'Content' }),
      },
    }),
  },
});
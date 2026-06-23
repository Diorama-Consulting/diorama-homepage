// 1. Add 'block' to your imports
import { config, fields, singleton, collection } from '@keystatic/core';
import { block } from '@keystatic/core/content-components';

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
      slugField: 'title',
      path: 'src/content/blog/*/',
      entryLayout: 'content',
      format: { contentField: 'content' },
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
        content: fields.mdx({
          label: 'Content',
          components: {
            // 2. Capitalize Iframe and wrap the object in block()
            Iframe: block({
              label: 'Embed',
              schema: {
                src: fields.text({ label: 'Source URL' }),
                width: fields.text({ label: 'Width' }),
                height: fields.text({ label: 'Height' }),
                title: fields.text({ label: 'Title' }),
              },
            }),
          },
        }),
      },
    }),
  },
});
import { config, fields, singleton, collection } from '@keystatic/core';
import { block } from '@keystatic/core/content-components';

// ---------------------------------------------------------------------------
// Shared field helpers
// ---------------------------------------------------------------------------

// Hero/cover images can either be uploaded into the repo (co-located next to
// the entry, the default Keystatic image-field behaviour) or linked from an
// external URL (e.g. Unsplash/Pexels, while you don't yet have a local
// asset). fields.conditional renders a toggle in the Keystatic UI so editors
// pick one or the other per entry.
//
// Deliberately no `directory`/`publicPath` override here: for collections
// whose path ends in `*/` (blog, projects, charities — one folder per
// entry), Keystatic's default behaviour already stores the image inside
// that entry's own folder, alongside its index.mdx. That's exactly the
// co-location model this site uses, so the default is correct and we don't
// fight it.
const coLocatedImageField = fields.conditional(
  fields.checkbox({
    label: 'Use an external image URL?',
    description: 'Off = upload a local image (recommended, stored next to this entry). On = paste a URL.',
    defaultValue: false,
  }),
  {
    true: fields.url({
      label: 'Image URL',
      description: 'Link to an externally hosted image (e.g. Unsplash/Pexels).',
    }),
    false: fields.image({
      label: 'Image',
    }),
  },
);

const iframeEmbedComponent = {
  Iframe: block({
    label: 'Embed',
    schema: {
      src: fields.text({ label: 'Source URL' }),
      width: fields.text({ label: 'Width', defaultValue: '728' }),
      height: fields.text({ label: 'Height', defaultValue: '409' }),
      title: fields.text({ label: 'Title' }),
    },
  }),
};

export default config({
  storage: { kind: 'github', repo: 'paolominhas/diorama-homepage' },

  singletons: {
    // -------------------------------------------------------------------
    // HOMEPAGE — hero copy plus independent on/off toggles for each
    // standalone widget. Widgets are edited in their own singletons below
    // (homeCxaiWidget, homeCharityWidget) and just toggled visible here —
    // they are standalone content, not teasers pulled from other pages.
    // -------------------------------------------------------------------
    home: singleton({
      label: 'Homepage',
      path: 'src/content/pages/home',
      schema: {
        heroHeading: fields.text({ label: 'Headline' }),
        heroSubheading: fields.text({ label: 'Subheading', multiline: true }),
        ctaText: fields.text({ label: 'Button text' }),
        showCxaiWidget: fields.checkbox({
          label: 'Show CxAI widget',
          defaultValue: true,
        }),
        showCharityWidget: fields.checkbox({
          label: 'Show Charity widget',
          defaultValue: true,
        }),
      },
    }),

    // Standalone homepage widget — edited independently of /services/charities.
    homeCharityWidget: singleton({
      label: 'Homepage Widget — Charities',
      path: 'src/content/pages/home-charity-widget',
      schema: {
        heading: fields.text({ label: 'Heading', defaultValue: 'Supporting UK Charities' }),
        body: fields.text({ label: 'Body copy', multiline: true }),
        ctaText: fields.text({ label: 'Button text', defaultValue: 'Learn more' }),
        ctaHref: fields.text({ label: 'Button link', defaultValue: '/services/charities' }),
      },
    }),

    homeBlogWidget: singleton({
      label: 'Homepage Widget — Blog',
      path: 'src/content/pages/home-blog-widget',
      schema: {
        heading: fields.text({ label: 'Heading', defaultValue: 'From the Blog' }),
        body: fields.text({ label: 'Body copy', multiline: true }),
        ctaText: fields.text({ label: 'Button text', defaultValue: 'Read the blog' }),
        ctaHref: fields.text({ label: 'Button link', defaultValue: '/blog' }),
      },
    }),

    // Standalone homepage widget for CxAI — independent content, not pulled
    // automatically from the CxAI Substack or site.
    homeCxaiWidget: singleton({
      label: 'Homepage Widget — CxAI',
      path: 'src/content/pages/home-cxai-widget',
      schema: {
        heading: fields.text({ label: 'Heading', defaultValue: 'CxAI' }),
        body: fields.text({ label: 'Body copy', multiline: true }),
        ctaText: fields.text({ label: 'Button text', defaultValue: 'Read CxAI' }),
        ctaHref: fields.url({
          label: 'Button link',
          defaultValue: 'https://cxai100.substack.com',
        }),
      },
    }),

    // -------------------------------------------------------------------
    // SERVICES — Consulting is largely fixed marketing copy (cards,
    // pricing, testimonials) so it's modelled as a singleton rather than
    // a collection. Charities is a collection below since it lists
    // multiple organisations.
    // -------------------------------------------------------------------
    servicesConsulting: singleton({
      label: 'Services — Consulting',
      path: 'src/content/pages/services-consulting',
      schema: {
        heading: fields.text({ label: 'Heading', defaultValue: 'Built on decades of experience' }),
        subheading: fields.text({ label: 'Subheading', multiline: true }),
        capabilities: fields.array(
          fields.object({
            title: fields.text({ label: 'Title' }),
            description: fields.text({ label: 'Description', multiline: true }),
          }),
          {
            label: 'Capability cards',
            itemLabel: (props) => props.fields.title.value || 'Capability',
          },
        ),
      },
    }),

    // -------------------------------------------------------------------
    // ABOUT — split into mission (About) and Founder per the new IA.
    // FAQ is a collection below since it's a list of Q&A entries.
    // -------------------------------------------------------------------
    about: singleton({
      label: 'About',
      path: 'src/content/pages/about',
      schema: {
        heading: fields.text({ label: 'Heading', defaultValue: 'We are all in the diorama' }),
        body: fields.mdx({ label: 'Body copy' }),
      },
    }),

    aboutFounder: singleton({
      label: 'About — Founder',
      path: 'src/content/pages/about-founder',
      schema: {
        heading: fields.text({ label: 'Heading', defaultValue: 'Meet the Founder' }),
        // Singletons have no entry slug to nest under, so we give this an
        // explicit directory (the documented pattern for non-collection
        // image fields) rather than relying on the per-entry default.
        portrait: fields.image({
          label: 'Portrait',
          directory: 'src/content/pages/about-founder',
          publicPath: './',
        }),
        paragraphs: fields.array(fields.text({ label: 'Paragraph', multiline: true }), {
          label: 'Bio paragraphs',
          itemLabel: (props) => (props.value || '').slice(0, 60) || 'Paragraph',
        }),
        quote: fields.text({ label: 'Pull quote', multiline: true }),
        quoteAuthor: fields.text({ label: 'Quote author' }),
      },
    }),
  },

  collections: {
    // -------------------------------------------------------------------
    // BLOG — co-located folder-per-post model. Images referenced in MDX
    // body content live in ./images/ alongside each post's index.mdx
    // (uploaded manually for now — see README on content components and
    // body images). heroImage can be either uploaded (co-located, default
    // Keystatic behaviour since this collection's path ends in `*/`) or an
    // external URL.
    // -------------------------------------------------------------------
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
        updatedDate: fields.date({ label: 'Last updated', description: 'Leave blank if never updated.' }),
        heroImage: coLocatedImageField,
        link: fields.url({
          label: 'Original Substack URL',
          description:
            'Only set this if the post originated on Substack — shows a "Originally published on Substack" banner. Leave blank for native posts.',
        }),
        draft: fields.checkbox({ label: 'Draft (hide from site)', defaultValue: false }),
        content: fields.mdx({
          label: 'Content',
          components: iframeEmbedComponent,
        }),
      },
    }),

    // -------------------------------------------------------------------
    // PROJECTS — co-located folder-per-project model, same pattern as blog.
    // -------------------------------------------------------------------
    projects: collection({
      label: 'Projects',
      slugField: 'title',
      path: 'src/content/projects/*/',
      entryLayout: 'content',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({ label: 'Title', validation: { isRequired: true } }),
        summary: fields.text({ label: 'Summary', multiline: true }),
        heroImage: coLocatedImageField,
        status: fields.select({
          label: 'Status',
          options: [
            { label: 'Live', value: 'live' },
            { label: 'In progress', value: 'in-progress' },
            { label: 'Archived', value: 'archived' },
          ],
          defaultValue: 'live',
        }),
        externalUrl: fields.url({ label: 'Live / demo URL' }),
        repoUrl: fields.url({ label: 'Source code URL' }),
        relatedBlogSlug: fields.text({
          label: 'Related blog post slug',
          description: 'Optional — links to a blog write-up without duplicating content.',
        }),
        order: fields.integer({ label: 'Sort order', defaultValue: 0 }),
        draft: fields.checkbox({ label: 'Draft (hide from site)', defaultValue: false }),
        content: fields.mdx({
          label: 'Content',
          components: iframeEmbedComponent,
        }),
      },
    }),

    // -------------------------------------------------------------------
    // FAQ — flat MDX files (no co-located images needed), grouped by
    // category on the /about/faq page.
    // -------------------------------------------------------------------
    faq: collection({
      label: 'FAQ',
      slugField: 'question',
      path: 'src/content/faq/*',
      format: { contentField: 'answer' },
      schema: {
        question: fields.text({ label: 'Question', validation: { isRequired: true } }),
        category: fields.text({
          label: 'Category',
          description: 'Groups entries on the FAQ page, e.g. "Engagement", "Charities".',
          defaultValue: 'General',
        }),
        order: fields.integer({ label: 'Sort order within category', defaultValue: 0 }),
        answer: fields.mdx({ label: 'Answer' }),
      },
    }),

    // -------------------------------------------------------------------
    // CHARITIES — used by /services/charities. The homepage widget is a
    // separate singleton (homeCharityWidget) and is edited independently.
    // -------------------------------------------------------------------
    charities: collection({
      label: 'Charities',
      slugField: 'name',
      path: 'src/content/charities/*/',
      entryLayout: 'content',
      format: { contentField: 'content' },
      schema: {
        name: fields.text({ label: 'Charity name', validation: { isRequired: true } }),
        role: fields.text({ label: 'Role', description: 'e.g. "Trustee"' }),
        summary: fields.text({ label: 'Summary', multiline: true }),
        logo: coLocatedImageField,
        externalUrl: fields.url({ label: 'Charity website' }),
        order: fields.integer({ label: 'Sort order', defaultValue: 0 }),
        content: fields.mdx({ label: 'Details' }),
      },
    }),
  },
});

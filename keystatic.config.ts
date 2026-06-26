import { config, fields, singleton, collection } from '@keystatic/core';
import { block } from '@keystatic/core/content-components';

// ---------------------------------------------------------------------------
// Shared field helpers
// ---------------------------------------------------------------------------

// Hero/cover images: two SEPARATE, plain fields rather than one field
// wrapped in fields.conditional(). This is a deliberate change from an
// earlier design — fields.image() nested inside fields.conditional() does
// NOT reliably inherit the "co-locate next to this entry" default the way
// a genuinely top-level field does, even with an explicit `directory` set.
// In practice it was repeatedly observed writing a path like
// `heroImage/value.webp` (a subfolder named after the FIELD key, containing
// a file named after the CONDITIONAL BRANCH key) instead of co-locating
// next to the entry — confirmed directly against real saved entries, not
// just documentation. A plain top-level fields.image() with no `directory`
// override does NOT have this problem (confirmed working with real
// uploaded files) — so the conditional wrapper has been removed entirely
// for collection-entry image fields. Singletons keep an explicit directory
// where needed since they have no entry slug to anchor to.
//
// Returns an object to SPREAD into a schema — produces two keys:
//   <name>        — fields.image(), optional, local upload, co-located
//   <name>Url     — fields.url(), optional, external URL alternative
// Every consumer must check imageUrl()/imageSrc() in lib/keystatic.ts,
// which now reads this two-field shape rather than a conditional object.
function heroImageFields(name: string, label: string) {
  return {
    [name]: fields.image({
      label: `${label} (local upload)`,
      description: 'Recommended — uploaded into this entry\u2019s own folder.',
    }),
    [`${name}Url`]: fields.url({
      label: `${label} (external URL)`,
      description: 'Alternative to the upload above — only used if no local image is set.',
    }),
  };
}

// Singletons have no entry slug to anchor a co-located image to, so this
// variant takes an explicit directory (same reasoning as the original
// fields.image() default-path docs — only an issue for fields.conditional()
// nesting, never an issue for a plain top-level field like this one).
function heroImageFieldsForSingleton(name: string, label: string, directory: string) {
  return {
    [name]: fields.image({
      label: `${label} (local upload)`,
      directory,
      description: 'Recommended — uploaded into this page\u2019s own folder.',
    }),
    [`${name}Url`]: fields.url({
      label: `${label} (external URL)`,
      description: 'Alternative to the upload above — only used if no local image is set.',
    }),
  };
}

// Every singleton/collection that represents a real page gets this same
// trio of fields so search engines and AI answer engines (GEO) have
// something to work with even when the page-specific copy fields are left
// at their defaults. All three are optional — when left blank, BaseHead.astro
// falls back to the siteSettings singleton's sitewide defaults.
const seoFields = (directory: string) => ({
  seoTitle: fields.text({
    label: 'SEO — Page title override',
    description: 'Shown in browser tabs, search results, and link previews. Leave blank to auto-generate from the heading.',
  }),
  seoDescription: fields.text({
    label: 'SEO — Meta description',
    description: 'Shown in search results and link previews. Aim for 1–2 sentences, ~150 characters.',
    multiline: true,
  }),
  ...heroImageFieldsForSingleton('seoImage', 'SEO — Social share image', directory),
});

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
    // SITE SETTINGS — global defaults used everywhere: fallback SEO copy,
    // Organization JSON-LD (for GEO/AI-answer-engine structured data),
    // site-wide header/footer brand details, and legal/registration info
    // that previously lived hardcoded in Footer.astro.
    // -------------------------------------------------------------------
    siteSettings: singleton({
      label: 'Site Settings',
      path: 'src/content/pages/site-settings',
      schema: {
        siteName: fields.text({ label: 'Site name', defaultValue: 'Diorama Consulting Ltd' }),
        defaultSeoTitle: fields.text({ label: 'Default page title', defaultValue: 'Diorama Consulting' }),
        defaultSeoDescription: fields.text({
          label: 'Default meta description',
          multiline: true,
          defaultValue: 'AI Technology Advisory for Boards, Founders and Investors, with a focus on D2C marketplaces and consumer products.',
        }),
        ...heroImageFieldsForSingleton('defaultSeoImage', 'Default social share image', 'src/content/pages/site-settings'),
        // --- Organization JSON-LD (read by BaseHead.astro on every page) ---
        legalName: fields.text({ label: 'Legal company name', defaultValue: 'Diorama Consulting Ltd' }),
        foundingDate: fields.date({ label: 'Founding date' }),
        founderName: fields.text({ label: 'Founder name', defaultValue: 'Mal Minhas' }),
        registeredAddress: fields.text({
          label: 'Registered office address',
          multiline: true,
          defaultValue: '71-75 Shelton Street, Covent Garden, London, WC2H 9JQ',
        }),
        companyNumber: fields.text({ label: 'Companies House number', defaultValue: '16137029' }),
        vatNumber: fields.text({ label: 'VAT registration number', defaultValue: '483184277' }),
        sameAs: fields.array(fields.url({ label: 'Profile URL' }), {
          label: 'Social / external profile links (sameAs)',
          description: 'LinkedIn, Substack, GitHub, etc. — helps AI answer engines link this entity to its public profiles.',
          itemLabel: (props) => props.value || 'Link',
        }),
      },
    }),

    // -------------------------------------------------------------------
    // HEADER & FOOTER — nav structure, brand text, legal footer line.
    // -------------------------------------------------------------------
    headerNav: singleton({
      label: 'Header & Navigation',
      path: 'src/content/pages/header-nav',
      schema: {
        logoText: fields.text({ label: 'Logo text', defaultValue: 'Diorama' }),
        links: fields.array(
          fields.object({
            label: fields.text({ label: 'Label' }),
            href: fields.text({ label: 'Link' }),
          }),
          {
            label: 'Navigation links',
            itemLabel: (props) => props.fields.label.value || 'Link',
          },
        ),
        ctaText: fields.text({ label: 'Button text', defaultValue: 'Contact' }),
        ctaHref: fields.text({ label: 'Button link', defaultValue: '/contact' }),
      },
    }),

    footerNav: singleton({
      label: 'Footer',
      path: 'src/content/pages/footer-nav',
      schema: {
        brandBlurb: fields.text({
          label: 'Brand blurb',
          multiline: true,
          defaultValue: 'AI Technology Advice led by Mal Minhas with a focus on D2C marketplaces and products.',
        }),
        groups: fields.array(
          fields.object({
            heading: fields.text({ label: 'Group heading' }),
            links: fields.array(
              fields.object({
                label: fields.text({ label: 'Label' }),
                href: fields.text({ label: 'Link' }),
              }),
              { label: 'Links', itemLabel: (props) => props.fields.label.value || 'Link' },
            ),
          }),
          {
            label: 'Footer link groups',
            itemLabel: (props) => props.fields.heading.value || 'Group',
          },
        ),
        legalLine: fields.text({
          label: 'Legal / copyright line',
          description: 'Company registration details — pulls from Site Settings by default; override here only if this footer needs different wording.',
          multiline: true,
        }),
      },
    }),

    // -------------------------------------------------------------------
    // HOMEPAGE
    // -------------------------------------------------------------------
    home: singleton({
      label: 'Homepage',
      path: 'src/content/pages/home',
      schema: {
        ...seoFields('src/content/pages/home'),
        heroEyebrow: fields.text({ label: 'Hero eyebrow', defaultValue: 'Now in beta' }),
        heroHeading: fields.text({ label: 'Hero headline', defaultValue: 'Ideas that make a difference.' }),
        heroSubheading: fields.text({
          label: 'Hero subheading',
          multiline: true,
          defaultValue: 'We help ambitious teams ship AI products that actually work.',
        }),
        heroCtaText: fields.text({ label: 'Hero button text', defaultValue: 'Get started' }),
        heroCtaHref: fields.text({ label: 'Hero button link', defaultValue: '/contact' }),
        ...heroImageFieldsForSingleton('heroImage', 'Hero background image', 'src/content/pages/home'),
        ...heroImageFieldsForSingleton('heroFace', 'Hero portrait (reveal photo)', 'src/content/pages/home'),
        heroFaceAlt: fields.text({ label: 'Hero portrait alt text', defaultValue: 'Portrait of the founder.' }),
        revealHeading: fields.text({ label: 'Reveal headline', defaultValue: 'Unique Industry Experience.' }),
        revealSubheading: fields.text({
          label: 'Reveal subheading',
          multiline: true,
          defaultValue: 'Our team has extensive experience in developing, delivering and evolving AI product software across startups, scale-ups, SMEs and Big Tech. We partner with C-Suite, Boards, Founders and Investors to bridge product strategy, engineering and AI.',
        }),
        exploreEyebrow: fields.text({ label: 'Explore section eyebrow', defaultValue: 'Explore' }),
        exploreHeading: fields.text({ label: 'Explore section heading', defaultValue: 'Where to start' }),
        exploreSubheading: fields.text({
          label: 'Explore section subheading',
          defaultValue: "A quick map of what's on this site.",
        }),
        exploreCards: fields.array(
          fields.object({
            title: fields.text({ label: 'Title' }),
            description: fields.text({ label: 'Description', multiline: true }),
            href: fields.text({ label: 'Link' }),
            linkText: fields.text({ label: 'Link text', defaultValue: 'Learn more' }),
          }),
          {
            label: 'Explore cards',
            itemLabel: (props) => props.fields.title.value || 'Card',
          },
        ),
        widgetsEyebrow: fields.text({ label: 'Widgets section eyebrow', defaultValue: 'From the network' }),
        widgetsHeading: fields.text({ label: 'Widgets section heading', defaultValue: 'More from Diorama' }),
        showCxaiWidget: fields.checkbox({ label: 'Show CxAI widget', defaultValue: true }),
        showCharityWidget: fields.checkbox({ label: 'Show Charity widget', defaultValue: true }),
      },
    }),

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

    homeCxaiWidget: singleton({
      label: 'Homepage Widget — CxAI',
      path: 'src/content/pages/home-cxai-widget',
      schema: {
        heading: fields.text({ label: 'Heading', defaultValue: 'CxAI' }),
        body: fields.text({ label: 'Body copy', multiline: true }),
        ctaText: fields.text({ label: 'Button text', defaultValue: 'Read CxAI' }),
        ctaHref: fields.url({ label: 'Button link', defaultValue: 'https://cxai100.substack.com' }),
      },
    }),

    // -------------------------------------------------------------------
    // SERVICES
    // -------------------------------------------------------------------
    servicesIndex: singleton({
      label: 'Services — Hub',
      path: 'src/content/pages/services-index',
      schema: {
        ...seoFields('src/content/pages/services-index'),
        eyebrow: fields.text({ label: 'Eyebrow', defaultValue: 'What we do' }),
        heading: fields.text({ label: 'Heading', defaultValue: 'Two practices, one disciplined approach' }),
        subheading: fields.text({
          label: 'Subheading',
          multiline: true,
          defaultValue: 'Diorama Consulting brings the same rigour to commercial engagements and charity advisory: clear scope, pragmatic technology choices, and outcomes tied to P&L or mission impact.',
        }),
        tiles: fields.array(
          fields.object({
            eyebrow: fields.text({ label: 'Eyebrow' }),
            title: fields.text({ label: 'Title' }),
            description: fields.text({ label: 'Description', multiline: true }),
            href: fields.text({ label: 'Link' }),
            linkText: fields.text({ label: 'Link text' }),
          }),
          {
            label: 'Service tiles',
            itemLabel: (props) => props.fields.title.value || 'Tile',
          },
        ),
      },
    }),

    // Pricing intentionally removed — see README "Pricing removed" note.
    servicesConsulting: singleton({
      label: 'Services — Consulting',
      path: 'src/content/pages/services-consulting',
      schema: {
        ...seoFields('src/content/pages/services-consulting'),
        eyebrow: fields.text({ label: 'Eyebrow', defaultValue: 'Consulting' }),
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
        testimonialsEyebrow: fields.text({ label: 'Testimonials eyebrow', defaultValue: 'Testimonials' }),
        testimonialsHeading: fields.text({ label: 'Testimonials heading', defaultValue: 'What people say' }),
        testimonials: fields.array(
          fields.object({
            quote: fields.text({ label: 'Quote', multiline: true }),
            name: fields.text({ label: 'Name' }),
            role: fields.text({ label: 'Role' }),
          }),
          {
            label: 'Testimonials',
            description: 'Leave empty to hide this section entirely until you have real client quotes.',
            itemLabel: (props) => props.fields.name.value || 'Testimonial',
          },
        ),
      },
    }),

    servicesCharities: singleton({
      label: 'Services — Charities',
      path: 'src/content/pages/services-charities',
      schema: {
        ...seoFields('src/content/pages/services-charities'),
        eyebrow: fields.text({ label: 'Eyebrow', defaultValue: 'For UK Charities' }),
        heading: fields.text({ label: 'Heading', defaultValue: 'Technology support for mission-led organisations' }),
        subheading: fields.text({
          label: 'Subheading',
          multiline: true,
          defaultValue: 'Alongside commercial advisory, Diorama supports the charity sector directly through Trustee roles — bringing the same pragmatic, P&L-literate approach to mission impact instead of margin.',
        }),
      },
    }),

    // -------------------------------------------------------------------
    // PROJECTS — page intro copy. The project entries themselves are the
    // `projects` collection below.
    // -------------------------------------------------------------------
    projectsIndex: singleton({
      label: 'Projects — Page',
      path: 'src/content/pages/projects-index',
      schema: {
        ...seoFields('src/content/pages/projects-index'),
        eyebrow: fields.text({ label: 'Eyebrow', defaultValue: 'Building' }),
        heading: fields.text({ label: 'Heading', defaultValue: 'Projects' }),
        subheading: fields.text({
          label: 'Subheading',
          multiline: true,
          defaultValue: "Fun and useful side projects built with AI coding tools. Each one started as an itch to scratch — here's what came out of it.",
        }),
      },
    }),

    // -------------------------------------------------------------------
    // TEACHING
    // -------------------------------------------------------------------
    teachingPage: singleton({
      label: 'Teaching — Page',
      path: 'src/content/pages/teaching',
      schema: {
        ...seoFields('src/content/pages/teaching'),
        eyebrow: fields.text({ label: 'Eyebrow', defaultValue: 'Executive AI coaching' }),
        heading: fields.text({ label: 'Heading', defaultValue: 'Teaching' }),
        subheading: fields.text({
          label: 'Subheading',
          multiline: true,
          defaultValue: 'A collection of teaching content built to support the practical demystification of AI, quantum computing, and search — developed for executive coaching engagements and shared here for anyone curious.',
        }),
        tools: fields.array(
          fields.object({
            title: fields.text({ label: 'Title' }),
            description: fields.text({ label: 'Description', multiline: true }),
            href: fields.url({ label: 'Tool URL' }),
          }),
          {
            label: 'Teaching tools',
            itemLabel: (props) => props.fields.title.value || 'Tool',
          },
        ),
        blogTeaserHeading: fields.text({ label: 'Blog teaser heading', defaultValue: 'From the blog' }),
      },
    }),

    // -------------------------------------------------------------------
    // ABOUT — split into mission (About), Founder, and FAQ (collection).
    // -------------------------------------------------------------------
    about: singleton({
      label: 'About',
      path: 'src/content/pages/about',
      schema: {
        ...seoFields('src/content/pages/about'),
        eyebrow: fields.text({ label: 'Eyebrow', defaultValue: 'About us' }),
        heading: fields.text({ label: 'Heading', defaultValue: 'We are all in the diorama' }),
        subheading: fields.text({ label: 'Subheading', multiline: true }),
        bodyParagraphs: fields.array(fields.text({ label: 'Paragraph', multiline: true }), {
          label: 'Body paragraphs',
          itemLabel: (props) => (props.value || '').slice(0, 60) || 'Paragraph',
        }),
        founderLinkTitle: fields.text({ label: '"The Founder" link title', defaultValue: 'The Founder' }),
        founderLinkDescription: fields.text({
          label: '"The Founder" link description',
          defaultValue: 'The story behind Diorama and the person leading it.',
        }),
        faqLinkTitle: fields.text({ label: '"FAQ" link title', defaultValue: 'FAQ' }),
        faqLinkDescription: fields.text({
          label: '"FAQ" link description',
          defaultValue: 'How we engage with clients and what to expect.',
        }),
      },
    }),

    aboutFounder: singleton({
      label: 'About — Founder',
      path: 'src/content/pages/about-founder',
      schema: {
        ...seoFields('src/content/pages/about-founder'),
        heading: fields.text({ label: 'Heading', defaultValue: 'Meet the Founder' }),
        ...heroImageFieldsForSingleton('portrait', 'Portrait', 'src/content/pages/about-founder'),
        paragraphs: fields.array(fields.text({ label: 'Paragraph', multiline: true }), {
          label: 'Bio paragraphs',
          itemLabel: (props) => (props.value || '').slice(0, 60) || 'Paragraph',
        }),
        quote: fields.text({ label: 'Pull quote', multiline: true }),
        quoteAuthor: fields.text({ label: 'Quote author' }),
        teamHeading: fields.text({ label: 'Team section heading', defaultValue: 'A small team, for complete control' }),
        team: fields.array(
          fields.object({
            name: fields.text({ label: 'Name' }),
            role: fields.text({ label: 'Role' }),
            bio: fields.text({ label: 'Bio', multiline: true }),
            socials: fields.array(
              fields.object({
                label: fields.text({ label: 'Platform' }),
                href: fields.url({ label: 'URL' }),
              }),
              { label: 'Social links', itemLabel: (props) => props.fields.label.value || 'Link' },
            ),
          }),
          {
            label: 'Team members',
            itemLabel: (props) => props.fields.name.value || 'Member',
          },
        ),
      },
    }),

    // -------------------------------------------------------------------
    // CONTACT
    // -------------------------------------------------------------------
    contactPage: singleton({
      label: 'Contact — Page',
      path: 'src/content/pages/contact',
      schema: {
        ...seoFields('src/content/pages/contact'),
        eyebrow: fields.text({ label: 'Eyebrow', defaultValue: 'Contact' }),
        heading: fields.text({ label: 'Heading', defaultValue: 'Tell us about your project' }),
        subheading: fields.text({
          label: 'Subheading',
          defaultValue: 'Talk to us directly and find the solution you need.',
        }),
      },
    }),
  },

  collections: {
    // -------------------------------------------------------------------
    // BLOG
    // -------------------------------------------------------------------
    blog: collection({
      label: 'Blog Posts',
      slugField: 'title',
      path: 'src/content/blog/*/',
      entryLayout: 'content',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title', validation: { isRequired: true } } }),
        description: fields.text({
          label: 'Description',
          description: 'Short excerpt for previews',
          multiline: true,
        }),
        pubDate: fields.date({ label: 'Published', validation: { isRequired: true } }),
        updatedDate: fields.date({ label: 'Last updated', description: 'Leave blank if never updated.' }),
        ...heroImageFields('heroImage', 'Hero image'),
        link: fields.url({
          label: 'Original Substack URL',
          description: 'Only set this if the post originated on Substack. Leave blank for native posts.',
        }),
        draft: fields.checkbox({ label: 'Draft (hide from site)', defaultValue: false }),
        // --- SEO/GEO overrides — fall back to title/description above when blank ---
        seoTitle: fields.text({ label: 'SEO — Page title override' }),
        seoDescription: fields.text({ label: 'SEO — Meta description override', multiline: true }),
        content: fields.mdx({
          label: 'Content',
          components: iframeEmbedComponent,
        }),
      },
    }),

    // -------------------------------------------------------------------
    // PROJECTS
    // -------------------------------------------------------------------
    projects: collection({
      label: 'Projects',
      slugField: 'title',
      path: 'src/content/projects/*/',
      entryLayout: 'content',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title', validation: { isRequired: true } } }),
        summary: fields.text({ label: 'Summary', multiline: true }),
        ...heroImageFields('heroImage', 'Hero image'),
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
        relatedBlogSlug: fields.text({ label: 'Related blog post slug' }),
        order: fields.integer({ label: 'Sort order', defaultValue: 0 }),
        draft: fields.checkbox({ label: 'Draft (hide from site)', defaultValue: false }),
        seoTitle: fields.text({ label: 'SEO — Page title override' }),
        seoDescription: fields.text({ label: 'SEO — Meta description override', multiline: true }),
        content: fields.mdx({
          label: 'Content',
          components: iframeEmbedComponent,
        }),
      },
    }),

    // -------------------------------------------------------------------
    // FAQ
    // -------------------------------------------------------------------
    faq: collection({
      label: 'FAQ',
      slugField: 'question',
      path: 'src/content/faq/*',
      format: { contentField: 'answer' },
      schema: {
        question: fields.slug({ name: { label: 'Question', validation: { isRequired: true } } }),
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
    // CHARITIES
    // -------------------------------------------------------------------
    charities: collection({
      label: 'Charities',
      slugField: 'name',
      path: 'src/content/charities/*/',
      entryLayout: 'content',
      format: { contentField: 'content' },
      schema: {
        name: fields.slug({ name: { label: 'Charity name', validation: { isRequired: true } } }),
        role: fields.text({ label: 'Role', description: 'e.g. "Trustee"' }),
        summary: fields.text({ label: 'Summary', multiline: true }),
        ...heroImageFields('logo', 'Logo'),
        externalUrl: fields.url({ label: 'Charity website' }),
        order: fields.integer({ label: 'Sort order', defaultValue: 0 }),
        content: fields.mdx({ label: 'Details' }),
      },
    }),
  },
});

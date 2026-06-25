// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Keystatic's fields.conditional() always stores its value as
// { discriminant: boolean, value: ... } — discriminant: true means an
// external URL was used, discriminant: false means a local upload. Every
// image/logo field below must use this exact shape, not a plain string —
// see src/lib/keystatic.ts for the corresponding unwrap helpers used by
// every page that renders one of these fields.
//
// Both branches' `value` are nullable AND optional: depending on exactly
// how the field was left unset, Keystatic has been observed writing any of
// the following for "nothing uploaded/typed yet":
//   { discriminant: false, value: null }   — value present but null
//   { discriminant: false }                — value key absent entirely
// Every consumer (see imageUrl/imageSrc in lib/keystatic.ts) already treats
// a null OR missing value the same as a missing field — `field.value == null`
// is true for both `null` and `undefined` in JS, so the runtime logic does
// not need to special-case which of these shapes shows up.
function conditionalImage(imageSchema: z.ZodType) {
  return z
    .union([
      z.object({ discriminant: z.literal(true), value: z.string().url().nullable().optional() }),
      z.object({ discriminant: z.literal(false), value: imageSchema.nullable().optional() }),
    ])
    .optional();
}

// ---------------------------------------------------------------------------
// BLOG  (src/content/blog/<slug>/index.mdx + co-located images)
// ---------------------------------------------------------------------------
const blog = defineCollection({
  loader: glob({ pattern: '*/index.mdx', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: conditionalImage(image()),
      // Optional provenance link if a post originated on Substack — purely
      // informational, only renders the "Originally published on Substack"
      // banner in BlogPost.astro when present. Omit entirely for native posts.
      link: z.string().url().optional(),
      draft: z.boolean().default(false),
      // SEO overrides — fall back to title/description when blank.
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
    }),
});

// ---------------------------------------------------------------------------
// PROJECTS  (src/content/projects/<slug>/index.mdx + co-located images)
// ---------------------------------------------------------------------------
const projects = defineCollection({
  loader: glob({ pattern: '*/index.mdx', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      heroImage: conditionalImage(image()),
      status: z.enum(['live', 'in-progress', 'archived']).default('live'),
      externalUrl: z.string().url().optional(),
      repoUrl: z.string().url().optional(),
      // Lets a project page cross-reference an educational write-up
      // without duplicating content into two collections.
      relatedBlogSlug: z.string().optional(),
      order: z.number().default(0),
      draft: z.boolean().default(false),
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
    }),
});

// ---------------------------------------------------------------------------
// FAQ  (src/content/faq/<slug>.mdx) — flat files, no images needed
// ---------------------------------------------------------------------------
const faq = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/faq' }),
  schema: z.object({
    question: z.string(),
    order: z.number().default(0),
    // Groups FAQ entries on the page, e.g. "Engagement", "Pricing", "Charities"
    category: z.string().default('General'),
  }),
});

// ---------------------------------------------------------------------------
// CHARITIES  (src/content/charities/<slug>/index.mdx + co-located images)
// Used by both /services/charities and the standalone homepage widget.
// ---------------------------------------------------------------------------
const charities = defineCollection({
  loader: glob({ pattern: '*/index.mdx', base: './src/content/charities' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      role: z.string(), // e.g. "Trustee"
      summary: z.string(),
      logo: conditionalImage(image()),
      externalUrl: z.string().url().optional(),
      order: z.number().default(0),
    }),
});

export const collections = { blog, projects, faq, charities };

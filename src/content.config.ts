// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

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
      // Local, co-located image (./cover.jpg next to index.mdx) — optimised by Astro.
      // Falls back to a remote URL string if you paste an external link instead.
      heroImage: z.union([image(), z.string().url()]).optional(),
      // Optional provenance link if a post originated on Substack — purely
      // informational, only renders the "Originally published on Substack"
      // banner in BlogPost.astro when present. Omit entirely for native posts.
      link: z.string().url().optional(),
      draft: z.boolean().default(false),
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
      heroImage: z.union([image(), z.string().url()]).optional(),
      status: z.enum(['live', 'in-progress', 'archived']).default('live'),
      externalUrl: z.string().url().optional(),
      repoUrl: z.string().url().optional(),
      // Lets a project page cross-reference an educational write-up
      // without duplicating content into two collections.
      relatedBlogSlug: z.string().optional(),
      order: z.number().default(0),
      draft: z.boolean().default(false),
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
      logo: z.union([image(), z.string().url()]).optional(),
      externalUrl: z.string().url().optional(),
      order: z.number().default(0),
    }),
});

export const collections = { blog, projects, faq, charities };

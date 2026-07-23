// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Keystatic appears to write an empty string '' for an optional fields.url()
// left blank on a new entry (observed directly: `link: Invalid URL` on a
// freshly created post with no link set) — z.string().url() correctly
// rejects '' since it isn't a valid URL, even though the field is meant to
// be optional. This coerces '' to undefined before validating, so "blank"
// is treated as "not set" rather than as an invalid value, while a genuine
// non-empty string still has to be a real URL.
const optionalUrl = z
  .string()
  .optional()
  .transform((val) => (val === '' ? undefined : val))
  .pipe(z.string().url().optional());

// ---------------------------------------------------------------------------
// IMAGE FIELDS: two separate flat fields, not one fields.conditional().
//
// An earlier design used a single field storing
// { discriminant: boolean, value: ... } via Keystatic's fields.conditional().
// That was repeatedly observed writing a broken path — a subfolder named
// after the FIELD key containing a file named after the CONDITIONAL BRANCH
// key (e.g. `heroImage/value.webp`) — instead of co-locating the file next
// to the entry, even with an explicit `directory` set. This happened
// consistently for fields.image() nested inside fields.conditional(),
// confirmed directly against real saved Keystatic entries.
//
// A plain, non-nested fields.image() does NOT have this problem (confirmed
// working with real uploaded files placed directly beside index.mdx).
// keystatic.config.ts now defines two independent fields per image —
// `<name>` (local upload) and `<name>Url` (external URL alternative) —
// and this schema mirrors that shape exactly. See lib/keystatic.ts's
// resolveImage() helper for how pages read whichever one is actually set.
function imageFields(name: string, imageSchema: z.ZodType) {
  return {
    [name]: imageSchema.optional(),
    [`${name}Url`]: optionalUrl,
  };
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
      ...imageFields('heroImage', image()),
      // Optional provenance link if a post originated on Substack — purely
      // informational, only renders the "Originally published on Substack"
      // banner in BlogPost.astro when present. Omit entirely for native posts.
      link: optionalUrl,
      draft: z.boolean().default(false),
      // SEO overrides — fall back to title/description when blank.
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
    }),
});

// ---------------------------------------------------------------------------
// PROJECTS / TOOLS  (src/content/projects/<slug>/index.mdx + co-located images)
// The collection keeps its internal name `projects` (see the note in
// src/pages/tools/index.astro for why renames were skipped) but its schema
// now describes the /tools rack: category, accent, monogram, tagline,
// featured flag, tech stack and feature highlights. Every added field is
// optional or defaulted, so pre-existing entries stay valid untouched.
// ---------------------------------------------------------------------------

// Like optionalUrl, but also accepts site-relative paths ("/invoice-forge")
// — the normal case now that the tools are served from this same domain.
const optionalLink = z
  .string()
  .optional()
  .transform((val) => (val === '' ? undefined : val))
  .pipe(
    z
      .string()
      .regex(/^\/[^\s]*$|^https?:\/\/[^\s]+$/, {
        message: 'Must be a site-relative path starting with / or a full http(s):// URL',
      })
      .optional(),
  );

const projects = defineCollection({
  loader: glob({ pattern: '*/index.mdx', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      tagline: z.string().optional(),
      summary: z.string(),
      category: z.enum(['application', 'learning']).default('application'),
      accent: z.enum(['green', 'leaf', 'amber', 'sky', 'sand', 'rose']).default('green'),
      monogram: z.string().optional(),
      featured: z.boolean().default(false),
      ...imageFields('heroImage', image()),
      status: z.enum(['live', 'in-progress', 'archived']).default('live'),
      externalUrl: optionalLink,
      repoUrl: optionalUrl,
      techStack: z.array(z.string()).default([]),
      features: z
        .array(z.object({ title: z.string(), description: z.string().optional() }))
        .default([]),
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
      ...imageFields('logo', image()),
      ...imageFields('heroImage', image()),
      mission: z.string().optional(),
      focusAreas: z.array(z.string()).default([]),
      stats: z
        .array(
          z.object({
            value: z.number(),
            suffix: z.string().optional(), // e.g. "%", "k", "+"
            label: z.string(),
          }),
        )
        .default([]),
      externalUrl: optionalUrl,
      order: z.number().default(0),
    }),
});

// ---------------------------------------------------------------------------
// EVENTS  (src/content/events/<slug>/index.mdx + co-located images)
// Used by the homepage "Upcoming Events" section, and selectable (like blog
// posts) as a hero-carousel slide source.
// ---------------------------------------------------------------------------
const events = defineCollection({
  loader: glob({ pattern: '*/index.mdx', base: './src/content/events' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      location: z.string().optional(),
      description: z.string().optional(),
      ...imageFields('heroImage', image()),
      href: optionalUrl, // registration page, write-up, etc.
      linkText: z.string().optional(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { blog, projects, charities, events };

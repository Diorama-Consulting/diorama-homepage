# Diorama Consulting — Website

The Astro-based marketing site for Diorama Consulting Ltd, content-managed
through [Keystatic](https://keystatic.com).

---

## Site structure

Five top-level sections, plus a homepage that links into all of them:

```
/                       Homepage — hero, a 3-card jump-off to the main sections,
                        and two standalone widgets (Charities, CxAI)

/services               Services hub
/services/consulting    Fractional CTO/CPTO leadership, AI strategy, pricing
/services/charities     Charity Trustee work (Helpforce, Aston-Mansfield)

/projects                "Building" / "Tooling" content — general-purpose
/projects/<slug>         side projects (Music Map, Invoice Forge, etc.)

/teaching                Pedagogical tools (AI Foundations, MNIST Demystifier,
                          PageRank Playpen, Quantum Curious, AI Evolution)
                          + a "From the blog" teaser
/blog                    Blog index (lives conceptually under Teaching)
/blog/<slug>             Individual posts

/about                   Company mission ("We are all in the diorama")
/about/founder           Founder bio, photo, team
/about/faq               FAQ, grouped by category

/contact                 Contact form (unchanged — Neon/Drizzle/Resend backend)
```

### Why this split?

The old site (`dioramaconsulting.co.uk`) had **nine** sections: Services, FAQ,
Writing, Teaching, Charity, Building, Tooling, CxAI, Contact, About. This
rebuild consolidates them into five tabs. The two judgment calls worth
knowing about:

- **Teaching vs. Projects.** Both contain "an app with a screenshot." The
  split is by *purpose*, not content type: explicitly pedagogical tools
  (built for executive AI coaching) go under Teaching; everything else
  ("Building" + "Tooling" on the old site) goes under Projects.
- **Blog lives under Teaching, not as its own tab.** The existing posts are
  mostly educational/explainer pieces, so they fit there conceptually. A
  couple of posts (`team-tapestry`, `experiments-in-ai-coding`) are really
  about apps Mal built — if you'd rather they live as Projects pages instead
  of (or as well as) blog posts, that's a one-file move; nothing on the Blog
  side depends on them staying put.

### Homepage widgets are standalone, not teasers

The Charities and CxAI homepage widgets are edited as their **own**
Keystatic singletons (`homeCharityWidget`, `homeCxaiWidget`), independent of
`/services/charities` and the CxAI Substack. This was a deliberate choice —
it means updating the widget copy doesn't change the full page and vice
versa. The trade-off: if you change one, remember to check whether the other
needs updating too, since nothing keeps them in sync automatically.

---

## Content model

Everything content-editable lives in `src/content/` and is described in
`src/content.config.ts` (Astro's content collections) and
`keystatic.config.ts` (the CMS UI on top of those same files). **These two
files must stay in sync** — see "The bug that was here before" below for why
that matters.

| Collection / Singleton | Path | Notes |
|---|---|---|
| `blog` | `src/content/blog/<slug>/index.mdx` | Folder-per-post, co-located images |
| `projects` | `src/content/projects/<slug>/index.mdx` | Same pattern as blog |
| `charities` | `src/content/charities/<slug>/index.mdx` | Same pattern as blog |
| `faq` | `src/content/faq/<slug>.mdx` | Flat files, grouped by `category` field |
| `home`, `homeCharityWidget`, `homeCxaiWidget` | `src/content/pages/...` | Singletons |
| `servicesConsulting`, `about`, `aboutFounder` | `src/content/pages/...` | Singletons |

### The folder-per-post / co-located image model

**Yes — this is the right model, and the project already uses it for blog
posts.** Each entry is a directory containing an `index.mdx`, with any
images it needs sitting right next to it:

```
src/content/blog/75-years-of-the-turing-test/
├── index.mdx
└── images/
    ├── turing-1951-lecture.png
    ├── eliza-slide.png
    └── ...
```

Why this beats a shared `/assets` dump:

- **Portable.** Delete or move a post's folder and its images go with it —
  nothing else references them.
- **No filename collisions.** Five different posts can each have an
  `images/figure-1.png` without clashing.
- **Matches Keystatic's default behaviour.** When you upload an image
  through a Keystatic `image` field on a collection whose path ends in
  `*/` (blog, projects, charities all do), Keystatic stores it inside that
  entry's own folder automatically — you don't need to configure a
  `directory` override for this to work.

The same pattern is used for `projects/` and `charities/`. `faq/` doesn't
need it (no images), so those are flat `.mdx` files instead.

### heroImage / logo fields: local upload or remote URL

Every image-bearing field (`heroImage` on blog/projects, `logo` on
charities, `portrait` on the Founder page) is a **conditional field** in
Keystatic: a toggle lets you choose between uploading a local file
(co-located, recommended) or pasting an external URL (e.g. while you don't
have a local asset yet). In `content.config.ts` this is modelled as:

```ts
heroImage: z.union([image(), z.string().url()]).optional()
```

Any page that renders one of these fields checks `typeof x === 'string'` to
tell the two cases apart — see `pages/projects/index.astro` or
`layouts/ProjectPage.astro` for the pattern if you add a new page that needs
to render one.

---

## What was broken, and what's fixed

Three real bugs were found and fixed as part of this restructure — not
typos, but a genuine half-finished migration from a live Substack RSS feed
to static files:

1. **Schema/layout mismatch.** `BlogPost.astro` destructured `link` and
   `updatedDate` from props, but `content.config.ts`'s schema never declared
   them — only `title`, `description`, `pubDate`, `heroImage`. This is
   leftover from `src/loaders/substack.ts` (the original live RSS loader,
   now unused — see below), which *did* produce a `link` field. When the
   migration to static `.mdx` files happened, the schema was rewritten but
   the layout wasn't updated to match. **Fixed**: both fields are now in
   the schema, `link` is optional (only shows the "Originally published on
   Substack" banner when set).

2. **`post.slug` vs `post.id`.** `pages/blog/[...slug].astro` called
   `getStaticPaths()` and used `post.slug` to generate routes — but
   Astro's content layer `glob()` loader exposes `.id`, not `.slug`, on
   collection entries (the sibling `index.astro` already used `.id`
   correctly). This single-character-looking bug meant every blog post page
   either failed to build or generated broken routes. **Fixed**: now uses
   `post.id`, consistent with the rest of the codebase.

3. **Malformed MDX from the Substack export.** All five existing blog posts
   were raw, unprocessed Substack exports: every post shared the *same*
   placeholder `heroImage` (an Unsplash URL), and each post's body contained
   newsletter chrome — a "## Connections" masthead, a subscriber avatar
   image, and a "Subscribe to Connections / Ready for more?" footer — none
   of which is actual article content. **Fixed**: stripped from all five
   posts. Embedded content images (the real article figures, not the
   newsletter chrome) were converted to local `./images/` references.

### Known gap: body images aren't downloaded yet

The cleanup script converted every in-body image reference from
`substackcdn.com` URLs to local `./images/<name>.png` paths, but **the
actual image files were not downloaded** — Claude's sandboxed environment
doesn't have network access to `substackcdn.com` or
`substack-post-media.s3.amazonaws.com`. This means:

- The five blog posts will currently show broken images for every figure
  in the body (the `heroImage` and any images you re-upload through
  Keystatic are unaffected).
- The `alt` text on each placeholder is auto-generated and descriptive
  enough to know *which* image needs to go where, but you'll need to fetch
  the originals yourself.

**To fix this**, for each post, open the original Substack post in a
browser, right-click → save each image, and drop it into that post's
`images/` folder using the exact filename already referenced in the MDX
(check `grep "!\[" src/content/blog/<slug>/index.mdx` to list them in
order). Alternatively, run a small script with `curl` or `wget` from a
machine that *does* have access to `substackcdn.com` — the original URLs
are preserved in git history / this conversation if you need to recover
them.

### Known gap: inferred Substack URLs

The `link` field (used for the "Originally published on Substack" banner)
was verified for one post (`75-years-of-the-turing-test`, fetched directly).
For the other four posts, the URL follows the same `cxai100.substack.com/p/<slug>`
pattern but **was not individually verified** — double-check these before
relying on them:

- `ai-and-business-transformation`
- `experiments-in-ai-coding`
- `team-tapestry`
- `tech-organisation-design`

If any of these 404, either correct the `link` field in Keystatic or clear
it (the banner simply won't render if `link` is unset).

### Dead code you can safely delete

`src/loaders/substack.ts` is the original live-RSS Astro loader. It's no
longer imported anywhere (the blog collection now uses `glob()` over static
files), but it was left in place rather than deleted unprompted. If you're
confident you won't go back to a live RSS-driven blog, delete this file.

---

## Keystatic

Run the CMS locally with:

```bash
npm run dev
# visit /keystatic
```

### What's editable where

- **Blog, Projects, Charities** — full collections with rich MDX content,
  an `Iframe` embed block component (for YouTube embeds etc.), draft
  toggles, and sort order where relevant.
- **FAQ** — flat collection, grouped into categories on the page by the
  `category` field (e.g. "Engagement", "Charities"). Add a new category by
  just typing a new value — no schema change needed.
- **Home, Founder, About, Services → Consulting** — singletons, since
  there's only ever one of each.
- **Homepage widgets** (`homeCharityWidget`, `homeCxaiWidget`) — separate
  singletons, intentionally decoupled from the pages they reference (see
  "Homepage widgets are standalone" above).

### Adding a new Teaching tool

The five teaching tools (AI Foundations, MNIST Demystifier, etc.) are
currently **hand-authored** as a plain array inside
`pages/teaching/index.astro`, not a Keystatic collection — each one links
out to an externally-hosted app rather than rendering its own page on this
site, so there was no MDX body to manage. If these grow into full
write-ups with their own pages, promote them into a `teaching` content
collection mirroring `projects` (same schema shape, same co-located image
model) and loop over `getCollection('teaching')` instead of the hardcoded
array.

### Adding a new Quantum Curious / AI News Agent style entry

These were the two items that sat right on the Teaching/Projects line.
Current split: pedagogical tools → Teaching (hand-authored, see above);
general-purpose builds (Music Map, Raspberry Pi Christmas Tree, AI News
Agent, Invoice Forge) → the `projects` collection. If you build something
new and aren't sure which side it's on, ask: "would I show this to a client
to teach a concept, or just to show what I built?" — the former is
Teaching, the latter is Projects.

---

## Local development

```bash
npm install
npm run dev       # site at /, Keystatic admin at /keystatic
npm run build     # production build
```

### Environment variables

The contact form (`pages/api/contact.ts`) needs:

```
RESEND_API_KEY=...      # Resend transactional email
DATABASE_URL=...        # Neon Postgres connection string (Drizzle)
```

Keystatic's GitHub storage mode (`keystatic.config.ts` → `storage.kind:
'github'`) needs standard Keystatic GitHub App credentials configured per
the [Keystatic GitHub mode docs](https://keystatic.com/docs/github-mode) —
not covered here since it didn't change as part of this restructure.

---

## File structure reference

```
src/
├── content.config.ts        # Astro content collection schemas (Zod)
├── content/
│   ├── blog/<slug>/index.mdx
│   ├── projects/<slug>/index.mdx
│   ├── charities/<slug>/index.mdx
│   ├── faq/<slug>.mdx
│   └── pages/                # singleton content (home, about, etc.)
├── layouts/
│   ├── Layout.astro          # base HTML shell
│   ├── BlogPost.astro        # blog post chrome (hero, Substack banner)
│   └── ProjectPage.astro     # project page chrome (status badge, links)
├── components/                # generic, reusable — Section/Card/Profile/Badge
│   └── ...
└── pages/
    ├── index.astro            # homepage + widgets
    ├── services/
    │   ├── index.astro
    │   ├── consulting.astro
    │   └── charities.astro
    ├── projects/
    │   ├── index.astro
    │   └── [...slug].astro
    ├── teaching/index.astro
    ├── blog/
    │   ├── index.astro
    │   └── [...slug].astro
    ├── about/
    │   ├── index.astro
    │   ├── founder.astro
    │   └── faq/index.astro
    └── contact.astro

keystatic.config.ts            # CMS schema — mirrors content.config.ts
```

---

## Open decisions for you

A few things flagged during this restructure that are worth a final call:

1. **Should "Team Tapestry" and "Experiments in AI Coding" also appear as
   Projects?** Both blog posts describe an app Mal built. They're staying
   as blog posts per the educational-content decision, but nothing stops
   you adding a matching `projects/` entry too, cross-linked via the
   `relatedBlogSlug` field.
2. **FAQ categories are currently "Engagement" and "Charities"** (3 sample
   entries seeded). Add real content here before launch — these are
   placeholders to prove the grouping works, not final copy.
3. **Charities collection has two seeded entries** (Helpforce,
   Aston-Mansfield) pulled from the existing About page copy. Logos are not
   set — add them via Keystatic once you have square-ish logo assets for
   each.

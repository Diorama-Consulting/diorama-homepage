# Summary of changes

## 1. Left-padding / alignment
Audited — already consistent. Every main-page section is wrapped in the
shared `.container` class (same 24px side padding used by the header
logo), so no changes were needed here.

## 2. Green "eyebrow" text — made consistent
Previously this varied by page: different colours (`--mint` vs
`--signal` vs `--ink-accent`), sizes (12px vs 12.5px), letter-spacing
(0.08em vs 0.1em), and font-weight. Now standardised to:
`font-family: mono, 12px, weight 700, letter-spacing 0.08em, uppercase`,
using `--signal` on light page backgrounds and `--ink-accent` on the
dark photo heroes (colour has to differ there for contrast — everything
else is identical).

Files touched: `src/components/Hero.astro`, `HeroCarousel.astro`,
`Section.astro`, `AboutIntro.astro`, `LiveProof.astro`,
`OutcomesBand.astro`, `src/pages/about/index.astro`.

## 3. Main heading size — made consistent
Added a shared token in `src/styles/global.css`:
`--page-title-size: clamp(34px, 4.6vw, 52px)`.

Applied to the primary heading on all 5 main pages:
- Home (`Hero.astro`, `HeroCarousel.astro`)
- About (`about/index.astro`)
- Insights (`insights/index.astro`)
- Services & Contact — via a new `pageTitle` boolean prop on
  `Section.astro`, scoped so it only affects that one instance and
  doesn't resize every other in-page section heading that also uses
  `Section`.

## 4. Bopping scroll-cue arrows (accessibility)
New reusable component: `src/components/ScrollCue.astro` — an animated
chevron inside a real `<a href="#target">`, so it works with no JS,
keyboard-only, and screen readers (arrow is `aria-hidden`, accessible
name comes from `aria-label`). Respects `prefers-reduced-motion` and
hides under 860px.

Wired into:
- Home (`Hero.astro`) → scrolls to the About-intro section
- About (`about/index.astro`) → refactored its original bespoke arrow
  into the shared component (same visual result, now consistent code)
- Services (`services/index.astro`) → scrolls to the Outcomes band
- Insights (`insights/index.astro`) → scrolls to the spotlight article
- Contact (`contact.astro`) → scrolls to the footer (short page, so the
  footer was the sensible target)

Deliberately **not** added to the homepage's alternate carousel hero
(`HeroCarousel.astro`) — it already has a persistent bottom navigation
bar (tabs + prev/next + play/pause) and another arrow there would
overlap real controls rather than help.

## 5. Sustainability widget — fixed wrong domain
`src/components/SustainabilityNote.astro` had a typo'd fallback domain,
`dioramaconsulting.uk` (missing "co"), while every other file in the
codebase correctly falls back to `dioramaconsulting.co.uk`. This is what
was feeding the Green Web Foundation badge/link the wrong domain
whenever `SITE_DOMAIN` wasn't set at build time. Fixed to match.

## 6. Sitemap
`@astrojs/sitemap` was already installed and already regenerates on
every `astro build` — so it "updates with pushes" as long as your CI/CD
builds on push (this zip doesn't include `.github/workflows` or
`package.json`, so I couldn't verify that trigger directly — worth a
quick check on your end).

Hardened it further in `astro.config.mjs`: added an explicit `filter`
that excludes `/admin`, `/api`, `/keystatic`, and `/tools/gated` from
the sitemap. These are already server-only routes (`prerender = false`)
so they shouldn't appear anyway — this is a second line of defence so a
future page under one of those paths can never silently leak into the
public sitemap.

Also added `public/robots.txt`, pointing crawlers at
`/sitemap-index.xml` and disallowing the same private paths. Note: the
domain in `robots.txt` is hardcoded to `dioramaconsulting.co.uk` (a
static file can't read `SITE_DOMAIN` at request time in a fully static
build) — flag if you need this to vary per-environment and I can turn it
into a small `.ts` endpoint instead.

---

# Session — 2026-07-25 to 2026-07-26

A running log of changes made to this repo during this session, in the
order they happened (oldest first, matching the git history).

## `7c3a257` — Fix escaped image markdown in how-data-unlocks-ai-success post

Three inline body images (`TikTok.jpg`, `DataStrategy.jpg`, `DataArch.png`)
were rendering as literal text (`![](images/TikTok.jpg)`) instead of images.
The markdown was double-escaped (`!\[]\(images/TikTok.jpg)`) — almost
certainly an artifact of the script that imported this post from Substack.
Unescaped all three so they render as proper `<img>` tags, matching the
syntax every other post on the site already uses correctly.

## `702c589` — Replace hero image for how-data-unlocks-ai-success with new architecture illustration

Swapped the post's `heroImage.jpg` for a new AI-generated illustration (an
abstract layered-architecture visual playing on the post's own house-building
metaphor for data infrastructure), based on a DALL-E prompt drafted from the
article's content and the site's brand colour.

## `bd3f434` — Fix inconsistent page-title formatting across Services/Tools/About

Three separate bugs found while auditing why each top-level page's title
looked different after clicking between tabs:

- **Services**: eyebrow label read "What we do" instead of "Services"
  (`src/content/pages/services-index.yaml`), and the page's title used the
  shared `Section` component's generic in-page padding (`--space-section`,
  80–148px) instead of a page-top title's tighter spacing. Added a
  `.section--page-title` class/rule to `src/components/Section.astro` giving
  page-top titles a fixed `padding-top: 56px`, matching Insights.
- **Tools**: eyebrow/heading content (`src/content/pages/projects-index.yaml`)
  was stale "Building"/"Projects" text left over from before the nav was
  renamed to "Tools". The heading also had no `font-size` override in
  `src/pages/tools/index.astro`, so it fell back to the browser default
  instead of the site's `--page-title-size`, making it look like a different
  font from every other page's heading. Fixed both.
- **About**: the hero content box (`.about-hero-inner` in
  `src/pages/about/index.astro`) was a flex item with no explicit width, so
  it shrank to fit its own content and got centered off-position instead of
  filling the row first — it visually landed indented compared to the other
  pages. Fixed with `width: 100%`.

## `b187a6c` — Align Tools eyebrow with nav and fix its missing bold weight

Follow-up after seeing it live: the Tools eyebrow still didn't match the nav
and still looked like a different font.

- Eyebrow: "Building" → "Tools" (matches nav).
- Heading: "Tools" → "AI Coding Projects".
- The `.eyebrow` CSS rule in `src/pages/tools/index.astro` was missing
  `font-weight: 700`, which every other page's eyebrow rule has — this was
  the actual cause of it reading as a different, lighter font. Fixed.

Also updated the `keystatic.config.ts` schema defaults for this content
(`projectsIndex` singleton) to match, so future content resets don't
reintroduce the stale copy.

## `0b60d59` — Remove scroll cue overlapping the Insights page title

The "More ↓" scroll cue on `/insights` was absolutely positioned and
centered itself within the eyebrow+heading box — since that box is only as
tall as its two lines of text, the cue landed directly on top of the
heading ("Writing, talks, and events"). Removed it from
`src/pages/insights/index.astro` (Services and About use the same
`ScrollCue` component without this problem, because their positioned
ancestor is a much taller block, so their cues land clear of the text).

## `ef754fd` — Fix incomplete sentence in homepage "Who we are" copy

The positioning paragraph in `src/lib/site-content.ts` (the single source of
truth for this copy — also feeds the chatbot's knowledge base) ended
mid-sentence: *"...accelerate value creation through."* before jumping
straight into the charities line. Changed to: *"...accelerate value
creation by focussing on productivity, delivery and quality."*

## `19cccdc` — Switch site typography from Geom Variable/Cal Sans to Inter Variable

Per user feedback that the heading font felt too thick/bold and body text
felt too small at 100% zoom. Geom Variable's geometric construction
(near-uniform stroke width) reads as heavy at display sizes even at a
moderate weight; Cal Sans has a small x-height, making body text look
smaller than its numeric font-size. Switched both `--font-display` and
`--font-body` (`src/styles/global.css`) to Inter Variable — an
already-installed but previously unused dependency
(`@fontsource-variable/inter`), designed specifically for on-screen
legibility. Removed the now-unused `@fontsource-variable/geom` and
`@fontsource/cal-sans` imports.

---

## Related, outside this repo

Not part of this repo's git history, but done in the same session and
relevant to the live site:

- **ai-scout container env fix**: the `ai-news-summarizer` container on the
  droplet was running with a stale environment — its `.env` file had already
  been corrected to `dioramaconsulting.co.uk`, but the running container was
  created before that edit and Docker doesn't hot-reload env vars into a
  live process. Recreated the container (`docker compose up -d`) so it
  picked up the corrected values; this is why the CxAI daily report's
  "view online"/tracking/image links were pointing at the old `dioramas.uk`
  domain.
- **Report file patch**: the already-generated report file for 2026-07-25
  (`ai_news_report_2026-07-25_07-05-53.html`, on the droplet at
  `/opt/apps/ai-news-summarizer/reports/`) had the old domain baked into it
  from before the container fix. Patched the 25 `dioramas.uk` references
  in that one file to `dioramaconsulting.co.uk` directly (backed up as
  `.bak` alongside it) — reports generated after the container fix don't
  need this, since the domain is built fresh at generation time.

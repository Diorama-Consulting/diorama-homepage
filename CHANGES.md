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

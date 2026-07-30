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

## `be5230a` — Append this session's changes to CHANGES.md

Documented all commits up to this point in this session (this section of
the file).

## Fix "Who we are" paragraph wording and missing full stop

Follow-up to the `ef754fd` sentence fix above. Per user request, changed
the second half of the paragraph from *"...accelerate value creation by
focussing on productivity, delivery and quality."* to *"...accelerate value
creation through fractional leadership, pragmatic AI and data strategy,
platform modernisation, and organisation design."* — matching the phrasing
already used on the About page's own body paragraph. Also added the
missing full stop at the end of the paragraph ("...AI and Digital
Strategy.").

## Reduce page-title size and add a shared page-subheading token

Follow-up after seeing the Tools page live: "AI Coding Projects" felt too
large/dominant over its eyebrow, and the subheading below it felt too
small. Two changes, both in `src/styles/global.css`:

- Reduced the shared `--page-title-size` token (used by every top-level
  page's `<h1>`: Home, About, Services, Insights, Tools, Contact) from
  `clamp(34px, 4.6vw, 52px)` to `clamp(28px, 3.8vw, 42px)`. Applied
  site-wide, not just Tools — likely a side effect of the Inter switch
  above, since Inter's larger x-height reads bigger at the same size than
  the previous font did.
- Added a new shared `--page-subheading-size: 17px` token for the lead
  paragraph under a page title, and pointed every page's subheading rule
  at it instead of its own bespoke value: `Section.astro` (Services/
  Contact, was 15.5px), `Hero.astro` (Home static hero, was already
  17px), `HeroCarousel.astro` (Home carousel hero, was 16.5px), Tools
  (was 17px, set earlier this session), and About's `.hero-mission`
  (was `clamp(17px, 2vw, 22px)`). Insights has no equivalent lead
  paragraph, so it's not part of this token. Only `font-size` was
  touched on each — colour, max-width, and animation stay page-specific.

## Add missing chat widget to the Insights page

Found while investigating a reported "chat bubble looks different between
tabs" issue: the bubble wasn't inconsistent, it was entirely absent on
`/insights` — the only top-level page that hand-builds its own `<html>`
shell instead of using the shared `<Layout>` component, which is where
`<ChatWidget />` gets included. Patched by importing and adding
`<ChatWidget />` directly to `src/pages/insights/index.astro`, matching
where `Layout.astro` places it (just before `</body>`).

This is a narrower fix than the root cause deserves — see `TODO.md` for
the fuller refactor (Insights should use `<Layout>` like every other page)
and why it wasn't done tonight: that same root cause also means Insights
is missing PostHog analytics entirely, which the narrow patch doesn't
address.

---

---

# Session — 2026-07-27

## `f206f5b` — Add CLAUDE.md and ARCHITECTURE.md for repo/agent onboarding

New `CLAUDE.md` (commands, deployment, architecture gotchas) and
`ARCHITECTURE.md` (C4 Context/Container/Component Mermaid diagrams) for
future Claude Code sessions and human contributors — neither file existed
before.

## `c3cd917` — Expand CLAUDE.md with Keystatic, admin dashboard, PostHog, and layout details

Follow-up requests: documented Keystatic's role as the embedded,
GitHub-storage-backed CMS; `/admin/dashboard`'s PostHog Query API +
contact-service dependencies and its graceful-degradation behaviour when
those env vars are absent; the distinct PostHog client/server/query/flag
integrations and their different hosts/credentials; and a per-file
breakdown of the five page layout templates in `src/layouts/`.

## `8059e24` — Add NotebookLM podcast feed for Insights articles; fix header overlap

Two changes:

- **Podcast feed.** The 7 NotebookLM-narrated Insights posts had
  NotebookLM-generated audio (44–208MB WAVs) that couldn't go through git
  or the Docker image at that size. Transcoded to 96kbps mono MP3 (~84%
  smaller — NotebookLM output is already mono 24kHz speech, so this is
  lossless-enough for the source material) and hosted directly on the
  droplet via a new Caddy `file_server` route at `/podcast-audio/*`,
  outside git and the Docker build entirely (see "Related, outside this
  repo" below). Each post's `audioUrl`/`audioTitle` frontmatter fields
  (already part of the blog schema, previously unused) now point at the
  hosted MP3s, which surfaces the existing pinned audio player in
  `BlogPost.astro` with no player-UI changes needed. Added
  `src/pages/podcast.xml.js`, a real iTunes-tagged RSS feed built from the
  `blog` collection (filtered to entries with `audioUrl` set), plus a
  generated 1400×1400 placeholder cover
  (`public/images/podcast-cover.png`, composited from `Logo.svg` via
  `sharp`) so the feed validates for podcast-directory submission.
- **Header-overlap fix.** `BlogPost.astro`'s floating "Go back"/"Subscribe
  on Substack" buttons were hardcoded to `top: 100px`, but `Header.astro`
  is actually ~121px tall unscrolled (24px nav padding ×2 + 72px logo) and
  has a higher `z-index` (50 vs. the buttons' 40) — so the header rendered
  on top of and clipped them. Bumped both the desktop and mobile offsets
  to `136px`. Verified with a real headless-Chrome screenshot on
  `/insights/seeking-solis/`.

Also copied the `docker-status` Claude Code skill into this repo's
`.claude/skills/` (previously only in a separate ops repo) so droplet
status checks are available from here too.

## `0067423` — Merge remote-tracking branch 'origin/main'

Two Keystatic CMS edits (`05cc7be`, `71137e4`) landed on `main` mid-session
— genuine content fixes correcting stale Substack URLs on
`experiments-in-ai-coding` (→ `/p/experiments-in-coding-with-ai`) and
`tech-organisation-design` (→ `/p/engineering-org-management-strategies`),
plus Keystatic's usual save-time markdown reformatting. Both conflicted
with this session's `audioUrl`/`audioTitle` frontmatter additions on the
same two files; resolved by keeping Keystatic's content/link fixes in full
and re-inserting the two new audio fields at the same position.

## `cf66d26` — Revert @astrojs/check/typescript devDependency addition

See the new TODO.md entry ("CI's `npx astro check` typecheck step is a
silent no-op") for the full story: adding these to run `astro check`
locally made CI's typecheck step actually execute for the first time ever,
which surfaced ~168 pre-existing, unrelated type errors and blocked
deploy. Reverted so tonight's deploy wasn't blocked by pre-existing debt.

## `a5efea6` — Fix SITE_DOMAIN, archive live Caddyfile, redesign Services hero

- **`SITE_DOMAIN` GitHub Actions secret** was set to `dioramas.uk`, a
  legacy/future domain that doesn't currently resolve to anything — this
  is baked into every build via `astro.config.mjs`'s `site` config, so
  every absolute URL site-wide (`/rss.xml`, `/sitemap-index.xml`, every
  page's canonical `<link>`, and the new `/podcast.xml`) was pointing at a
  dead domain in production. Updated the secret to
  `dioramaconsulting.co.uk`, the domain actually serving the site.
- **`deploy/Caddyfile`** — copied the real, live Caddy config from the
  droplet into the repo for reference (distinct from the pre-existing
  `deploy/Caddyfile.example`, which is a generic template, not what's
  actually running).
- **Services page hero redesign** (`src/pages/services/index.astro`):
  replaced the `FeatureToggle` click-to-expand list (Consulting/Charities
  stacked vertically, only one's description visible at a time, image on
  the right) with a single full-width image sized to match Insights'
  `.spotlight` (440px height, same radius/shadow), with "01 Consulting"
  and "02 Charities" as white panels side by side directly on the image,
  each linking straight through. Removes the toggle interaction entirely
  rather than just restyling it — per feedback that the expand/collapse
  behaviour itself was the confusing part, not just the layout.

## `11826cf` — Podcast feed polish: footer link, cleaner titles, per-episode artwork

Follow-up after confirming the feed works in Overcast:

- Added a "Podcast" link (`/podcast.xml`) to the footer's Explore group,
  next to Insights — previously the feed had no discoverable link
  anywhere on the site (`src/content/pages/footer-nav.yaml`, with
  `src/components/Footer.astro`'s fallback defaults kept in sync per this
  file's usual convention).
- Dropped the redundant `(Audio)` suffix from the podcast's channel title
  and `(NotebookLM)` from every episode title (`audioTitle` on all 7 blog
  posts) — both were internal labelling, not useful to a listener.
- `itunes:image` per episode now resolves to that post's own hero image
  (via `resolveImageUrl()`, same helper every other page uses) instead of
  the shared podcast-cover placeholder, falling back to it only if a post
  has no hero image. Verified against a real production build, not just
  dev mode, since local images resolve completely differently between the
  two (Vite's dev-only `/@fs/...` passthrough vs. a real fingerprinted
  `/_astro/...` asset) — dev-only output would have been silently broken
  in production without checking this.

## `cff6b42` — Top-align the Services spotlight labels

Follow-up after seeing the redesigned Services hero live: "Consulting"/
"Charities" were bottom-aligned on the image plate, which put them below
the fold on arrival at the page on typical laptop viewports — you had to
scroll to see them. Flipped both the panel alignment
(`justify-content: flex-end` → `flex-start`) and the scrim gradient
direction (dark-at-bottom → dark-at-top, so the white text still has
contrast against the image) in `src/pages/services/index.astro`.

## `6039e3f` — Add body images to "The AI World Cup may have no single winner"

The post (added via Keystatic) had no embedded images — the source
Substack article has 7 charts/tables interspersed through the body.
Copied the 7 source images (`~/Desktop/AI WorldCup Images/`) into
`src/content/blog/the-ai-world-cup-may-have-no-single-winner/images/`,
matching the folder-per-post co-located-image convention every other post
uses. Fetched the original Substack post to identify exact placement (the
paragraph immediately before/after each image) and matched each image to
its anchor sentence in this post's own text — verified visually (each
image's actual chart title/content against its filename) before placing,
since filenames alone (`chineseModelShare` vs. `chineseModelUsage`) were
ambiguous. Note the paragraph order in this post differs from the source
Substack article in places, so images were placed by matching each one's
own anchor sentence wherever it falls here, not by copying the source's
sequential image order.

## `d040d64` — Add podcast audio to "The AI World Cup may have no single winner"

Transcoded `China_s_Kimi_K3_challenges_US_AI_dominance.m4a` (AAC, stereo,
44.1kHz, 22.7min) to 96kbps mono MP3 (same recipe as the original 7
episodes), uploaded to `/var/www/podcast-audio/` on the droplet (no sudo
needed — the directory's already deploy-owned from the earlier one-time
setup), and wired it into the post via `audioUrl`/`audioTitle` frontmatter
plus a new entry in `podcast.xml.js`'s `AUDIO_BYTES` map. Verified locally:
pinned audio player renders, and the episode appears correctly in
`/podcast.xml` with the right enclosure length.

## `01ef78e` — Add podcast-episode-publish skill

Turned the recipe just used for the AI World Cup episode (m4a → 96kbps
mono MP3 → rsync to droplet → wire into post frontmatter + podcast.xml's
AUDIO_BYTES map → verify → commit/push) into a reusable Claude Code skill
at `.claude/skills/podcast-episode-publish/SKILL.md`, so future episodes
don't require re-deriving each step.

## `695e7fd` — Add hero image to "The AI World Cup may have no single winner"

Added the AI-generated hero image (`heroImage.png`, from the NanoBanana
prompt drafted earlier this session — a converging circular arena of
competing geometric figures over a circuit-board pattern, no text/logos/
flags, matching the post's "no single winner" thesis) to the post's
`heroImage` frontmatter field. Verified on the post's own hero banner, the
Insights grid card, and the "More to explore" rail thumbnail. Since this
post already has `audioUrl` set, it also becomes the episode's
`itunes:image` in `/podcast.xml` (falls through automatically via
`resolveImageUrl()` — no code change needed).

## `c16f4ff` — Rewrite descriptions for 5 blog posts

The existing `description` frontmatter on Team Tapestry, Experiments in AI
Coding, AI and Business Transformation, and Tech Organisation Design were
stylistic subtitles ("Fatal Exception: Developer Does Not Exist") rather
than descriptive summaries, and The AI World Cup post had no description
at all. Replaced/added single-sentence (~15-18 word) descriptions
summarising each post's actual content, per user review and approval —
these feed the meta description tag, social previews, and (for the 4
posts with audio) the podcast feed's episode summary.

## `31f8c77` — Replace Seeking Solis hero image

Swapped the generic stock photo (`heroImage.jpg`) for an AI-generated
image (`heroImage.png`, Gemini/NanoBanana, per the prompt drafted this
session — an abstracted Ra-like sun deity sending a 93-million-mile beam
of light to a rooftop solar panel/battery/inverter, gold-to-green
palette) directly tied to the post's own content (the Bill McKibben
"sunlight travels 93 million miles" quote, and "Solis" being both Latin
for sun and the inverter brand name). Old stock photo removed.

## Related, outside this repo

- **Droplet podcast audio setup.** Added a scoped `NOPASSWD` sudoers rule
  (`/etc/sudoers.d/deploy-podcast-audio`, limited to the exact `mkdir`/
  `chown`/`chmod`/`caddy validate`/`systemctl reload caddy` commands
  needed — no editor, no blanket `ALL`) so routine future audio uploads
  don't need an interactive password. Created `/var/www/podcast-audio/`
  (deploy-owned) and added a `handle_path /podcast-audio/*` block to
  `/etc/caddy/Caddyfile` serving it via `file_server`. Uploaded the 7
  transcoded MP3s there via `rsync`; confirmed all seven serve with
  correct `audio/mpeg` content-type, exact byte-matching `Content-Length`,
  and `Accept-Ranges: bytes` (needed for podcast-app scrubbing).
- **`deploy` account password rotated** on the droplet (interactively, by
  the repo owner) — unrelated to SSH access (key-based, unaffected), just
  a short-password hygiene fix noticed while setting up sudo access above.

---

## Related, outside this repo (previous session)

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

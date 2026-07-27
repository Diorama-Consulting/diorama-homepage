# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev       # dev server — site at /, Keystatic CMS admin at /keystatic
npm run build     # production build (astro build)
npm run preview   # preview the production build locally
npx astro check   # typecheck — this is what CI runs as its only automated check
```

There is no test suite and no lint script configured in `package.json` — don't assume `npm test` or `npm run lint` exist. `npx astro check` is the only automated verification step before deploy.

Docker (matches what CI builds):
```bash
docker build -t diorama-homepage .
```
`PUBLIC_`-prefixed vars (`PUBLIC_POSTHOG_PROJECT_TOKEN`, `PUBLIC_POSTHOG_HOST`, `SITE_DOMAIN`) must be passed as `--build-arg`s — they're inlined at build time. Everything else (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `DATABASE_URL`, `CONTACT_ADMIN_TOKEN`, `POSTHOG_PERSONAL_API_KEY`) is read at container runtime via `process.env`.

## Deployment

Push to `main` → GitHub Actions (`.github/workflows/ci-cd.yml`): typecheck → build Docker image → push to GHCR (`ghcr.io/<org>/diorama-homepage`) → SSH to the droplet → `docker compose pull && up -d diorama`. The droplet never compiles anything itself. `deploy/` holds the droplet-side config (Caddyfile, systemd/PM2 leftovers) referenced by that pipeline.

## Architecture

**Astro 6, hybrid rendering.** `output: 'static'` + the Node adapter (`astro.config.mjs`) means pages are prerendered by default; anything needing request-time logic (API routes, admin pages, Keystatic, the tools rack) opts out per-file with `export const prerender = false`. Look for that line to tell static pages from server-rendered ones.

**Two parallel content configs that must stay in sync.** `src/content.config.ts` (Astro content collections, Zod schemas, read via `getCollection()`/`getEntry()`) and `keystatic.config.ts` (the CMS UI schema, read via `createReader()` in `src/lib/keystatic.ts`) describe the *same* underlying files independently. There's no codegen link between them — if you add/change a field in one, update the other by hand or Keystatic's editor and the Zod schema silently diverge.

**Keystatic's role.** Keystatic (`@keystatic/astro`, config in `keystatic.config.ts`, ~1,300 lines) is the entire CMS — there's no separate database or headless-CMS service. It runs embedded inside the same Astro server and edits the *same* MDX/YAML files that Astro's content collections read at build/request time; there's no sync step because they're the same files on disk. Storage mode is `'github'` (see `storage.kind` in `keystatic.config.ts`), meaning saves in `/keystatic` go through GitHub's API as real commits to this repo — not local disk writes — which is what `src/middleware.ts` OAuth-redirect fix and the GitHub App credentials are for. Content is split into:
- **Collections** (repeatable entries): `blog` (public label "Insights"), `projects` (public label "Tools"), `charities`, `events`, and `clientAccess` (backs `/admin/access` — restricted-tool visitor access, not rendered as a public page).
- **Singletons** (exactly one of each, e.g. `home`, `siteSettings`, `headerNav`, `footerNav`, `about`, `aboutFounder`, `servicesConsulting`, `chatbotSettings`, `positioning`, `legalPages`, plus the standalone `homeCharityWidget`/`homeCxaiWidget` homepage widgets) — page-level or site-wide copy that isn't a "list of things."

Visit `/keystatic` locally (`npm run dev`) to see the live field list; it's the source of truth for what's editable, not this file.

Collections (`src/content.config.ts`): `blog`, `projects`, `charities`, `events` — each a folder-per-entry under `src/content/<collection>/<slug>/index.mdx` with co-located images (e.g. `images/foo.png` sitting next to `index.mdx`). This is deliberate (portable, no filename collisions, matches Keystatic's default upload behavior for `*/`-suffixed collection paths) — don't flatten it into a shared `/assets` dump.

Two collections are publicly relabeled without renaming their internal name or files (renaming was judged unnecessary risk for no reader-facing benefit):
- `blog` → public routes/nav say **Insights** (`src/pages/insights/`); `src/pages/blog/` still exists alongside it.
- `projects` → public routes/nav say **Tools** (`src/pages/tools/`), driven by `ToolRack`/`ToolPage`. Adding a tool is content-only: create one Keystatic entry (category, accent, monogram, live URL) — no code change needed. Deploying the tool's own container/Caddy route is a separate, manual droplet-side step.

**The two-field image pattern.** Every image field is actually two independent optional fields — `<name>` (local upload) and `<name>Url` (external URL) — never a single `fields.conditional()`. This is a deliberate workaround: nesting `fields.image()` inside `fields.conditional()` was observed writing files to a broken path (`heroImage/value.webp` instead of co-located next to the entry). Always resolve a pair together through `resolveImageUrl()` / `resolveImageSrc()` / `isLocalImage()` in `src/lib/keystatic.ts` — never read `data.heroImage` or `data.heroImageUrl` directly in a page. Note the two content-reading paths resolve local images differently: Astro content collections get real `ImageMetadata` (via the schema's `image()` transform); the Keystatic `reader` (used for singletons like `home`, `aboutFounder`) returns a raw YAML-relative string path, which `resolveSingletonImage()` maps back to a built asset by globbing `src/content/pages/**`.

**Runtime secrets vs. build-time public vars — this has broken production before.** Server-only secrets (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, etc.) must be read through `secret()`/`requireSecret()` in `src/lib/env.ts`, never `import.meta.env` directly. Reason: the Docker build runs with placeholder secret values baked in at build time; `import.meta.env.X` for non-`PUBLIC_` vars gets inlined then and would ship the placeholder to production. `process.env` is read at actual container runtime and sees the real `.env` on the droplet. `PUBLIC_`-prefixed vars are the intentional opposite (they need build-time inlining since they ship to the browser) and stay on `import.meta.env`.

**Admin console** (`src/pages/admin/*`, nav list in `src/lib/admin-auth.ts`'s `ADMIN_PAGES`) is a separate, non-Keystatic surface — it's for *operating* the site (analytics, enquiries, tool health, access, feature flags), not for editing page content (that's what `/keystatic` is for). Pages: `dashboard`, `leads`, `enquiries`, `chatbot`, `tools`, `access`, `banner`. Gated by a single shared cookie (`diorama_admin`) set via a `?key=<CONTACT_ADMIN_TOKEN>` query param on any admin page (scoped to `/admin`, so signing in once covers all of them); checked with `requireAdmin(Astro, selfPath)` from `admin-auth.ts`. New admin pages should use this helper; two legacy pages (`dashboard.astro`, `enquiries.astro`) hand-roll the same check inline and were left alone rather than refactored.

`/admin/dashboard` specifically is the site's private analytics dashboard, and it's the one admin page with real external dependencies beyond the cookie gate:
- **Traffic/behaviour panels** (pages, referrers, devices, chat + contact events) come from PostHog's Query API (HogQL), via `POSTHOG_PERSONAL_API_KEY` (a *personal* API key with Query-read scope — not the public project token used by the client snippet) and `POSTHOG_PROJECT_ID`. The Query API host is derived from `PUBLIC_POSTHOG_HOST` by swapping `.i.posthog.com` → `.posthog.com` (ingestion host vs. app/API host are different subdomains).
- **Enquiry counts** come from a separate contact-service container (`CONTACT_SERVICE_URL`, defaults to `http://contact-service:8104`), independent of the PostHog panels.
- If the two PostHog env vars are absent, the page still renders — it shows a setup notice in place of those panels rather than failing; the enquiries panel works regardless. Don't treat a blank PostHog panel as a bug without checking those env vars first.

**Chatbot** (`src/pages/api/chat.ts`): Anthropic SDK (`claude-haiku-4-5-20251001`), knowledge base built from Keystatic content via `chatbot-context.ts`, admin-configurable override text via `chatbot-override.ts`, response quality heuristics in `chat-quality.ts`. In-memory per-IP rate limiting — resets on restart, would need moving to Redis if this ever runs multi-replica.

**PostHog integration** spans several files and two separate PostHog hosts — don't assume one host/key covers everything:
- `src/components/posthog.astro` — the client-side tracking snippet (standard inlined `array.js` loader), included once by `Layout.astro`. Configured via `PUBLIC_POSTHOG_PROJECT_TOKEN` / `PUBLIC_POSTHOG_HOST` (both build-time-inlined `PUBLIC_` vars — see the env var note above), default `defaults: '2026-01-30'`. Talks to the **ingestion host** (`eu.i.posthog.com`).
- `src/lib/posthog-server.ts` — a `posthog-node` server-side capture client for events emitted from API routes (e.g. chat/contact) rather than the browser.
- `src/lib/posthog-query.ts` — reads analytics via PostHog's **Query API (HogQL)** for `/admin/dashboard`. This is a different host to the client snippet: the app/API host is derived by swapping `eu.i.posthog.com` → `eu.posthog.com` (ingestion vs. app subdomains). Needs `POSTHOG_PERSONAL_API_KEY` (personal key, Query-read scope) + `POSTHOG_PROJECT_ID` — neither is the public client token.
- `src/lib/posthog-flags.ts` — per-tool boolean feature flags (key pattern `tool-<slug>`) via the Feature Flags REST API, used by `/admin/tools` purely as a maintenance kill-switch (flip a tool off site-wide without a redeploy) — deliberately not used for rollout percentages or per-visitor experiment targeting. Needs the same personal API key, but with "Feature Flag" write scope specifically (Query-read scope alone isn't enough for the toggle to work).
- `ToolOpenTracking` / `ToolVisibility` components (rendered by `Layout.astro`) hook individual tool cards into capture events for the tools rack.

**Middleware** (`src/middleware.ts`): rewrites the request URL from `X-Forwarded-Host`/`X-Forwarded-Proto` headers, but *only* for Keystatic's GitHub OAuth routes. Needed because Keystatic builds its OAuth `redirect_uri` from the request it sees internally (`http://127.0.0.1:4321/...` behind Caddy), which won't match what's registered on the GitHub App unless corrected. Don't broaden this middleware to other routes without checking why it's scoped this tightly (upstream Keystatic issue: `Thinkmill/keystatic#1022`).

**Contact form** (`src/pages/api/contact.ts`) is the one part of the stack with its own persistence: Neon Postgres via Drizzle, plus Resend for transactional email. Needs `RESEND_API_KEY` and `DATABASE_URL`.

**Layouts / screen templates** (`src/layouts/*.astro`) — five page-level shells, each rendering a different screen shape:
- `Layout.astro` (76 lines) — the base `<html>` shell every top-level page should wrap itself in: `BaseHead`, the PostHog snippet, `SiteBanner`, `ToolOpenTracking`/`ToolVisibility`, and the `ChatWidget` (opt out per-page with `showChatWidget={false}`, e.g. on `/contact`). Also owns the sitewide scroll-reveal script (`IntersectionObserver` on `[data-reveal]` elements, with a 2s force-visible safety net and a `prefers-reduced-motion` bypass). Other layouts either wrap this one (`LegalPage.astro`) or duplicate its `<head>`/`<body>` shell directly (`BlogPost.astro`, `ProjectPage.astro`, `ToolPage.astro`) rather than nesting inside it.
- `BlogPost.astro` (549 lines) — the Insights/blog article screen: hero image, title/date/updated-date, an optional pinned audio-narration player (`audioFile` upload takes precedence over `audioUrl`, mirroring the image-pair convention), and a conditional "Originally published on Substack" banner gated on the optional `link` field (never rendered for natively-written posts).
- `ProjectPage.astro` (169 lines) — the original project-detail screen (hero, summary, status badge, external/repo links). **Superseded by `ToolPage.astro`** for the `/tools/<slug>` route per a comment in `ToolPage.astro` itself ("Replaces ProjectPage.astro for this route... can be deleted once nothing else imports it") — check current importers before assuming it's still live before deleting.
- `ToolPage.astro` (422 lines) — the current `/tools/<slug>` screen: a dark "ink" hero band (monogram tile, title, tagline, status badge, primary "Open `<tool>`" action — consistent with the site's dark header/footer bookends), the MDX write-up as prose, an optional feature grid, and a closing full-width launch band so the CTA appears at both ends of the page. Includes `ToolOpenTracking`/`ToolVisibility` directly (since it doesn't nest inside `Layout.astro`).
- `LegalPage.astro` (263 lines) — shared screen for `/legal/*` (Privacy, Terms, Cookies, Accessibility, Sustainability): a compact dark hero (eyebrow, title, "Last updated" chip) over a two-column body — sticky table-of-contents (from a `toc` prop, hidden on mobile) beside the document prose, each section scroll-revealing via the same `data-reveal` pattern.

Per `TODO.md`, `src/pages/insights/index.astro` currently hand-rolls its own `<html>` shell instead of using `Layout`, so it's missing PostHog analytics and the tool-tracking components — a known gap, not yet fixed as of this writing.

`src/loaders/substack.ts` is a dead, unused live-RSS loader from before the blog moved to static `.mdx` files — not imported anywhere, kept rather than deleted.

## Site map

```
/                          Homepage
/services, /services/consulting, /services/charities
/tools, /tools/<slug>, /tools/gated/<slug>   (restricted tools)
/insights, /insights/<slug>                  (public label for the `blog` collection)
/blog, /blog/<slug>                          (still present alongside /insights)
/about, /about/founder, /about/faq
/contact
/admin/*                                     (cookie-gated, see above)
/keystatic                                   (CMS UI)
```

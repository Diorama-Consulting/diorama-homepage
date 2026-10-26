# TODO

## CI's "npx astro check" typecheck step is a silent no-op

**What**: `.github/workflows/ci-cd.yml`'s Typecheck job runs `npx astro
check`, but `@astrojs/check` and `typescript` are not (and, as of this
writing, deliberately are not — see below) declared as devDependencies.
Without them installed, `astro check` prints:

```
To continue, Astro requires the following dependency to be installed: @astrojs/check.
To continue, Astro requires the following dependency to be installed: typescript.
[ERROR] [check] The `@astrojs/check` and `typescript` packages are required for this command to work.
```

and then **exits 0 anyway**. The job shows green in every run in the
history to date, but has never actually type-checked a single file.

**Impact**: no real type-safety gate exists in CI. Confirmed directly: on
2026-07-27, adding `@astrojs/check`/`typescript` as devDependencies (to run
`astro check` locally while verifying an unrelated change) made the same
CI step run for real for the first time, and it immediately surfaced
**~168 pre-existing errors** — readonly-array type mismatches (`NavLink[]`/
`LinkGroup[]` props expecting mutable arrays but receiving Keystatic's
readonly-inferred ones) and missing-property errors on the `heroImage`/
`heroImageUrl` two-field image pattern (a type-inference gap in how
`imageFields()` in `content.config.ts` generates dynamic keys). None of
these are new; they predate this discovery and are unrelated to whatever
change happens to be shipping when someone next investigates this.

**Why not fixed tonight**: fixing ~168 errors across many unrelated files
is a real, separate body of work with its own regression risk, not
something to bundle into an unrelated feature deploy. The devDependency
addition that exposed this was reverted (see CHANGES.md) specifically so
tonight's deploy wasn't blocked by pre-existing debt — which also means
this gap is, for now, back to being silently masked exactly as before.

**Next steps**:
1. Decide whether to fix the ~168 errors incrementally (probably in
   batches by category — the readonly-array ones look like a single
   shared-type fix in whatever declares `NavLink`/`LinkGroup`, likely
   mechanical; the `heroImage`/`heroImageUrl` ones may need a shared type
   helper alongside `imageFields()` in `content.config.ts`) or to scope
   `astro check` down (e.g. exclude known-bad files) as an interim step.
2. Once the codebase is clean, re-add `@astrojs/check` and `typescript` as
   pinned devDependencies so `npm ci` in CI installs them and the
   Typecheck job starts checking for real — and stays green because it's
   actually passing, not because the tool silently declined to run.
3. Consider whether CI should treat a non-zero exit from a required tool
   as a hard failure in general (this specific silent-exit-0 behavior is
   `astro check`'s own CLI behavior when its deps are missing, not a
   workflow config issue, so there may be little to change beyond #2).

## Insights page is missing PostHog analytics entirely

**What**: `src/pages/insights/index.astro` is the only top-level page on the
site that doesn't use the shared `<Layout>` component (`src/layouts/Layout.astro`)
— it hand-builds its own `<html>`/`<head>`/`<body>` shell directly instead.
`Layout.astro` is where `<PostHog />` (the analytics snippet) gets included,
so Insights never gets it. There's no separate/duplicate PostHog snippet on
the page either — it's just genuinely absent.

**Impact**: pageviews and events on `/insights` (the site's blog/events hub —
probably one of the more content-rich, frequently-visited pages) are not
being tracked at all right now. No data is being lost silently in a
recoverable sense — it's just not being captured going forward until this
is fixed.

**Also missing from the same root cause** (lower priority, no current
functional impact): `ToolOpenTracking` and `ToolVisibility` components,
which Layout also provides. Checked — these only matter for pages that
render tool cards (via `ToolRack`/`ToolPage`), which Insights doesn't, so
their absence isn't causing a bug today. Worth fixing anyway as part of the
same cleanup, since they'll silently be needed the moment Insights ever
grows a tool-related widget.

**Why not fixed tonight**: the obvious/thorough fix is refactoring Insights
to use `<Layout>` like every other page (this is also what would have fixed
the separate missing-chat-widget bug — that part was patched directly
instead, see CHANGES.md). The concern raised: Insights has real interactive
client-side logic (the Articles/Events filter tabs + search box, a
self-contained script keyed off `insights-grid`/`insights-search-input`/
`.filter-btn` IDs and classes) that isn't present on any other page using
Layout, and there was no time tonight to thoroughly test that migration in
a real browser before shipping it.

Code-level read of that script suggests it *should* be unaffected — it
finds its elements by ID/class regardless of DOM nesting depth, already
guards against double-init (`grid.dataset.hubInit`), and already handles
Astro's `astro:page-load` event the same way Layout's own scroll-reveal
script does — so nothing about wrapping the existing `<main class="container">`
content in `<Layout>`'s `<slot />` should change its behavior. But this is
untested, not proven safe.

**Next steps**:
1. Refactor `src/pages/insights/index.astro` to use `<Layout title=... description=... image=...>` instead of its own `<!doctype html><html>...</html>` shell, moving the existing `<SiteBanner /><Header /><main>...</main><Footer />` content into the slot (matching the structure every other top-level page already uses).
2. Remove the now-redundant direct `<ChatWidget />` addition from tonight's patch (Layout adds it automatically).
3. Build locally and manually test in a real browser: the Articles/Events filter tabs, the search box, and the spotlight/rail/grid rendering — before pushing.
4. Once confirmed working, this also closes the gap for `ToolOpenTracking`/`ToolVisibility` for free.

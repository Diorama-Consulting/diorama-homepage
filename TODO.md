# TODO

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

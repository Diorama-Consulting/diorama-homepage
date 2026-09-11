# ARCHITECTURE.md

Architecture of the Diorama Consulting website, described using the
[C4 model](https://c4model.com/): Context → Container → Component. Diagrams
are Mermaid's C4 syntax — render natively on GitHub, or paste into
[mermaid.live](https://mermaid.live) if your viewer doesn't support them.

---

## Level 1 — System Context

Who uses the site, and which external systems it depends on.

```mermaid
C4Context
    title System Context — Diorama Consulting Website

    Person(visitor, "Site Visitor", "Browses services/tools/insights, submits the contact form, chats with the bot")
    Person(admin, "Mal (Admin / Editor)", "Edits content via Keystatic; reviews leads, enquiries, analytics and tool health via /admin")

    System(website, "Diorama Homepage", "Astro 6 marketing site: pages, tools rack, chatbot, contact form, embedded CMS, admin dashboards")

    System_Ext(github, "GitHub", "Source repo; Keystatic 'github' storage mode; OAuth App for CMS sign-in; Actions CI/CD")
    System_Ext(ghcr, "GHCR", "Container registry holding built site images")
    System_Ext(posthog, "PostHog (EU)", "Product analytics, session/event data, per-tool feature flags")
    System_Ext(anthropic, "Anthropic API", "Claude Haiku — powers the on-site FAQ chatbot")
    System_Ext(resend, "Resend", "Transactional email for contact-form notifications")
    System_Ext(neon, "Neon Postgres", "Stores contact-form enquiries (via Drizzle)")
    System_Ext(tools, "Standalone Tool Apps", "Independently deployed containers (e.g. Invoice Forge) linked from the Tools rack — not part of this repo")

    Rel(visitor, website, "Browses, submits form, chats", "HTTPS")
    Rel(admin, website, "Edits content, manages access/flags/banner", "HTTPS + admin cookie")
    Rel(website, github, "Reads/writes content commits; OAuth login", "HTTPS / OAuth")
    Rel(website, posthog, "Sends events; queries analytics; reads/writes flags", "HTTPS API")
    Rel(website, anthropic, "Chat completions", "HTTPS API")
    Rel(website, resend, "Sends enquiry emails", "HTTPS API")
    Rel(website, neon, "Reads/writes enquiries", "Postgres wire protocol")
    Rel(visitor, tools, "Uses individual tools", "HTTPS")
    Rel(github, ghcr, "CI builds & pushes image", "GitHub Actions")
    Rel(ghcr, website, "Deploys new image", "docker compose pull/up")
```

**Notes**
- There is exactly one "system" in scope for this repo — the Astro app. Every other box is an external dependency it talks to over HTTPS.
- The standalone Tool Apps are shown because the `/tools` rack links to them, but they have their own deploys/repos and are out of scope here.

---

## Level 2 — Containers

What actually runs, and where. Production is a single small droplet running Docker behind Caddy.

```mermaid
C4Container
    title Container diagram — Diorama Consulting Website

    Person(visitor, "Site Visitor")
    Person(admin, "Mal (Admin / Editor)")

    System_Boundary(droplet, "Production Droplet") {
        Container(caddy, "Caddy", "Reverse proxy", "TLS termination; routes dioramaconsulting.co.uk to the app container; also proxies each standalone tool's own subpath")
        Container(app, "Astro Server", "Node 24, @astrojs/node (standalone), Docker container, port 4321", "Renders pages, serves /api/* routes, hosts the Keystatic CMS UI (/keystatic) and cookie-gated /admin dashboards")
    }

    System_Ext(github, "GitHub", "Content storage (Keystatic) + OAuth + Actions CI/CD")
    System_Ext(ghcr, "GHCR", "Image registry")
    System_Ext(posthog, "PostHog", "Analytics + feature flags")
    System_Ext(anthropic, "Anthropic API", "Chatbot model")
    System_Ext(resend, "Resend", "Transactional email")
    ContainerDb_Ext(neon, "Neon Postgres", "Managed Postgres", "Contact-form enquiries")

    Rel(visitor, caddy, "HTTPS")
    Rel(admin, caddy, "HTTPS")
    Rel(caddy, app, "Reverse proxy", "HTTP, 127.0.0.1:8080 → :4321")
    Rel(app, github, "Content read/write; OAuth", "HTTPS")
    Rel(app, posthog, "Events, queries, flag reads/writes", "HTTPS API")
    Rel(app, anthropic, "Chat completions", "HTTPS API")
    Rel(app, resend, "Send enquiry email", "HTTPS API")
    Rel(app, neon, "SQL via Drizzle", "Postgres protocol")
    Rel(github, ghcr, "CI builds & pushes image on push to main")
    Rel(ghcr, app, "docker compose pull && up -d diorama")
```

**Notes**
- The app is one container, one process — there's no separate CMS server; Keystatic runs embedded inside the same Astro server via `@keystatic/astro`.
- `PUBLIC_*` env vars (PostHog token/host, site domain) are baked in at **image build time**; everything else (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `DATABASE_URL`, `CONTACT_ADMIN_TOKEN`) is read at **container runtime** from the droplet's env file — see `src/lib/env.ts`. Mixing these up has broken production before (build-time placeholders getting shipped instead of real secrets).
- The droplet never compiles anything; CI builds the image on the GitHub Actions runner and the droplet just pulls + restarts.

---

## Level 3 — Components (inside the Astro Server container)

```mermaid
C4Component
    title Component diagram — Astro Server container

    Container_Boundary(app, "Astro Server") {
        Component(pages, "Pages & Layouts", "src/pages/**/*.astro, src/layouts/*.astro", "Static/hybrid marketing pages: home, services, tools rack, insights/blog, about, contact form UI")
        Component(apiRoutes, "API Routes", "src/pages/api/*.ts", "chat.ts, contact.ts, banner.ts — prerender=false server endpoints")
        Component(adminPages, "Admin Dashboards", "src/pages/admin/*.astro", "Cookie-gated: dashboard, leads, enquiries, chatbot config, tools & health, access, banner")
        Component(keystaticCms, "Keystatic CMS", "@keystatic/astro + keystatic.config.ts", "/keystatic editor UI; GitHub storage mode")
        Component(middleware, "Middleware", "src/middleware.ts", "Rewrites request URL from X-Forwarded-* headers, scoped to Keystatic's GitHub OAuth routes only")
        Component(contentCollections, "Content Collections", "src/content.config.ts + src/content/**", "blog, projects, charities, events — Zod-validated MDX, folder-per-entry with co-located images")
        Component(libHelpers, "Shared Lib", "src/lib/*.ts", "env.ts (secret()), keystatic.ts (image resolution), admin-auth.ts, posthog-{flags,query,server}.ts, chatbot-{context,override}.ts, chat-quality.ts, sheets.ts, carbon.ts")
    }

    System_Ext(github, "GitHub")
    System_Ext(posthog, "PostHog")
    System_Ext(anthropic, "Anthropic API")
    System_Ext(resend, "Resend")
    ContainerDb_Ext(neon, "Neon Postgres")

    Rel(pages, contentCollections, "getCollection() / getEntry()")
    Rel(pages, libHelpers, "resolveImageUrl(), site-content helpers")
    Rel(adminPages, libHelpers, "requireAdmin() cookie gate")
    Rel(apiRoutes, libHelpers, "secret(), chatbot-context, chat-quality, sheets")
    Rel(apiRoutes, anthropic, "chat.ts — chat completions")
    Rel(apiRoutes, resend, "contact.ts — send email")
    Rel(apiRoutes, neon, "contact.ts — Drizzle queries")
    Rel(keystaticCms, github, "Reads/writes MDX via GitHub storage mode")
    Rel(middleware, keystaticCms, "Fixes OAuth redirect_uri behind reverse proxy")
    Rel(libHelpers, posthog, "Events, analytics queries, feature-flag reads/writes")
```

**Notes**
- `content.config.ts` and `keystatic.config.ts` describe the *same* content independently (no shared codegen) — see `CLAUDE.md` for the sync gotcha.
- The two-field image pattern (`<name>` local upload / `<name>Url` external) and its resolvers in `lib/keystatic.ts` are what most page components go through to render an image, rather than reading collection fields directly.

---

## CI/CD flow (supplementary)

Not a C4 level, but the deploy path is architecturally significant enough to spell out:

```mermaid
flowchart LR
    A[Push to main] --> B[Typecheck: astro check]
    B --> C[Build Docker image]
    C --> D[Push image to GHCR]
    D --> E[SSH to droplet]
    E --> F["docker compose pull diorama"]
    F --> G["docker compose up -d diorama"]
```

See `.github/workflows/ci-cd.yml` and `CLAUDE.md` for details.

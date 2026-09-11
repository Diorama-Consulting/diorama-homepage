---
name: docker-status
description: SSH into the dioramaconsulting.co.uk droplet and produce a summary of Docker container status (health, uptime, ports, resource usage) with restarting/unhealthy/exited containers flagged. Use when asked for a Docker/container/deployment status check, health check, or "what's running" on the diorama server.
allowed-tools: Bash
---

# Docker Container Status — dioramaconsulting.co.uk

Produces a human-readable status summary of every Docker container running on the
Digital Ocean droplet that hosts dioramaconsulting.co.uk and its sub-apps.

## Connection details

- **Host**: `188.166.171.220` (current droplet IP — this has changed at least once before,
  so if the connection fails, ask the user to confirm the current IP rather than assuming
  the old one still works. Do not update `terraform.tfvars` or any tracked infra files
  from this skill; that's a separate, deliberate change.)
- **User**: `deploy`
- **Key**: `droplet_key` in the repo root (gitignored, do not print its contents)
- **Hostname on the box**: `diorama-website-new`

Standard connect/sanity check:

```bash
ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -i droplet_key deploy@188.166.171.220 "echo CONNECTED && hostname && uname -a"
```

If this fails with a connection error (not an auth error), the IP has likely changed again —
tell the user rather than guessing at a replacement.

## Gathering status

Run these over the same SSH connection (chain with `&&` or separate calls):

```bash
# Full container list: name, image, status/health, ports
ssh -i droplet_key deploy@188.166.171.220 \
  "docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'"

# Live resource usage (CPU / memory) — one-shot snapshot, not streaming
ssh -i droplet_key deploy@188.166.171.220 \
  "docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'"

# Disk headroom on the host (containers/images/volumes can fill this up)
ssh -i droplet_key deploy@188.166.171.220 "docker system df && df -h /"
```

## Reporting the summary

Build a table from `docker ps -a` with one row per container:

| Container | Status | Health | Notes |
|---|---|---|---|

- **Flag anything not `Up`** (`Exited`, `Restarting`, `Created`) as a problem needing attention.
- **Flag `(unhealthy)`** containers explicitly — Docker reports this in the `Status` column
  when a container defines a healthcheck that's currently failing.
- Note containers with no healthcheck at all (`Status` has no `(healthy)`/`(unhealthy)`
  suffix) — that's expected for some services, not itself a problem.
- Cross-reference container names against the public route map below so the summary can say
  *what's actually reachable*, not just what's running — a container can be `Up` and still be
  unreachable if Caddy's route to it is broken.
- Call out anything with unusually high CPU/mem in the `docker stats` snapshot.
- Keep the summary concise: a table plus 2-4 sentences of narrative (what's healthy, what
  needs attention, what changed vs. expectations), not a wall of raw command output.

## Known container → public route map

Diorama's droplet runs one container per app behind a single Caddy instance
(`/etc/caddy/Caddyfile` on the box). As of the last check, the map was:

| Container (docker ps name) | Internal port | Public path on dioramaconsulting.co.uk |
|---|---|---|
| `diorama-apps-diorama-1` | 8080 | `/` (root — Astro site) |
| `diorama-apps-friendly-digits-explorer-1` | 8081 | `/friendly-digits-explorer` |
| `diorama-apps-invoice-forge-frontend-1` | 8082 | `/invoice-forge` |
| `diorama-apps-invoice-forge-backend-1` | 8083 | `/invoice-forge-api` |
| `diorama-apps-quantum-frontend-1` | 8086 | `/quantum-curious` |
| `diorama-apps-quantum-backend-1` | 8087 | `/quantum-curious-api` |
| `diorama-apps-ai-news-backend-1` | 8089 | `/ai-newsagent-api` |
| `diorama-apps-ai-news-frontend-1` | 8088 | `/ai-newsagent` |
| `diorama-apps-team-timeline-tapestry-1` | 8090 | `/team-tapestry` |
| `diorama-apps-team-tracker-1` | 8093 | `/team-tracker` |
| `diorama-apps-ai-news-summarizer-1` | 8096 | `/ai-scout` (reports app) |
| `diorama-apps-the-mighty-fall-1` | 8098 | `/the-mighty-fall` |
| `diorama-apps-ailr-backend-1` | 8101 | `/ailr/api`, `/ailr/docs`, `/ailr/redoc`, `/ailr/openapi.json` |
| `diorama-apps-ailr-frontend-1` | 8102 | `/ailr` |
| `diorama-apps-contact-service-1` | 8104 | (internal — used by the root site) |

This table can drift as apps are added/removed. If `docker ps` shows a container not listed
here, say so rather than guessing its route — read `/etc/caddy/Caddyfile` on the box
(`ssh ... "cat /etc/caddy/Caddyfile"`) to confirm before reporting a path.

## Output format

Default to a concise Markdown table + short narrative in chat. Only build an Artifact if the
user asks for a dashboard/visual view — a status check is normally read once and discarded.

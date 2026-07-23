# Dockerfile — diorama-homepage (Astro 6, @astrojs/node standalone)
#
# Multi-stage: build with the full toolchain, ship a slim runtime image.
# Node 24 = current Active LTS; Astro 6 requires >=22.12.

# ---------------------------------------------------------------- build ----
FROM node:24-alpine AS build
WORKDIR /app

# Sharp needs these on alpine occasionally; cheap insurance.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# PUBLIC_-prefixed vars are baked into the client HTML AT BUILD TIME
# (see the long comment in ci-cd.yml) — they must be passed as build args,
# not runtime env. Server-only secrets (ANTHROPIC_API_KEY etc.) are the
# opposite: read at runtime, so placeholders here are fine.
ARG PUBLIC_POSTHOG_PROJECT_TOKEN
ARG PUBLIC_POSTHOG_HOST
ARG SITE_DOMAIN=dioramaconsulting.co.uk
ENV PUBLIC_POSTHOG_PROJECT_TOKEN=$PUBLIC_POSTHOG_PROJECT_TOKEN \
    PUBLIC_POSTHOG_HOST=$PUBLIC_POSTHOG_HOST \
    SITE_DOMAIN=$SITE_DOMAIN \
    ANTHROPIC_API_KEY=build-placeholder \
    RESEND_API_KEY=build-placeholder

RUN npm run build

# -------------------------------------------------------------- runtime ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    # 0.0.0.0 INSIDE the container is correct and safe — the compose file
    # publishes the port as 127.0.0.1:8080:4321 on the HOST, so it is still
    # unreachable from the internet except through Caddy.
    HOST=0.0.0.0 \
    PORT=4321

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 4321
USER node
CMD ["node", "./dist/server/entry.mjs"]

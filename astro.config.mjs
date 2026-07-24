// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import node from '@astrojs/node';

import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro'

// astro.config.mjs runs before Astro's normal import.meta.env exists, so it
// can't read env vars that way — loadEnv() is Vite's own mechanism for this
// exact situation. Tested directly: it correctly picks up SITE_DOMAIN both
// from a real .env file (local dev) and from a var exported straight into
// the process environment (which is what GitHub Actions' `env:` block does
// in ci-cd.yml) — one mechanism covers both cases.
const { SITE_DOMAIN } = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');

// Keeps the sitemap to genuinely public pages only. Admin, API, the
// Keystatic CMS UI, and gated tool-access routes are already server-only
// (prerender = false) so Astro shouldn't emit static pages for them in
// the first place — this filter is a second, explicit line of defence so
// a future page added under one of these paths can never silently leak
// into the public sitemap.
const SITEMAP_EXCLUDE_PATTERNS = [
  /\/admin(\/|$)/,
  /\/api(\/|$)/,
  /\/keystatic(\/|$)/,
  /\/tools\/gated(\/|$)/,
];

// https://astro.build/config
export default defineConfig({
    site: `https://${SITE_DOMAIN || 'dioramaconsulting.co.uk'}`,
    integrations: [
        mdx(),
        sitemap({
            filter: (page) => !SITEMAP_EXCLUDE_PATTERNS.some((pattern) => pattern.test(page)),
        }),
        react(),
        markdoc(),
        keystatic(),
    ],
    output: 'static',
    adapter: node({ mode: 'standalone' }),
    security: { checkOrigin: false },
});
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

// https://astro.build/config
export default defineConfig({
    site: `https://${SITE_DOMAIN || 'dioramas.uk'}`,
    integrations: [mdx(), sitemap(), react(), markdoc(), keystatic()],
    output: 'static',
    adapter: node({ mode: 'standalone' }),
});
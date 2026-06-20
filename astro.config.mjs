// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import node from '@astrojs/node';

import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
    site: 'https://dioramaconsulting.co.uk',
    integrations: [mdx(), sitemap()],
    output: 'static',
    adapter: vercel(),
});
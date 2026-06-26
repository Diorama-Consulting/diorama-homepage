// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import vercel from '@astrojs/vercel';

import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import keystatic from '@keystatic/astro'

// https://astro.build/config
export default defineConfig({
    site: 'https://dioramaconsulting.co.uk',
    integrations: [mdx(), sitemap(), react(), markdoc(), keystatic()],
    output: 'hybrid',
    adapter: vercel(),
});
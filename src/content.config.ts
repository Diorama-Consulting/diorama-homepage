// src/content.config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  // Remove the substackLoader — no more RSS, just files
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    heroImage: z.string().optional(),
    // content is handled automatically by Astro from the .mdx file
  }),
});

export const collections = { blog };
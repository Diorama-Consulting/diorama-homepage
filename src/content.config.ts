import { defineCollection, z } from 'astro:content';
import { substackLoader } from './loaders/substack';

const blog = defineCollection({
  loader: substackLoader('https://malm.substack.com/feed'),
  schema: z.object({
    title: z.string(),
    link: z.string(),
    pubDate: z.coerce.date(),
    description: z.string().optional(),
    heroImage: z.string().optional(),
  }),
});

export const collections = { blog };
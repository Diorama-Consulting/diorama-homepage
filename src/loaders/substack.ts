import Parser from 'rss-parser';
import type { Loader } from 'astro/loaders';

export function substackLoader(feedUrl: string): Loader {
  return {
    name: 'substack-loader',
    load: async ({ store, parseData }) => {
      const parser = new Parser({
        customFields: { item: [['content:encoded', 'fullContent']] },
      });
      const feed = await parser.parseURL(feedUrl);
      store.clear();

      for (const item of feed.items) {
        const slug = new URL(item.link!).pathname.split('/').filter(Boolean).pop()!;
        const html = (item as any).fullContent ?? item.content ?? '';

        const data = await parseData({
          id: slug,
          data: {
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            description: item.contentSnippet?.slice(0, 160),
            heroImage: item.enclosure?.url,
          },
        });

        store.set({ id: slug, data, rendered: { html } });
      }
    },
  };
}
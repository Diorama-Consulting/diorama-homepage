import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { reader } from '../lib/keystatic';

export async function GET(context) {
	const siteSettings = await reader.singletons.siteSettings.read();
	const posts = await getCollection('blog', ({ data }) => !data.draft);

	return rss({
		title: siteSettings?.siteName ?? 'Diorama Consulting Ltd',
		description: siteSettings?.defaultSeoDescription ?? '',
		site: context.site,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: `/blog/${post.id}/`,
			// heroImage is intentionally NOT spread here — it's stored as a
			// { discriminant, value } object (see lib/keystatic.ts) and would
			// serialize into malformed RSS XML if included directly.
		})),
	});
}

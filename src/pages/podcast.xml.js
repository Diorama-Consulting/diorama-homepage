import { getCollection } from 'astro:content';
import { reader } from '../lib/keystatic';

// Byte length for each episode's MP3 enclosure. RSS 2.0 requires
// <enclosure length="..."> to be accurate for podcast apps to show correct
// download/progress sizes — since these files are hosted directly on the
// droplet (via Caddy, outside this repo/build — see CLAUDE.md's "Podcast
// audio" note) rather than through Astro, there's no local file to stat at
// build time. Sizes below are fixed: this is the exact byte count of each
// transcoded MP3 as uploaded; update this map only if a file is replaced.
const AUDIO_BYTES = {
  'tech-organisation-design': 19722861,
  'ai-and-business-transformation': 11470509,
  'experiments-in-ai-coding': 14440941,
  'team-tapestry': 11848365,
  'how-data-unlocks-ai-success': 14171373,
  '75-years-of-the-turing-test': 8514189,
  'seeking-solis': 16269453,
};

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(context) {
  const siteSettings = await reader.singletons.siteSettings.read();
  const siteName = siteSettings?.siteName ?? 'Diorama Consulting Ltd';
  const founderName = siteSettings?.founderName ?? 'Mal Minhas';

  const siteUrl = context.site?.toString().replace(/\/$/, '') ?? 'https://dioramaconsulting.co.uk';
  const feedUrl = `${siteUrl}/podcast.xml`;
  const coverImage = `${siteUrl}/images/podcast-cover.png`;
  const channelDescription =
    "NotebookLM-generated audio companions to Mal Minhas' Insights articles on AI, data, and tech leadership, published by Diorama Consulting.";

  const posts = (await getCollection('blog', ({ data }) => !data.draft && Boolean(data.audioUrl))).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );

  const items = posts
    .map((post) => {
      const { title, description, pubDate, audioUrl, audioTitle } = post.data;
      const pageUrl = `${siteUrl}/insights/${post.id}/`;
      const summary = description ?? title;
      const length = AUDIO_BYTES[post.id] ?? 0;

      return `    <item>
      <title>${escapeXml(audioTitle || title)}</title>
      <link>${escapeXml(pageUrl)}</link>
      <guid isPermaLink="false">${escapeXml(audioUrl)}</guid>
      <pubDate>${pubDate.toUTCString()}</pubDate>
      <description>${escapeXml(summary)}</description>
      <itunes:subtitle>${escapeXml(summary)}</itunes:subtitle>
      <itunes:summary>${escapeXml(summary)}</itunes:summary>
      <itunes:author>${escapeXml(founderName)}</itunes:author>
      <itunes:explicit>false</itunes:explicit>
      <itunes:image href="${escapeXml(coverImage)}"/>
      <enclosure url="${escapeXml(audioUrl)}" length="${length}" type="audio/mpeg"/>
    </item>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)} — Insights (Audio)</title>
    <link>${escapeXml(siteUrl)}/insights/</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
    <language>en-gb</language>
    <description>${escapeXml(channelDescription)}</description>
    <itunes:author>${escapeXml(founderName)}</itunes:author>
    <itunes:summary>${escapeXml(channelDescription)}</itunes:summary>
    <itunes:owner>
      <itunes:name>${escapeXml(founderName)}</itunes:name>
    </itunes:owner>
    <itunes:image href="${escapeXml(coverImage)}"/>
    <itunes:category text="Technology"/>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    <image>
      <url>${escapeXml(coverImage)}</url>
      <title>${escapeXml(siteName)} — Insights (Audio)</title>
      <link>${escapeXml(siteUrl)}/insights/</link>
    </image>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}

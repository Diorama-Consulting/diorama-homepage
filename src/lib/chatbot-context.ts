// src/lib/chatbot-context.ts — REWRITTEN.
//
// Why: the previous version only read a handful of early Keystatic fields
// (services tiles, the old capabilities list, page subheadings). After
// the site's content moved into the service-area catalogue, outcomes,
// tools collection and charity programme, the bot's knowledge base ended
// up nearly empty whenever those old fields were sparse in Keystatic —
// producing "not enough information about the site" answers even though
// the pages themselves were rich.
//
// Now: the knowledge base is built from src/lib/site-content.ts (the same
// single source of truth the pages render from, exact defaults included)
// PLUS live Keystatic content PLUS the tools collection. If a Keystatic
// field is empty, the bot gets the same default text a visitor sees — the
// bot can never again know less than the website shows.
//
// Still plain context-stuffing into one system prompt (the whole site is
// a few pages of copy — no vector search needed), cached for 5 minutes.

import { getCollection } from 'astro:content';
import { reader } from './keystatic';
import {
  CORE_POSITIONING,
  OUTCOMES_INTRO,
  THIRD_SECTOR_LAB,
  resolveOutcomes,
  resolvePositioning,
  resolveServiceAreas,
} from './site-content';

function section(heading: string, body: string | null | undefined): string {
  const text = (body ?? '').trim();
  return text ? `## ${heading}\n${text}\n` : '';
}

function bulletList(items: (string | null | undefined)[]): string {
  return items.filter(Boolean).map((item) => `- ${item}`).join('\n');
}

// Strip Markdown links down to "text (url)" so the model reads clean prose.
function plain(md: string): string {
  return md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
}

let cached: { text: string; expiresAt: number } | null = null;

export async function buildKnowledgeBase(ttlMs = 5 * 60 * 1000): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.text;
  }

  const [siteSettings, positioning, servicesConsulting, servicesCharities, about, aboutFounder, faqPage, teachingPage, contactPage] =
    await Promise.all([
      reader.singletons.siteSettings.read(),
      reader.singletons.positioning.read().catch(() => null),
      reader.singletons.servicesConsulting.read(),
      reader.singletons.servicesCharities.read(),
      reader.singletons.about.read(),
      reader.singletons.aboutFounder.read(),
      reader.singletons.faqPage.read(),
      reader.singletons.teachingPage.read(),
      reader.singletons.contactPage.read().catch(() => null),
    ]);

  const tools = await getCollection('projects', ({ data }) => !data.draft && !data.restricted).catch(() => []);

  const parts: string[] = [];

  // --- Who Diorama is (exact positioning, Keystatic-overridable) ---
  const pos = resolvePositioning(positioning);
  parts.push(
    section(
      'About Diorama Consulting',
      [
        ...pos.paragraphs,
        bulletList(pos.points),
        siteSettings?.defaultSeoDescription,
        ...(about?.bodyParagraphs ?? []),
      ]
        .filter(Boolean)
        .join('\n\n'),
    ),
  );

  parts.push(
    section(
      'Founder',
      aboutFounder?.paragraphs?.length
        ? `${siteSettings?.founderName ?? 'Mal Minhas'} — ${aboutFounder.paragraphs.join(' ')}`
        : 'Diorama Consulting is led by Mal Minhas.',
    ),
  );

  // --- The four outcomes (exact, overridable) ---
  const outcomes = resolveOutcomes(positioning?.outcomes);
  parts.push(
    section(
      'Four key business outcomes',
      `${OUTCOMES_INTRO}\n${bulletList(outcomes.map((o) => `${o.title}: ${o.description}`))}`,
    ),
  );

  // --- The full service catalogue (exact defaults if Keystatic empty) ---
  const areas = resolveServiceAreas(servicesConsulting?.serviceAreas);
  parts.push(
    section(
      'Consulting services (full catalogue)',
      areas
        .map((a) => `### ${a.title}\n${plain(a.intro)}\n${bulletList(a.bullets.map(plain))}`)
        .join('\n\n'),
    ),
  );

  // --- Charity work ---
  parts.push(
    section(
      'Charity support',
      [
        servicesCharities?.subheading,
        `Third Sector Lab programme: ${THIRD_SECTOR_LAB.intro}`,
        `BrightHope CRM: ${THIRD_SECTOR_LAB.brighthope}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    ),
  );

  // --- Live tools ---
  if (tools.length > 0) {
    parts.push(
      section(
        'Tools built by Diorama (live on this site)',
        bulletList(
          tools
            .sort((a, b) => a.data.order - b.data.order)
            .map((t) => `${t.data.title}${t.data.tagline ? ` — ${t.data.tagline}` : ''}${t.data.summary ? `. ${t.data.summary}` : ''} (details: /tools/${t.id}/)`),
        ),
      ),
    );
  }

  parts.push(section('Teaching / executive AI coaching', teachingPage?.subheading));

  // --- Contact ---
  parts.push(
    section(
      'How to get in touch',
      [
        'Visitors can use the contact form at /contact — Diorama replies within a couple of working days.',
        contactPage?.subheading,
      ]
        .filter(Boolean)
        .join(' '),
    ),
  );

  // --- FAQ ---
  const faqText = (faqPage?.categories ?? [])
    .flatMap((category) =>
      (category.questions ?? []).map((q) => `Q: ${q.question}\nA: ${(q.answer ?? '').replace(/\n+/g, ' ')}`),
    )
    .join('\n\n');
  parts.push(section('Frequently asked questions', faqText));

  const text = parts.filter(Boolean).join('\n');
  cached = { text, expiresAt: Date.now() + ttlMs };
  return text;
}

// Fallback guard used by /api/chat: if the assembled knowledge base is
// implausibly small (a build/content issue), it still always contains the
// exact core positioning — so the bot can never truthfully say it has no
// information about the site.
export function minimumKnowledge(): string {
  return `## About Diorama Consulting\n${CORE_POSITIONING.join('\n\n')}`;
}

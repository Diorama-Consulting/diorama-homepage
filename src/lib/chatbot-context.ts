// src/lib/chatbot-context.ts
//
// Builds the chat assistant's "knowledge" from content that already exists
// in Keystatic — services, about, FAQ, teaching — rather than asking Paolo
// to author a second, separate knowledge base that will inevitably drift
// out of sync with the real pages. Editing a page in Keystatic updates the
// live site AND what the assistant knows, in the same commit.
//
// This is plain context-stuffing, not fine-tuning: Claude models aren't
// retrained on custom data through the API. The whole knowledge base below
// is small (a handful of pages of copy), so it comfortably fits inside a
// single system prompt with room to spare — no chunking or vector search
// needed. See the note in pages/api/chat.ts for when that would change.
//
// Deliberately NOT included: servicesConsulting's `testimonials` (client
// quotes shouldn't be paraphrased by an LLM) and anything under
// siteSettings' company-registration fields (no reason for a chatbot to be
// reciting a VAT number).

import { reader } from './keystatic';

function section(heading: string, body: string | null | undefined): string {
  const text = (body ?? '').trim();
  return text ? `## ${heading}\n${text}\n` : '';
}

function bulletList(items: string[]): string {
  return items.filter(Boolean).map((item) => `- ${item}`).join('\n');
}

/**
 * Assembles the knowledge-base portion of the chat system prompt.
 * Cached in memory for `ttlMs` (default 5 minutes) so a burst of chat
 * requests doesn't each re-read every singleton from Keystatic's GitHub-mode
 * reader — long enough to matter for cost/latency, short enough that a
 * content edit shows up in the bot within minutes without a redeploy.
 */
let cached: { text: string; expiresAt: number } | null = null;

export async function buildKnowledgeBase(ttlMs = 5 * 60 * 1000): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.text;
  }

  const [siteSettings, servicesIndex, servicesConsulting, servicesCharities, about, aboutFounder, faqPage, teachingPage] =
    await Promise.all([
      reader.singletons.siteSettings.read(),
      reader.singletons.servicesIndex.read(),
      reader.singletons.servicesConsulting.read(),
      reader.singletons.servicesCharities.read(),
      reader.singletons.about.read(),
      reader.singletons.aboutFounder.read(),
      reader.singletons.faqPage.read(),
      reader.singletons.teachingPage.read(),
    ]);

  const parts: string[] = [];

  parts.push(
    section(
      'About Diorama Consulting',
      [siteSettings?.defaultSeoDescription, ...(about?.bodyParagraphs ?? [])].filter(Boolean).join('\n\n'),
    ),
  );

  parts.push(
    section(
      'Founder',
      aboutFounder?.paragraphs?.length
        ? `${siteSettings?.founderName ?? 'Mal Minhas'} — ${aboutFounder.paragraphs.join(' ')}`
        : undefined,
    ),
  );

  parts.push(
    section(
      'Services overview',
      [
        servicesIndex?.subheading,
        bulletList((servicesIndex?.tiles ?? []).map((t) => `${t.title}: ${t.description}`)),
      ]
        .filter(Boolean)
        .join('\n\n'),
    ),
  );

  parts.push(
    section(
      'Consulting — for boards, founders & investors',
      [
        servicesConsulting?.subheading,
        bulletList((servicesConsulting?.capabilities ?? []).map((c) => `${c.title}: ${c.description}`)),
      ]
        .filter(Boolean)
        .join('\n\n'),
    ),
  );

  parts.push(section('Charity support', servicesCharities?.subheading));

  parts.push(section('Teaching / executive AI coaching', teachingPage?.subheading));

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
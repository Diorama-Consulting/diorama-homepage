import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { reader } from '../../lib/keystatic';
import { buildKnowledgeBase } from '../../lib/chatbot-context';
import { getPostHogServer } from '../../lib/posthog-server';

export const prerender = false;

const anthropic = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });

// Cheap, fast model — this is a marketing-site FAQ assistant, not a
// reasoning task. Swap to 'claude-sonnet-5' if answers need to get sharper
// as the knowledge base grows. See /mnt/skills/public/product-self-knowledge
// equivalent (docs.claude.com) before changing model strings — they do
// change over time.
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 500;
const MAX_TURNS = 10; // messages kept from the client-sent history
const MAX_MESSAGE_LENGTH = 2000; // characters, per message

// --- Minimal in-memory rate limit -------------------------------------
// Good enough for a single-process deployment behind Caddy (this project's
// target — see the Caddy section of the deploy notes). Resets on restart
// and doesn't share state across multiple instances; if this ever runs
// behind more than one Node process, move this to a small Redis/Upstash
// instance, or a row in the Google Sheet if you want to stay dependency-free.
const requestLog = new Map<string, number[]>();
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 10 * 60 * 1000; // per 10 minutes, per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT;
}

function clientIp(request: Request): string {
  // Caddy's reverse_proxy sets this by default (see deploy/Caddyfile.example).
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function sanitizeHistory(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (m): m is ChatMessage =>
        m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }))
    .slice(-MAX_TURNS);
}

export const POST: APIRoute = async ({ request }) => {
  // Same-origin only — this key costs real money per call, and there's no
  // reason for another site to be calling it directly from a browser.
  // Doesn't stop server-to-server abuse, only casual cross-site embedding;
  // the rate limit below is the real backstop.
  //
  // Behind Caddy, request.url reflects the internal connection (Caddy talks
  // to this Node process over plain HTTP on 127.0.0.1), not the public
  // https://dioramaconsulting.co.uk the browser actually used — so it can
  // never match a real browser's Origin header. Reconstruct the public
  // origin from the X-Forwarded-Host/-Proto headers Caddy sets by default
  // instead, falling back to request.url only when those aren't present
  // (e.g. local dev with no proxy in front).
  const origin = request.headers.get('origin');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const site = forwardedHost ? `${forwardedProto || 'https'}://${forwardedHost}` : new URL(request.url).origin;
  if (origin && origin !== site) {
    return json({ error: 'Forbidden' }, 403);
  }

  const ip = clientIp(request);
  if (isRateLimited(ip)) {
    const distinctId = request.headers.get('X-PostHog-Distinct-Id') || `chat-anon-${ip}`;
    const posthog = getPostHogServer();
    posthog.capture({ distinctId, event: 'chat_rate_limited' });
    return json({ error: "Too many messages — please wait a few minutes and try again, or use the contact form." }, 429);
  }

  const chatbotSettings = await reader.singletons.chatbotSettings.read();
  if (chatbotSettings?.enabled === false) {
    return json({ error: 'Chat is currently unavailable.' }, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const messages = sanitizeHistory((body as { messages?: unknown })?.messages);
  if (messages.length === 0) {
    return json({ error: 'No message provided.' }, 400);
  }

  const knowledgeBase = await buildKnowledgeBase();
  const persona =
    chatbotSettings?.personaInstructions ||
    'You are the website assistant for Diorama Consulting Ltd. Answer only from the context provided.';
  const extra = chatbotSettings?.extraContext ? `\n\n## Additional notes\n${chatbotSettings.extraContext}` : '';

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: `${persona}\n\n# CONTEXT\n${knowledgeBase}${extra}`,
          // This system prompt is identical for every visitor and only
          // changes when someone edits content in Keystatic (the 5-minute
          // cache in chatbot-context.ts). Marking it ephemeral lets
          // Anthropic cache it server-side, so a burst of concurrent chats
          // only pays full price for the first request in each ~5 minute
          // window. See docs.claude.com/en/docs/build-with-claude/prompt-caching.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    const reply = response.content.find((block) => block.type === 'text')?.text?.trim();

    const sessionId = request.headers.get('X-PostHog-Session-Id') || undefined;
    const distinctId = request.headers.get('X-PostHog-Distinct-Id') || `chat-anon-${ip}`;
    const posthog = getPostHogServer();
    posthog.capture({
      distinctId,
      event: 'chat_message_processed',
      properties: {
        $session_id: sessionId,
        turn_count: messages.length,
        input_tokens: response.usage?.input_tokens,
        output_tokens: response.usage?.output_tokens,
      },
    });

    return json({ reply: reply || "Sorry, I didn't catch that — could you rephrase?" });
  } catch (error) {
    console.error('Anthropic API error in /api/chat:', error);
    return json({ error: 'The assistant is temporarily unavailable — please try the contact form instead.' }, 502);
  }
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
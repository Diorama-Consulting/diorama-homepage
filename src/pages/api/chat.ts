import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { reader } from '../../lib/keystatic';
import { buildKnowledgeBase } from '../../lib/chatbot-context';
import { getPostHogServer } from '../../lib/posthog-server';
import { secret } from '../../lib/env';

export const prerender = false;

// The client is created lazily, per-process, with the key read at RUNTIME
// via secret() — never at module load via import.meta.env. Module-scope
// `new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY })` was the
// bug that broke the bot after containerisation: the build-time placeholder
// got baked in and the container's real env_file value was never read.
// See src/lib/env.ts for the full story.
let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (anthropic) return anthropic;
  const apiKey = secret('ANTHROPIC_API_KEY');
  if (!apiKey) return null;
  anthropic = new Anthropic({ apiKey });
  return anthropic;
}

// Cheap, fast model — this is a marketing-site FAQ assistant, not a
// reasoning task. Check docs.claude.com before changing model strings.
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 500;
const MAX_TURNS = 10; // messages kept from the client-sent history
const MAX_MESSAGE_LENGTH = 2000; // characters, per message

// --- Minimal in-memory rate limit -------------------------------------
// Good enough for a single-process deployment behind Caddy. Resets on
// restart; if this ever runs as more than one replica, move it to Redis.
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
  // Same-origin only. Behind Caddy, reconstruct the public origin from
  // X-Forwarded-Host/-Proto (request.url reflects the internal 127.0.0.1
  // connection, never the public origin the browser used).
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
    getPostHogServer().capture({ distinctId, event: 'chat_rate_limited' });
    return json({ error: 'Too many messages — please wait a few minutes and try again, or use the contact form.' }, 429);
  }

  const chatbotSettings = await reader.singletons.chatbotSettings.read();
  if (chatbotSettings?.enabled === false) {
    return json({ error: 'Chat is currently unavailable.' }, 503);
  }

  const client = getAnthropic();
  if (!client) {
    // Configuration problem, not a user problem — log loudly, degrade politely.
    console.error('/api/chat: ANTHROPIC_API_KEY is not set in the runtime environment.');
    return json({ error: 'The assistant is temporarily unavailable — please use the contact form instead.' }, 503);
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
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: `${persona}\n\n# CONTEXT\n${knowledgeBase}${extra}`,
          // Identical for every visitor; changes only on Keystatic edits
          // (5-min cache in chatbot-context.ts). Ephemeral marking lets
          // Anthropic cache it server-side across concurrent chats.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    const reply = response.content.find((block) => block.type === 'text')?.text?.trim();

    const sessionId = request.headers.get('X-PostHog-Session-Id') || undefined;
    const distinctId = request.headers.get('X-PostHog-Distinct-Id') || `chat-anon-${ip}`;
    getPostHogServer().capture({
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

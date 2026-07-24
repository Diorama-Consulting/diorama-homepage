import type { APIRoute } from 'astro';
import { getPostHogServer } from '../../lib/posthog-server';
import { secret } from '../../lib/env';

export const prerender = false;

// The contact model, rebuilt: submissions go to the contact-service
// container (SQLite is the durable source of truth; it sends both the
// owner notification and the customer confirmation itself, and feeds the
// /admin/enquiries page). This endpoint is now a thin same-origin gateway:
// honeypot, validation, forward, analytics. Google Sheets and direct
// Resend calls are gone from the site entirely.
//
// CONTACT_SERVICE_URL:
//   container:  http://contact-service:8104   (compose service DNS)
//   PM2 fallback / local dev: http://127.0.0.1:8104
// Read at runtime via secret() — see src/lib/env.ts for why that matters.

function serviceUrl(): string {
  return secret('CONTACT_SERVICE_URL') || 'http://contact-service:8104';
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  const data = isJson
    ? await request.json()
    : Object.fromEntries(await request.formData());

  const name = String(data.name ?? '').trim();
  const email = String(data.email ?? '').trim();
  const message = String(data.message ?? '').trim();
  const honeypot = String(data.company ?? ''); // hidden field — see ContactForm.astro

  if (honeypot) {
    return respond(isJson, { ok: true }); // pretend success, drop silently
  }

  if (!name || !email || !message || !isValidEmail(email)) {
    return respond(isJson, { ok: false, error: 'Please fill in every field with a valid email.' }, 400);
  }

  let submissionId: string | undefined;
  try {
    const res = await fetch(`${serviceUrl()}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`contact-service responded ${res.status}`);
    submissionId = (await res.json())?.id;
  } catch (error) {
    console.error('contact-service unreachable or failed:', error);
    const domain = secret('SITE_DOMAIN') || 'dioramaconsulting.co.uk';
    return respond(
      isJson,
      { ok: false, error: `Something went wrong on our end — please try again, or email hello@${domain} directly.` },
      502,
    );
  }

  const sessionId = request.headers.get('X-PostHog-Session-Id') || undefined;
  const distinctId = request.headers.get('X-PostHog-Distinct-Id') || `contact-anon-${submissionId}`;
  getPostHogServer().capture({
    distinctId,
    event: 'contact_form_received',
    properties: { $session_id: sessionId, submission_id: submissionId },
  });

  return respond(isJson, { ok: true });
};

function respond(isJson: boolean, body: { ok: boolean; error?: string }, status = 200) {
  if (isJson) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const url = body.ok ? '/contact/thanks' : '/contact?error=1';
  return new Response(null, { status: 303, headers: { Location: url } });
}

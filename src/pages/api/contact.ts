import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { db } from '../../lib/db';
import { submissions } from '../../lib/schema';
import { getPostHogServer } from '../../lib/posthog-server';
import { appendContactSubmission } from '../../lib/sheets';

export const prerender = false;

const resend = new Resend(import.meta.env.RESEND_API_KEY);

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

  // Write to the database first — this is your source of truth.
  // Even if both emails below fail, the lead is never lost.
  const [row] = await db
    .insert(submissions)
    .values({ name, email, message })
    .returning();

  const sessionId = request.headers.get('X-PostHog-Session-Id') || undefined;
  const distinctId = request.headers.get('X-PostHog-Distinct-Id') || `contact-anon-${row.id}`;
  const posthog = getPostHogServer();
  posthog.capture({
    distinctId,
    event: 'contact_form_received',
    properties: {
      $session_id: sessionId,
      submission_id: row.id,
    },
  });

  // Notify you, confirm receipt to the sender, and log to the spreadsheet —
  // independently, so any one of the three failing doesn't block or roll
  // back the others.
  const results = await Promise.allSettled([
    resend.emails.send({
      from: 'Diorama site <notifications@dioramaconsulting.com>',
      to: 'hello@dioramaconsulting.com',
      replyTo: email,
      subject: `New enquiry from ${name}`,
      text: `${name} <${email}> wrote:\n\n${message}`,
    }),
    resend.emails.send({
      from: 'Diorama Consulting <hello@dioramaconsulting.com>',
      to: email,
      subject: 'Thanks for getting in touch',
      text: `Hi ${name},\n\nThanks for reaching out — we've received your message and will get back to you shortly.\n\nBest,\nDiorama Consulting`,
    }),
    appendContactSubmission({
      submissionId: row.id,
      submittedAt: row.createdAt.toISOString(),
      name,
      email,
      message,
    }),
  ]);

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const label = ['notification email', 'confirmation email', 'spreadsheet log'][i];
      console.error(`${label} failed for submission ${row.id}`, result.reason);
    }
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
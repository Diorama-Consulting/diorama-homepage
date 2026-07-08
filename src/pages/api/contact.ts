import type { APIRoute } from 'astro';
import { Resend } from 'resend';
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
 
  // No database anymore — this ID/timestamp used to come from the Postgres
  // row. Generated here instead, purely so the spreadsheet log has a stable
  // ID and timestamp per submission; nothing depends on it beyond that.
  const submissionId = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
 
  const sessionId = request.headers.get('X-PostHog-Session-Id') || undefined;
  const distinctId = request.headers.get('X-PostHog-Distinct-Id') || `contact-anon-${submissionId}`;
  const posthog = getPostHogServer();
  posthog.capture({
    distinctId,
    event: 'contact_form_received',
    properties: { $session_id: sessionId, submission_id: submissionId },
  });
 
  // With no database, the spreadsheet and the notification email are now
  // jointly the durable record — no single one of them is "the" source of
  // truth the way the DB write used to be. They still run independently,
  // so one failing doesn't block the others, but the three are no longer
  // equally disposable: if BOTH the notification email and the sheet log
  // fail, the lead is genuinely gone, and the visitor deserves to be told
  // that rather than a false "success" — the confirmation email failing
  // alone still doesn't matter to them.
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
    appendContactSubmission({ submissionId, submittedAt, name, email, message }),
  ]);
 
  // Resend's SDK does not throw on API-level failures (invalid key,
  // unverified domain, etc.) — it always resolves, with the problem
  // reported inside the resolved value's `error` field instead. Checking
  // only `status === 'rejected'` (as this used to) means a failed send
  // still counts as "fulfilled" and silently passes as success. Only
  // google-spreadsheet (the third entry) actually rejects on failure.
  results.forEach((result, i) => {
    const label = ['notification email', 'confirmation email', 'spreadsheet log'][i];
    if (result.status === 'rejected') {
      console.error(`${label} failed for submission ${submissionId}`, result.reason);
    } else if (i < 2 && (result.value as { error?: unknown })?.error) {
      console.error(`${label} failed for submission ${submissionId}`, (result.value as { error?: unknown }).error);
    }
  });
 
  const notificationOk = results[0].status === 'fulfilled' && !(results[0].value as { error?: unknown })?.error;
  const sheetOk = results[2].status === 'fulfilled';
 
  if (!notificationOk && !sheetOk) {
    // Both durability paths failed — genuinely lost, don't pretend otherwise.
    return respond(
      isJson,
      { ok: false, error: "Something went wrong on our end — please try again, or email hello@dioramaconsulting.com directly." },
      502,
    );
  }
 
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
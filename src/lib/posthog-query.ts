// src/lib/posthog-query.ts
//
// Shared PostHog Query API (HogQL) helper — the same mechanism
// /admin/dashboard.astro pioneered, factored out so the newer admin pages
// (/admin/leads, /admin/chatbot, /admin/tools) don't each re-implement the
// same ~30 lines of fetch/auth/error-handling boilerplate.
//
// Requires the same two env vars as the dashboard:
//   POSTHOG_PERSONAL_API_KEY — Settings → Personal API keys, "Query read" scope.
//   POSTHOG_PROJECT_ID       — the numeric id in the PostHog project URL.
// Every consumer must check `posthogConfigured` and degrade gracefully
// (an empty-state notice, same pattern as the dashboard) when it's false —
// this is a self-hosted admin tool, not a build-time dependency, so a
// missing key should never break a page render.
import { secret } from './env';

export const PH_PROJECT = secret('POSTHOG_PROJECT_ID');
const PH_KEY = secret('POSTHOG_PERSONAL_API_KEY');

// The Query + Feature Flag REST APIs live on the APP host
// (eu.posthog.com / us.posthog.com), not the ingestion host
// (eu.i.posthog.com) the browser snippet posts events to.
const ingestHost = (import.meta.env.PUBLIC_POSTHOG_HOST as string) || 'https://eu.i.posthog.com';
export const PH_APP_HOST = ingestHost.replace('.i.posthog.com', '.posthog.com');

export const posthogConfigured = Boolean(PH_KEY && PH_PROJECT);

// Tracks whether the MOST RECENT query attempt failed specifically due to
// an auth/permission problem (401/403) — distinct from "not configured at
// all" (missing env vars) or a transient network error. A personal API
// key can exist and still lack the "Query" read scope specifically (e.g.
// if only "Feature Flags" scope was ever granted) — that failure mode
// looks identical to "no data" unless callers check this and say so.
export let lastQueryAuthError = false;

export type HogQLRow = (string | number | boolean | null)[];

/** Escapes a value for safe interpolation into a single-quoted HogQL string literal. */
export function escapeHogQL(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function hogql(query: string): Promise<HogQLRow[]> {
  if (!posthogConfigured) return [];
  try {
    const res = await fetch(`${PH_APP_HOST}/api/projects/${PH_PROJECT}/query/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PH_KEY}`,
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      lastQueryAuthError = res.status === 401 || res.status === 403;
      console.error(`posthog-query: HogQL request failed ${res.status}: ${await res.text()}`);
      return [];
    }
    lastQueryAuthError = false;
    return (await res.json())?.results ?? [];
  } catch (e) {
    console.error('posthog-query: HogQL request error', e);
    return [];
  }
}

/** Link straight to a person's PostHog profile (their event feed + recordings tab). */
export function personUrl(distinctId: string): string {
  return `${PH_APP_HOST}/project/${PH_PROJECT}/person/${encodeURIComponent(distinctId)}`;
}

/** Link straight to a specific session replay recording. */
export function replayUrl(sessionId: string): string {
  return `${PH_APP_HOST}/project/${PH_PROJECT}/replay/${encodeURIComponent(sessionId)}`;
}

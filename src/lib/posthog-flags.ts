// src/lib/posthog-flags.ts
//
// Thin wrapper over PostHog's Feature Flags REST API
// (/api/projects/{id}/feature_flags/), used by /admin/tools as a
// site-wide kill switch per Docker tool ("flip it off for maintenance,
// visitors stop seeing it immediately, no redeploy").
//
// This is deliberately NOT used for per-visitor targeting/experiments —
// each tool gets exactly one boolean flag (key: `tool-<slug>`) whose own
// `active` field IS the on/off switch. That makes evaluation uniform for
// every visitor regardless of who they are, which is what a maintenance
// toggle needs (contrast with a normal rollout-percentage flag, which is
// intentionally visitor-dependent).
//
// Needs the SAME two env vars as posthog-query.ts, plus the personal API
// key must have "Feature Flag" write scope (Query read alone isn't
// enough for the POST/PATCH calls below).
import { secret } from './env';
import { PH_APP_HOST, PH_PROJECT, posthogConfigured } from './posthog-query';

const PH_KEY = secret('POSTHOG_PERSONAL_API_KEY');

// Same idea as posthog-query.ts's lastQueryAuthError: a key can exist and
// still lack the specific scope this file's calls need ("Feature Flag"
// read for listing, read+WRITE for create/toggle) — distinct from "not
// configured at all." Checked by /admin/tools to show a precise notice
// instead of silently doing nothing when a toggle click fails.
export let lastFlagAuthError = false;

export interface FeatureFlag {
  id: number;
  key: string;
  name: string;
  active: boolean;
}

async function phFetch(path: string, init?: RequestInit): Promise<Response | null> {
  if (!posthogConfigured) return null;
  try {
    const res = await fetch(`${PH_APP_HOST}/api/projects/${PH_PROJECT}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PH_KEY}`,
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    lastFlagAuthError = res.status === 401 || res.status === 403;
    return res;
  } catch (e) {
    console.error('posthog-flags: request error', e);
    return null;
  }
}

/** All feature flags in the project (paginated result flattened — a site this size won't hit the page limit). */
export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  const res = await phFetch('/feature_flags/?limit=200');
  if (!res || !res.ok) return [];
  const data = await res.json();
  return (data?.results ?? []).map((f: any) => ({ id: f.id, key: f.key, name: f.name, active: Boolean(f.active) }));
}

/**
 * Ensures a simple, always-on-for-everyone-unless-toggled flag exists for
 * a given key, creating it (defaulting to active/visible) if missing.
 * Returns null if PostHog isn't configured or the call failed.
 */
export async function ensureToolFlag(key: string, name: string): Promise<FeatureFlag | null> {
  const existing = (await listFeatureFlags()).find((f) => f.key === key);
  if (existing) return existing;

  const res = await phFetch('/feature_flags/', {
    method: 'POST',
    body: JSON.stringify({
      key,
      name,
      active: true,
      // 100% rollout, no conditions — "on" means genuinely everyone, so
      // flipping `active` to false is a true global kill switch rather
      // than a partial rollout change.
      filters: { groups: [{ properties: [], rollout_percentage: 100 }] },
    }),
  });
  if (!res || !res.ok) {
    if (res) console.error(`posthog-flags: create failed ${res.status}: ${await res.text()}`);
    return null;
  }
  const f = await res.json();
  return { id: f.id, key: f.key, name: f.name, active: Boolean(f.active) };
}

/** Flip a flag's own active state — the global on/off switch. */
export async function setFlagActive(flagId: number, active: boolean): Promise<boolean> {
  const res = await phFetch(`/feature_flags/${flagId}/`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
  if (!res || !res.ok) {
    if (res) console.error(`posthog-flags: update failed ${res.status}: ${await res.text()}`);
    return false;
  }
  return true;
}

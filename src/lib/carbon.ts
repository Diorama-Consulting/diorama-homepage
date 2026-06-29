// src/lib/carbon.ts
//
// Estimates per-pageview CO2 emissions using the Green Web Foundation's
// own CO2.js library (the same engine behind Website Carbon Calculator,
// Ecograder, WebPageTest's Carbon Control, and Mozilla's dev tooling).
//
// IMPORTANT — this does NOT assert that this site's hosting is green.
// `green` must come from a real, current Green Web Check result (read from
// the siteSettings singleton's `greenHostingVerified` field, kept honest by
// hand rather than hardcoded true) — see keystatic.config.ts for why this
// is editable, not a constant: hosting providers' verified status can and
// does lapse (DigitalOcean's own listing has lapsed and been reinstated
// before), so this must never be hardcoded as true without a live check
// behind it.

import { co2 } from '@tgwf/co2';

const swd = new co2({ model: 'swd', version: 4 });

export interface CarbonEstimate {
  grams: number;
  green: boolean;
}

/**
 * Estimate grams of CO2 for a single page visit, given the page's total
 * transferred bytes (HTML + CSS + JS + images actually sent over the wire).
 */
export function estimatePageCarbon(bytes: number, isGreenHost: boolean): CarbonEstimate {
  const grams = swd.perVisit(bytes, isGreenHost);
  return { grams, green: isGreenHost };
}

/**
 * Live-check a domain against the Green Web Foundation's dataset. Returns
 * null on any error (network unavailable at build time, domain not found,
 * non-JSON error response from the API, etc.) rather than throwing — a
 * failed check should never break a page build; the UI should just fall
 * back to showing nothing or a "not yet verified" state.
 */
export async function checkGreenHosting(domain: string): Promise<{
  green: boolean;
  hostedBy?: string;
} | null> {
  try {
    const checkHost = (await import('@tgwf/co2/hosting')).default;
    const result = await checkHost(domain);
    if (typeof result !== 'object' || result === null) return null;
    return {
      green: Boolean((result as Record<string, unknown>).green),
      hostedBy: (result as Record<string, unknown>).hosted_by as string | undefined,
    };
  } catch {
    return null;
  }
}

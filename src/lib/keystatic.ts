// src/lib/keystatic.ts
//
// Shared helpers for reading Keystatic singleton/collection content from
// Astro pages, and for resolving the two-field image pattern used
// throughout this project: every image is stored as two SEPARATE fields,
// `<name>` (a local upload, optional) and `<name>Url` (an external URL,
// optional) — never as a single fields.conditional() object.
//
// This replaced an earlier design using fields.conditional() to combine
// both options into one field storing { discriminant, value }. That was
// repeatedly observed writing a broken path for the uploaded file — a
// subfolder named after the FIELD key containing a file named after the
// CONDITIONAL BRANCH key (e.g. `heroImage/value.webp`) instead of
// co-locating next to the entry — confirmed directly against real saved
// Keystatic entries, not just documentation. A plain, non-nested
// fields.image() does not have this problem.
//
// Always call resolveImageUrl()/resolveImageSrc() with BOTH fields from a
// pair — never read `data.heroImage` or `data.heroImageUrl` directly in a
// page. Local upload takes precedence if somehow both are set.

import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import type { ImageMetadata } from 'astro';

export const reader = createReader(process.cwd(), keystaticConfig);

/**
 * Resolve an image pair to a plain URL string — for plain <img src> or
 * OG/Twitter meta tags. Pass the local-upload field first, the external-URL
 * field second; local takes precedence if both happen to be set.
 */
export function resolveImageUrl(
  local: ImageMetadata | undefined | null,
  url: string | undefined | null,
): string | undefined {
  if (local) return local.src;
  if (url) return url;
  return undefined;
}

/**
 * Resolve an image pair to whatever <Image /> (astro:assets) needs — a
 * plain string for an external URL, or the ImageMetadata object for a
 * local upload (Astro's <Image /> component accepts either).
 */
export function resolveImageSrc(
  local: ImageMetadata | undefined | null,
  url: string | undefined | null,
): string | ImageMetadata | undefined {
  if (local) return local;
  if (url) return url;
  return undefined;
}

/** True if the pair resolves to a local upload rather than an external URL. */
export function isLocalImage(
  local: ImageMetadata | undefined | null,
  url: string | undefined | null,
): boolean {
  return Boolean(local) && !url;
}

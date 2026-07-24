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

// ---------------------------------------------------------------------------
// SINGLETON IMAGE RESOLUTION — the fix for "local uploads never showed".
//
// IMPORTANT DISTINCTION between the two ways this codebase reads content:
//   1. Astro content collections (blog/projects/events/charities) — the
//      z.object schema's image() transform turns co-located files into
//      real ImageMetadata objects. `local.src` works there.
//   2. The Keystatic READER (all the `reader.singletons.*.read()` calls)
//      — this returns the RAW STRING stored in the YAML, e.g.
//      `trustedCompanies/1/logo.png`, relative to the field's configured
//      `directory` (e.g. `src/content/pages/home`). It is NOT an
//      ImageMetadata object, so the old `local.src` returned `undefined`
//      and every locally-uploaded singleton image (trusted-company logos,
//      the founder portrait, quote backdrops…) silently fell through and
//      was dropped/filtered. Only external `…Url` images ever rendered.
//
// This maps those raw string paths back to real, build-processed asset
// URLs by eagerly globbing every image under src/content/pages (the only
// place singleton uploads live) and matching on the path suffix. Vite
// then fingerprints/serves them like any other imported asset.
// ---------------------------------------------------------------------------
const singletonImages = import.meta.glob<{ default: ImageMetadata }>(
  '/src/content/pages/**/*.{png,jpg,jpeg,webp,avif,gif,svg}',
  { eager: true },
);

function resolveSingletonImage(value: string): ImageMetadata | undefined {
  const suffix = `/${value.replace(/^\/+/, '')}`;
  for (const [key, mod] of Object.entries(singletonImages)) {
    if (key.endsWith(suffix)) return mod.default;
  }
  return undefined;
}

type LocalImage = ImageMetadata | string | undefined | null;

/**
 * Resolve an image pair to a plain URL string — for plain <img src> or
 * OG/Twitter meta tags. Pass the local-upload field first, the external-URL
 * field second; local takes precedence if both happen to be set.
 *
 * Accepts either a real ImageMetadata (content-collection entries) or the
 * raw string path the Keystatic reader returns for singletons.
 */
export function resolveImageUrl(
  local: LocalImage,
  url: string | undefined | null,
): string | undefined {
  if (typeof local === 'string' && local) {
    const resolved = resolveSingletonImage(local);
    if (resolved) return resolved.src;
    // Already a served path (e.g. something in /public) — pass through.
    if (local.startsWith('/') || local.startsWith('http')) return local;
  } else if (local && typeof local === 'object') {
    return local.src;
  }
  if (url) return url;
  return undefined;
}

/**
 * Resolve an image pair to whatever <Image /> (astro:assets) needs — a
 * plain string for an external URL, or the ImageMetadata object for a
 * local upload (Astro's <Image /> component accepts either).
 */
export function resolveImageSrc(
  local: LocalImage,
  url: string | undefined | null,
): string | ImageMetadata | undefined {
  if (typeof local === 'string' && local) {
    const resolved = resolveSingletonImage(local);
    if (resolved) return resolved;
    if (local.startsWith('/') || local.startsWith('http')) return local;
  } else if (local && typeof local === 'object') {
    return local;
  }
  if (url) return url;
  return undefined;
}

/** True if the pair resolves to a local upload rather than an external URL. */
export function isLocalImage(
  local: LocalImage,
  url: string | undefined | null,
): boolean {
  return Boolean(local) && !url;
}

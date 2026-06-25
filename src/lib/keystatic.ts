// src/lib/keystatic.ts
//
// Shared helpers for reading Keystatic singleton/collection content from
// Astro pages, and for unwrapping the conditional image-field shape that
// Keystatic's fields.conditional() always produces:
//
//   { discriminant: true,  value: 'https://example.com/foo.jpg' }   — external URL
//   { discriminant: false, value: <ImageMetadata> }                  — local upload
//
// Never destructure a conditional image field as a bare string or pass it
// straight to <img src={...}> — always run it through one of the helpers
// below first. This is the exact bug class that broke the blog post pages
// twice before; centralising the unwrap here means there's only one place
// to get it right.

import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import type { ImageMetadata } from 'astro';

export const reader = createReader(process.cwd(), keystaticConfig);

type ConditionalImage =
  | { discriminant: true; value?: string | null }
  | { discriminant: false; value?: ImageMetadata | null }
  | null
  | undefined;

// Keystatic writes out the conditional-field "shell" object even when no
// value has been set — observed in both of these shapes:
//   { discriminant: false, value: null }   — value present but null
//   { discriminant: false }                — value key absent entirely
// `field.value == null` below is true for both `null` and `undefined`
// (absent), so every helper already treats both shapes the same as a
// genuinely missing field without needing to special-case which one shows up.

/** Unwrap to a plain URL string — for plain <img src> or OG/Twitter meta tags. */
export function imageUrl(field: ConditionalImage): string | undefined {
  if (!field || field.value == null) return undefined;
  return field.discriminant ? field.value : field.value.src;
}

/** Unwrap to whatever <Image /> (astro:assets) needs — string OR ImageMetadata. */
export function imageSrc(field: ConditionalImage): string | ImageMetadata | undefined {
  if (!field || field.value == null) return undefined;
  return field.discriminant ? field.value : field.value;
}

/** True if the field holds a local upload (ImageMetadata), false for an external URL. */
export function isLocalImage(field: ConditionalImage): boolean {
  return Boolean(field && field.value != null && !field.discriminant);
}

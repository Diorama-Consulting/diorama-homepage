// src/lib/site-banner.ts
//
// A site-wide alert banner ("Accepting new clients for August", "New tool
// added: [link]") that needs to appear/disappear INSTANTLY from
// /admin/banner — the same "no redeploy" requirement as the chatbot
// override, and for the same reason: this site is static-first (most
// pages are prerendered HTML), so there's no per-request server code to
// bake the banner into on every page.
//
// The fix mirrors that same pattern used elsewhere for exactly this
// problem: keep the banner state in memory on the running server, expose
// it through one tiny SSR API route (/api/banner, GET, public/no-auth
// since a banner message isn't sensitive), and have a small client-side
// script on every page fetch it once and inject it if active. Everything
// else on the page stays static; only this one small extra request is
// dynamic.
//
// In-memory + single-process, same caveat as chatbot-override.ts: resets
// on restart/redeploy, and won't be shared across replicas if this ever
// runs as more than one.
export type BannerTone = 'accent' | 'amber' | 'neutral';

export interface SiteBanner {
  active: boolean;
  message: string;
  linkHref?: string;
  linkText?: string;
  tone: BannerTone;
  updatedAt: string;
}

let current: SiteBanner = {
  active: false,
  message: '',
  tone: 'accent',
  updatedAt: new Date(0).toISOString(),
};

export function getSiteBanner(): SiteBanner {
  return current;
}

export function setSiteBanner(fields: {
  active: boolean;
  message: string;
  linkHref?: string;
  linkText?: string;
  tone?: BannerTone;
}): SiteBanner {
  current = {
    active: fields.active && Boolean(fields.message.trim()),
    message: fields.message.trim(),
    linkHref: fields.linkHref?.trim() || undefined,
    linkText: fields.linkText?.trim() || undefined,
    tone: fields.tone ?? 'accent',
    updatedAt: new Date().toISOString(),
  };
  return current;
}

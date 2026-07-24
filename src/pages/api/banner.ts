import type { APIRoute } from 'astro';
import { getSiteBanner } from '../../lib/site-banner';

// Public, unauthenticated, read-only — a banner message isn't sensitive,
// and requiring auth here would defeat the point (every visitor's browser
// calls this once per page load to see the current banner). Writing is
// only possible from /admin/banner, which IS token-gated.
export const prerender = false;

export const GET: APIRoute = async () => {
  const banner = getSiteBanner();
  return new Response(JSON.stringify(banner), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Short-lived cache is fine — a stale banner for a few seconds
      // after an admin change is a non-issue, and this keeps the extra
      // per-pageview request cheap.
      'Cache-Control': 'public, max-age=15',
    },
  });
};

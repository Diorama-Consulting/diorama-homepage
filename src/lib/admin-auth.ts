// src/lib/admin-auth.ts
//
// The same token-gate /admin/dashboard and /admin/enquiries each hand-roll
// (see the comments there for the full reasoning) — factored out here so
// the newer admin pages don't duplicate it a fourth/fifth/sixth time. The
// two original pages are left exactly as they were (lowest-risk choice —
// they already work); only new pages use this.
//
// Usage in an Astro page frontmatter:
//
//   export const prerender = false;
//   import { requireAdmin } from '../../lib/admin-auth';
//   const gate = await requireAdmin(Astro, '/admin/my-page');
//   if (gate instanceof Response) return gate;
//   const { ADMIN_TOKEN } = gate;
//
import type { AstroGlobal } from 'astro';
import { secret } from './env';

export const ADMIN_COOKIE = 'diorama_admin';

export async function requireAdmin(
  Astro: AstroGlobal,
  selfPath: string,
): Promise<{ ADMIN_TOKEN: string } | Response> {
  const ADMIN_TOKEN = secret('CONTACT_ADMIN_TOKEN') || '';
  const keyParam = Astro.url.searchParams.get('key');
  const cookieToken = Astro.cookies.get(ADMIN_COOKIE)?.value;

  if (ADMIN_TOKEN && keyParam === ADMIN_TOKEN) {
    Astro.cookies.set(ADMIN_COOKIE, ADMIN_TOKEN, {
      path: '/admin',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30,
    });
    return Astro.redirect(selfPath);
  }

  if (!ADMIN_TOKEN || cookieToken !== ADMIN_TOKEN) {
    return new Response('Not found', { status: 404 });
  }

  return { ADMIN_TOKEN };
}

/** The nav bar every admin page shares — kept in one place so adding a
 * page means editing one array, not six separate files. */
export const ADMIN_PAGES: { href: string; label: string }[] = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/leads', label: 'Leads & Journeys' },
  { href: '/admin/enquiries', label: 'Enquiries' },
  { href: '/admin/chatbot', label: 'Chatbot' },
  { href: '/admin/tools', label: 'Tools & Health' },
  { href: '/admin/access', label: 'Client Access' },
  { href: '/admin/banner', label: 'Site Banner' },
];

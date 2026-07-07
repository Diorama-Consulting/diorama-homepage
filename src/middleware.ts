// src/middleware.ts
//
// What this fixes: Keystatic builds its GitHub OAuth redirect_uri from the
// request it sees internally, not the public domain. Behind a reverse
// proxy — Caddy, in this setup — the request Keystatic's handler sees is
// "http://127.0.0.1:4321/..." rather than "https://dioramaconsulting.co.uk/...",
// so the redirect_uri it sends to GitHub doesn't match what's registered on
// the GitHub App, and sign-in fails. Known, still-open Keystatic issue:
// https://github.com/Thinkmill/keystatic/issues/1022 — this workaround
// (rewriting the request URL from the X-Forwarded-Host/-Proto headers Caddy
// already sends, for OAuth routes only) is the standard fix for this.
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const isOAuthRoute =
    context.url.pathname.includes('/github/oauth/') ||
    context.url.pathname.includes('/github/login');

  if (isOAuthRoute) {
    const forwardedHost = context.request.headers.get('x-forwarded-host');
    const forwardedProto = context.request.headers.get('x-forwarded-proto');

    if (forwardedHost && forwardedProto) {
      const correctUrl = new URL(context.url);
      correctUrl.protocol = forwardedProto;
      correctUrl.host = forwardedHost;

      const newRequest = new Request(correctUrl.toString(), {
        method: context.request.method,
        headers: context.request.headers,
        body: context.request.body,
        // @ts-ignore — required for requests with a body in this Fetch API context
        duplex: 'half',
      });

      Object.defineProperty(context, 'url', { value: correctUrl, writable: false });
      Object.defineProperty(context, 'request', { value: newRequest, writable: false });
    }
  }

  return next();
});
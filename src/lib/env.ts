// src/lib/env.ts
//
// THE FIX for the chatbot + contact breakage after containerisation.
//
// In Astro, `import.meta.env.<NAME>` for non-PUBLIC_ variables is inlined
// AT BUILD TIME. The Docker build intentionally runs with placeholder
// values (ANTHROPIC_API_KEY=build-placeholder etc. — see the Dockerfile),
// so those placeholders were baked into the server bundle, and the real
// values in /opt/apps/diorama/.env were never read at runtime. Result:
// Anthropic returned `authentication_error: invalid x-api-key` (it was
// literally being sent "build-placeholder") and Resend failed the same way.
//
// `process.env`, by contrast, is read at RUNTIME by the Node adapter — it
// sees whatever the container's env_file provides. So: every server-side
// secret must go through this helper, never import.meta.env directly.
// (PUBLIC_-prefixed vars are the opposite: build-time inlining is exactly
// what we want for those, since they ship to the browser — leave them on
// import.meta.env.)

export function secret(name: string): string | undefined {
  const runtime = process.env[name];
  if (runtime && runtime !== 'build-placeholder') return runtime;
  // Fall back to the inlined value only when it's real (covers `npm run
  // dev`, where import.meta.env reads .env directly and process.env may
  // not be populated by the dev server for every var).
  const inlined = (import.meta.env as Record<string, string | undefined>)[name];
  if (inlined && inlined !== 'build-placeholder') return inlined;
  return undefined;
}

export function requireSecret(name: string): string {
  const value = secret(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

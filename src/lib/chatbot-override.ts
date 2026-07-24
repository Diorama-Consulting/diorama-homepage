// src/lib/chatbot-override.ts
//
// A FAST, TEMPORARY override for the chatbot's system prompt fields —
// the thing Keystatic's personaInstructions/extraContext fields (see
// keystatic.config.ts → chatbotSettings) can't do: take effect without a
// commit + CI/CD redeploy. Keystatic's `storage: { kind: 'github' }`
// means an edit there commits to GitHub and only reaches the running
// container on the next build — exactly right for real content, too slow
// for "the bot just said something wrong, fix it in the next 30 seconds."
//
// This is intentionally IN-MEMORY, not written to disk or committed
// anywhere: it's cleared on restart/redeploy by design. Anything worth
// keeping permanently should still be copied into Keystatic afterwards —
// this module is the emergency lever, not a second source of truth.
// (A single-process deployment is assumed, same as the chat rate-limiter
// in api/chat.ts — if this ever runs as more than one replica, an
// override set on one instance won't be visible on the others.)

interface Override {
  personaInstructions?: string;
  extraContext?: string;
  updatedAt: string;
}

let current: Override | null = null;

export function getChatbotOverride(): Override | null {
  return current;
}

export function setChatbotOverride(fields: { personaInstructions?: string; extraContext?: string }): Override {
  current = {
    personaInstructions: fields.personaInstructions?.trim() || undefined,
    extraContext: fields.extraContext?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  return current;
}

export function clearChatbotOverride(): void {
  current = null;
}

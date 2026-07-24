// src/lib/chat-quality.ts
//
// Heuristic "did the bot actually help" flag, computed server-side right
// after each reply (see api/chat.ts) and stored as an event property so
// /admin/chatbot's "Unanswered / flagged" view can filter on it directly
// via HogQL rather than re-reading every transcript by eye. Deliberately
// simple pattern-matching, not a second LLM call — cheap, synchronous,
// good enough to triage which conversations are worth reading first.
export interface ChatQuality {
  flagged: boolean;
  reason?: string;
}

// Phrases the assistant tends to use when the knowledge base genuinely
// doesn't cover something — see chatbot-context.ts / the persona
// instructions, which explicitly tell it to "say so plainly" when unsure.
const UNCERTAIN_PATTERNS = [
  /\bi don'?t (?:know|have)\b/i,
  /\bnot (?:sure|certain)\b/i,
  /\bno information\b/i,
  /\bcan'?t find\b/i,
  /\bdoesn'?t (?:appear to |seem to )?(?:cover|include|mention)\b/i,
  /\bi'?m not able to\b/i,
  /\bunable to answer\b/i,
];

// Signals the VISITOR is frustrated or the bot looped/misunderstood —
// worth a human look regardless of how the reply reads on its own.
const FRUSTRATION_PATTERNS = [
  /\bthat'?s not (?:what i asked|helpful|right)\b/i,
  /\byou'?re not (?:understanding|listening|helping)\b/i,
  /\b(?:useless|pointless|rubbish|worthless)\b/i,
  /\bi already (?:said|told you|asked)\b/i,
  /\bwrong answer\b/i,
  /\bnone of (?:that|this) (?:helps|makes sense)\b/i,
];

export function assessChatQuality(userMessage: string, reply: string): ChatQuality {
  for (const pattern of FRUSTRATION_PATTERNS) {
    if (pattern.test(userMessage)) return { flagged: true, reason: 'Visitor expressed frustration' };
  }
  for (const pattern of UNCERTAIN_PATTERNS) {
    if (pattern.test(reply)) return { flagged: true, reason: "Bot said it didn't know / couldn't find an answer" };
  }
  // A conspicuously short reply to a substantive question is often a
  // non-answer even without one of the phrases above.
  if (reply.trim().length < 40 && userMessage.trim().length > 20) {
    return { flagged: true, reason: 'Unusually short reply' };
  }
  return { flagged: false };
}

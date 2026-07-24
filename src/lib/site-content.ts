// src/lib/site-content.ts
//
// SINGLE SOURCE OF TRUTH for the site's exact positioning copy.
//
// Every consumer — /services/consulting, OutcomesBand, AboutIntro, and
// critically the CHATBOT's knowledge base — imports these defaults rather
// than keeping its own copy. Keystatic values override them when set;
// when a Keystatic field is empty, everything (pages and bot alike) falls
// back to the same text. This is what fixes the "not enough info about
// the site" chatbot failure: previously the bot only read a handful of
// old Keystatic fields, so sparse CMS content meant an empty knowledge
// base even though the pages themselves showed rich (default) content.
//
// The wording here is the exact supplied positioning text — do not
// paraphrase. Change it in Keystatic (which overrides), or here
// deliberately.

export const CORE_POSITIONING = [
  'Diorama Consulting Ltd is an AI Technology Advisory service led by Mal Minhas with a focus on D2C marketplaces and products.',
  'We have unique industry experience in developing, delivering and evolving AI product software across startups, scale-ups, SMEs and Big Tech. We partner with C-Suite, Boards, Founders and Investors to bridge product strategy, engineering and AI.',
  'We can help you create defensible growth, reduce risk and accelerate value creation through. We also advise UK charities on AI and Digital Strategy:',
];

export const SIX_POINTS = [
  'Fractional/Interim leadership (CTO, CPTO)',
  'Pragmatic AI and Data Strategy aligned to P&L',
  'D2C marketplace optimisation and innovation',
  'Platform and architecture modernisation without rewrite',
  'Product Engineering team organisation design',
  'Practical operationalisation of sustainability initiatives',
];

export const OUTCOMES = [
  { title: 'Defensible growth', description: 'Data, platforms, and network effects measured in revenue, retention, and margin.' },
  { title: 'Lower delivery risk', description: 'Guardrails, governance, and observability to reduce incidents and compliance exposure.' },
  { title: 'Faster time-to-value', description: 'Lean roadmaps, paved paths, and automation to accelerate impact.' },
  { title: 'Resilience at scale', description: 'Architectures that evolve without wholesale rewrites.' },
];

export const OUTCOMES_INTRO =
  'Services provided by Diorama Consulting cover a broad spectrum of fractional and interim advisory focussed on four key business outcomes.';

export const DEFAULT_SERVICE_AREAS = [
  {
    title: 'Board and Investor Advisory',
    intro: 'Strategic guidance from pre-deal due diligence through post-investment value creation.',
    bullets: [
      'Technical & product due diligence and post-acquisition',
      '100-day acceleration plans',
      'Operating models, OKRs, and governance',
      'Risk reviews and executive readouts',
    ],
  },
  {
    title: 'Non-Executive and Trustee',
    intro: 'Board-level governance experience as a Non-Executive Director and charity Trustee, alongside advisory work.',
    bullets: [
      'Trustee at [Helpforce](https://helpforce.community/), a national NHS and community volunteering charity.',
      'Trustee at [Aston-Mansfield](https://www.aston-mansfield.org.uk/), a community charity supporting children, young people and families in Newham, London.',
      'Governance, risk, and digital/AI oversight at Board level',
      'Available for NED appointments, particularly where technology, AI or data strategy is on the agenda.',
    ],
  },
  {
    title: 'Marketplaces and Consumer Products',
    intro: 'Technology to support you from discovery and trust to growth loops, pricing, and unit economics.',
    bullets: [
      'Onsite and offsite advertising. SEO/GEO strategy.',
      'Search/discovery and conversion improvements',
      'Trust and safety: review integrity, identity/KYC, fraud detection',
      'Operational Tooling to support product catalog, disputes',
      'Product Experimentation and growth modelling',
      'Sustaining and Disruptive Product Innovation',
    ],
  },
  {
    title: 'AI and Data Strategy',
    intro: 'Pragmatic, safe adoption of AI tied directly to commercial outcomes based on our 3 step [AI Future Ready](https://dioramaconsulting.co.uk/ai-future-ready/) framework.',
    bullets: [
      'Agentic AI coding adoption support',
      'Use-case discovery and prioritisation',
      'Evaluation, guardrails, and observability',
      'Data platforms and AI-ready architectures',
      'Cost, safety, and ROI modelling',
      'Personalised AI executive training',
    ],
  },
  {
    title: 'AI Leadership Readiness (AILR)',
    intro: 'Our [AI Leadership Readiness (AILR)](/ailr) is a structured self-assessment that benchmarks individual and team readiness to lead with AI, built on our REACH™ framework.',
    bullets: [
      '40-question personal and team scorecard across five leadership domains.',
      'REACH™ readiness profile mapped to maturity levels.',
      'Personalised coaching reports with strengths and focus areas',
      'Team-level aggregation for coaches and team admins',
      'More information on AILR is available [here](/tools/ailr/).',
      '[Try out AILR today](/ailr)!',
    ],
  },
  {
    title: 'Platform Architecture and Modernisation',
    intro: 'Evolving legacy systems into scalable platforms with minimal disruption.',
    bullets: [
      'Domain-led decomposition and API-first target architecture',
      'Cloud, DevOps, and security baselining',
      'Paved paths and developer experience',
      'Resilience, SLOs, and cost controls',
      'Platform Engineering dimensioning',
    ],
  },
  {
    title: 'Tech Leadership and Organisation Design',
    intro: 'Right-sized tech organisation structures, roles, and practices that improve speed and quality.',
    bullets: [
      'Team topology and role clarity',
      'Hiring plans and capability mapping',
      'DORA/SPACE and outcome metrics',
      'Leadership coaching and operating rhythms',
      'Restructuring and Talent Density uplift',
    ],
  },
  {
    title: 'Climate-Tech Advisory',
    intro: 'Support for founders and funds building sustainability data products and infrastructure.',
    bullets: [
      'Product and data strategy',
      'Partnerships and go-to-market',
      'Impact framing and measurement',
      'Board advisory and diligence',
    ],
  },
];

export const THIRD_SECTOR_LAB = {
  intro:
    'These two sessions form an AI Leadership Readiness programme delivered to charity leaders through Third Sector Lab in 2026. Session 1 (13 May) introduced foundational AI literacy and governance frameworks for charity leadership teams. Session 2 (16 June) moved from frameworks to practical implementation, covering AI policy development, data classification, and a live demonstration of building a lightweight CRM for a fictional small charity called BrightHope directly from a spreadsheet. Feedback from both sessions was positive, with attendees consistently citing the practical, charity-specific framing as the key strength.',
  brighthope:
    'BrightHope is a proof-of-concept customer relationship management tool, built to show charities a practical middle step between an overstretched spreadsheet and a costly enterprise CRM. Developed with Lovable and Claude Code as a live demonstration for the second Third Sector Lab session, it illustrates how a small charity could track donors, supporters, and case records in a lightweight, purpose-built interface, without the procurement overhead of a full CRM platform.',
};

// ------------------------------------------------------------------
// Fallback resolvers: Keystatic value if present, exact default if not.
// Pages and the chatbot use THESE, never raw reads, so both always see
// the same content.
// ------------------------------------------------------------------
type KeystaticAreas = Array<{ title?: string | null; intro?: string | null; bullets?: string | null }> | undefined | null;

export function resolveServiceAreas(keystatic: KeystaticAreas) {
  if (keystatic?.length) {
    return keystatic
      .map((a) => ({
        title: a.title || '',
        intro: a.intro || '',
        bullets: (a.bullets || '').split('\n').map((b) => b.trim()).filter(Boolean),
      }))
      .filter((a) => a.title);
  }
  return DEFAULT_SERVICE_AREAS;
}

type KeystaticOutcomes = Array<{ title?: string | null; description?: string | null }> | undefined | null;

export function resolveOutcomes(keystatic: KeystaticOutcomes) {
  if (keystatic?.length) {
    return keystatic
      .map((o) => ({ title: o.title || '', description: o.description || '' }))
      .filter((o) => o.title);
  }
  return OUTCOMES;
}

export function resolvePositioning(keystatic: { paragraphs?: readonly string[] | null; points?: readonly string[] | null } | undefined | null) {
  return {
    paragraphs: keystatic?.paragraphs?.length ? [...keystatic.paragraphs] : CORE_POSITIONING,
    points: keystatic?.points?.length ? [...keystatic.points] : SIX_POINTS,
  };
}

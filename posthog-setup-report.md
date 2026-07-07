<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Diorama Consulting Astro (hybrid) site. Client-side tracking is initialised via a new `posthog.astro` snippet component included in both the main `Layout.astro` and the standalone `BlogPost.astro` layout. A server-side singleton (`src/lib/posthog-server.ts`) using `posthog-node` powers event capture in the two API routes. PostHog session and distinct IDs are forwarded from the browser to API routes via custom headers so client and server events are correlated in the same session. Environment variables (`PUBLIC_POSTHOG_PROJECT_TOKEN`, `PUBLIC_POSTHOG_HOST`) are set in `.env`.

| Event name | Description | File |
|---|---|---|
| `contact_form_submitted` | User successfully submits the contact form and receives a confirmation. | `src/components/ContactForm.astro` |
| `chat_opened` | User opens the AI chat widget for the first time on a page visit. | `src/components/ChatWidget.astro` |
| `chat_message_sent` | User sends a message in the AI chat widget. | `src/components/ChatWidget.astro` |
| `hero_cta_clicked` | User clicks the primary call-to-action button in the hero section. | `src/components/Hero.astro` |
| `teaching_tool_clicked` | User clicks through to an external teaching tool from the Teaching page. | `src/pages/teaching/index.astro` |
| `charity_link_clicked` | User clicks the 'Visit site' link to visit a charity's external website. | `src/pages/services/charities.astro` |
| `blog_post_viewed` | User views a blog post — tracked as the top of the content funnel. | `src/layouts/BlogPost.astro` |
| `contact_form_received` | Contact form submission is successfully written to the database on the server. | `src/pages/api/contact.ts` |
| `chat_message_processed` | AI chat request is successfully answered by the Anthropic API. | `src/pages/api/chat.ts` |
| `chat_rate_limited` | A chat request is rejected because the visitor has exceeded the rate limit. | `src/pages/api/chat.ts` |

## Next steps

We've built a dashboard and five insights in PostHog to keep an eye on user behaviour:

- [Analytics basics (wizard) — Dashboard](https://eu.posthog.com/project/218076/dashboard/799962)
- [Contact enquiries over time](https://eu.posthog.com/project/218076/insights/SHai56nl)
- [Chat engagement](https://eu.posthog.com/project/218076/insights/GP7Bw36S)
- [Teaching tool clicks by tool](https://eu.posthog.com/project/218076/insights/NgoLX4bO)
- [Hero CTA clicks (unique users/day)](https://eu.posthog.com/project/218076/insights/P0O35FVA)
- [Blog → contact conversion](https://eu.posthog.com/project/218076/insights/dLVa90pa)

## Verify before merging

- [ ] Run a full production build (`npm run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `PUBLIC_POSTHOG_PROJECT_TOKEN` and `PUBLIC_POSTHOG_HOST` to `.env.example` and any onboarding/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify in PostHog error tracking.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-astro-hybrid/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>

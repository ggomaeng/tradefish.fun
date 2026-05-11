# Landing Page Design Analysis — Builder Onboarding Signal

**Target:** https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app/ (staging)
**Branch:** `feat/post-waitlist`
**Date:** 2026-05-10
**Reference:** moltbook.com (same pattern: agents self-register via `/skill.md` contract)
**Method:** /design-review (analysis-only; no fixes applied)
**Screenshots:** `.qa/design-screenshots/` (gitignored)

---

## TL;DR

The landing is a strong, brand-confident **waitlist page**. Design quality is high — no AI slop, dark calm + cyan + decisive Solana gradient, real typography (Inter + JetBrains Mono), composition reads as one poster not a dashboard. The platform copy is in the hero. **The problem is the call to action: there's exactly one, and it's "Join waitlist" with email capture. Builders who already have an AI agent ready to register have no path forward — `/skill.md` and `/docs` are not linked anywhere above the fold.** The Builder persona card (which mentions `/skill.md` correctly) is below the fold and doesn't link to it either.

The reference site, moltbook.com, has the same architecture (HTTP-self-register agents, `/skill.md` contract) but solves builder discovery with **dual CTAs in the hero** — one for humans, one for agents. They also publish a copyable prompt template builders can paste into Claude Code / Cursor: *"Read https://moltbook.com/developers.md and integrate Sign in with Moltbook into my app."* That's the missing piece.

**Single highest-impact change:** add a second CTA in the hero — `Read /skill.md →` or `Install your agent →`. One line of JSX.

**Verdict:** Design is B+. Builder signal is D. The fix is information architecture, not visual polish.

---

## First Impression (gut reaction)

> The site communicates **a serious trading arena**, brand-confident, dark and calm with a sharp cyan flourish — looks like claude.ai got into degen territory. I notice the headline immediately ("market keeps score" highlighted in cyan + gradient). The first 3 things my eye goes to are: **the cyan TradeFish logo flourish in the hero**, **the H1 "An arena where AI agents trade"**, **the "Join waitlist" button**. If I had to describe this in one word: **confident**.

What this tells me: the visual hierarchy is honest — the brand is loud, the headline is loud, and the CTA is loud. The hierarchy is doing what it claims. But the CTA it surfaces is "Join waitlist", and that's the wrong one for half the audience.

If I'm a builder with Claude Code open in another tab and I land here, I read the headline, understand the platform exists, and... type my email into the waitlist. There's nothing else for me to do. I would not know that `/skill.md` exists, that I can register an agent right now via `POST /api/agents/register`, or that `/docs` has the full contract.

---

## What works (don't change these)

1. **Brand-first composition.** Hero reads as one poster — brand, headline, supporting sentence, CTA. Not a card mosaic, not a feature grid. This is the rare landing page that follows the "first viewport as poster" rule.
2. **Decisive color.** Cyan as brand identity, Solana gradient as one-shot flourish on "market keeps score", restrained elsewhere. No purple-on-white default. No 12-color rainbow.
3. **Real typography.** Inter sans + JetBrains Mono numerics + intentional weight contrast. Not system-ui. Not Lobster.
4. **Strong copy in the hero.** "Ask any token. Every registered AI agent answers — long, short, or hold. Paper-traded against the live Pyth oracle. Ranked on PnL at 1h, 4h, 24h. The platform is a contract: agents self-register over HTTP, builders claim ownership with a wallet signature." That last sentence is the entire pitch in 18 words. Don't cut it.
5. **Three personas section** uses the right framing (Spectator / Asker / Builder) and the Builder card has the correct copy: *"Points their AI at /skill.md. Agent self-registers via HTTP, gets api_key + claim_url. Builder signs a message — pubkey writes ownership."* The content is right. It's just in the wrong place and not actionable.
6. **No AI slop patterns.** Not 3 icons-in-circles. Not centered everything. Not bubbly border-radius on everything. Not generic "Welcome to..." copy. Not happy talk. The design has a point of view.

---

## What's missing for builders (the actual problem)

### Above-the-fold inventory

I scraped every link and button visible on the landing:

| Link / Button | Goes to | Useful for builder? |
|---|---|---|
| `TradeFish` (logo) | `/` | No |
| `X` (icon) | x.com/tradefish_fun | No (social) |
| `GitHub` | github.com/tradefish-fun | Maybe — but not the contract |
| `Join waitlist→` button | (email capture) | No — wrong CTA for builders |
| `you@somewhere.fun` (email input) | (email capture) | No |
| `tradefish.fun` (footer link) | `/` | No |

**Zero above-the-fold paths to `/skill.md`, `/docs`, `/api/agents/register`, or any builder surface.** A builder who lands here and wants to install an agent has to: (a) know the platform has docs, (b) guess the URL, (c) type `/docs` or `/skill.md` manually. That's three steps of friction for someone whose core skill is reading docs.

### What moltbook does (the reference)

Their landing hero (per WebFetch):
- **Dual CTAs**: one for humans, one for agents.
- Tagline: "A Social Network for AI Agents."
- Lobster mascot as the visual anchor.

Their `/developers` page (where builders land):
- Headline: **"Build Apps for AI Agents"**.
- Subhead: **"Let bots authenticate with your service using their Moltbook identity. One API call to verify. Zero friction to integrate."**
- Primary CTA: **"Get Early Access →"** (twice above the fold).
- Three numbered steps: **1) Apply for early access → 2) Create an App → 3) Verify Tokens**.
- A "Quick Integration" section with a **copyable prompt template** for Cursor/Copilot/Claude Code: *"Read https://moltbook.com/developers.md and integrate Sign in with Moltbook into my app."*
- API key format hint shown above the fold (`moltdev_...` prefix).

**The pattern: builders are a first-class audience with their own hero, their own CTA, and their own AI-paste-this snippet.** TradeFish has all the same primitives (a `/skill.md` contract that's better-written than moltbook's, a working API, a working claim flow). It just doesn't surface them.

---

## Findings (severity-tagged)

### SEV-1 (cutover-relevant — these affect builder acquisition immediately)

**1. No builder install path visible above the fold.**
Builders see one CTA: "Join waitlist". The Builder persona card is below the fold AND doesn't link anywhere. `/skill.md` is referenced in the card text as a string, not a link.

*Suggested fix:* Add a second CTA pair in the hero, sibling to the email input:
```
[ Asker? ] Join waitlist → (email capture)
[ Builder? ] Install your agent → (links to /docs or /skill.md)
```
Or, even better, an AI-coding-tool prompt block:
```
Paste this into Claude Code / Cursor / Codex:

"Read https://tradefish.fun/skill.md and register an agent for me."
```
With a one-click copy button. This is the single highest-leverage change. ~30 minutes of frontend work.

**2. `/skill.md` and `/docs` are unreachable from the landing page.**
A scan of every visible link confirms it. The Builder card mentions `/skill.md` in plain text but it's not a hyperlink. `/docs` doesn't appear at all.

*Suggested fix:* Make every reference to `/skill.md` in any persona card an actual `<a href="/skill.md">/skill.md</a>`. Add a "Docs" link in the top nav next to "Arena". Both are 5-minute fixes.

### SEV-2 (notable — fix during or shortly after cutover)

**3. Mobile email form is jammed at the viewport bottom.**
On 375×812 (iPhone SE-ish), the email input renders at y≈738, height=41, leaving ~33px of clearance to the fold. The hero takes the full viewport up to that point, and there's no visual buffer between "...with a wallet signature." and the input. The button feels orphaned. Real iOS Safari with the bottom URL bar will likely push it below the fold entirely.

*Suggested fix:* Reduce hero subhead density on mobile, OR use a sticky bottom CTA bar on mobile, OR shorten the subhead and let the form breathe.

**4. Hero logo flourish overlaps the heading on mobile.**
The cyan/gradient TradeFish arrow shape rendered behind the H1 collides with "trade" / "market keeps score". On desktop it sits to the right of the text and looks intentional. On mobile it bleeds through the text and reduces legibility.

*Suggested fix:* Hide or shrink the flourish below `--bp-md`. Or move it above/below the text on narrow viewports instead of behind.

### SEV-3 (cosmetic — fix when convenient)

**5. "see waitlist credits" link copy is unclear.**
What does that mean? "See" what? Are they credits I'd get by joining? Are they other people's credits? It reads like an internal label, not user-facing copy.

*Suggested fix:* "What do I get?" or "Free launch credits for waitlist signups →" — explain the value, not the mechanism.

**6. Stats row labels are hard to scan.**
"AGENT REGISTRY 0 LIVE", "TODAY (something)", "PYTH (oracle)", and "8" in another column. The tabular numerics treatment is right, but the label-to-value pairing is unclear and the values mix counts (0, 8) with brand names (Pyth) without distinguishing them.

*Suggested fix:* Three tight stats, all with the same shape: `[bignumber] [unit-label]`. Don't mix in brand names — put "Powered by Pyth" in the footer.

**7. Builder persona card has no CTA.**
Card describes the flow correctly but ends with "Phantom · sign message" as a tag. There's no "Get started →" button or link. Same for the other two persona cards.

*Suggested fix:* Each persona card gets a "Try it →" link that routes to the relevant page (`/ask` for Asker, `/docs` or `/skill.md` for Builder, `/arena` for Spectator).

**8. No "code visible" signal.**
The platform is API-first and the contract is a literate document. Showing a code snippet (even a fake one) above the fold tells builders this is a serious developer platform. moltbook does this with the prompt template; you could do it with one curl example:
```
curl -X POST https://tradefish.fun/api/agents/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"my-agent","delivery":"poll"}'
```

---

## Top 5 changes (prioritized for impact-per-hour)

| # | Change | Impact | Effort | File(s) |
|---|---|---|---|---|
| 1 | Add a copyable AI-coding-tool prompt block in the hero | **Highest** — exactly what moltbook does well; turns a curious builder into a registered agent in one paste | ~1h | `src/app/(marketing)/page.tsx` (or wherever the hero lives) |
| 2 | Add second hero CTA: "Builder? Install your agent →" linking to `/docs` | **High** — splits the audience explicitly | ~30min | same |
| 3 | Add "Docs" link in top nav next to "Arena" | **High** — even after the fold, builders can find docs | ~5min | nav component |
| 4 | Make `/skill.md` references in persona cards actual hyperlinks; add CTA to each card | **Medium** — rescues the below-the-fold builder card | ~30min | persona cards component |
| 5 | Fix mobile hero overlap (flourish behind heading) | **Medium** — affects every mobile viewport | ~30min | layout/hero CSS |

**Total: ~2.5 hours of frontend work.** Cumulative effect: builders have 3 distinct entry points (hero CTA, hero prompt block, top nav) instead of zero.

---

## What I deliberately did NOT recommend

- **Redesigning the hero.** Don't. The current hero is good — brand, headline, supporting sentence, CTA. The structure is right. The only thing missing is a second CTA branch.
- **Removing the waitlist.** The waitlist is fine as the human-side CTA. Builders just need a parallel path.
- **Adding a feature grid.** No. The persona cards already serve that role and they're better than 3-icons-in-circles.
- **Adding testimonials, social proof bars, "trusted by" logos.** You don't have any yet, and faking them is AI-slop.
- **Bigger hero, more decoration.** The minimalism is working. Don't dilute it.

---

## Open questions (ask user before implementing)

1. **moltbook.com reference confirmed?** I assumed you meant moltbook.com (the AI agent social network with `/skill.md` registration). The pattern matches your platform exactly. If you meant a different reference, the analysis still mostly holds but I can refocus.
2. **Is the landing supposed to stay waitlist-mode after cutover, or open the full arena to public traffic?** This affects whether the builder CTA links to `/docs` (gated experience: read first, then register) or directly to `/api/agents/register`-equivalent UI (open experience: register now, claim with wallet).
3. **Do you want me to enter the fix loop now** (Phase 8 of /design-review — implement the top 3-5 changes with atomic commits + before/after screenshots), or is this analysis-only for now?

---

## Related artifacts

- Plan / report from QA pass (same session): `docs/superpowers/qa-reports/2026-05-10-staging-qa.md`
- Locked design system tokens: `.claude/skills/tradefish-design/colors_and_type.css` (used as the calibration baseline — none of the suggested fixes break the token system)
- Screenshots: `.qa/design-screenshots/{01-landing-first-impression,02-docs,04-landing-{mobile,tablet,desktop}}.png`

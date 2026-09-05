# GSAP Motion Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install GSAP and add a restrained, accessible motion foundation to the two public product-story pages while documenting safe future uses.

**Architecture:** Keep the existing pages server-rendered. A small client-only motion component owns GSAP setup, scopes selectors to one page root, registers ScrollTrigger explicitly, and disables movement when the visitor requests reduced motion. Page markup opts into motion with data attributes, so content remains visible and usable if JavaScript fails.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, GSAP, `@gsap/react`, Vitest, Playwright

**Spec:** `HUNAR_OS_MASTER_BUILD_SPEC.md` sections 6, 10, 16 and `DESIGN.md` sections 4, 6, 8

## Global Constraints

- Motion is calm, directional, responsive, under 200ms for controls, and never required to understand a decision.
- Respect `prefers-reduced-motion` and leave all content visible without animation.
- Animate only transform and opacity.
- Preserve server rendering and do not add animation to safety, authorisation, recording, or repeated task controls.
- Keep the current Ticket 17 release-hardening changes intact.

---

### Task 1: Install and isolate the motion runtime

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/app/motion/public-page-motion.tsx`

**Interfaces:**

- Consumes: a page-root CSS selector passed as `rootSelector`
- Produces: `PublicPageMotion({ rootSelector }: { readonly rootSelector: string })`

- [ ] **Step 1: Install the official packages**

Run: `pnpm add gsap @gsap/react`

Expected: both packages appear in dependencies and the lockfile resolves them once.

- [ ] **Step 2: Add the client-only motion component**

Create a component that registers `useGSAP` and `ScrollTrigger`, scopes every selector to the page root, runs a short hero timeline, reveals marked sections once on scroll, and reverts all animations during cleanup.

- [ ] **Step 3: Add a reduced-motion branch**

Use `gsap.matchMedia()` with `(prefers-reduced-motion: no-preference)` so visitors requesting less motion receive the unchanged server-rendered page.

- [ ] **Step 4: Run static checks**

Run: `pnpm typecheck` and `pnpm lint`

Expected: both pass with no warnings.

### Task 2: Mark the two public stories for motion

**Files:**

- Modify: `src/app/hunar-os/page.tsx`
- Modify: `src/app/kaam-saathi/page.tsx`
- Test: `src/app/public-shells.test.tsx`
- Test: `tests/e2e/public-routes.spec.ts`

**Interfaces:**

- Consumes: `PublicPageMotion` and `data-motion-*` hooks
- Produces: progressive-enhancement motion on `/hunar-os` and `/kaam-saathi`

- [ ] **Step 1: Preserve content without JavaScript**

Add data attributes only; do not add CSS that hides content before hydration.

- [ ] **Step 2: Mark hero sequences**

Mark the eyebrow, heading, explanation, actions, and proof artifact as one short entrance sequence on each public page.

- [ ] **Step 3: Mark story sections**

Mark the workline stages, demo cards, future cards, trust/assurance blocks, and final call to action for one-time viewport reveals.

- [ ] **Step 4: Mount the motion component**

Mount one scoped client component per page, after the semantic page content.

- [ ] **Step 5: Run focused tests**

Run: `pnpm test -- src/app/public-shells.test.tsx`

Expected: public headings, links, and product-status copy still pass.

### Task 3: Record safe GSAP opportunities and limits

**Files:**

- Create: `docs/GSAP_MOTION_AUDIT.md`

**Interfaces:**

- Consumes: current routes, component behavior, product safety rules, and GSAP capabilities
- Produces: a route-by-route priority map with “use GSAP,” “keep CSS,” and “do not animate” decisions

- [ ] **Step 1: Inventory current UI surfaces**

Cover public landing pages, demo entry, worker capture/transcript/interpretation/decision/status/completion/replay, customer confirmation/result, Hunar Trace, and Hunar Studio.

- [ ] **Step 2: Rank opportunities**

Use three levels: now, later after browser validation, and avoid. Tie every recommendation to a user benefit rather than decoration.

- [ ] **Step 3: Document implementation rules**

Include client-boundary, plugin-registration, cleanup, reduced-motion, performance, testing, and state-safety rules.

### Task 4: Verify the release surface

**Files:**

- Verify only

**Interfaces:**

- Consumes: Tasks 1–3
- Produces: evidence that the dependency and progressive enhancement do not break the current app

- [ ] **Step 1: Run unit, lint, and type checks**

Run: `pnpm lint`, `pnpm typecheck`, and `pnpm test`

Expected: all pass.

- [ ] **Step 2: Run the production build**

Run: `pnpm build`

Expected: pass, or record the exact existing Ticket 17 build blocker without claiming completion.

- [ ] **Step 3: Run focused browser checks**

Run the public landing-page Playwright tests at 360px and 1280px.

Expected: no overflow, key links remain reachable, and content remains visible.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check` and review only the GSAP-related files plus the preserved overlapping user changes.

# KaamSaathi Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a calm, bilingual worker landing page that honestly presents the live TaskConfirm demo, Ride Replay preview, and four future scenario previews.

**Architecture:** Keep the page server-rendered and dependency-free. Use native links, anchors, and `details` disclosures so every interaction works without client JavaScript; keep all visual behavior in the existing global design system.

**Tech Stack:** Next.js App Router, React, strict TypeScript, semantic HTML, CSS, Vitest, Testing Library, Playwright.

**Spec:** `.scratch/hunar-os-v01/issues/16-build-kaamsaathi-landing-page.md`

## Global Constraints

- Follow `DESIGN.md`: Saathi Teal, Warm Paper, Marigold proof nodes, Anek display type, Noto Sans interface type.
- Use English and Hindi copy, 48px touch targets, visible focus, and responsive 360px/desktop layouts.
- Label TaskConfirm `Live demo` and Ride Replay `Demo preview`; do not create a Ride Replay route before Ticket 18.
- Never imply ambient recording; workers record only their own description.
- Future packs expand in place and never link to empty routes.

---

### Task 1: Page structure and honest demo choices

**Files:**
- Modify: `src/app/kaam-saathi/page.tsx`
- Test: `src/app/public-shells.test.tsx`

**Interfaces:**
- Consumes: existing `/demo` TaskConfirm route and `/hunar-os` audience route.
- Produces: `#demos` anchor, equal-weight demo cards, four native future-pack disclosures.

- [ ] **Step 1: Extend the landing test** with assertions for the exact headline, `Choose a demo` anchor, both status labels, `/demo` link, and four future disclosures.
- [ ] **Step 2: Run the focused test** with `node_modules\\.bin\\vitest.cmd run src/app/public-shells.test.tsx`; expect the new assertions to fail.
- [ ] **Step 3: Build the semantic page** using a hero, two equal `article` cards, and four `details` elements containing problem, bounded flow, and intended outcome copy.
- [ ] **Step 4: Run the focused test** and expect it to pass.

### Task 2: Worker-first responsive design

**Files:**
- Modify: `src/app/styles.css`
- Test: `tests/e2e/public-routes.spec.ts`

**Interfaces:**
- Consumes: KaamSaathi class names created in Task 1.
- Produces: responsive demo grid, replay-violet practice treatment, accessible disclosures, and reduced-motion behavior.

- [ ] **Step 1: Add a browser test** that checks the CTA anchor, status labels, future disclosure expansion, focus, and no horizontal overflow at 360px and desktop.
- [ ] **Step 2: Add scoped CSS** with 48px targets, two equal columns, a single voice-to-proof signature element, and one-column mobile layout.
- [ ] **Step 3: Run focused browser checks** with `node scripts\\run-e2e.mjs tests/e2e/public-routes.spec.ts:<line>`; expect both viewports to pass.
- [ ] **Step 4: Run project checks** with Vitest, TypeScript, ESLint, and `git diff --check`.
- [ ] **Step 5: Commit** only Ticket 16 files as `feat:build-kaamsaathi-landing-page`.

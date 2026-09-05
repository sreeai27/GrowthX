# Landing Page Image Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use every supplied image to make the Hunar OS and KaamSaathi landing pages more vivid without weakening product truth, accessibility, or performance.

**Architecture:** Keep both pages as server-rendered Next.js pages and use `next/image` static imports so dimensions and responsive image loading are handled at build time. Place each image where it explains a real part of the product: human moment, rule-backed path, proof, practice, or operating boundary. Preserve the existing motion hooks and all demo links.

**Tech Stack:** Next.js App Router, React 19, TypeScript, `next/image`, CSS, Vitest, Testing Library

**Spec:** `HUNAR_OS_MASTER_BUILD_SPEC.md` Phase 9 and `DESIGN.md`

## Global Constraints

- Hunar OS remains the operator landing page and sends demos to KaamSaathi.
- TaskConfirm and Ride Replay retain equal card weight; TaskConfirm remains the release-blocking golden path.
- Use only fictional Sahaay demonstration framing and do not imply a named platform affiliation.
- Worker photography must show dignity and deliberate use, never ambient recording or surveillance.
- Keep 48px touch targets, visible focus, reduced-motion support, and usable 360px layouts.
- Keep the existing navy, teal, marigold, violet, warm-paper, Anek, Noto Sans, and IBM Plex Mono design language.

---

### Task 1: Build the two visual landing-page stories

**Files:**
- Modify: `src/app/hunar-os/page.tsx`
- Modify: `src/app/kaam-saathi/page.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: the ten static PNG assets under `images/`, existing landing-page copy, links, and motion data attributes
- Produces: responsive `next/image` compositions with descriptive alt text and unchanged public routes

- [ ] **Step 1: Add static image imports**

Import `Image` from `next/image` and give every supplied PNG a descriptive variable name in the page where it is used.

- [ ] **Step 2: Compose the Hunar OS story**

Use the team photograph as the human-led hero; place the proof console over the visual without obscuring faces; add the system, operator-review, and trust images beside the sections they explain.

- [ ] **Step 3: Compose the KaamSaathi story**

Use the worker voice photograph as the hero; add customer agreement and safely-stopped replay images to the two equal-weight demo cards; connect the remaining visual explainers to the bounded-flow and privacy sections.

- [ ] **Step 4: Add responsive styling**

Create shared image-frame rules, page-specific crops, calm hover movement, and mobile layouts that stack copy before detail while preserving image meaning and 48px controls.

### Task 2: Protect the public-page contract and verify

**Files:**
- Modify: `src/app/public-shells.test.tsx`

**Interfaces:**
- Consumes: rendered Hunar OS and KaamSaathi pages
- Produces: regression checks for hero imagery, image count, primary CTAs, audience switches, and public claims

- [ ] **Step 1: Add visual-content assertions**

Assert each landing page renders its intended named hero image and five total images, while retaining its main heading and CTA.

- [ ] **Step 2: Run focused tests**

Run: `pnpm test -- src/app/public-shells.test.tsx`

Expected: all public-shell tests pass.

- [ ] **Step 3: Run repository checks**

Run: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.

Expected: all commands exit successfully. If an unrelated existing failure remains, record the exact command and error.

- [ ] **Step 4: Inspect both viewport sizes**

Start the local site and inspect `/hunar-os` and `/kaam-saathi` at 360px and desktop widths. Confirm no clipped copy, hidden faces, overlapping proof cards, or broken links.


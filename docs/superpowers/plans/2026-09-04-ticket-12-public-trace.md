# Ticket 12 Public Trace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use test-driven development and parallel implementation for independent domain, data, and UI slices.

**Goal:** Expose one redacted, read-only Public Trace for the visitor’s current demo run plus three non-enumerable fictional examples.

**Architecture:** A pure domain projector accepts internal trace facts and returns a strict public schema that cannot contain secrets, contacts, raw prompts, private reasoning, raw errors, or unnecessary transcript text. A provider boundary enforces current browser-run ownership or exact curated IDs; the page only renders projected data and performs no mutations.

**Tech Stack:** strict TypeScript, Zod, Convex, Next.js App Router, Vitest, Playwright.

**Spec:** `.scratch/hunar-os-v01/issues/12-expose-hunar-trace.md`

## Global Constraints

- Tenant and run ownership are mandatory for current-run data.
- Curated examples use fixed fictional IDs and cannot enumerate visitor runs.
- Public output contains only allow-listed fields.
- Public Trace is read-only and never exposes raw prompts, chain-of-thought, contacts, transcript bodies, hashes, secrets, or internal errors.
- Mobile controls are at least 48px with visible focus.

### Task 1: Public projection and curated fixtures

**Files:** Create `src/domain/public-trace.ts`, `src/domain/public-trace.test.ts`, and `src/domain/public-trace-fixtures.ts`.

- [ ] Write a failing test proving ordered stages retain actor/status/source/version/model/flow/prompt/approval/receipt/latency/usage/cost while forbidden fields are absent from serialized output.
- [ ] Implement strict Zod output schemas and an explicit allow-list projector.
- [ ] Add three fixed fictional fixtures: included, completed customer approval, and unsupported/escalated.
- [ ] Test that fixtures parse and contain no forbidden values.

### Task 2: Read-only run-scoped data provider

**Files:** Create `convex/publicTrace.ts`, `src/services/providers/public-trace.ts`, and focused tests.

- [ ] Write failing ownership tests: current run succeeds, another run returns null, unknown curated ID returns null, and no list operation exists.
- [ ] Implement a read-only Convex query and fixture adapter using browser token hash plus public run ID.
- [ ] Gather ordered trace, decision, approval, execution, verification, replay, and capability facts, then call the public projector.
- [ ] Validate every returned object at the provider boundary.

### Task 3: Responsive Public Trace page

**Files:** Create `src/app/trace/page.tsx`, `src/app/trace/[exampleId]/page.tsx`; modify current worker result/status navigation and `src/app/styles.css`.

- [ ] Add a failing Playwright test for current-run isolation, refresh persistence, exact curated routes, forbidden-text absence, and no mutation controls.
- [ ] Render an ordered trace timeline with source and proof cards at 360px and desktop.
- [ ] Add three fixed gallery links without visitor-run search or enumeration.
- [ ] Run focused browser coverage, then lint, typecheck, unit, eval, full browser, and production build checks.

## Self-review

- Every Ticket 12 acceptance criterion maps to a task above.
- The public schema is an allow-list, not a redaction blacklist.
- No admin surface, trace enumeration, raw prompt viewer, or mutation is introduced.

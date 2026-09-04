# Studio and Demo Contact Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give named operators and two platform administrators time-limited individual access while enforcing masked contact views, audited purpose-bound reveals, 30-day retention, and reviewed deletion requests.

**Architecture:** Convex owns identities, one-time-link hashes, sessions, access events, deletion requests, and retention receipts. Pure domain modules decide expiry, permissions, purpose, and deletion transitions; thin Convex functions validate tenant and actor before writes. Studio server pages expose only role-safe views and never receive encryption fields unless a permitted administrator reveal is being executed.

**Tech Stack:** Next.js App Router, strict TypeScript, Convex, Zod, Vitest, Playwright, `@convex-dev/auth` only where its session wiring supports the named-user boundary.

**Spec:** `.scratch/hunar-os-v01/issues/14-protect-studio-and-demo-contacts.md`; `HUNAR_OS_MASTER_BUILD_SPEC.md` sections 6, 10, 12, 17 and 24.

## Global Constraints

- One-time links expire after 15 minutes; sessions expire after eight hours.
- Ordinary operators see only masked contacts and cannot invoke privileged paths.
- Exactly two separately signed-in platform administrators are seeded; credentials are never shared.
- Reveals require a permitted reason and append an immutable audit event.
- Full demo/contact data expires after 30 days; only anonymous totals and non-identifying receipts remain.
- Deletion is due within seven calendar days; uncertain or refused requests require second-administrator review.
- Approval confirmation is recorded before contact, consent, run, and active-link removal.
- Every external input is validated and every query/mutation is tenant-scoped.

---

### Task 1: Access and deletion policy module

**Files:**
- Create: `src/domain/studio-access.ts`
- Create: `src/domain/studio-access.test.ts`

**Interfaces:**
- Produces: `issueOneTimeLink`, `consumeOneTimeLink`, `authoriseStudioAction`, `transitionDeletionRequest`, `retentionDisposition`.

- [ ] Write failing table tests for 15-minute links, one-use hashes, eight-hour sessions, operator/admin permissions, permitted reveal purposes, seven-day due dates, second review, refusal review, and 30-day expiry.
- [ ] Run `vitest run src/domain/studio-access.test.ts`; confirm missing exports fail.
- [ ] Implement strict Zod schemas, stable enums, UTC comparisons, exhaustive deletion transitions, and fail-closed permission checks.
- [ ] Re-run the focused tests and `tsc --noEmit`.

### Task 2: Persistent identity and audit records

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/studioAccess.ts`
- Create: `convex/studioAccess.test.ts`
- Create: `convex/auth.ts`
- Create: `convex/auth.config.ts`
- Create: `convex/convex.config.ts`

**Interfaces:**
- Consumes: Task 1 policy functions.
- Produces: tenant-scoped sign-in issue/consume, session lookup, masked contact list, administrator reveal, deletion request/review/execute, and expiry functions.

- [ ] Write integration tests proving allowlist enforcement, link replay rejection, session expiry, cross-tenant denial, operator reveal denial, two distinct administrator identities, immutable access events, and deletion ordering.
- [ ] Install and configure `@convex-dev/auth` plus `jose`; generate deployment keys headlessly as required by the auth skill, never committing keys.
- [ ] Add `studioUsers`, `studioSignInLinks`, `studioSessions`, `contactAccessEvents`, `deletionRequests`, `deletionReviews`, and non-identifying `retentionReceipts` with tenant-first indexes.
- [ ] Implement thin functions that accept opaque hashes, derive actor/tenant from the authenticated session, and return role-safe shapes.
- [ ] Run focused Convex tests, typecheck, and lint.

### Task 3: Retention and deletion execution

**Files:**
- Create: `convex/demoRetention.ts`
- Create: `convex/demoRetention.test.ts`
- Modify: `convex/crons.ts`

**Interfaces:**
- Consumes: Task 1 retention/deletion decisions and Task 2 audit tables.
- Produces: `expirePublicDemoRuns` and `executeApprovedDeletion`.

- [ ] Write tests that seed all run-related tables, advance beyond 30 days, and prove personal/full-run rows and active links are removed while only anonymous counts and non-identifying receipts remain.
- [ ] Write tests proving deletion cannot execute before approval confirmation and uncertain/refused cases require a different administrator’s review.
- [ ] Implement bounded batched cleanup in dependency-safe order and append the receipt after successful deletion.
- [ ] Register the expiry job and run focused tests.

### Task 4: Protected Studio contact UI

**Files:**
- Create: `src/app/studio/sign-in/page.tsx`
- Create: `src/app/studio/auth/actions.ts`
- Create: `src/app/studio/contacts/page.tsx`
- Create: `src/app/studio/contacts/[contactId]/page.tsx`
- Create: `src/app/studio/deletions/page.tsx`
- Modify: `src/app/studio/page.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: Task 2 role-safe Convex contracts and Task 3 deletion contract.
- Produces: accessible operator/admin Studio flows.

- [ ] Add component tests for unauthenticated redirect, masked operator rows, absent privileged controls, reason-required admin reveal, and second-review identity rejection.
- [ ] Build one-time-link consumption and HttpOnly session handling without placing raw tokens in logs or stored browser state.
- [ ] Build contact and deletion views consistent with `DESIGN.md`, with semantic HTML, visible focus, and 48px controls.
- [ ] Run component tests, typecheck, and lint.

### Task 5: End-to-end proof and checkpoint

**Files:**
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `scripts/seed.mjs`
- Modify: `.env.example`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: repeatable release evidence using fictional named users only.

- [ ] Seed one operator and exactly two administrators, each with a separate identity.
- [ ] Add browser tests for link/session expiry, masked operator access, administrator reveal audit, cross-tenant denial, approved deletion, uncertain second review, refusal review, and 360px/desktop layout.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm test:evals`, and `pnpm build`; report any exact environmental blocker.
- [ ] Run `git diff --check`, inspect the staged diff for secrets or user files, and commit `feat:protect-studio-and-demo-contacts`.

## Self-review

- Spec coverage: all six Ticket 14 acceptance bullets map to Tasks 1–5.
- Placeholder scan: no deferred implementation steps or unspecified error handling remain.
- Type consistency: domain decisions feed thin Convex functions; UI consumes only role-safe outputs.

# Collect Customer Decision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a worker create one secure, expiring customer link for a stored policy-decision snapshot, then let the customer confirm the request and approve, decline or report a mismatch without an account or private booking access.

**Architecture:** A pure confirmation lifecycle module owns token-state and idempotency rules. A focused tenant-scoped Convex confirmation module stores only a SHA-256 token hash, an immutable customer-safe decision snapshot and the response; Next.js server actions generate/hash the raw token and keep it out of storage and logs. Separate validated gateways serve the authenticated worker status and single-purpose public customer view.

**Tech Stack:** TypeScript strict mode, Node crypto, Zod, Convex, Next.js App Router, Vitest and Playwright.

**Spec:** `.scratch/hunar-os-v01/issues/05-collect-customer-decision.md`; canonical detail in `HUNAR_OS_MASTER_BUILD_SPEC.md` sections 7.10, 7.11, 8.4 Confirmation Service, 10.1 `confirmationRequests` and 11.2.

## Global Constraints

- Confirmation tokens are cryptographically random, single-purpose, expire after exactly 30 minutes and are stored only as SHA-256 hashes.
- The token grants access to one customer-safe snapshot, never the booking account or worker/demo session.
- Customer request confirmation is separate from commercial approval.
- Approve, decline, mismatch, invalid, expired, already-used and stale states are distinct and persistent.
- Same-response retries are idempotent; a different response after consumption is rejected as already used.
- Booking version, decision hash or active policy/source version changes make the request stale and prevent authorisation.
- Customer-supplied forms contain no price, duration, task or policy fields; those values come only from the stored snapshot.
- No connector executes in ticket 05. Approval records authority for ticket 06 only.
- Every enterprise query/mutation is tenant-scoped; public token lookup reveals only the minimum customer-safe fields.
- Worker and customer pages use English and Hindi, semantic HTML, visible focus, 48px touch targets and the saved `.interface-design/system.md` patterns.

---

### Task 1: Pure confirmation lifecycle

**Files:**
- Create: `src/domain/customer-confirmation.ts`
- Create: `src/domain/customer-confirmation.test.ts`
- Modify: `src/domain/incident-state.ts`
- Modify: `src/domain/incident-state.test.ts`

**Interfaces:**
- Consumes: current time, expiry, request status, stored decision/booking versions and requested response.
- Produces: `evaluateConfirmationAccess(input): ConfirmationAccessResult`, `applyCustomerResponse(input): CustomerResponseResult`, and incident transitions into `AWAITING_CUSTOMER`, `ACTION_AUTHORISED`, `COMPLETION_PENDING` or `AWAITING_HUMAN_REVIEW`.

- [ ] **Step 1: Write the first failing lifecycle tests**

```ts
expect(evaluateConfirmationAccess(activeFixture())).toEqual({ kind: "ACTIVE" });
expect(evaluateConfirmationAccess(expiredFixture())).toEqual({ kind: "EXPIRED" });
expect(applyCustomerResponse(activeFixture(), "APPROVE")).toMatchObject({
  kind: "RECORDED",
  status: "APPROVED",
  incidentStatus: "ACTION_AUTHORISED",
});
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm exec vitest run src/domain/customer-confirmation.test.ts`
Expected: FAIL because the lifecycle module does not exist.

- [ ] **Step 3: Implement access and response state tables**

Define request states `PENDING`, `APPROVED`, `DECLINED`, `REQUEST_MISMATCH`, `EXPIRED`, `REVOKED`, `STALE`. Distinguish invalid lookup outside this module; it receives a found request only.

- [ ] **Step 4: Add vertical tests for idempotency and stale authority**

Cover same-response retry, different-response retry, expired response, booking-version mismatch, decision-hash mismatch, source-version mismatch, request mismatch, and the two-step rule that commercial approval is rejected until the request is confirmed.

- [ ] **Step 5: Extend the incident state machine**

Add `AWAITING_CUSTOMER`, `ACTION_AUTHORISED` and `COMPLETION_PENDING`. Add events `SEND_TO_CUSTOMER`, `CUSTOMER_APPROVES`, `CUSTOMER_DECLINES`, `CUSTOMER_REPORTS_MISMATCH`; reject each outside its valid state.

- [ ] **Step 6: Run focused domain tests and verify GREEN**

Run: `pnpm exec vitest run src/domain/customer-confirmation.test.ts src/domain/incident-state.test.ts`
Expected: PASS without network access.

### Task 2: Tenant-scoped confirmation persistence

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/confirmationSupport.ts`
- Create: `convex/confirmations.ts`
- Create: `convex/confirmations.test.ts`
- Modify: `convex/incidentSupport.ts`

**Interfaces:**
- Consumes: owned incident/decision plus `tokenHash`, `tokenPrefix`, `expiresAt`, and server-owned `now`.
- Produces: `confirmations:create`, `confirmations:getForCustomer`, `confirmations:confirmRequest`, `confirmations:respond`, and `confirmations:getForWorker`.

- [ ] **Step 1: Write failing schema/API integration tests**

Test one request per decision, hash-only persistence, exact 30-minute expiry, immutable snapshot fields, tenant/run isolation and unchanged booking.

- [ ] **Step 2: Add confirmation storage**

Store tenant, incident/decision IDs, token hash/prefix, expiry/status, request snapshot, request-confirmed flag/time, commercial response, response time, decision hash, booking version, source version and timestamps. Index token hash and tenant+incident.

- [ ] **Step 3: Implement thin creation and read handlers**

Creation requires an owned `DECISION_READY` add-on/trade-off decision whose allowed actions require customer involvement. Duplicate creation returns the existing safe record without generating another request.

- [ ] **Step 4: Implement public token lookup with stale checks**

Lookup is by hash, then validates expiry, request status, current booking version, current policy decision hash/source version and incident state. Return a discriminated customer-safe view: `ACTIVE`, `INVALID`, `EXPIRED`, `ALREADY_USED` or `STALE`.

- [ ] **Step 5: Implement two-step customer mutations**

`confirmRequest` records only `YES` or mismatch. `respond` accepts only `APPROVE` or `DECLINE` after `YES`. Use the pure lifecycle module, patch incident state, and append tenant-scoped trace events without executing a connector.

- [ ] **Step 6: Add integration coverage**

Test approve, decline, mismatch, invalid hash, expired, already-used same/different retries, booking/policy stale changes, token collision, snapshot integrity and cross-tenant/cross-incident access.

- [ ] **Step 7: Run and verify GREEN**

Run: `pnpm exec vitest run convex/confirmations.test.ts convex/incidents.test.ts`
Expected: PASS.

### Task 3: Validated worker/customer gateways and actions

**Files:**
- Create: `src/services/providers/customer-confirmation.ts`
- Create: `src/services/providers/customer-confirmation.test.ts`
- Modify: `src/app/worker/incidents/actions.ts`
- Create: `src/app/confirm/actions.ts`

**Interfaces:**
- Produces: `createConfirmation(input)`, `getWorkerConfirmation(input)`, `getCustomerConfirmation(tokenHash)`, `confirmCustomerRequest(tokenHash, answer)`, and `respondToConfirmation(tokenHash, response)`; every return is Zod-validated.

- [ ] **Step 1: Write failing contract tests**

Assert customer views exclude tenant ID, customer alias, worker ID, raw token hash and internal document IDs while containing the frozen booking/task/price/time/source snapshot.

- [ ] **Step 2: Add Convex and fixture gateway adapters**

Both adapters expose the same schemas and lifecycle semantics. Fixture mode stores hashes and snapshots in the fixture file and revalidates staleness against its current decision/booking data.

- [ ] **Step 3: Generate the raw token only in the worker server action**

Use `randomBytes(32).toString("base64url")`; compute SHA-256 with the existing token-hash convention; send only hash/prefix/expiry to persistence. Return/redirect with the raw token only once in the worker view.

- [ ] **Step 4: Add public customer actions**

Validate the route token and enum-only form values. Hash token server-side. Forms never include impact fields. Redirect to the same token route after each response.

- [ ] **Step 5: Run contract tests, lint and typecheck**

Run: `pnpm exec vitest run src/services/providers/customer-confirmation.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS.

### Task 4: Worker status and no-account customer UI

**Files:**
- Modify: `src/app/worker/incidents/[incidentId]/decision/page.tsx`
- Create: `src/app/worker/incidents/[incidentId]/status/page.tsx`
- Create: `src/app/confirm/[token]/page.tsx`
- Modify: `src/app/styles.css`
- Modify: `tests/e2e/public-routes.spec.ts`

**Interfaces:**
- Consumes: validated views and server actions from Task 3.
- Produces: worker send/status flow and the public two-step customer confirmation route.

- [ ] **Step 1: Write failing mobile browser journey**

Worker resolves balcony add-on, creates one link, customer opens it without a demo cookie, confirms `Yes`, sees the exact ₹299/25-minute snapshot, approves, and worker status shows approved without a booking mutation.

- [ ] **Step 2: Build the worker send/status surfaces**

Enable `Send for customer approval` only for the stored allowed action. Status shows one copy/open link, waiting/approved/declined/mismatch/expired/stale states and no customer-private data. Refresh must not create a second request.

- [ ] **Step 3: Build the customer two-step page**

Use Warm Paper and the governed workline/proof artifact. Show Sahaay demonstration identity, original booking scope, interpreted task, classification, resulting task list, exact approved impact and source version. First ask request confirmation; only then show approve/decline.

- [ ] **Step 4: Build distinct safe terminal/error states**

Render invalid, expired, already used, stale, mismatch, approved and declined as separate headings/copy. Do not reveal whether an invalid token resembles another request.

- [ ] **Step 5: Add role-boundary and lifecycle E2E cases**

Cover no-cookie customer access, worker route denial without demo credentials, invalid token, expired fixture, already-used refresh, mismatch, decline, stale booking/policy, snapshot equality, 360px/desktop overflow, keyboard focus and 48px controls.

- [ ] **Step 6: Run focused browser tests**

Run: `pnpm test:e2e -- -g "customer confirmation"`
Expected: PASS.

### Task 5: Independent review, full verification and checkpoint

**Files:**
- Modify: `.scratch/hunar-os-v01/issues/05-collect-customer-decision.md`

- [ ] **Step 1: Run separate standards and spec reviews**

Standards checks strict TypeScript/Zod, tenant boundaries, thin Convex modules, hash-only tokens, logs/privacy and duplication. Spec checks every ticket state, 30-minute expiry, snapshot equality, staleness, idempotency and role boundaries.

- [ ] **Step 2: Fix and re-verify all material findings**

Use the same reviewers to verify only their prior findings against one staged snapshot.

- [ ] **Step 3: Run all required checks**

Run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:evals`, `pnpm seed`, `pnpm build`, then `pnpm test:e2e`.
Expected: all pass; report an exact safe seed skip if no Convex URL exists.

- [ ] **Step 4: Resolve and checkpoint**

Mark the ticket resolved only after all gates pass, then:

```bash
git add .
git commit -m "feat:collect-customer-decision"
```

## Self-review

- Spec coverage: token randomness/hash/expiry, exact shared snapshot, two-step request/commercial decision, all terminal states, stale authority, persistence/idempotency, tenant isolation and role boundaries each have explicit implementation and test steps.
- Placeholder scan: no deferred implementation placeholders remain.
- Type consistency: lifecycle results, confirmation gateway methods and persisted/customer/worker views are named once and consumed consistently.

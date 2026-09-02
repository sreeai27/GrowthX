# Send Private Demo Result Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a demo visitor optionally send a privacy-limited, seven-day result link to an unverified email address or Indian mobile number, with separate one-invitation consent and deterministic abuse limits.

**Architecture:** Pure TypeScript normalises contact input, calculates retention, and decides rate limits. Thin Convex functions and a fixture adapter persist encrypted contacts, hashed lookups, result snapshots, link hashes, delivery attempts, and provider receipts; a delivery interface isolates email/SMS. Server-rendered pages consume strict safe projections so public routes never expose raw transcripts, Trace data, contact values, tenant IDs, or internal errors.

**Tech Stack:** Next.js App Router, strict TypeScript, Zod, Convex, Vitest, Playwright, Node crypto, pnpm.

**Spec:** `.scratch/hunar-os-v01/issues/08-send-private-demo-result.md`; `HUNAR_OS_MASTER_BUILD_SPEC.md` sections 7.3 Public demo identity and access, 10.2 demo contact/result tables, 18 retention table, 28.2 release checklist, and 37 decision log.

## Global Constraints

- Contact capture is optional and skipping never changes navigation, features, or result visibility.
- Accept email or Indian mobile only; normalise email casing/whitespace and Indian mobile to `+91XXXXXXXXXX`.
- Contact remains `UNVERIFIED` and is never identity, login, or cross-device run recovery.
- Encrypt contact values at rest with a server-only key; store a keyed lookup hash and masked display separately.
- Result content is frozen to confirmed request summary, policy outcome, customer decision, and final receipt only.
- Never include raw transcripts, prompts, internal Trace, private browser tokens, tenant IDs, document IDs, or internal provider errors in a public result.
- Result tokens are 32 random bytes, stored only as SHA-256 hashes, scoped to one run, read-only, and expire after exactly seven days.
- Enforce three delivery attempts per browser-rate key in a rolling hour and five per normalised-contact key in a rolling day before calling a provider.
- Delivery failures keep the current result visible, store only a redacted error code/message, and permit retry within the same limits.
- Result-delivery contact and the full demo run expire after 30 days.
- Invitation consent is a separate unchecked checkbox, versioned, and expires after six months or immediately after one invitation.
- Every external input and provider output is Zod-validated; enterprise mutations remain tenant-scoped.
- Worker/customer controls remain bilingual, keyboard accessible, visibly focused, and at least 48px high at 360px and desktop widths.

---

### Task 1: Contact, token, retention, and rate-limit rules

**Files:**
- Create: `src/domain/private-demo-result.ts`
- Create: `src/domain/private-demo-result.test.ts`

**Interfaces:**
- Produces: `demoContactInputSchema`, `normaliseDemoContact(input)`, `maskDemoContact(contact)`, `resultSnapshotSchema`, `resultTokenExpiresAt(now)`, `resultRetentionExpiresAt(now)`, `invitationRetentionExpiresAt(now)`, `evaluateDemoSendLimit(input)`, and `redactDeliveryError(error)`.
- Consumes: no storage or provider code.

- [ ] **Step 1: Write failing contact normalisation tests**

```ts
expect(normaliseDemoContact({ contact: " Visitor@Example.COM " })).toEqual({
  type: "EMAIL",
  normalised: "visitor@example.com",
  maskedDisplay: "v***@example.com",
});
expect(normaliseDemoContact({ contact: "098765 43210" })).toMatchObject({
  type: "INDIAN_MOBILE",
  normalised: "+919876543210",
  maskedDisplay: "+91******3210",
});
expect(() => normaliseDemoContact({ contact: "+14155552671" })).toThrow();
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- src/domain/private-demo-result.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement strict domain schemas and clocks**

Define `DemoContact = { type: "EMAIL" | "INDIAN_MOBILE"; normalised: string; maskedDisplay: string }`. Use a conservative email schema and accept Indian mobile inputs only when the digits reduce to `91` plus a ten-digit number beginning `6`–`9`. Return ISO UTC expiries at `now + 7 days`, `now + 30 days`, and `now + 6 calendar months`.

- [ ] **Step 4: Add failing rate-limit and redaction tests**

```ts
expect(evaluateDemoSendLimit({ browserAttemptsInLastHour: 2, contactAttemptsInLastDay: 4 })).toEqual({ allowed: true });
expect(evaluateDemoSendLimit({ browserAttemptsInLastHour: 3, contactAttemptsInLastDay: 0 })).toMatchObject({ allowed: false, reason: "BROWSER_HOURLY_LIMIT" });
expect(evaluateDemoSendLimit({ browserAttemptsInLastHour: 0, contactAttemptsInLastDay: 5 })).toMatchObject({ allowed: false, reason: "CONTACT_DAILY_LIMIT" });
expect(redactDeliveryError(new Error("Authorization: secret-token"))).not.toContain("secret-token");
```

- [ ] **Step 5: Implement limit decisions and safe error mapping**

Count attempts, not only successful sends. Return stable public retry times. Map provider errors to bounded codes `TEMPORARY_PROVIDER_FAILURE`, `PERMANENT_PROVIDER_FAILURE`, or `INVALID_PROVIDER_RESPONSE` and a fixed user-safe message.

- [ ] **Step 6: Verify GREEN**

Run: `pnpm test -- src/domain/private-demo-result.test.ts && pnpm typecheck && pnpm lint`
Expected: all pass.

---

### Task 2: Tenant-scoped result persistence and retention records

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/privateDemoResults.ts`
- Create: `convex/privateDemoResultSupport.ts`
- Create: `convex/privateDemoResults.test.ts`
- Modify: `convex/demoSessions.ts`
- Modify: `convex/demoSessions.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas and helpers; existing demo-run access lookup.
- Produces: `getCheckpoint`, `captureContact`, `reserveDelivery`, `completeDelivery`, `getByResultToken`, and tables `demoContacts`, `demoResultLinks`, `demoDeliveries`.

- [ ] **Step 1: Write the failing persistence tracer**

```ts
const captured = await captureContact(activeRun, {
  contact: "visitor@example.com",
  invitationConsent: false,
});
expect(captured).toMatchObject({ maskedDisplay: "v***@example.com", verificationState: "UNVERIFIED" });
expect(await openResult(captured.rawResultToken)).toMatchObject({
  requestSummary: expect.any(String),
  policyOutcome: expect.any(Object),
  customerDecision: "APPROVE",
  finalReceipt: expect.any(Object),
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- convex/privateDemoResults.test.ts`
Expected: FAIL because functions/tables do not exist.

- [ ] **Step 3: Add storage with explicit indexes**

Add `demoContacts` fields from master section 10.2, plus `contactIv`, `contactAuthTag`, and `consentVersion`. Add `demoResultLinks` with `tokenHash`, `demoRunId`, frozen `resultSnapshot`, `expiresAt`, `status`, and timestamps. Add `demoDeliveries` with channel, status, provider, receipt/error, rate keys, and attempt timestamps. Index every query by tenant plus its lookup fields; allow the public token lookup only through a globally unique token-hash index, then verify linked tenant/run relations.

- [ ] **Step 4: Implement capture and immutable snapshot creation**

Require active browser-token access and an incident belonging to the run. Build the snapshot only from stored confirmed text, policy decision, confirmation response, action receipt, and completion verification. Reject a missing structured summary or unsupported terminal state. Generate separate result and lookup keys; never persist the raw result token.

- [ ] **Step 5: Add isolation, expiry, and consent tests**

Cover a second tenant, wrong browser token, token scoped to another run, seven-day expiry, revoked token, duplicate same-run capture, conflicting contact, unchecked consent, consent version/timestamp, six-month expiry, one-invitation cutoff, and 30-day result deletion fields. Assert returned projections exclude ciphertext, hashes, IDs, tenant ID, transcript, Trace, and provider internals.

- [ ] **Step 6: Implement delivery reservation atomically**

Within one mutation, count `demoDeliveries` for the browser key since `now - 1 hour` and contact key since `now - 24 hours`; reject at 3 or 5, otherwise insert one `PENDING` attempt before any provider call. Identical retry requests create a new counted attempt; concurrent requests cannot both bypass the limit.

- [ ] **Step 7: Verify GREEN**

Run: `pnpm test -- convex/privateDemoResults.test.ts convex/demoSessions.test.ts && pnpm typecheck && pnpm lint`
Expected: all pass.

---

### Task 3: Email/SMS delivery provider and fixture parity

**Files:**
- Create: `src/services/providers/private-result-delivery.ts`
- Create: `src/services/providers/private-result-delivery.test.ts`
- Create: `src/services/providers/private-demo-result.ts`
- Create: `src/services/providers/private-demo-result.test.ts`
- Modify: `src/config/env.ts`
- Modify: `.env.example`
- Modify: `src/services/providers/customer-confirmation.ts` only if its existing atomic fixture writer is extracted to a shared safe primitive.

**Interfaces:**
- Produces: `PrivateResultDeliveryProvider.send(input): Promise<DeliveryReceipt>`, `PrivateDemoResultGateway`, `MockPrivateResultDeliveryProvider`, strict public view schemas, and Convex/fixture adapters.
- Consumes: Task 2 handlers and Task 1 schemas.

- [ ] **Step 1: Write failing provider contract tests**

Assert email and SMS requests validate, a mock receipt persists, malformed/unknown receipt fields reject, provider secrets never enter stored/public projections, failure becomes a redacted stored error, retry succeeds, and Convex-shaped/fixture-shaped values parse to identical safe views.

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- src/services/providers/private-result-delivery.test.ts src/services/providers/private-demo-result.test.ts`
Expected: FAIL because the provider modules do not exist.

- [ ] **Step 3: Implement the provider boundary**

Use `channel: "EMAIL" | "SMS"`, destination only in the in-memory provider request, absolute result URL, expiry, and bilingual message copy. Validate `DeliveryReceipt = { provider: string; providerMessageId: string; acceptedAt: string }`. The default development provider is deterministic and performs no network call; production configuration must fail closed until an authorised provider adapter is configured.

- [ ] **Step 4: Implement gateway orchestration**

The server gateway validates input, reserves the rate-limited attempt, decrypts the destination only for the provider call, calls the provider, and completes the attempt with a receipt or redacted error. Fixture mode uses separate validated files, same-process locks, atomic replacement, identical limits, hashed tokens, and the same public schemas.

- [ ] **Step 5: Verify parity GREEN**

Run: `pnpm test -- src/services/providers/private-result-delivery.test.ts src/services/providers/private-demo-result.test.ts convex/privateDemoResults.test.ts && pnpm typecheck && pnpm lint`
Expected: all pass.

---

### Task 4: Optional checkpoints and read-only private result UI

**Files:**
- Create: `src/app/worker/incidents/[incidentId]/private-result-checkpoint.tsx`
- Create: `src/app/worker/incidents/[incidentId]/private-result-actions.ts`
- Modify: `src/app/worker/incidents/[incidentId]/interpretation/page.tsx`
- Modify: `src/app/worker/incidents/[incidentId]/completion/page.tsx`
- Create: `src/app/result/[token]/page.tsx`
- Modify: `src/app/styles.css`
- Modify: `tests/e2e/public-routes.spec.ts`

**Interfaces:**
- Consumes: `PrivateDemoResultGateway` safe views and the current browser credential.
- Produces: optional contact form at `TASK_CONFIRMED`, final `Send me this result` form, safe retry state, and public `/result/[token]` view.

- [ ] **Step 1: Write browser tests before UI**

Add named journeys for skip-without-blocking at both checkpoints; email send; Indian mobile send; separate unchecked invitation consent; persisted success; provider failure with visible result and retry; expired/invalid link; cross-run isolation; 3/hour and 5/day limits; 360px and desktop layout; keyboard focus; 48px controls; and absence of transcript/Trace/private fields in result HTML.

- [ ] **Step 2: Verify behavioral RED**

Run: `pnpm test:e2e --grep=private.demo.result`
Expected: FAIL because the form and result route do not exist.

- [ ] **Step 3: Implement one reusable optional checkpoint**

Use exact lead copy `Keep your result` and `Add your email or phone and we'll send you a private copy of this result, plus an invite when Hunar accounts are ready.` Use primary `Send my result`, secondary link `Not now`, and a separate unchecked `Send me one account invitation when accounts are ready` checkbox. State `Unverified contact · पहचान सत्यापित नहीं` and show 7-day link/30-day contact retention beside the form.

- [ ] **Step 4: Place checkpoints without blocking progression**

Render the first checkpoint only after the structured task is confirmed; `Not now` leaves the existing policy-decision action fully available. Render it once more on the terminal completion result as `Send me this result`; after capture or second skip, do not prompt again for that run. Do not redirect the visitor away from their current result on send failure.

- [ ] **Step 5: Implement the read-only result route**

Show only confirmed request summary, deterministic policy state/source/version, customer decision, final agreement state, and safe connector receipt fields. Render distinct invalid, expired, revoked, delivery-pending, delivery-failed, and delivered states. Set `robots: noindex, nofollow`, `Cache-Control: no-store`, and no mutation controls.

- [ ] **Step 6: Verify responsive journeys**

Run: `pnpm test:e2e --grep=private.demo.result`
Expected: all named journeys pass at mobile and desktop widths.

---

### Task 5: Review, full gates, issue resolution, and checkpoint

**Files:**
- Modify: `.scratch/hunar-os-v01/issues/08-send-private-demo-result.md`

**Interfaces:**
- Consumes: complete staged Ticket 8 diff.
- Produces: reviewed, tested commit `feat:send-private-demo-result`.

- [ ] **Step 1: Run the two-axis staged review**

Use fixed point `a194d18`; standards review checks `AGENTS.md`, the master spec, privacy boundaries, focused diffs, strict TypeScript, external validation, tenant scope, and provider interfaces. Spec review checks every Ticket 8 checkbox plus master sections 7.3, 10.2, 18, and 28.2. Fix every material finding and have the same reviewers verify it.

- [ ] **Step 2: Run all required gates**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:evals
pnpm seed
pnpm build
pnpm test:e2e
```

Expected: all commands pass. If `pnpm seed` cannot exercise Convex because `NEXT_PUBLIC_CONVEX_URL` is unset, record that exact environment limitation and do not claim the remote seed ran.

- [ ] **Step 3: Resolve the issue and checkpoint**

Set Ticket 8 to `resolved`, check every acceptance box, and add an Answer containing exact test totals, review outcome, provider mode, retention behaviour, and deviations. Run `git diff --cached --check a194d18`, commit with `git commit -m "feat:send-private-demo-result"`, and confirm `git status --short` is empty.

## Self-Review

- Spec coverage: all six Ticket 8 acceptance criteria map to Tasks 1–4; review and release evidence map to Task 5.
- Placeholder scan: no deferred implementation steps or undefined error handling remain.
- Type consistency: `PrivateDemoResultGateway`, `PrivateResultDeliveryProvider`, `DeliveryReceipt`, safe views, expiry helpers, and rate-limit decisions are defined before use.
- Scope: administration, contact reveal, deletion-request workflow, production provider onboarding, and invitation sending remain in later tickets; Ticket 8 stores only the consent needed for one future invitation.

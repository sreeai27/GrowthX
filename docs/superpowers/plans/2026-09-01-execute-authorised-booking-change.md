# Execute Authorised Booking Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn one current customer approval into exactly one mock booking update with a durable, shared receipt and safe retries.

**Architecture:** Pure TypeScript validates authority, builds the exact action payload, and defines retry outcomes. A provider-neutral connector deduplicates by an immutable idempotency key. Convex and the local demo fixture reserve an execution before the external call, then atomically finalize the booking and receipt; worker and customer pages only render stored projections.

**Tech Stack:** Next.js App Router, strict TypeScript, Zod, Convex, Vitest, Playwright, pnpm.

**Spec:** `.scratch/hunar-os-v01/issues/06-execute-authorised-booking-change.md` and `HUNAR_OS_MASTER_BUILD_SPEC.md` sections 9.4, 9.5, 10.1, 10.2, 11.1, 12.9, 18.4, 20.2 and Phase 3.

## Global Constraints

- The connector cannot run until the incident is `ACTION_AUTHORISED` and the current approval, decision, source and booking version all match.
- The only v0.1 mutation is the fictional `ADD_TASK` for `balcony_deep_cleaning`, +25 minutes and ₹299.
- Idempotency key is `sha256(tenantId + incidentId + decisionHash + actionType)` using an unambiguous canonical encoding.
- All external input and connector output is validated with Zod.
- Every enterprise read/write includes tenant identity; public projections expose no tenant ID, document ID, token hash or private connector payload.
- A successful mutation increments the booking version once and stores the external action ID, request hash, timestamps, prior/resulting versions and receipt.
- Retry after refresh, timeout or duplicate tap returns the stored result or an explicit safe failure; it never adds the task twice.
- Connector/provider code remains behind an interface under `src/services/providers`; deterministic rules remain pure under `src/domain`.
- User copy remains English/Hindi compatible, mobile-first, keyboard accessible, and uses at least 48px touch targets.

---

### Task 1: Pure action authority and lifecycle

**Files:**
- Create: `src/domain/action-execution.ts`
- Create: `src/domain/action-execution.test.ts`
- Modify: `src/domain/incident-state.ts`
- Modify: `src/domain/incident-state.test.ts`
- Modify: `src/services/providers/contracts.ts`

**Interfaces:**
- Consumes: immutable confirmation fields `bookingVersion`, `decisionHash`, `sourceVersion`, `requestConfirmedByCustomer`, `commercialResponse`, and the current incident/decision/booking values.
- Produces: `allowedBookingActionSchema`, `actionExecutionRequestSchema`, `actionReceiptSchema`, `assertActionAuthorised(input)`, `buildActionExecutionRequest(input)`, `classifyActionRetry(status)`, plus `START_ACTION`, `ACTION_SUCCEEDS`, and `ACTION_FAILS` state events.

- [ ] **Step 1: Write failing authority and hash tests**

```ts
it("builds one canonical add-task request only from current approval", () => {
  const request = buildActionExecutionRequest(authorisedFixture);
  expect(request.action).toEqual({
    type: "ADD_TASK",
    taskId: "balcony_deep_cleaning",
    priceDeltaMinor: 29900,
    durationDeltaMinutes: 25,
  });
  expect(request.idempotencyKey).toMatch(/^[a-f0-9]{64}$/);
});

it.each(["wrong status", "unconfirmed request", "declined", "stale booking", "stale decision", "stale source", "unsupported action"])(
  "rejects %s before connector execution",
  (caseName) => expect(() => buildActionExecutionRequest(fixtureFor(caseName))).toThrow(),
);
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm test -- src/domain/action-execution.test.ts src/domain/incident-state.test.ts`

Expected: failure because action execution contracts and transitions do not exist.

- [ ] **Step 3: Implement strict pure contracts**

```ts
export const allowedBookingActionSchema = z.object({
  type: z.literal("ADD_TASK"),
  taskId: z.string().min(1),
  priceDeltaMinor: z.number().int().nonnegative(),
  durationDeltaMinutes: z.number().int().positive(),
}).strict();

export const actionExecutionRequestSchema = z.object({
  tenantId: z.string().min(1),
  incidentKey: z.string().min(1),
  decisionHash: z.string().min(1),
  bookingKey: z.string().min(1),
  bookingVersion: z.number().int().positive(),
  sourceVersion: z.string().min(1),
  action: allowedBookingActionSchema,
  requestHash: z.string().regex(/^[a-f0-9]{64}$/),
  idempotencyKey: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
```

Use length-prefixed fields or canonical JSON before SHA-256 so concatenation cannot collide. Extend the state machine through `ACTION_EXECUTING`, `ACTION_EXECUTED`, and `COMPLETION_PENDING`; invalid transitions must throw.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm test -- src/domain/action-execution.test.ts src/domain/incident-state.test.ts`

Expected: all authority, hashing, retry and transition cases pass.

---

### Task 2: Idempotent mock connector

**Files:**
- Create: `src/services/providers/booking-action.ts`
- Create: `src/services/providers/booking-action.test.ts`
- Modify: `src/services/providers/contracts.ts`

**Interfaces:**
- Consumes: `ActionExecutionRequest` from Task 1.
- Produces: `BookingActionConnector.execute(request): Promise<ActionReceipt>`, `MockBookingActionConnector`, and failure modes `TRANSIENT_BEFORE_COMMIT`, `TIMEOUT_AFTER_COMMIT`, `PERMANENT_REJECTION` for tests only.

- [ ] **Step 1: Write failing provider-contract tests**

```ts
it("returns the same receipt for the same idempotency key", async () => {
  const connector = new MockBookingActionConnector();
  const first = await connector.execute(request);
  const second = await connector.execute(request);
  expect(second).toEqual(first);
  expect(connector.mutationCount).toBe(1);
});

it("rejects malformed connector output", async () => {
  await expect(executeWithOutput(request, { status: "ok" })).rejects.toThrow();
});
```

- [ ] **Step 2: Run provider tests and verify RED**

Run: `pnpm test -- src/services/providers/booking-action.test.ts`

- [ ] **Step 3: Implement the interface and demonstration connector**

The receipt must validate these exact fields: `actionExecutionId`, `connector: "DEMONSTRATION_CONNECTOR"`, `idempotencyKey`, `externalActionId`, `requestHash`, `previousBookingVersion`, `resultingBookingVersion`, `actionType: "ADD_TASK"`, `status`, and ISO `executedAt`. Build the external ID deterministically from the idempotency key and keep the mock's result registry private to the adapter.

- [ ] **Step 4: Verify idempotency and failure recovery**

Run: `pnpm test -- src/services/providers/booking-action.test.ts`

Expected: same-key reuse, different-key isolation, malformed output rejection, transient failure, permanent failure and timeout-after-success all pass.

---

### Task 3: Persistent reservation, connector call and finalization

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/actionExecutionSupport.ts`
- Create: `convex/actionExecutions.ts`
- Create: `convex/actionExecutions.test.ts`
- Modify: `src/services/providers/customer-confirmation.ts`
- Modify: `src/services/providers/customer-confirmation.test.ts`
- Modify: `src/app/confirm/actions.ts`

**Interfaces:**
- Consumes: Task 1 request builder and Task 2 connector.
- Produces: tenant-scoped reserve/read/finalize/fail mutations, `executeApprovedAction(tokenHash)`, and safe stored action projections for worker/customer gateways.

- [ ] **Step 1: Write failing persistence and concurrency tests**

```ts
it("reserves before connector execution and finalizes one booking mutation", async () => {
  const [left, right] = await Promise.all([
    executeApprovedAction(approvedToken),
    executeApprovedAction(approvedToken),
  ]);
  expect(left.receipt).toEqual(right.receipt);
  expect(await bookingVersion()).toBe(2);
  expect(await taskOccurrences("balcony_deep_cleaning")).toBe(1);
});
```

Cover tenant isolation, non-approved/mismatched/declined confirmation, stale booking/decision/source, unsupported support state, in-progress reuse, stored success reuse, retryable failure, permanent failure, timeout-after-connector-success and malformed receipt.

- [ ] **Step 2: Run integration tests and verify RED**

Run: `pnpm test -- convex/actionExecutions.test.ts src/services/providers/customer-confirmation.test.ts`

- [ ] **Step 3: Add `actionExecutions` and orchestration**

Store: tenant/incident/decision IDs, connector, action type, redacted payload, payload hash, idempotency key, `PENDING|SUCCEEDED|RETRYABLE_FAILED|PERMANENT_FAILED`, attempt count, external action ID, prior/resulting versions, validated receipt, redacted error code/message, started/completed/updated timestamps. Index by tenant+idempotency key, tenant+incident and tenant+status.

Reserve atomically. Call the connector only in a server action after reservation. Finalize transactionally by rechecking authority/current versions, adding the task once to `includedTaskIds` and `existingAddOnTaskIds`, adding 25 scheduled minutes, incrementing version once, storing receipt, and transitioning the incident through execution to completion pending. On repeats, return the stored receipt.

For fixture mode, keep the same public contract and use validated atomic file replacement; coordinate same-process calls by idempotency key so concurrent browser taps converge.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm test -- convex/actionExecutions.test.ts src/services/providers/customer-confirmation.test.ts src/domain/action-execution.test.ts`

Expected: exactly-one mutation, receipt durability, isolation, staleness and all retry paths pass.

---

### Task 4: Shared revised agreement UI

**Files:**
- Modify: `src/app/confirm/[token]/page.tsx`
- Modify: `src/app/confirm/actions.ts`
- Modify: `src/app/worker/incidents/[incidentId]/status/page.tsx`
- Modify: `src/app/worker/incidents/actions.ts`
- Modify: `src/app/styles.css`
- Modify: `tests/e2e/public-routes.spec.ts`

**Interfaces:**
- Consumes: stored execution projections from Task 3.
- Produces: matching worker/customer revised-agreement and receipt views, plus safe pending/retry/permanent-failure states.

- [ ] **Step 1: Add failing browser journeys**

Add tests for:

```ts
test("approval updates once and both parties see the same receipt", async ({ browser }) => {
  // complete worker link and two customer confirmations
  // assert task list, +25 minutes, ₹299 and ACT-DEMO-* on customer view
  // open worker status and assert the same values
  // refresh/retry and assert booking version/task occurrence remain unchanged
});
```

Also cover decline preserving the original booking, retryable failure with a visible retry control, permanent failure with safe escalation, 360px layout, desktop layout and keyboard operation.

- [ ] **Step 2: Run the new E2E tests and verify RED**

Run: `pnpm test:e2e -- --grep "authorised booking change"`

- [ ] **Step 3: Implement stored-result UI states**

Approval submits the customer response, executes the authorised action server-side, then renders stored state. Show `Booking updated`, revised task list, `+25 minutes · ₹299`, the demonstration connector label, receipt ID and timestamp. Worker status reads the same stored record. Pending and retryable failures offer one clear refresh/retry action; permanent/uncertain failures show that the booking was not changed and the safe recovery path. Decline continues to show the original agreement.

- [ ] **Step 4: Verify responsive and refresh behavior**

Run: `pnpm test:e2e -- --grep "authorised booking change"`

Expected: worker and customer projections match, refresh cannot duplicate, failure states recover safely, and 360px/desktop assertions pass.

---

### Task 5: Independent review, full gates and checkpoint

**Files:**
- Modify: `.scratch/hunar-os-v01/issues/06-execute-authorised-booking-change.md`

**Interfaces:**
- Consumes: staged diff against checkpoint `89a12c1`.
- Produces: reviewed, resolved ticket and one clean Git checkpoint.

- [ ] **Step 1: Run parallel standards and spec reviews**

Use the `code-review` skill with fixed point `89a12c1`. One reviewer checks repository standards; one checks ticket 06 plus the cited master-spec sections. Fix every material finding and have the same reviewer verify the fix.

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

If seed cannot run because `NEXT_PUBLIC_CONVEX_URL` is unset, record that exact safe skip. Do not claim completion if any other required command fails.

- [ ] **Step 3: Resolve the local ticket**

Check every acceptance item, set `Status: resolved`, and add `## Answer` with the implementation, failure/idempotency behavior, review findings, exact gate counts and any honest test-process deviation.

- [ ] **Step 4: Verify and commit**

```bash
git diff --cached --check 89a12c1
git commit -m "feat: execute authorised booking change"
git status --short
```

Expected: commit succeeds and the working tree is clean.

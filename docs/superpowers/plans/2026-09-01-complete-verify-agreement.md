# Complete and Verify Agreement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the worker submit a structured completion summary against the final agreement and let the customer acknowledge or dispute it, producing a durable deterministic verification state.

**Architecture:** Pure TypeScript validates the exact final task set and computes verification without model judgement. Thin Convex functions and a separate completion provider persist tenant-scoped summaries, responses, verification evidence and trace records; fixture mode implements the same gateway. Worker and customer pages render only stored safe projections.

**Tech Stack:** Next.js App Router, strict TypeScript, Zod, Convex, Vitest, Playwright, pnpm.

**Spec:** `.scratch/hunar-os-v01/issues/07-complete-and-verify-agreement.md`; `HUNAR_OS_MASTER_BUILD_SPEC.md` sections 7.13, 9, 10.1, 10.2, 11.1, 12.10, 20.5 and Phase 4.

## Global Constraints

- Completion references the final resulting booking version, never the pre-action confirmation version.
- Every agreed task has exactly one worker state: `COMPLETE` or `BLOCKED`; free text is optional and bounded.
- A required action receipt must exist and match the final booking; preserved-original flows do not invent a receipt.
- Customer response is `ACKNOWLEDGE` or `RAISE_ISSUE`; an issue opens review and never marks worker failure.
- Verification is deterministic: `VERIFIED`, `DISPUTED`, `REVIEW_REQUIRED`, `CANNOT_VERIFY`; no image/model quality inference.
- Persist criteria version, actor, booking version, structured evidence, receipt reference when applicable, reviewer requirement and UTC timestamps.
- Every enterprise query/mutation is tenant scoped. Public views expose no tenant ID, token hash, document ID, private receipt hash or adverse worker field.
- Duplicate identical submissions are idempotent; conflicting or stale transitions reject.
- Use English/Hindi copy, 48px controls, visible focus, 360px and desktop layouts, and the saved Earned Confidence design system.

---

### Task 1: Pure completion and verification rules

**Files:**
- Create: `src/domain/completion-verification.ts`
- Create: `src/domain/completion-verification.test.ts`
- Modify: `src/domain/incident-state.ts`
- Modify: `src/domain/incident-state.test.ts`
- Modify: `convex/schema.ts` only for incident status enum compatibility

**Interfaces:**
- Produces: `workerTaskStateSchema`, `completionSummaryInputSchema`, `customerCompletionResponseSchema`, `verificationResultSchema`, `validateWorkerCompletion(input)`, `computeVerification(input)`; state events `SUBMIT_COMPLETION`, `CUSTOMER_ACKNOWLEDGES`, `CUSTOMER_RAISES_ISSUE`, `REQUIRE_COMPLETION_REVIEW`.

- [ ] **Step 1: Write a failing success tracer**

```ts
expect(computeVerification({
  agreedTaskIds: ["kitchen_surface_cleaning", "balcony_deep_cleaning"],
  workerTaskStates: [
    { taskId: "kitchen_surface_cleaning", state: "COMPLETE" },
    { taskId: "balcony_deep_cleaning", state: "COMPLETE" },
  ],
  requiredReceiptMatches: true,
  customerResponse: "ACKNOWLEDGE",
  unresolvedReview: false,
})).toMatchObject({ state: "VERIFIED", reviewerRequired: false });
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- src/domain/completion-verification.test.ts src/domain/incident-state.test.ts`

- [ ] **Step 3: Implement vertical slices**

Add one test/implementation cycle for exact task-set equality, stale version, missing required receipt → `CANNOT_VERIFY`, any blocker → `REVIEW_REQUIRED`, customer issue → `DISPUTED`, no-photo success, duplicate/conflicting response, and invalid state transitions. `computeVerification` accepts only structured facts; it has no provider/model dependency.

- [ ] **Step 4: Verify GREEN**

Run focused tests, `pnpm typecheck`, and focused lint.

---

### Task 2: Tenant-scoped completion persistence

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/completionSupport.ts`
- Create: `convex/completion.ts`
- Create: `convex/completion.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas/functions and ticket06 action receipt/booking state.
- Produces: worker `get`, `submitWorkerSummary`; customer `getForCustomer`, `respondAsCustomer`; stored `completionSummaries` and append-only `verificationEvents`.

- [ ] **Step 1: Write failing integration tracer**

```ts
it("stores one final-version summary and deterministic acknowledgement", async () => {
  const summary = await submitCompleteFinalAgreement(seed.executedIncident);
  const result = await acknowledgeAsCustomer(seed.customerTokenHash);
  expect(result.verification.state).toBe("VERIFIED");
  expect(await reload(result.publicIncidentKey)).toEqual(result);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- convex/completion.test.ts`

- [ ] **Step 3: Implement thin handlers and tables**

`completionSummaries` stores tenant/incident/booking version, frozen agreed task labels, structured worker states, bounded worker note, customer response/note, final state and timestamps. `verificationEvents` stores criteria version `taskconfirm-verification-v1`, actor, structured evidence, action execution reference when required, state and reviewerRequired. Recheck tenant, worker run, customer token relation, incident status, final booking version/task list and receipt before every mutation. Create `COMPLETION_DISPUTE` review for customer issues; blocker produces review-required without adverse outcome.

- [ ] **Step 4: Verify persistence behavior**

Cover Q01–Q06, tenant isolation, customer-before-summary rejection, idempotent identical submission/response, conflicting response rejection, stale version, refresh and trace sequence. Run focused tests/type/lint.

---

### Task 3: Convex/fixture completion gateway parity

**Files:**
- Create: `src/services/providers/completion-verification.ts`
- Create: `src/services/providers/completion-verification.test.ts`
- Modify: fixture storage helpers only where a shared safe primitive is required

**Interfaces:**
- Produces: `CompletionVerificationGateway` with `getForWorker(access)`, `submitWorkerSummary(access,input)`, `getForCustomer(tokenHash)`, `respondAsCustomer(tokenHash,response)` and strict safe view schemas.

- [ ] **Step 1: Write failing provider contract tests**

Assert Convex-shaped and fixture-shaped values parse to the same public projections; malformed fields, token hashes, tenant IDs, document IDs, private receipt hashes, and unknown keys fail or are excluded.

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- src/services/providers/completion-verification.test.ts`

- [ ] **Step 3: Implement both adapters**

Use Convex function references for production. Fixture mode writes a separate validated completion store with atomic replacement and same-process locking, reuses hashed customer access and worker run access, freezes final task labels/version, and persists response/verification across reload. Do not deepen `customer-confirmation.ts` with completion behavior.

- [ ] **Step 4: Verify parity GREEN**

Run provider + Convex + pure suites, typecheck, lint and diff check.

---

### Task 4: Worker completion and customer verification UI

**Files:**
- Create: `src/app/worker/incidents/[incidentId]/completion/page.tsx`
- Modify: `src/app/worker/incidents/actions.ts`
- Modify: `src/app/worker/incidents/[incidentId]/status/page.tsx`
- Modify: `src/app/confirm/[token]/page.tsx`
- Modify: `src/app/confirm/actions.ts`
- Modify: `src/app/styles.css`
- Modify: `tests/e2e/public-routes.spec.ts`

**Interfaces:**
- Consumes: Task 3 gateway safe views.
- Produces: final-agreement checklist, customer acknowledgement/issue form, terminal verification views and recovery states.

- [ ] **Step 1: Write browser tests before UI**

Add named journeys: revised booking → all tasks complete → acknowledge → both `Verified`; customer issue → `Disputed`/human review; worker blocker → `Review required`; stale/invalid submission rejects and reloads current agreement; refresh preserves summary/response. Test 360px and desktop, keyboard and 48px controls.

- [ ] **Step 2: Verify behavioral RED**

Run: `pnpm test:e2e --grep "complete and verify"`

- [ ] **Step 3: Implement the guided workline UI**

Worker sees the frozen final task list and native radio controls for `Complete / पूरा` and `Blocked / रुकावट`, optional bounded note, then submits once. Customer link shows the identical agreement and worker summary, with `Acknowledge / स्वीकार करें` and `Raise an issue / समस्या बताएं`. Terminal pages show criteria version, booking version, receipt evidence when required, timestamp and reviewer state—never rating/pay/performance language.

- [ ] **Step 4: Verify responsive journeys**

Run focused unit/E2E, typecheck, lint and inspect mobile/desktop screenshots.

---

### Task 5: Parallel review, gates and checkpoint

**Files:**
- Modify: `.scratch/hunar-os-v01/issues/07-complete-and-verify-agreement.md`

- [ ] **Step 1: Stage and run two-axis review**

Use fixed point `49dee99`; run separate standards and spec reviewers against `git diff --cached 49dee99`. Fix all material findings and have the same reviewer verify.

- [ ] **Step 2: Run all gates**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:evals
pnpm seed
pnpm build
pnpm test:e2e
```

- [ ] **Step 3: Resolve ticket and checkpoint**

Set Status resolved, check all acceptance boxes, add Answer with exact tests/review/deviations, run `git diff --cached --check 49dee99`, commit `feat:complete-and-verify-agreement`, and confirm a clean working tree.

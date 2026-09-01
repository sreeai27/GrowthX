# Capture and Confirm Typed Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the demo worker create a TaskConfirm incident from the active seeded booking, persist and explicitly confirm typed or preset wording, then select only a bounded catalogue task or safely request review before policy resolution.

**Architecture:** A pure incident state machine under `src/domain` owns allowed transitions and preconditions. Thin tenant-scoped Convex mutations persist incidents, text/preset inputs, transcript confirmations, bounded interpretations, task confirmations, human-review records, and append-only trace steps. Signed demo-session credentials guard server actions; mobile-first Next.js pages render capture, transcript, and interpretation states without calling the policy engine.

**Tech Stack:** Next.js App Router, strict TypeScript, Convex, Zod, Vitest, convex-test, Playwright.

**Spec:** `.scratch/hunar-os-v01/issues/03-capture-and-confirm-typed-request.md`, `HUNAR_OS_MASTER_BUILD_SPEC.md` Sections 7.7, 7.8, 9, 10.1, 11.1–11.2, and 12.1/12.4/12.6.

## Global Constraints

- Every query and mutation is scoped to `demo_sahaay_home_services`; the browser never supplies a tenant ID.
- Typed and preset values are untrusted external input and must be validated before persistence.
- The booking is read-only in this ticket; no policy decision or connector call occurs.
- Only active task-catalogue IDs from the seeded booking catalogue may be selected.
- Undefined state transitions reject without partial writes.
- Every write records tenant ID, incident ID, flow version, source/catalogue version where relevant, and an append-only trace step.
- Preserve original and edited text; never store or expose hidden reasoning.
- Worker copy supports English and Hindi, has visible focus, and uses at least 48px controls.

---

### Task 1: Pure Incident State Machine

**Files:**
- Create: `src/domain/incident-state.ts`
- Test: `src/domain/incident-state.test.ts`

**Interfaces:**
- Consumes: no persistence or network dependencies.
- Produces: `IncidentStatus`, `IncidentEvent`, `TransitionContext`, and `transitionIncident(current, event, context)`.

- [ ] **Step 1: Write failing exhaustive transition tests**

```ts
expect(transitionIncident("DRAFT", { type: "CAPTURE_INPUT" }, {})).toEqual({
  nextStatus: "INPUT_CAPTURED",
  auditEvent: "input_captured",
});
expect(() =>
  transitionIncident("DRAFT", { type: "CONFIRM_TASK" }, { hasConfirmedTranscript: false }),
).toThrow("Invalid incident transition");
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `pnpm vitest run src/domain/incident-state.test.ts`

Expected: FAIL because `incident-state.ts` does not exist.

- [ ] **Step 3: Implement the pure transition function**

```ts
export function transitionIncident(
  current: IncidentStatus,
  event: IncidentEvent,
  context: TransitionContext,
): TransitionResult {
  if (current === "DRAFT" && event.type === "CAPTURE_INPUT")
    return { nextStatus: "INPUT_CAPTURED", auditEvent: "input_captured" };
  if (current === "INPUT_CAPTURED" && event.type === "PREPARE_TRANSCRIPT")
    return { nextStatus: "TRANSCRIPT_READY", auditEvent: "transcript_ready" };
  if (current === "TRANSCRIPT_READY" && event.type === "CONFIRM_TRANSCRIPT")
    return { nextStatus: "TRANSCRIPT_CONFIRMED", auditEvent: "transcript_confirmed" };
  if (current === "TRANSCRIPT_CONFIRMED" && event.type === "OFFER_CANDIDATES")
    return { nextStatus: "TASK_CONFIRMATION_REQUIRED", auditEvent: "task_candidates_offered" };
  if (current === "TRANSCRIPT_CONFIRMED" && event.type === "ABSTAIN_TO_REVIEW")
    return { nextStatus: "AWAITING_HUMAN_REVIEW", auditEvent: "human_review_requested" };
  if (
    current === "TASK_CONFIRMATION_REQUIRED" &&
    event.type === "CONFIRM_TASK" &&
    context.hasConfirmedTranscript
  ) return { nextStatus: "TASK_CONFIRMED", auditEvent: "task_confirmed" };
  throw new InvalidIncidentTransitionError(current, event.type);
}
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `pnpm vitest run src/domain/incident-state.test.ts`

Expected: PASS, including invalid and precondition cases.

- [ ] **Step 5: Commit the domain seam**

```bash
git add src/domain/incident-state.ts src/domain/incident-state.test.ts
git commit -m "feat: add incident transition rules"
```

### Task 2: Tenant-Scoped Incident Persistence

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/incidents.ts`
- Create: `convex/incidents.test.ts`

**Interfaces:**
- Consumes: `transitionIncident` from Task 1 and the existing seeded `bookings`, `taskCatalog`, and `demoRuns` tables.
- Produces: `startTaskConfirm`, `captureRequest`, `confirmTranscript`, `prepareTaskCandidates`, `confirmTask`, `routeToReview`, and `getWorkerIncident`.

- [ ] **Step 1: Write failing Convex integration tests**

```ts
const started = await database.mutation(startTaskConfirm, {
  publicRunId: runId,
  browserTokenHash: tokenHash,
  incidentKey: "inc_demo_123",
});
expect(started).toMatchObject({ status: "DRAFT", bookingKey: "DEMO-4821" });
expect(await bookingAfter(database)).toEqual(bookingBefore);
```

Add named tests for cross-run access, invalid token, refresh reads, original/edited text retention, invalid transition rejection, out-of-catalogue selection, and atomic review routing.

- [ ] **Step 2: Run the Convex tests and confirm RED**

Run: `pnpm vitest run convex/incidents.test.ts`

Expected: FAIL because schema tables and functions do not exist.

- [ ] **Step 3: Add the minimum schema**

```ts
incidents: defineTable({
  incidentKey: v.string(), tenantId: v.string(), demoRunId: v.id("demoRuns"),
  scenarioPack: v.literal("TASK_CONFIRM"), bookingKey: v.string(),
  workerPublicUserId: v.string(), status: incidentStatusValidator,
  riskTier: v.number(), supportState: v.string(),
  flowVersion: v.string(), createdAt: v.string(), updatedAt: v.string(),
}).index("by_tenant_incident_key", ["tenantId", "incidentKey"]),
```

Add `mediaInputs`, `transcripts`, `transcriptConfirmations`, `exceptionInterpretations`, `taskConfirmations`, `humanReviews`, and `traceSteps` with tenant/incident indexes and only ticket-03 fields from the master schema.

- [ ] **Step 4: Implement thin mutations around shared helpers**

```ts
const session = await requireActiveDemoRun(context, args.publicRunId, args.browserTokenHash);
const transition = transitionIncident(incident.status, { type: "CONFIRM_TRANSCRIPT" }, {});
await context.db.insert("transcriptConfirmations", confirmation);
await context.db.patch(incident._id, { status: transition.nextStatus, updatedAt: now });
await appendTrace(context, incident, transition.auditEvent, now, metadata);
```

`captureRequest` accepts a Zod-equivalent validated union of `{ modality: "TEXT"; text }` or `{ modality: "PRESET"; presetKey }`; preset keys resolve through a reviewed server-side fixture map. `prepareTaskCandidates` returns server-built catalogue candidates only. `confirmTask` checks both offered candidate IDs and the active tenant catalogue before writing.

- [ ] **Step 5: Run Convex tests and confirm GREEN**

Run: `pnpm vitest run convex/incidents.test.ts`

Expected: PASS with no booking mutation and no partial writes after rejected transitions.

- [ ] **Step 6: Commit persistence**

```bash
git add convex/schema.ts convex/incidents.ts convex/incidents.test.ts
git commit -m "feat: persist typed TaskConfirm incidents"
```

### Task 3: Signed-Session Server Gateway and Actions

**Files:**
- Create: `src/services/providers/incident-gateway.ts`
- Create: `src/app/worker/incidents/actions.ts`
- Modify: `src/app/demo/session.ts`
- Test: `src/services/providers/incident-gateway.test.ts`

**Interfaces:**
- Consumes: the signed `BrowserCredential`, `hashDemoToken`, and Task 2 Convex functions.
- Produces: Zod-validated `WorkerIncidentView` and server actions for start, capture, transcript confirmation, candidate preparation, task selection, retry, and safe review.

- [ ] **Step 1: Write failing gateway validation tests**

```ts
expect(() => workerIncidentViewSchema.parse({ status: "TASK_CONFIRMED" })).toThrow();
expect(workerIncidentViewSchema.parse(validWorkerIncident)).toEqual(validWorkerIncident);
```

- [ ] **Step 2: Run the focused gateway test and confirm RED**

Run: `pnpm vitest run src/services/providers/incident-gateway.test.ts`

Expected: FAIL because the gateway does not exist.

- [ ] **Step 3: Implement the provider boundary and server actions**

```ts
export async function requireDemoCredential() {
  const credential = await readBrowserCredential();
  if (!credential) redirect("/demo");
  return { publicRunId: credential.publicRunId, browserTokenHash: hashDemoToken(credential.privateToken) };
}
```

Every action validates `FormData` with Zod, supplies credentials server-side, calls one bounded gateway method, and redirects to the persisted incident route returned by Convex.

- [ ] **Step 4: Run focused gateway and existing session tests**

Run: `pnpm vitest run src/services/providers/incident-gateway.test.ts src/domain/demo-session.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the server boundary**

```bash
git add src/services/providers/incident-gateway.ts src/app/worker/incidents/actions.ts src/app/demo/session.ts
git commit -m "feat: add guarded incident actions"
```

### Task 4: Mobile Capture, Transcript, and Task Confirmation UI

**Files:**
- Modify: `src/app/worker/bookings/[bookingId]/page.tsx`
- Create: `src/app/worker/incidents/[incidentId]/capture/page.tsx`
- Create: `src/app/worker/incidents/[incidentId]/transcript/page.tsx`
- Create: `src/app/worker/incidents/[incidentId]/interpretation/page.tsx`
- Create: `src/app/worker/incidents/incident-view.test.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: `WorkerIncidentView` and server actions from Task 3.
- Produces: accessible worker pages for the three persisted states.

- [ ] **Step 1: Write failing component tests for required controls and copy**

```tsx
expect(screen.getByRole("textbox", { name: /customer request/i })).toBeVisible();
expect(screen.getByRole("button", { name: /confirm these words/i })).toBeVisible();
expect(screen.getAllByRole("button", { name: /select this/i })).toHaveLength(3);
expect(screen.getByRole("button", { name: /cannot find the task/i })).toBeVisible();
```

- [ ] **Step 2: Run component tests and confirm RED**

Run: `pnpm vitest run src/app/worker/incidents/incident-view.test.tsx`

Expected: FAIL because pages/components do not exist.

- [ ] **Step 3: Build the booking start control and capture page**

The booking page adds `Report a customer-requested change · ग्राहक का नया अनुरोध बताएँ`. The capture page provides a required textarea plus reviewed preset cards for balcony deep cleaning, booking mismatch, and safety concern; it explains that the booking will not change yet.

- [ ] **Step 4: Build transcript confirmation**

Render `Is this what you said? · क्या आपने यही कहा?`, an editable native/code-mixed field, input-quality state, and `Yes, continue`, `Edit transcript`, and `Try again` controls. Submission always writes an explicit confirmation; editing preserves the original text.

- [ ] **Step 5: Build bounded interpretation**

Render `We understood this request · हमने यह अनुरोध समझा`, at most three persisted catalogue candidates, concise public match labels, `Select this`, `Edit what I said`, and `Cannot find the task`. Do not render price, inclusion, duration, or policy state.

- [ ] **Step 6: Add mobile-first styles and run component tests**

Run: `pnpm vitest run src/app/worker/incidents/incident-view.test.tsx`

Expected: PASS; all interactive controls are at least 48px and focus-visible.

- [ ] **Step 7: Commit the UI**

```bash
git add src/app/worker src/app/styles.css
git commit -m "feat: add typed TaskConfirm confirmation flow"
```

### Task 5: Browser Persistence and Safety Coverage

**Files:**
- Modify: `tests/e2e/public-routes.spec.ts`
- Modify: `scripts/run-e2e.mjs`
- Modify: `.scratch/hunar-os-v01/issues/03-capture-and-confirm-typed-request.md`

**Interfaces:**
- Consumes: the complete ticket-03 UI and fixture gateway.
- Produces: browser proof and resolved ticket record.

- [ ] **Step 1: Write the failing browser flow**

```ts
await page.getByRole("link", { name: /report a customer-requested change/i }).click();
await page.getByRole("textbox", { name: /customer request/i }).fill("Balcony ko deep clean karna hai");
await page.getByRole("button", { name: /review request/i }).click();
await page.reload();
await expect(page.getByDisplayValue("Balcony ko deep clean karna hai")).toBeVisible();
await page.getByRole("button", { name: /yes, continue/i }).click();
await page.getByRole("button", { name: /select this/i }).first().click();
await expect(page.getByText(/task confirmed/i)).toBeVisible();
```

Add a second browser context that proves it cannot open the first context's incident URL.

- [ ] **Step 2: Run browser tests and confirm RED**

Run: `pnpm test:e2e`

Expected: FAIL until the fixture incident gateway persists the same schema and authorization rules.

- [ ] **Step 3: Extend the fixture provider without weakening production rules**

Use the same pure transition and catalogue-membership functions as Convex. Store only test fixture state under `.demo-fixture`, scoped by run ID; never accept a browser tenant ID.

- [ ] **Step 4: Run final checks once**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:evals && pnpm seed && pnpm build && pnpm test:e2e`

Expected: all pass. `pnpm seed` may explicitly skip when no Convex deployment URL is configured.

- [ ] **Step 5: Review against standards and ticket spec**

Run the repository `code-review` skill against the fixed point before ticket 03. Fix all documented-rule violations and material spec gaps, then rerun only affected checks.

- [ ] **Step 6: Resolve ticket and checkpoint**

Set ticket status to `resolved`, check every acceptance item, add the test/review summary under `## Answer`, then:

```bash
git add .
git commit -m "feat: capture and confirm typed requests"
```

## Self-Review

- Spec coverage: all five ticket checks map to Tasks 1–5; transcript retention, safe abstention, trace versions, no booking mutation, and catalogue bounds are explicit.
- Placeholder scan: no TBD/TODO or unspecified error-handling steps remain.
- Type consistency: UI and actions consume `WorkerIncidentView`; persistence transitions use the same `IncidentStatus` and pure state machine; all public writes derive tenant and token hash from the signed browser session.

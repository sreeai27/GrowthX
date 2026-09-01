# Resolve Policy With Visible Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve each confirmed TaskConfirm catalogue task into exactly one deterministic, source-backed policy outcome and show the evidence and safe next actions to the worker.

**Architecture:** A pure TypeScript policy resolver accepts immutable booking, task, source and rule snapshots and returns either one supported decision or a safe abstention/conflict outcome. Thin tenant-scoped Convex functions load approved records, persist the decision and append its trace; a validated gateway feeds one bilingual mobile decision page.

**Tech Stack:** TypeScript strict mode, Vitest, Zod, Convex, Next.js App Router, Playwright.

**Spec:** `.scratch/hunar-os-v01/issues/04-resolve-policy-with-visible-evidence.md`; canonical detail in `HUNAR_OS_MASTER_BUILD_SPEC.md` sections 3.4, 7.9, 9.3, 12.7 and 13.

## Global Constraints

- Deterministic code alone decides inclusion, price, time, permissions and allowed actions.
- Missing, stale, inactive or conflicting policy support must abstain or escalate; it must never guess.
- Every external input and stored provider response is validated with Zod.
- Every database query and mutation is tenant-scoped and preserves booking, source, rule and flow versions.
- The seeded Sahaay policy is explicitly fictional demonstration data.
- Worker UI supports English and Hindi, 48px touch targets, visible focus, 360px width and desktop.
- No decision state offers cancellation, customer approval simulation or a connector action before authorisation.

---

### Task 1: Pure deterministic policy resolver

**Files:**
- Create: `src/domain/policy-decision.ts`
- Create: `src/domain/policy-decision.test.ts`
- Modify: `src/domain/incident-state.ts`
- Modify: `src/domain/incident-state.test.ts`

**Interfaces:**
- Consumes: `resolvePolicy(input: PolicyResolutionInput): PolicyResolutionResult` with booking, selected task, current ISO time, matching rules and sources.
- Produces: `PolicyDecision` for one valid rule or `PolicyAbstention` with support state `CANNOT_VERIFY`, `SOURCE_CONFLICT` or `ESCALATED`.

- [ ] **Step 1: Write failing table tests for all five decisions**

```ts
it.each([
  ["bathroom_cleaning_standard_1", "INCLUDED_CONTINUE"],
  ["balcony_deep_cleaning", "ADD_ON_APPROVAL_REQUIRED"],
  ["inside_cabinet_cleaning", "TRADE_OFF_REQUIRED"],
  ["wardrobe_assembly", "NOT_SUPPORTED"],
  ["exposed_live_wire_response", "SAFETY_ESCALATION"],
])("resolves %s as %s", (taskId, expected) => {
  expect(resolvePolicy(fixtureInput(taskId))).toMatchObject({
    kind: "DECISION",
    decisionState: expected,
  });
});
```

- [ ] **Step 2: Run the domain test and verify RED**

Run: `pnpm exec vitest run src/domain/policy-decision.test.ts`
Expected: FAIL because `resolvePolicy` does not exist.

- [ ] **Step 3: Add the strict resolver contracts and allowed-action mapping**

```ts
export type DecisionState = "INCLUDED_CONTINUE" | "ADD_ON_APPROVAL_REQUIRED" |
  "TRADE_OFF_REQUIRED" | "NOT_SUPPORTED" | "SAFETY_ESCALATION";

export function resolvePolicy(input: PolicyResolutionInput): PolicyResolutionResult;
```

The resolver filters by tenant, service, task, active source, effective time and exact source version; it returns exactly one rule or abstains. Allowed actions are fixed per decision state, with no cancel action.

- [ ] **Step 4: Add failing precedence, stale, missing and conflict tests**

Cover: future source, inactive source, missing source, missing rule, duplicate equally valid rules, rule/source version mismatch, booking/catalog mismatch and inactive task. Assert no price/time/action is returned for abstention.

- [ ] **Step 5: Implement deterministic precedence and stable decision hashing**

Select only a uniquely applicable approved source/rule. Hash the canonical JSON inputs with Node crypto; include booking version, rule key/version, source key/version and task ID.

- [ ] **Step 6: Extend the incident state machine**

Add `DECISION_READY` and event `RESOLVE_POLICY`; allow it only from `TASK_CONFIRMED`, with audit event `policy_resolved`. Add invalid-transition tests.

- [ ] **Step 7: Run domain tests and verify GREEN**

Run: `pnpm exec vitest run src/domain/policy-decision.test.ts src/domain/incident-state.test.ts`
Expected: PASS.

### Task 2: Seeded source passages and persisted decisions

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/fixtures.ts`
- Modify: `convex/seed.ts`
- Modify: `convex/seed.test.ts`
- Modify: `convex/incidents.ts`
- Modify: `convex/incidents.test.ts`
- Modify: `convex/incidentSupport.ts`

**Interfaces:**
- Consumes: `resolvePolicy` from Task 1.
- Produces: `incidents:resolvePolicyDecision` and a tenant-safe worker decision view.

- [ ] **Step 1: Write failing seed tests for visible evidence**

Assert one active source contains title, version, effective date, notice and five rule-linked passages. Assert every rule carries source version, effective range, priority and passage key.

- [ ] **Step 2: Add policy passage and decision schemas**

Add tenant-scoped `policyPassages` and `policyDecisions` tables. Store booking version, rule/source/passages, decision/support states, task, impacts, requirements, allowed/prohibited actions, explanation key, hash and timestamp.

- [ ] **Step 3: Expand the fictional seeded policy**

Seed exact passages for included, add-on, trade-off, unsupported and safety rules. Keep `₹299` as `29_900` minor units and `25` minutes only in the approved add-on rule.

- [ ] **Step 4: Write failing Convex resolution tests**

Cover all five states, tenant isolation, unchanged booking, one persisted decision, trace versions, idempotent re-read, conflict abstention and rejection outside `TASK_CONFIRMED`.

- [ ] **Step 5: Implement thin resolution persistence**

Load the owned incident, confirmed task, booking, active catalogue, tenant rules, sources and passages; call `resolvePolicy`; persist the snapshot; move to `DECISION_READY` or `AWAITING_HUMAN_REVIEW`; append one trace through `appendIncidentTrace`.

- [ ] **Step 6: Run Convex tests and verify GREEN**

Run: `pnpm exec vitest run convex/seed.test.ts convex/incidents.test.ts`
Expected: PASS.

### Task 3: Validated decision gateway and server action

**Files:**
- Modify: `src/services/providers/incident-gateway.ts`
- Modify: `src/app/worker/incidents/actions.ts`

**Interfaces:**
- Consumes: Convex decision functions and fixture policy data.
- Produces: `resolveDecision(input)` and `getDecision(input)` returning `WorkerPolicyDecisionView | null`.

- [ ] **Step 1: Define one Zod schema for the worker decision view**

Validate the original booking tasks/time, confirmed task, outcome, impacts, authority, source evidence, support state and allowed actions.

- [ ] **Step 2: Add Convex and fixture adapter methods**

Both adapters use the same pure resolver and return schema-parsed output. Fixture authorization must recheck active public run plus browser token hash.

- [ ] **Step 3: Add a server action after task confirmation**

After `confirmTask`, resolve the decision and redirect to `/worker/incidents/[incidentId]/decision`. Add a safe retry action for a persisted `TASK_CONFIRMED` state if resolution failed before persistence.

- [ ] **Step 4: Run typecheck and focused tests**

Run: `pnpm typecheck && pnpm exec vitest run src/domain/policy-decision.test.ts convex/incidents.test.ts`
Expected: PASS.

### Task 4: Evidence-first worker decision page

**Files:**
- Create: `src/app/worker/incidents/[incidentId]/decision/page.tsx`
- Modify: `src/app/worker/incidents/[incidentId]/interpretation/page.tsx`
- Modify: `src/app/styles.css`
- Modify: `tests/e2e/public-routes.spec.ts`

**Interfaces:**
- Consumes: `WorkerPolicyDecisionView` from Task 3.
- Produces: the route required by master spec section 7.9.

- [ ] **Step 1: Write the failing Playwright golden-path assertion**

After balcony selection, assert the page shows original booking, confirmed task, `Customer approval needed`, `25 minutes`, `₹299`, decision authority, source title/version/effective date/passage, `SUPPORTED`, and `Send for customer approval`.

- [ ] **Step 2: Build the semantic bilingual page**

Render content in the required order using a numbered workline and proof-node source card. The source passage opens inline without leaving the incident. Label all policy/price values as fictional demo data.

- [ ] **Step 3: Render only state-approved actions**

Included: continue/report error. Add-on: send/continue original. Trade-off: ask customer. Unsupported: continue/request review. Safety: stop affected work/contact supervisor. Ticket 04 buttons that belong to later tickets remain disabled with honest `Available next` copy and perform no mutation.

- [ ] **Step 4: Test mobile and desktop layout**

At 360x800 and 1280x800 assert no horizontal overflow, source disclosure is keyboard reachable, and visible controls meet the 48px target.

- [ ] **Step 5: Run focused browser test**

Run: `pnpm test:e2e -- -g "policy decision"`
Expected: PASS.

### Task 5: Review, full verification and checkpoint

**Files:**
- Modify: `.scratch/hunar-os-v01/issues/04-resolve-policy-with-visible-evidence.md`

- [ ] **Step 1: Review against standards and ticket spec**

Verify deterministic authority, source precedence, tenant isolation, safe abstention, version traceability, bilingual evidence order and absence of premature action execution.

- [ ] **Step 2: Run all required checks**

Run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:evals`, `pnpm seed`, `pnpm build`, then `pnpm test:e2e`.
Expected: all pass; if seed lacks a Convex URL, record that exact safe skip instead of claiming deployment seeding.

- [ ] **Step 3: Resolve the ticket and checkpoint**

Mark all ticket acceptance boxes complete only after evidence exists, then commit:

```bash
git add .
git commit -m "feat:resolve-policy-with-visible-evidence"
```

## Self-review

- Spec coverage: all five states, precedence, abstention/conflict, approved price/time authority, visible source evidence, mobile/desktop layout and invalid transitions are assigned to explicit tasks.
- Placeholder scan: no deferred implementation placeholders remain.
- Type consistency: `PolicyResolutionResult`, `PolicyDecision`, `WorkerPolicyDecisionView`, `resolveDecision` and `getDecision` are defined once and consumed under the same names.

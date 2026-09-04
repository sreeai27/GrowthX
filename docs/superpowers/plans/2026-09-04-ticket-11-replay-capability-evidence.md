# Ticket 11 Replay and Capability Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use TDD to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a worker practise one safely changed TaskConfirm situation after verified completion, receive one focused correction, retry once, and save private capability evidence with full provenance.

**Architecture:** Pure TypeScript owns replay invariants and scoring. Provider adapters may generate wording or speech, but schema validation and deterministic comparison preserve the original policy state, risk tier, price, duration, and approval requirements; a reviewed fixture is always available. Thin Convex functions persist tenant-scoped replay attempts and private capability events, while one mobile-first worker route exposes the public seam.

**Tech Stack:** Next.js App Router, strict TypeScript, Convex, Zod, Vitest, Playwright.

**Spec:** `.scratch/hunar-os-v01/issues/11-generate-replay-and-capability-evidence.md` and `HUNAR_OS_MASTER_BUILD_SPEC.md`

## Global Constraints

- The model may generate or evaluate language, but deterministic code owns policy, price, duration, risk, permission, and approval.
- Validate every provider output and external input with Zod or Convex validators.
- Every enterprise query and mutation requires and checks `tenantId`.
- Capability evidence is private by default, challengeable, and cannot alter pay, rating, access, allocation, suspension, or employability.
- Reviewed prerecorded audio and a bounded answer fallback must work without network access.
- Replay response audio expires after 24 hours while structured evaluation may remain.
- Worker controls use semantic HTML, visible focus, and touch targets of at least 48px.
- Fixed user-facing copy supports English and Hindi; Marathi remains in native script with optional Roman form.

---

### Task 1: Deterministic replay contract and invariants

**Files:**
- Create: `src/domain/replay.ts`
- Create: `src/domain/replay.test.ts`

**Interfaces:**
- Consumes: a verified incident snapshot, its policy decision, approved source, and fixed rubric.
- Produces: `createReviewedReplay(input): Replay`, `validateReplayVariant(original, candidate): ReplayValidation`, and `evaluateReplayAttempt(replay, answer): ReplayEvaluation`.

- [ ] **Step 1: Write a failing domain test** proving the reviewed balcony fixture changes wording while retaining `decisionState`, `riskTier`, `priceDeltaMinor`, `durationDeltaMinutes`, approval flags, source ID/version, and rubric version.
- [ ] **Step 2: Run** `node_modules/.bin/vitest.cmd run src/domain/replay.test.ts` and confirm failure because the replay module does not exist.
- [ ] **Step 3: Implement Zod schemas and `createReviewedReplay`** with stable enums for result and assistance levels and an immutable reviewed balcony fixture.
- [ ] **Step 4: Run the focused test** and confirm it passes.
- [ ] **Step 5: Add a failing invariant test** for changed policy state, price, duration, risk, approval, unknown task, and invented source.
- [ ] **Step 6: Implement `validateReplayVariant`** so each mismatch returns a named rejection and the caller can use the reviewed fixture.
- [ ] **Step 7: Add a failing evaluation test** for valid recognition, one focused correction, one retry, and rejection of invented permission, price, cancellation, completion, unsafe action, and approval bypass.
- [ ] **Step 8: Implement deterministic rubric scoring** over bounded action keys; do not score accent, grammar, or free-form similarity.
- [ ] **Step 9: Run the focused test** and confirm all domain cases pass.

### Task 2: Replay generation and speech provider boundaries

**Files:**
- Create: `src/services/providers/replay-provider.ts`
- Create: `src/services/providers/replay-provider.test.ts`
- Create: `src/services/providers/replay-speech-provider.ts`
- Create: `src/services/providers/replay-speech-provider.test.ts`
- Add: `public/audio/replay/taskconfirm-balcony-reviewed.*`

**Interfaces:**
- Consumes: the domain replay input and reviewed fixture from Task 1.
- Produces: `ReplayProvider.generate(input): Promise<ReplayProviderResult>` and `ReplaySpeechProvider.resolve(replay): Promise<ReplayAudioResult>`.

- [ ] **Step 1: Write a failing provider test** where valid generated wording passes schema and invariants, while malformed or policy-changing output falls back to the reviewed fixture with a named reason.
- [ ] **Step 2: Run the focused provider test** and confirm red.
- [ ] **Step 3: Implement the provider interface, fixture adapter, Zod parsing, provenance fields, and invariant gate.** Keep any future OpenAI implementation behind this interface.
- [ ] **Step 4: Run the test** and confirm green.
- [ ] **Step 5: Write a failing speech test** proving generated speech failure returns the reviewed prerecorded asset and never blocks replay.
- [ ] **Step 6: Implement speech resolution** with provider metadata and unconditional local fallback.
- [ ] **Step 7: Run both provider tests** and confirm green.

### Task 3: Tenant-scoped replay and private capability persistence

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/replays.ts`
- Create: `convex/replays.test.ts`
- Modify: `convex/incidentSupport.ts`

**Interfaces:**
- Consumes: verified incident, active demo run, replay/evaluation contracts, source/rubric/model/prompt provenance.
- Produces: `replays.generate`, `replays.submitAttempt`, and `replays.getWorkerReplay` through the existing generated Convex API.

- [ ] **Step 1: Write a failing Convex test** proving only a `VERIFIED` incident in the same tenant/run can create one replay and repeated generation is idempotent.
- [ ] **Step 2: Run** `node_modules/.bin/vitest.cmd run convex/replays.test.ts` and confirm red.
- [ ] **Step 3: Add `replays`, `replayAttempts`, and `capabilityEvents` tables** with tenant indexes, source/rubric/model/prompt provenance, `privateByDefault: true`, assistance level, challenge state, and no employment-score fields.
- [ ] **Step 4: Implement `generate` and query helpers** with tenant/run ownership checks and reviewed fallback persistence.
- [ ] **Step 5: Run the focused test** and confirm green.
- [ ] **Step 6: Add a failing submission test** proving one correction and at most one retry, changed retry wording, stable rubric, idempotent attempt handling, and a final private capability event.
- [ ] **Step 7: Implement `submitAttempt`** using the public domain evaluator; reject invalid transitions and never write a capability event before a final result.
- [ ] **Step 8: Add tenant-isolation and challenge tests** proving another run cannot read the event and the worker may mark it challenged without changing its facts.
- [ ] **Step 9: Run `convex/replays.test.ts`** and confirm all persistence cases pass.

### Task 4: Worker replay page and bounded answer fallback

**Files:**
- Create: `src/app/worker/incidents/[incidentId]/replay/page.tsx`
- Create: `src/app/worker/incidents/[incidentId]/replay/actions.ts`
- Create: `src/app/worker/incidents/[incidentId]/replay/replay-recorder.tsx`
- Modify: `src/app/worker/incidents/[incidentId]/status/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `getWorkerReplay`, `generate`, and `submitAttempt` from Task 3 and reviewed audio from Task 2.
- Produces: the confirmed public seam: a worker replay page that saves and displays its private capability event.

- [ ] **Step 1: Add a failing Playwright path** that finishes the verified golden path and expects a `Practise a changed situation` link only after verification.
- [ ] **Step 2: Run the single browser test** and confirm the missing link failure.
- [ ] **Step 3: Add the verified-only status link and replay server page** with Replay Violet styling, source/version disclosure, privacy copy, and `not an external certification` copy.
- [ ] **Step 4: Extend the browser test** to play reviewed audio, choose a bounded answer, receive one specific correction, and see one changed retry prompt.
- [ ] **Step 5: Implement the bounded answer form and retry state.** Voice is deliberate push-to-talk; permission denial leaves choices available.
- [ ] **Step 6: Extend the browser test** to submit the corrected response, reload, and see the same private capability event and assistance level.
- [ ] **Step 7: Implement final result rendering and challenge control** without public sharing, ranking, credential, or employment language.
- [ ] **Step 8: Verify at 360px and desktop** with no horizontal overflow, visible keyboard focus, and 48px controls.

### Task 5: Offline replay and false-pass evaluation suite

**Files:**
- Create: `evals/replay-suite.ts`
- Create: `evals/replay.eval.test.ts`

**Interfaces:**
- Consumes: public replay validation and evaluation functions from Task 1.
- Produces: named offline fixtures covering replay, correction/retry, failure, and false-pass prevention.

- [ ] **Step 1: Write named failing fixtures** for equivalent variation, invalid policy mutation, invented permission, invented price, cancellation claim, false completion, unsafe action, approval bypass, valid first pass, and valid retry after correction.
- [ ] **Step 2: Run** `node_modules/.bin/vitest.cmd run --config vitest.evals.config.ts evals/replay.eval.test.ts` and confirm red.
- [ ] **Step 3: Wire fixtures through the public domain interfaces** and add only the minimum missing deterministic rules needed for correct outcomes.
- [ ] **Step 4: Run the replay eval file** and confirm green, including false-pass assertions that deliberately bad answers fail.

### Task 6: Full verification and checkpoint

**Files:**
- Modify: `.scratch/hunar-os-v01/issues/11-generate-replay-and-capability-evidence.md`

**Interfaces:**
- Consumes: all Ticket 11 slices.
- Produces: verified ticket status and Git checkpoint.

- [ ] **Step 1: Run** `node_modules/.bin/eslint.cmd . --max-warnings=0`.
- [ ] **Step 2: Run** `node_modules/.bin/tsc.cmd --noEmit`.
- [ ] **Step 3: Run** `node_modules/.bin/vitest.cmd run`.
- [ ] **Step 4: Run** `node_modules/.bin/vitest.cmd run --config vitest.evals.config.ts`.
- [ ] **Step 5: Run** `node scripts/run-e2e.mjs`.
- [ ] **Step 6: Run** `node_modules/.bin/next.cmd build`; if the known environment stall repeats, record the exact result and do not claim completion.
- [ ] **Step 7: Check every Ticket 11 acceptance criterion** against the implementation and test evidence, update ticket status only if all required checks pass, and create a focused Git checkpoint.

## Self-review

- Spec coverage: all six Ticket 11 acceptance criteria map to Tasks 1–5 and verification in Task 6.
- Placeholder scan: no deferred implementation or unspecified error handling remains.
- Type consistency: replay domain types are the sole contract used by providers, persistence, UI, and evals.
- Scope: this plan adds TaskConfirm replay only; it does not add a generic course, credential, worker score, public profile, or Ride Replay expansion.

# TaskConfirm Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TaskConfirm release checks deterministic, validate production configuration, and generate honest evidence that clearly separates locally proven gates from blocked live deployment gates.

**Architecture:** Keep provider secrets server-only and add one pure production-readiness validator at the environment boundary. Make the existing Playwright runner clear only its owned fixtures before each run, add a two-run release command, and create a read-only evidence script that summarizes machine-readable test output plus fixture receipts without exposing contacts or tokens.

**Tech Stack:** Next.js, strict TypeScript, Zod, Vitest, Playwright, Node.js scripts, Convex fixture adapters.

**Spec:** `.scratch/hunar-os-v01/issues/17-harden-and-deploy-taskconfirm.md`

## Global Constraints

- `FEATURE_FIXTURE_MODE` must be explicit and false in production.
- Production requires `NEXT_PUBLIC_CONVEX_URL`, `DEMO_SESSION_COOKIE_SECRET`, and `DEMO_CONTACT_ENCRYPTION_KEY`; secrets never receive a `NEXT_PUBLIC_` prefix.
- Release evidence must contain no raw tokens, contacts, transcripts, API keys, or unsupported live-deployment claims.
- A release is not deployed until two complete logged-out public runs pass on the actual URL and second device.
- Private result delivery and deletion confirmation fail closed until authorised production providers exist.

---

### Task 1: Validate production configuration

**Files:**
- Modify: `src/config/env.ts`
- Modify: `src/config/env.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: environment variables as `Record<string, string | undefined>`.
- Produces: `parseEnvironment` that throws on production fixture mode, missing production secrets, or public-prefixed secret names.

- [ ] **Step 1: Add failing tests** for missing production Convex/cookie/encryption values, enabled production fixtures, and a valid production configuration.
- [ ] **Step 2: Run `node_modules\\.bin\\vitest.cmd run src/config/env.test.ts`** and confirm the new tests fail.
- [ ] **Step 3: Extend the Zod environment schema** with `NODE_ENV` and production-only checks while preserving empty local development support.
- [ ] **Step 4: Run the focused test** and confirm it passes.

### Task 2: Make browser release runs repeatable

**Files:**
- Modify: `scripts/run-e2e.mjs`
- Modify: `package.json`
- Test: `tests/e2e/public-routes.spec.ts`

**Interfaces:**
- Consumes: `.demo-fixture/e2e-runs.json` and its owned sidecar files.
- Produces: clean isolated fixture state per invocation and `pnpm test:e2e:release` that runs the full browser suite twice consecutively.

- [ ] **Step 1: Add a fixture cleanup list** for the runner-owned run, incident, confirmation, completion, replay, private-result, eval and Studio-session files.
- [ ] **Step 2: Add `test:e2e:release`** that invokes the browser runner twice and stops at the first failure.
- [ ] **Step 3: Run a focused approval/browser test twice** and confirm both invocations pass without stale data.

### Task 3: Produce redacted release evidence

**Files:**
- Create: `scripts/release-evidence.mjs`
- Create: `scripts/release-evidence.test.ts`
- Modify: `package.json`
- Modify: `docs/PRODUCTION_READINESS.md`

**Interfaces:**
- Consumes: current Git commit, redacted fixture outcomes, eval summary, and explicit live-check environment fields.
- Produces: `.scratch/release-evidence/taskconfirm-release.json` with status `LOCAL_EVIDENCE_ONLY` or `LIVE_VERIFIED`.

- [ ] **Step 1: Add a failing redaction test** proving token, contact, transcript and encryption fields never appear in generated evidence.
- [ ] **Step 2: Implement the evidence builder** with counts, non-identifying run IDs, connector receipt IDs, eval totals, provider latency/cost summaries, deletion receipt presence, mobile-recording test state, and unmet gates.
- [ ] **Step 3: Add `pnpm release:evidence`** and document the command plus the honest deployment status.
- [ ] **Step 4: Generate local evidence** and inspect it for secrets before handoff.

### Task 4: Run release gates and checkpoint

**Files:**
- Modify: `docs/PRODUCTION_READINESS.md`

**Interfaces:**
- Consumes: required command results and deployment access state.
- Produces: dated release record with exact pass/fail/block reason.

- [ ] **Step 1: Run lint, typecheck, unit tests, evals, build and full browser tests.**
- [ ] **Step 2: Record exact results** and list live deployment, real delivery, live Sarvam/OpenAI, and second-device verification as unmet unless actually performed.
- [ ] **Step 3: Commit the verified local hardening checkpoint** without claiming deployment.

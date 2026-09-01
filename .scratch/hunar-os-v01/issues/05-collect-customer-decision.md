# 05: Collect the customer decision

**What to build:** The worker can send one secure customer confirmation link for a decision snapshot, and the customer can confirm the request before approving, declining or reporting a mismatch without installing an app or exposing booking-private data.

**Blocked by:** 04: Resolve policy with visible evidence.

**Status:** resolved

- [x] Confirmation links use cryptographically random single-purpose tokens, store only hashes and expire after 30 minutes.
- [x] The customer sees the same request, price, duration, task list and source version as the worker.
- [x] Approve, decline, mismatch, invalid, expired and already-used states are distinct, persistent and idempotent.
- [x] A changed booking or policy makes the decision stale and prevents authorisation.
- [x] Token lifecycle, snapshot integrity, tenant isolation and worker/customer role boundaries have integration and E2E coverage.

## Verification

- Standards review: pass after all five findings were fixed; legacy migration recheck: pass.
- Spec review: pass after all four findings were fixed; customer-safe snapshot projection recheck: pass.
- `pnpm lint`: pass.
- `pnpm typecheck`: pass.
- `pnpm test`: 127 tests passed.
- `pnpm test:evals`: 1 evaluation passed.
- `pnpm build`: pass.
- `pnpm test:e2e`: 13 browser tests passed, including 360px and desktop customer confirmation checks.
- `pnpm seed`: safely skipped because `NEXT_PUBLIC_CONVEX_URL` was not configured.
- Task 4 process note: the product E2E test was not first observed failing before implementation; shipped lifecycle and role-boundary coverage passed in the final suite.

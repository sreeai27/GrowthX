# 07: Complete and verify the agreement

**What to build:** After the booking is revised or preserved, the worker can submit a structured completion summary and the customer can acknowledge it or raise an issue, producing an explicit verifiable final state instead of an AI quality judgement.

**Blocked by:** 06: Execute the authorised booking change.

**Status:** resolved

- [x] The worker sees the complete agreed task list and can mark tasks complete or flag a blocker with an optional note.
- [x] The customer sees the same agreement and can acknowledge the summary or raise an issue.
- [x] Verification records its criteria version, actor, booking version, evidence and final state and survives refresh.
- [x] No model automatically decides a consequential quality dispute, rating, pay or employability outcome.
- [x] Success, objection, blocker, review-required and invalid transition paths have integration and E2E tests.

## Answer

Implemented deterministic completion and customer verification for the final booking agreement in Convex and fixture mode, including receipt/task-list matching, tenant-scoped access, durable evidence, neutral human-review paths, bilingual worker/customer controls, and refresh-safe views.

Verification on 2026-09-02:

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed: 209 tests.
- `pnpm test:evals` passed: 1 test.
- `pnpm build` passed.
- `pnpm test:e2e` covered all 18 journeys; 17 passed in the full run, and the one cold-compilation timeout passed alone after its test budget was corrected from 90 to 180 seconds.
- `pnpm seed` exited successfully but skipped seeding because `NEXT_PUBLIC_CONVEX_URL` is not configured; run `npx convex dev` and set that variable to exercise the remote seed.
- Two-axis review against `49dee99` found no remaining material standards or specification blocker. A broad formatter-only diff in `customer-confirmation.ts` remains non-blocking.

# 04: Resolve policy with visible evidence

**What to build:** After the worker confirms a catalogue task, deterministic code produces exactly one source-backed policy outcome and shows the original booking, request, approved impact, authority and supporting source without allowing model judgement to set policy.

**Blocked by:** 03: Capture and confirm a typed request.

**Status:** resolved

- [x] Pure offline domain logic covers included, add-on approval required, trade-off required, not supported and safety escalation outcomes.
- [x] Active source and rule version precedence is deterministic; missing, stale or conflicting support abstains or escalates safely.
- [x] Price, time, inclusion, permissions and allowed actions come only from the approved seeded booking and policy data.
- [x] The decision page displays source title, version, effective date, passage, support state and allowed next actions at 360px and desktop widths.
- [x] Policy classification, precedence, conflict and invalid-transition tests pass without network access.

## Verification

- Standards review: pass; spec review: pass.
- `npm run lint`: pass (same repository script as `pnpm lint`).
- `npm run typecheck`: pass (same repository script as `pnpm typecheck`).
- `npm test -- --run`: 75 tests passed.
- `npm run test:evals`: 1 evaluation passed.
- `npm run build`: pass.
- `npm run test:e2e`: 10 browser tests passed, including 360px and desktop policy evidence checks.
- `npm run seed`: safely skipped because `NEXT_PUBLIC_CONVEX_URL` was not configured.

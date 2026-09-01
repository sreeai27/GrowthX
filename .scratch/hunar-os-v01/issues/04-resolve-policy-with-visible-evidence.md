# 04: Resolve policy with visible evidence

**What to build:** After the worker confirms a catalogue task, deterministic code produces exactly one source-backed policy outcome and shows the original booking, request, approved impact, authority and supporting source without allowing model judgement to set policy.

**Blocked by:** 03: Capture and confirm a typed request.

**Status:** ready-for-agent

- [ ] Pure offline domain logic covers included, add-on approval required, trade-off required, not supported and safety escalation outcomes.
- [ ] Active source and rule version precedence is deterministic; missing, stale or conflicting support abstains or escalates safely.
- [ ] Price, time, inclusion, permissions and allowed actions come only from the approved seeded booking and policy data.
- [ ] The decision page displays source title, version, effective date, passage, support state and allowed next actions at 360px and desktop widths.
- [ ] Policy classification, precedence, conflict and invalid-transition tests pass without network access.

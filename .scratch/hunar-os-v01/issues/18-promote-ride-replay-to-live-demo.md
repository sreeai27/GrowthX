# 18: Promote Ride Replay to live demo

**What to build:** A safely stopped rider can complete a standalone Hindi-led Ride Replay about confusing Marathi or Kannada instructions, practise a changed situation and receive traceable private capability evidence; only after its independent release checks pass does the KaamSaathi card change from `Demo preview` to `Live demo`.

**Blocked by:** 17: Harden and deploy TaskConfirm.

**Status:** ready-for-agent

- [ ] Entry requires explicit confirmation that the rider is safely stopped or the ride has ended; no interaction or recording is available while moving.
- [ ] The rider uses a reviewed fictional or consented phrase, never passenger/customer recording by default.
- [ ] The flow explains the phrase, safe clarification and one changed Replay without becoming a live ride assistant or generic language course.
- [ ] State, evidence, privacy, provider fallbacks and Public Trace survive refresh and follow the same tenant/version boundaries as TaskConfirm.
- [ ] Failure paths cover unsafe context, unusable input, unsupported meaning, provider failure and attempts to use the flow while moving.
- [ ] Mobile, persistence, privacy, Trace, eval and E2E checks pass before the public status label becomes `Live demo`.

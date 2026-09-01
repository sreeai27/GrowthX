# 02: Isolated guided demo session

**What to build:** A visitor can enter a no-account guided demo backed by the fictional Sahaay tenant and booking, resume the same unfinished attempt in the same browser for 24 hours or deliberately start over without seeing another visitor's activity.

**Blocked by:** 01: Bootable Hunar OS shell.

**Status:** ready-for-agent

- [ ] Seeding creates the canonical fictional tenant, worker, booking, catalogue and policy data idempotently.
- [ ] Starting a demo creates a generated run ID and private token whose stored form is a secure hash.
- [ ] Refresh and reopen preserve the active booking and unfinished demo run for 24 hours.
- [ ] Returning visitors see `Continue your demo` and `Start a new demo`; starting again abandons and removes access to the earlier run.
- [ ] Tenant isolation, invalid tokens, expiry and cross-run access have automated tests.

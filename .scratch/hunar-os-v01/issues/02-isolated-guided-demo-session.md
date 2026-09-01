# 02: Isolated guided demo session

**What to build:** A visitor can enter a no-account guided demo backed by the fictional Sahaay tenant and booking, resume the same unfinished attempt in the same browser for 24 hours or deliberately start over without seeing another visitor's activity.

**Blocked by:** 01: Bootable Hunar OS shell.

**Status:** resolved

- [x] Seeding creates the canonical fictional tenant, worker, booking, catalogue and policy data idempotently.
- [x] Starting a demo creates a generated run ID and private token whose stored form is a secure hash.
- [x] Refresh and reopen preserve the active booking and unfinished demo run for 24 hours.
- [x] Returning visitors see `Continue your demo` and `Start a new demo`; starting again abandons and removes access to the earlier run.
- [x] Tenant isolation, invalid tokens, expiry and cross-run access have automated tests.

## Answer

Implemented the isolated `/demo` entry and seeded booking flow with a signed, HTTP-only browser credential. Convex stores only the token hash, applies server-owned 24-hour expiry, scopes every run to the fictional demo tenant, and atomically abandons the earlier run during start-over.

The canonical seed repairs partial data as well as repeated runs. The worker booking view reads the tenant-scoped seeded booking, worker, and included catalogue tasks. Unit, Convex, evaluation, build, and browser tests pass.

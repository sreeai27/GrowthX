# 05: Collect the customer decision

**What to build:** The worker can send one secure customer confirmation link for a decision snapshot, and the customer can confirm the request before approving, declining or reporting a mismatch without installing an app or exposing booking-private data.

**Blocked by:** 04: Resolve policy with visible evidence.

**Status:** ready-for-agent

- [ ] Confirmation links use cryptographically random single-purpose tokens, store only hashes and expire after 30 minutes.
- [ ] The customer sees the same request, price, duration, task list and source version as the worker.
- [ ] Approve, decline, mismatch, invalid, expired and already-used states are distinct, persistent and idempotent.
- [ ] A changed booking or policy makes the decision stale and prevents authorisation.
- [ ] Token lifecycle, snapshot integrity, tenant isolation and worker/customer role boundaries have integration and E2E coverage.

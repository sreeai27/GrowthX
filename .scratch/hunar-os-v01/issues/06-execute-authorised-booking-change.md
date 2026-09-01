# 06: Execute the authorised booking change

**What to build:** A valid customer approval authorises exactly one mock booking update, and both parties can see the revised agreement and durable connector receipt; retries never duplicate the action.

**Blocked by:** 05: Collect the customer decision.

**Status:** ready-for-agent

- [ ] No connector call occurs before the state machine confirms current approval and action authority.
- [ ] The mock connector is behind an interface and uses an idempotency key tied to the immutable decision snapshot.
- [ ] Success stores the external/mock action ID, request hash, timestamps, prior/resulting booking versions and receipt.
- [ ] Retry after timeout or refresh returns the existing result or a safe explicit failure without a second mutation.
- [ ] Worker and customer views show the same revised or preserved booking, and idempotency/stale-state tests pass.

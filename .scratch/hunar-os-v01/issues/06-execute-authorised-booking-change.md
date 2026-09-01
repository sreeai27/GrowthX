# 06: Execute the authorised booking change

**What to build:** A valid customer approval authorises exactly one mock booking update, and both parties can see the revised agreement and durable connector receipt; retries never duplicate the action.

**Blocked by:** 05: Collect the customer decision.

**Status:** resolved

- [x] No connector call occurs before the state machine confirms current approval and action authority.
- [x] The mock connector is behind an interface and uses an idempotency key tied to the immutable decision snapshot.
- [x] Success stores the external/mock action ID, request hash, timestamps, prior/resulting booking versions and receipt.
- [x] Retry after timeout or refresh returns the existing result or a safe explicit failure without a second mutation.
- [x] Worker and customer views show the same revised or preserved booking, and idempotency/stale-state tests pass.

## Answer

Implemented one authorised booking-action lifecycle across Convex and the isolated fixture demo. The state machine must grant current action authority before a connector request can be reserved. The connector request and idempotency key are derived from the immutable tenant, decision, booking, source and action snapshot.

Connector receipts are stored durably by tenant and idempotency key before local booking finalisation. Repeated, concurrent, refresh and timeout-recovery calls retrieve the exact stored receipt rather than performing another connector mutation. Successful finalisation stores the private request evidence and receipt while customer and worker projections expose only the safe external receipt fields and the same revised agreement.

If local authority changes after the connector has succeeded, the action becomes `RECONCILIATION_REQUIRED`, the incident moves to human review and both views say not to retry or assume either booking version is final. Transient failures remain safely retryable; permanent failures preserve the original booking without claiming connector success.

Standards and specification reviews are clear. Verification passed: lint, typecheck, 165 unit/integration tests, 1 evaluation, production build, 15 browser tests, and the focused retry browser test. Seed exited successfully with the documented safe skip because `NEXT_PUBLIC_CONVEX_URL` is unset.

Task 4 deviation: there was no valid pre-implementation behavioural RED test because the browser flow did not yet exist. Post-implementation browser REDs exposed stale completion-copy expectations and were corrected without changing production behaviour.

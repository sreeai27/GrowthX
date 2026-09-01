# 03: Capture and confirm a typed request

**What to build:** A worker can report a customer-requested change using text or a reviewed preset, confirm or edit what was captured and select one bounded catalogue task before any policy decision occurs.

**Blocked by:** 02: Isolated guided demo session.

**Status:** resolved

- [x] The worker starts from the seeded active booking and can create a TaskConfirm incident without changing the booking.
- [x] Typed and preset inputs persist, survive refresh and require explicit transcript/request confirmation.
- [x] The worker can confirm, edit, retry, choose among bounded catalogue candidates or route an unmatched task to safe review.
- [x] Every write is tenant-scoped and records the required trace metadata and version references.
- [x] Invalid state transitions and attempts to select tasks outside the supplied catalogue are rejected and tested.

## Verification

- 37 unit and integration tests passed.
- 1 evaluation case passed.
- 8 browser tests passed, including the 360px TaskConfirm journey.
- Type check, lint and production build passed.
- Standards and specification reviews passed with no blocking findings.
- Seed command exited safely with the expected message because no Convex deployment URL is configured.

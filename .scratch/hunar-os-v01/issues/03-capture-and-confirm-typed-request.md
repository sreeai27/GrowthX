# 03: Capture and confirm a typed request

**What to build:** A worker can report a customer-requested change using text or a reviewed preset, confirm or edit what was captured and select one bounded catalogue task before any policy decision occurs.

**Blocked by:** 02: Isolated guided demo session.

**Status:** ready-for-agent

- [ ] The worker starts from the seeded active booking and can create a TaskConfirm incident without changing the booking.
- [ ] Typed and preset inputs persist, survive refresh and require explicit transcript/request confirmation.
- [ ] The worker can confirm, edit, retry, choose among bounded catalogue candidates or route an unmatched task to safe review.
- [ ] Every write is tenant-scoped and records the required trace metadata and version references.
- [ ] Invalid state transitions and attempts to select tasks outside the supplied catalogue are rejected and tested.

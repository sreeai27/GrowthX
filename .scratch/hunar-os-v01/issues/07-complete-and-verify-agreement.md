# 07: Complete and verify the agreement

**What to build:** After the booking is revised or preserved, the worker can submit a structured completion summary and the customer can acknowledge it or raise an issue, producing an explicit verifiable final state instead of an AI quality judgement.

**Blocked by:** 06: Execute the authorised booking change.

**Status:** ready-for-agent

- [ ] The worker sees the complete agreed task list and can mark tasks complete or flag a blocker with an optional note.
- [ ] The customer sees the same agreement and can acknowledge the summary or raise an issue.
- [ ] Verification records its criteria version, actor, booking version, evidence and final state and survives refresh.
- [ ] No model automatically decides a consequential quality dispute, rating, pay or employability outcome.
- [ ] Success, objection, blocker, review-required and invalid transition paths have integration and E2E tests.

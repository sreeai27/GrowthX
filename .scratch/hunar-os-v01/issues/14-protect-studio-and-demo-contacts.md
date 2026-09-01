# 14: Protect Studio and demo contacts

**What to build:** Named team members can safely operate the demo: ordinary demo operators use time-limited sign-in and see masked contacts, while two separately signed-in platform administrators can reveal full contact only for a recorded permitted reason and resolve deletion requests through an auditable process.

**Blocked by:** 08: Send the private demo result; 12: Expose Hunar Trace.

**Status:** ready-for-agent

- [ ] Allowlisted one-time sign-in links expire after 15 minutes and authenticated sessions after eight hours; shared credentials are not supported.
- [ ] Ordinary operators see masked email/mobile values and cannot call privileged reveal or mutation paths.
- [ ] Platform-administrator reveals require a reason, create immutable access events and remain limited to result delivery or separately consented invitation use.
- [ ] Expiry jobs delete full public demo runs and result contact after 30 days while retaining only permitted anonymous totals and non-identifying receipts.
- [ ] Deletion requests are due within seven calendar days, record evidence/reason, require second review when uncertain and allow one reasoned review of refusal.
- [ ] Approval confirms before removing contact, invitation consent, full runs and active links; access, retention and deletion paths have integration tests.

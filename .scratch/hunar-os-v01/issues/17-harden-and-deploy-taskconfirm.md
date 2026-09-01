# 17: Harden and deploy TaskConfirm

**What to build:** A first-time visitor can complete the full TaskConfirm story twice consecutively on the public deployment, including safe failures, refreshes and second-device customer approval, while the team has release evidence proving privacy, accessibility, isolation and deterministic authority.

**Blocked by:** 08: Send the private demo result; 09: Add real voice capture; 10: Add bounded OpenAI task mapping; 11: Generate Replay and capability evidence; 12: Expose Hunar Trace; 13: Run named evaluations; 14: Protect Studio and demo contacts; 15: Build the Hunar OS landing page; 16: Build the KaamSaathi landing page.

**Status:** ready-for-agent

- [ ] E2E covers approval, decline, mismatch, expiry, stale state, abstention/safety, connector retry, completion, result delivery and refresh/reopen.
- [ ] Tenant isolation, invalid action, token lifecycle, rate limit, retention and deletion security tests pass.
- [ ] Worker/customer flows pass keyboard, screen-reader basics, visible focus, 48px targets and 360px/desktop checks.
- [ ] All required pnpm commands pass, fixture mode is explicit and production secrets are server-only and validated.
- [ ] The public deployment works logged out on a second device and the complete demo succeeds twice consecutively.
- [ ] Release evidence captures commit, run IDs, receipts, deletion event, eval summary, latency/cost, mobile recording and unmet gates without overstating validation.

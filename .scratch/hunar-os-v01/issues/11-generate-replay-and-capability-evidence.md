# 11: Generate Replay and capability evidence

**What to build:** After a verified TaskConfirm outcome, the worker can practise one meaningfully changed situation, receive one specific correction and produce a private capability event tied to the source and rubric.

**Blocked by:** 07: Complete and verify the agreement; 10: Add bounded OpenAI task mapping.

**Status:** ready-for-agent

- [ ] Replay changes wording and surface details without changing the policy state, risk tier, price, duration or required approval.
- [ ] Reviewed prerecorded audio always works; generated speech is behind a provider interface and cannot block the flow.
- [ ] The worker can answer by voice or bounded fallback, see one correction and retry once with a changed prompt.
- [ ] Evaluation fails invented permission, price, cancellation, completion, unsafe action or approval bypass.
- [ ] Capability evidence remains private by default and stores source/rubric/model/prompt provenance without becoming a credential or employment score.
- [ ] Replay, failure and false-pass eval fixtures pass offline.

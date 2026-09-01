# 10: Add bounded OpenAI task mapping

**What to build:** A confirmed messy worker report can be mapped through the OpenAI Responses API to supplied catalogue candidates or a safe abstention, while deterministic code remains the only authority for policy, price, duration, approval and action.

**Blocked by:** 03: Capture and confirm a typed request; 04: Resolve policy with visible evidence.

**Status:** ready-for-agent

- [ ] The OpenAI provider sits behind an interface and uses the Responses API with strict schema validation for every output.
- [ ] Returned candidates must reference supplied catalogue task IDs; invented tasks or malformed output are rejected.
- [ ] One bounded schema-repair retry is allowed, followed by abstention or human review.
- [ ] The worker confirms the mapped task before deterministic policy resolution runs.
- [ ] Source ID/version, prompt/flow version and model ID are recorded without requesting or exposing private chain-of-thought.
- [ ] Named fixtures cover correct mapping, ambiguity, code-mix, invented IDs, schema failure and false-pass prevention.

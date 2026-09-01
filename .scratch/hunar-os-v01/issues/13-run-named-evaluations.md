# 13: Run named evaluations

**What to build:** An authorised reviewer can run named deterministic, speech, mapping, explanation and Replay evaluation suites and see trustworthy pass/fail evidence tied to the exact source, flow, prompt, policy and model versions.

**Blocked by:** 04: Resolve policy with visible evidence; 09: Add real voice capture; 10: Add bounded OpenAI task mapping; 11: Generate Replay and capability evidence; 12: Expose Hunar Trace.

**Status:** ready-for-agent

- [ ] Evaluation fixtures cover policy precedence, invalid transitions, provider schema failures, abstention, approval bypass, unsafe advice and false-pass cases.
- [ ] Runs persist suite, source, policy, flow, prompt and model versions plus criterion-level results, latency and cost.
- [ ] The protected Studio evaluation page shows aggregate and case-level results without exposing secrets or unrelated tenant data.
- [ ] Corrected AI failures can be promoted into named regression cases.
- [ ] `pnpm test:evals` runs deterministically without paid providers and fails when a critical criterion is bypassed.

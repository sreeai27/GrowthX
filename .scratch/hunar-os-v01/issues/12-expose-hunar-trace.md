# 12: Expose Hunar Trace

**What to build:** A visitor can inspect a redacted read-only Public Trace for their current demo run and three curated fictional examples, seeing how input became a source-backed authorised outcome without seeing raw prompts, private data or another visitor's run.

**Blocked by:** 07: Complete and verify the agreement; 10: Add bounded OpenAI task mapping.

**Status:** ready-for-agent

- [ ] Current-run Trace shows ordered stages, actors, status, source/version, model/flow/prompt versions, approvals, receipt, latency, usage and estimated cost where applicable.
- [ ] Public Trace excludes raw prompts, private chain-of-thought, contact details, unnecessary transcript text, token hashes, secrets and internal errors.
- [ ] The curated gallery covers an included request, completed customer approval and unsupported/escalated outcome using fictional data.
- [ ] Public queries are tenant- and run-scoped, read-only and cannot enumerate visitor traces.
- [ ] Redaction, cross-run isolation, refresh persistence, curated fixtures and mobile/desktop presentation have automated coverage.

# Hunar OS — Codex Build Pack

**Version:** 1.0  
**Date:** 31 August 2026  
**Status:** Canonical build direction

## What to treat as the source of truth

1. `HUNAR_OS_MASTER_BUILD_SPEC.md` — the single canonical product, UX, architecture, data, AI, safety, evaluation and implementation specification.
2. `AGENTS.md` — durable instructions Codex should follow in every coding session.
3. `VC_BRUTAL_REVIEW.md` — investor analysis and the commercial evidence required before treating the company thesis as validated.

Earlier concept notes and Build Week documents are useful source material, but they are **not** the implementation source of truth where they conflict with this pack.

## Canonical company definition

> **Hunar OS is the exception-resolution infrastructure for frontline work. When a ride, delivery or home-service job leaves the happy path, it converts messy voice, screenshots and work context into a policy-grounded action, completes or verifies the next step, and turns the incident into future capability.**

## The product decision that matters most

The first commercial-quality flow is **TaskConfirm**, not a generic translator and not a standalone learning app.

TaskConfirm handles a live home-service scope change:

1. A worker reports a customer's additional request in their own language.
2. Hunar OS maps the request to the approved task catalogue.
3. Deterministic policy classifies it as included, add-on, trade-off, unsupported or safety escalation.
4. Worker and customer see the same interpretation and decision.
5. Required approval is collected.
6. A connector updates the booking or records the authorised next action.
7. Completion is confirmed and the event becomes a targeted replay/capability record.

**Ride Replay remains a secondary low-risk demonstration pack.** It proves multilingual interpretation and incident-to-capability, but by itself it is not a strong commercial wedge.

## How to start in Codex

Put all files in the root of a new Git repository, then give Codex this task:

```text
Read AGENTS.md and HUNAR_OS_MASTER_BUILD_SPEC.md completely. Do not code yet.
Return:
1. the canonical MVP in your own words;
2. the non-negotiable safety and policy boundaries;
3. the proposed repository tree;
4. a phase-by-phase implementation plan mapped to the specification;
5. every unresolved dependency or credential.
Do not broaden scope. Wait for approval after the plan.
```

After approving the plan, use:

```text
Implement Phase 0 and Phase 1 from HUNAR_OS_MASTER_BUILD_SPEC.md.
Work test-first for the deterministic policy engine.
Run typecheck, lint and tests before reporting completion.
Do not begin the next phase until all exit criteria pass.
```

Repeat one phase at a time. Create a Git checkpoint after every passing phase.

## Build target

A reviewer should be able to complete this complete loop from a public mobile URL:

> open a seeded booking → safely report an additional request by voice → confirm the transcript → see a source-backed deterministic decision → open the customer confirmation link → approve or decline → observe an idempotent booking update → confirm completion → inspect the trace → complete one changed replay → see a capability event.

A polished chatbot that stops at advice does **not** satisfy the specification.

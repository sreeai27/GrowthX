# AGENTS.md — Hunar OS

This file is the durable operating contract for coding agents in this repository.

## Read first

Before changing code, read:

1. `HUNAR_OS_MASTER_BUILD_SPEC.md`
2. the current phase and its exit criteria
3. relevant tests and existing implementation

Before making any visual or interface design decision, also read `DESIGN.md` and keep the decision consistent with its design language. If `DESIGN.md` conflicts with `HUNAR_OS_MASTER_BUILD_SPEC.md`, the master specification wins.

Where documents conflict, `HUNAR_OS_MASTER_BUILD_SPEC.md` wins. Do not revive discarded scope from earlier drafts.

## Canonical product rule

Hunar OS resolves bounded frontline-work exceptions. It is not a generic chatbot, language course, LMS, surveillance product or open-ended autonomous agent.

For every operational decision:

- the model may interpret messy input and map it to structured candidates;
- an approved, versioned source must support the action;
- deterministic code decides inclusion, price, time, permissions and required approval;
- consequential or unsupported cases must abstain or escalate;
- an action is not complete until an authorised connector returns a receipt or the system records an explicit verification outcome.

## Non-negotiable implementation constraints

- Use TypeScript in strict mode. Avoid `any`; document rare exceptions.
- Validate every external input and every model output with Zod/JSON Schema.
- Use the OpenAI Responses API, not the deprecated Assistants API.
- Keep model, speech, storage, action and analytics providers behind interfaces.
- Never let an LLM invent a task price, duration, booking inclusion state, policy rule, approval or platform action.
- Never call a connector before the state machine says the action is authorised.
- Make action mutations idempotent and store their receipts.
- Treat tenant ID as mandatory in every enterprise query and mutation.
- Preserve source ID, source version, prompt/flow version and model ID on every decision.
- Store concise structured rationale summaries; do not request or expose private chain-of-thought.
- No ambient or continuous recording. No passenger/customer recording by default.
- Block rider interaction while moving. The worker-retelling flow starts only after a safety confirmation.
- Do not use raw customer media for training. Retention and deletion must be explicit and testable.
- No automatic rating, suspension, pay, allocation or employability changes.
- Do not imply affiliation with Rapido, Swiggy, Zomato, Urban Company, Snabbit or YesMadam.
- Use the fictional seeded tenant and data defined in the master specification.
- Do not add a multi-agent chat UI. Named stages belong in one trace.
- Do not add new verticals until the TaskConfirm golden path and its tests pass.

## Engineering conventions

- Package manager: `pnpm`.
- Framework: mobile-first Next.js with App Router, Convex and TypeScript.
- Put deterministic domain logic in pure modules under `src/domain`; it must run without network access.
- Keep provider adapters under `src/services/providers`.
- Keep Convex functions thin; domain rules should not be trapped inside database handlers.
- Prefer server-side secrets and actions. Never expose API keys in the browser.
- Use accessible semantic HTML, keyboard support, visible focus and at least 48px touch targets on worker/customer flows.
- User-facing copy must support English and Hindi; Marathi phrases must preserve native script and an optional Roman form.
- Use stable enums and explicit state transitions. Reject invalid transitions.
- Use UTC timestamps in storage and render local time only in the UI.
- Log redacted metadata, not raw secrets or unnecessary personal data.

## Required commands

Maintain these commands as the repository evolves:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:evals
pnpm seed
```

A task is not complete until relevant commands pass. If a command cannot run, report the exact reason and do not claim completion.

## Testing priorities

Test in this order:

1. deterministic policy classification and version precedence;
2. invalid state transitions and action authorisation;
3. tenant isolation;
4. customer approval token lifecycle and idempotency;
5. provider-output schema validation and abstention;
6. persistence across refresh/reopen;
7. complete mobile golden path;
8. evaluation fixtures and false-pass prevention.

Every fixed production bug should add or update a regression test. Every corrected AI failure should become a named eval case.

## Change discipline

- Work one implementation phase at a time.
- Before coding, state which acceptance criteria the change addresses.
- Keep diffs focused. Do not refactor unrelated code.
- Add dependencies only when they remove meaningful implementation risk.
- Update the master spec only when the user explicitly changes a product decision.
- Record material deviations in a `DECISIONS.md` file with date, reason and impact.
- Create a Git checkpoint after each phase passes.

## Definition of done

A feature is done only when:

- the intended state transition works;
- failure and abstention paths work;
- data persists correctly;
- trace fields are written;
- privacy and tenant boundaries are preserved;
- unit/integration/e2e tests pass;
- the UI works at 360px width and on desktop;
- the implementation matches the specified copy and acceptance criteria.

## Agent skills

### Issue tracker

Issues are tracked as local Markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five default canonical label names. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain-doc layout. See `docs/agents/domain.md`.

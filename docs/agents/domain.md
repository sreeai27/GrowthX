# Domain Docs

How engineering skills should use this repo’s domain documentation.

## Before exploring, read these

- `CONTEXT.md` at the repo root
- `CONTEXT-MAP.md`, if present, and each relevant context file it points to
- Relevant decisions under `docs/adr/`
- In a multi-context repo, relevant decisions under `src/<context>/docs/adr/`

If these files do not exist, continue without raising their absence. The domain-modeling skill creates them when terms or decisions need to be recorded.

## File structure

This repo uses the single-context layout:

```
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the glossary’s vocabulary

When naming a domain concept in an issue, proposal, hypothesis, or test, use the term defined in `CONTEXT.md`.

If a needed concept is missing, reconsider whether it belongs to the project or note the gap for domain modeling.

## Flag decision conflicts

If work contradicts an existing architecture decision record—an ADR, meaning a saved technical decision—state the conflict instead of silently overriding it.

# Issue tracker: Local Markdown

Issues and specs for this repo live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are stored one per file at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`
- Issue numbers start at `01`
- Comments and conversation history are appended under a `## Comments` heading

## When a skill says “publish to the issue tracker”

Create a file under `.scratch/<feature-slug>/`, creating the directory if needed.

## When a skill says “fetch the relevant ticket”

Read the referenced file. The user will normally provide its path or issue number.

## Wayfinding operations

Used by `/wayfinder`. The map has one child file per ticket.

- **Map:** `.scratch/<effort>/map.md`
- **Child ticket:** `.scratch/<effort>/issues/NN-<slug>.md`
- **Type:** `research`, `prototype`, `grilling`, or `task`
- **Status:** `claimed` or `resolved`
- **Blocking:** recorded as `Blocked by: NN, NN`
- **Frontier:** the first numbered ticket that is open, unblocked, and unclaimed
- **Claim:** set `Status: claimed` before starting work
- **Resolve:** add the answer under `## Answer`, set `Status: resolved`, and add a short decision summary plus link to `map.md`

# Hunar OS Interface System

## Direction and feel

**Earned confidence:** calm, source-backed guidance for a frontline professional who is already mid-job. The interface should feel like a clear work record, not a chatbot, generic dashboard or policy PDF.

- Human: Asha or another worker resolving one bounded exception on a phone.
- Primary verb: understand and take the next authorised step.
- Emotional target: respectful, calm and certain without hiding limits.
- Domain vocabulary: booking scope, confirmed request, approved impact, decision authority, source passage, safe action, receipt and verification.
- Signature: a numbered vertical workline that ends in a Marigold proof node and inline evidence artifact.
- Reject: confidence scores, equal-card dashboard grids, modal-only sources, decorative gradients, cancel-job shortcuts and enabled actions before authorisation.

## Color world and tokens

Use the semantic tokens already defined in `src/app/styles.css` and `DESIGN.md`.

- `--warm-paper` (`#FCFBF7`): primary worker canvas.
- `--paper-raised`: evidence and transcript artifacts above the canvas.
- `--work-ink` (`#0B1F2A`): primary text.
- `--muted-ink`: supporting explanations and metadata.
- `--system-navy` (`#17324D`): approved impact and authority.
- `--saathi-teal` (`#0F766E`): calm worker action and supported states.
- `--marigold` (`#E9A82B`): proof nodes, source passage rules and visible focus.
- Proof-green and danger-red remain semantic outcome/safety colors; do not use them decoratively.

Aim for roughly 60% warm neutral, 30% ink/navy structure and no more than 10% teal/marigold emphasis.

## Depth and surfaces

Use subtle shadows on warm light surfaces. Borders are quiet structure, not decoration.

1. Canvas: Warm Paper, no shadow.
2. Guided sections: light tonal shift or an 8% ink ring.
3. Proof artifact: `20px` radius with `0 0 0 1px rgb(11 31 42 / 0.08), 0 12px 32px rgb(23 50 77 / 0.08)`.
4. Action area: teal-tinted surface with `0 8px 24px rgb(15 118 110 / 0.07)`.

Do not mix this with dramatic shadows, thick borders or unrelated surface hues.

## Spacing and shape

- Base spacing unit: `4px`; primary rhythm uses `8px` multiples.
- Mobile/worker controls: minimum `48px` height and full-width where the decision is linear.
- Workline columns: `48px` node column, `16px` gap, `40px` between steps.
- Workline node: `48px` circle; proof node adds a `6px` Marigold halo.
- Worker cards and action panels: `20px` radius.
- Approved-impact chips: `12px` radius and `12px 16px` padding.
- Source disclosure: minimum `56px` hit area.

## Typography and hierarchy

- Anek Devanagari: focal outcome headings and decision section headings.
- Noto Sans / Noto Sans Devanagari: instructions, bilingual body copy and source passage text.
- IBM Plex Mono: step labels, versions, dates, IDs, status and price/time evidence.

Use a calm ~1.25 type ratio. Weight, color and whitespace do more hierarchy work than extra sizes.

- Decision outcome: `clamp(2.7rem, 9vw, 5rem)`, tight width around `13ch`.
- Workline heading: `clamp(1.4rem, 4vw, 1.8rem)`, line-height `1.25`.
- Body/source text: `1rem`, line-height about `1.55`.
- Technical label: `0.72–0.75rem`, bold, slight tracking; uppercase only for compact metadata.
- Dynamic numbers use tabular figures through IBM Plex Mono.

The focal point is always the decision outcome. Booking and request establish context; impact and authority prove it; actions come last.

## Reusable patterns

### Governed workline

Use for flows where a human must understand how an operational conclusion was reached.

1. Original authoritative context.
2. Confirmed human request or observation.
3. Approved impact from deterministic data.
4. Who has authority to decide next.
5. Source proof, marked by the Marigold node.

Keep the connector Navy at low opacity. Each step uses semantic HTML inside an ordered list. Never replace this sequence with five equal cards.

### Inline source proof

- Show source title, version and effective date before the passage.
- Use native `<details>`/`<summary>` so keyboard behavior works without custom scripting.
- Summary focus ring: `3px` Marigold, inset with `-3px` offset.
- Passage: Noto Sans, `1rem/1.55`, with a `4px` Marigold left rule.
- Always show the fictional/demo notice when using seeded data.
- Source evidence opens without navigating away from the incident.

### Approved impact

- Present time and price as compact Navy evidence chips, not editable fields.
- Values must come from stored policy output; the UI never calculates or invents them.
- Explain directly that values come from approved policy rather than AI.

### Safe action area

- Comes after evidence and authority.
- Primary allowed action uses Saathi Teal; secondary allowed actions use the existing secondary-button treatment.
- A future-ticket action stays disabled and is labelled `Available next`; never make a dead control look active.
- Disabled controls use `opacity: 0.58` and `cursor: not-allowed` while keeping readable text.
- No cancel-job action. No worker-simulated customer approval.

### Status capsule

- Technical status uses IBM Plex Mono at `0.75rem/700`, slight tracking.
- Supported state uses a quiet teal tint; safety and conflict use their semantic colors.
- Status supports the outcome heading and must not compete with it.

## Responsive and accessibility rules

- Validate worker flows at `360×800` and desktop at `1280×800`.
- No horizontal overflow at either width.
- All controls and disclosures are keyboard reachable with visible focus.
- Worker/customer touch targets are at least `48px`.
- English and Hindi are presented together; Marathi native script is preserved when introduced.
- Use semantic headings, ordered lists, buttons and native disclosures.
- Respect `prefers-reduced-motion`; decision reading does not require animation.

## Future-screen consistency check

Before shipping a new worker decision/status/receipt screen, verify:

- one unmistakable focal outcome;
- authoritative context before action;
- explicit person/system with next authority;
- inline versioned evidence;
- Warm Paper/Navy/Teal/Marigold token discipline;
- 4/8px spacing rhythm and 20px worker-card radius;
- honest loading, empty, failure, abstention and disabled states;
- 360px, desktop, keyboard and 48px checks.

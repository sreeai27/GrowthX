# GSAP motion audit

Last reviewed: 2026-09-05

GSAP is a progressive enhancement here: page content renders first and remains usable if animation is unavailable. `src/app/motion/public-page-motion.tsx` is the single setup and cleanup boundary for current public-page motion.

## Use now

| Surface                                | Use                                         | Why it helps                                     | Limit                                            |
| -------------------------------------- | ------------------------------------------- | ------------------------------------------------ | ------------------------------------------------ |
| `/hunar-os` hero                       | Ordered entrance for the promise and proof  | Connects the claim to its evidence               | One run; transform and opacity only              |
| `/hunar-os` workline                   | Reveal each stage on entry                  | Reinforces the report-to-outcome order           | No scroll locking, scrubbing, or pinned sections |
| `/hunar-os` trust and closing sections | One restrained reveal                       | Clarifies the long-page reading rhythm           | Never sequence individual policy claims          |
| `/kaam-saathi` hero                    | Entrance from worker statement to next step | Makes the voice-to-proof direction legible       | No fake waveform or listening state              |
| `/kaam-saathi` demo and future cards   | One-time viewport reveals                   | Separates available, preview, and future choices | Status text always stays available               |
| `/kaam-saathi` assurance               | One restrained reveal                       | Gives privacy boundaries a clear pause           | Never delay individual protections               |

## Good later, after focused browser tests

| Surface                   | Possible use                                                    | Proof needed before shipping                                    |
| ------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| Demo entry                | Bring role instructions and device card in as a pair            | No delay to start/resume; test restored sessions                |
| Transcript review         | Briefly mark changed or uncertain words after an edit           | Screen-reader announcement and keyboard editing stay correct    |
| Interpretation candidates | Move the selected card into its confirmed position with Flip    | State persists and invalid candidates never look authorised     |
| Decision workline         | Draw its connector and settle the proof node after data arrives | Source, state, price, and duration render immediately           |
| Customer confirmation     | Transition from pending to approved/declined receipt            | Server result lands first; repeat submissions remain idempotent |
| Worker status             | Move the shared agreement into receipt state                    | Polling, refresh, and expired links remain clear without motion |
| Completion                | Reveal verification outcome and receipt together                | Failure and disputes get equal clarity; no celebration effect   |
| Replay                    | Move between prompt, answer, and correction                     | Keep it in private practice; never resemble a worker score      |
| Public Trace              | Reveal timeline nodes or an expanded trace row                  | Never hide source and version fields during data arrival        |
| Hunar Studio              | Animate occasional drawers or trace-detail transitions          | Skip dense repeated controls; keep keyboard focus stable        |
| Future Hunar Loom         | Coordinate WebGL camera and node transitions                    | Build only after TaskConfirm and a performance budget pass      |

## Keep as CSS

- Button hover, press, focus, and disabled feedback: these are small repeated interactions.
- The recorder ornament: keep CSS until it represents a real state; GSAP must not imply the microphone is active.
- Native `details` plus-icon rotation: CSS preserves native disclosure behavior.
- Color and shadow state changes: existing CSS tokens already own them.

## Do not animate

- Safety stops, moving-worker blocks, permission denials, provider errors, and abstention messages.
- Price, duration, booking inclusion, policy versions, approval authority, or receipts in ways that make them look calculated by motion.
- Record/start controls on load; recording starts only after an explicit worker action.
- Repeated form entry, authentication, admin tables, and frequent actions.
- Ratings, punishment, employability, or worker-score visuals; those behaviors are prohibited.
- Scroll-jacking, long pinned scenes, parallax behind text, confetti, counters, or decorative text splitting.

## Implementation rules

1. Import GSAP only from a client component; keep route content server-rendered.
2. Register each plugin explicitly so production bundling keeps it.
3. Use `useGSAP` or `gsap.context()` and revert animations during cleanup.
4. Scope selectors to one page root.
5. Run movement only for `(prefers-reduced-motion: no-preference)`.
6. Animate only `transform` and `opacity`, not layout dimensions or spacing.
7. Keep motion near 180–300ms; stagger only a short narrative sequence by 30–80ms.
8. Never use pre-hydration CSS to hide content.
9. Reserve ScrollTrigger for long, occasional story surfaces.
10. Test at 360px and desktop with normal and reduced motion.

## Packages

- `gsap` provides the animation engine and ScrollTrigger.
- `@gsap/react` provides `useGSAP`, which handles React cleanup.
- GSAP's official guide recommends module imports and explicit plugin registration so build tools do not remove plugins during tree shaking, meaning automatic removal of unused code.

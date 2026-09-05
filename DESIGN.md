# Hunar OS + KaamSaathi Design Language v1.1 — Earned Confidence

This document establishes the visual and technical blueprint for Hunar OS and KaamSaathi. It defines a system that balances enterprise-grade operational rigor with human-centric worker support.

---

## 1. Brand Personalities

| Dimension              | **Hunar OS**                       | **KaamSaathi**                        |
| :--------------------- | :--------------------------------- | :------------------------------------ |
| **Primary Audience**   | Ops leaders, quality teams, buyers | Frontline workers, first-time users   |
| **Primary Promise**    | Make frontline work verifiable     | Help handle the next difficult moment |
| **Emotional Quality**  | Reliable, transparent, rigorous    | Calm, respectful, useful, reassuring  |
| **Visual Density**     | Structured and moderately dense    | Spacious and highly focused           |
| **Lead Color**         | System Navy (#17324D)              | Saathi Teal (#0F766E)                 |
| **Interface Metaphor** | Operating layer and outcome graph  | Companion and guided path             |

---

## 2. Core Palette

The palette is anchored in **"Work Ink"** and **"Warm Paper"** to provide high-contrast legibility while avoiding the cold, institutional feel of standard blue SaaS.

### 2.1 Brand Colors

- **System Navy (#17324D):** Trust, depth, and infrastructure. Used for Hunar OS primary identity.
- **Saathi Teal (#0F766E):** Calm action and support. Used for KaamSaathi primary identity.
- **Marigold (#E9A82B):** The "Proof Node." Highlights human warmth, recorded evidence, and active voice states.

### 2.2 Semantic Colors

- **Replay Violet (#5E4FB5):** Practice, simulation, and post-incident learning modes.
- **Proof Green (#18794E):** Successfully demonstrated capability or verified outcome.
- **Danger Red (#B42318):** Safety stops, critical errors, or destructive actions.

### 2.3 Neutrals

- **Warm Paper (#FCFBF7):** The primary light background for high-dignity editorial layouts.
- **Work Ink (#0B1F2A):** Primary text and deep-surfaces.

---

## 3. Typography

The system uses a triple-font strategy to balance India-first character, long-form readability, and technical precision.

- **Anek (Display):** Used for headlines and campaign statements. It provides a modern India-first character without decorative stereotypes.
- **Noto Sans (Interface):** Used for all app instructions, transcripts, and Indic script UI.
- **IBM Plex Mono (Technical):** Reserved for IDs, versions, latency, and system metadata in Hunar Trace.

---

## 4. Visual Language & Composition

### 4.1 The Three-Plane System

1. **The Human Moment:** Real photography establishing the worker's environment.
2. **The Workline:** A visible path or connector revealing the system's logic.
3. **The Proof Artifact:** Tangible evidence like transcripts, guidance cards, or receipts.

### 4.2 Shape Language

- **Hunar OS:** Structured, with 12px radii for panels and 10px for controls.
- **KaamSaathi:** Approached, with 20px radii for cards and 16px for primary actions.
- **Shared:** Both systems use the circular "Marigold Node" to represent verified events.

---

## 5. Components

### 5.1 KaamSaathi (Worker App)

- **Voice Recorder:** 88px Teal circle with Marigold pulse for recording states.
- **Transcript Card:** Editable white card with uncertain words underlined in Marigold.
- **Grounded Answer Stack:** Ranked cards (Neutral -> Teal -> Navy) to separate "What they said" from "What you should do."
- **Replay Section:** Violet-tinted environment to signal the transition from live-job to practice.

### 5.2 Hunar OS (Enterprise)

- **Work Outcome Graph:** Signature WebGL visualization of incident-to-capability compounding.
- **Trace Timeline:** A structured vertical flow showing every provider call and human decision.
- **Source Viewer:** Split-pane interface highlighting the exact policy passage supporting a decision.

---

## 6. Motion & WebGL

- **Motion:** Calm, directional, and responsive. No confetti or "gamification theatre."
- **Hunar Loom (WebGL):** A 3D interactive graph on the Hunar OS site that visually connects real incidents to capability growth.
- **KaamSaathi Motion:** Focused on functional feedback (waveform, progress lines, subtle card lifts).

---

## 7. Principles & Guardrails

- **Human before AI:** The worker is always the hero; models are invisible infrastructure.
- **Source before Confidence:** Never show a "99% confidence" bar; show the actual policy passage.
- **Dignity over Pity:** Show professionals developing autonomy, not victims needing rescue.
- **Safety First:** Mobility flows are blocked unless the rider confirms they are safely stopped.

---

## 8. System-wide craft rules

- **Proof-node signature:** Every primary wordmark and every completed evidence path uses the same Marigold node. It represents a recorded, inspectable event—not decoration.
- **Color has a job:** Navy means authority, Teal means a safe supported action, Marigold means proof or focus, Violet means practice, Green means verified, and Red means stop or failure.
- **One depth model:** Raised artifacts use one quiet ring and a soft Navy shadow. Action areas use a low Teal shadow. Inputs are inset against their parent surface.
- **Four text levels:** Work Ink for the decision, Muted Ink for explanation, mono labels for metadata, and reduced opacity only for disabled content.
- **Interaction finish:** Controls have visible hover, press, focus and disabled states. Motion stays under 200ms and disappears when reduced motion is requested.
- **Shared shape logic:** 10–12px controls sit inside 20px worker cards; circular nodes are reserved for the Workline and recorded proof.

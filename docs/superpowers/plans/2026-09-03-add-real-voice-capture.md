# Add Real Voice Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a worker deliberately record a short Hindi, Marathi, or code-mixed retelling, receive a validated native transcript, and recover through retry, typing, or reviewed presets when recording cannot be used.

**Architecture:** A client recorder owns browser permission and recording states but never provider credentials. A server speech gateway validates audio metadata and provider output, stores tenant/run/incident-scoped evidence, and delegates transcription to fixture or Sarvam adapters behind one interface. Raw audio has a separate 24-hour lifecycle; durable transcript and trace metadata remain after deletion.

**Tech Stack:** Next.js App Router, React, TypeScript strict mode, Zod, Convex, MediaRecorder, Sarvam Saaras v3 REST, Vitest, Playwright.

**Spec:** `HUNAR_OS_MASTER_BUILD_SPEC.md` Phase 5 and sections 7.6, 7.7, 8.4, 14.2, 20.3.

## Global Constraints

- Recording starts only after a deliberate worker action and never records the customer or home by default.
- Keep typed and reviewed-preset fallbacks fully usable without microphone access.
- Validate every browser upload and speech-provider response before persistence.
- Do not invent a transcript for silence, unusable audio, timeout, upload failure, or provider failure.
- Store tenant ID, run ID, incident ID, provider/model ID, original transcript, edited transcript, and concise quality signals.
- Raw worker audio expires after 24 hours by default; deleting it must not delete structured evidence.
- Live-provider tests are credential-gated; fixture tests remain deterministic and offline.
- Preserve 48px touch targets, keyboard support, visible focus, English/Hindi copy, and the established Warm Paper/Navy/Teal/Marigold design language.

---

### Task 1: Speech and audio domain contracts

**Files:**
- Create: `src/domain/incident-audio.ts`
- Create: `src/domain/incident-audio.test.ts`

**Interfaces:**
- Produces: `incidentAudioUploadSchema`, `speechTranscriptSchema`, `classifyIncidentAudioQuality`, and `rawAudioExpiresAt`.
- Consumes: no network or storage dependencies.

- [ ] **Step 1: Write failing tests** for allowed MIME types, 5–15 second guidance, hard duration/size bounds, silence/short/unusable outcomes, strict transcript validation, and 24-hour expiry.
- [ ] **Step 2: Run** `pnpm test -- src/domain/incident-audio.test.ts` and verify the missing exports fail.
- [ ] **Step 3: Implement pure Zod schemas and deterministic quality classification** returning `USABLE`, `RETRY_RECOMMENDED`, or `UNUSABLE` without transcript text.
- [ ] **Step 4: Run the focused test** and verify it passes.

### Task 2: Provider boundary and deterministic fixture

**Files:**
- Create: `src/services/providers/speech-provider.ts`
- Create: `src/services/providers/fixture-speech.ts`
- Create: `src/services/providers/sarvam-speech.ts`
- Create: `src/services/providers/speech-provider.test.ts`
- Modify: `src/config/env.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: validated audio bytes plus `{ tenantId, incidentKey, languageHint }`.
- Produces: `SpeechProvider.transcribe(input): Promise<SpeechTranscript>` and `getSpeechProvider()`.

- [ ] **Step 1: Write failing contract tests** proving fixture determinism, timeout/error mapping, and rejection of malformed provider JSON.
- [ ] **Step 2: Run** `pnpm test -- src/services/providers/speech-provider.test.ts` and verify failure.
- [ ] **Step 3: Implement the interface and fixture provider** with named Hindi, Marathi, code-mix, silence, unusable, timeout, and failure fixtures.
- [ ] **Step 4: Implement Sarvam REST** with server-only API key, `saaras:v3`, abort timeout, multipart upload, and strict response parsing; never fall back silently after a live failure.
- [ ] **Step 5: Run focused tests** without credentials and verify all deterministic cases pass.

### Task 3: Tenant-scoped persistence and retention

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/incidentAudio.ts`
- Create: `convex/incidentAudioSupport.ts`
- Create: `convex/incidentAudio.test.ts`
- Modify: `src/services/providers/incident-gateway.ts`

**Interfaces:**
- Consumes: active demo access, incident key, validated upload metadata, validated provider result.
- Produces: audio upload reservation/finalization, transcript evidence view, and `deleteExpiredIncidentAudio({ now })`.

- [ ] **Step 1: Write failing Convex tests** for tenant/run ownership, invalid states, schema rejection, original/edited transcript preservation, trace metadata, and deletion after expiry without evidence loss.
- [ ] **Step 2: Run** `pnpm test -- convex/incidentAudio.test.ts` and verify failure.
- [ ] **Step 3: Add scoped audio and transcript fields/tables** including storage ID, MIME type, duration, size, expiry, provider/model, language label, quality state, original transcript, edited transcript, and trace timestamps.
- [ ] **Step 4: Add upload/finalize/delete functions** that reject missing ownership and invalid state transitions.
- [ ] **Step 5: Extend fixture persistence** with the same validated external view and deterministic deletion behavior.
- [ ] **Step 6: Run focused Convex and gateway tests** and verify they pass.

### Task 4: Recording and recovery interface

**Files:**
- Create: `src/app/worker/incidents/[incidentId]/capture/voice-recorder.tsx`
- Create: `src/app/worker/incidents/[incidentId]/capture/voice-recorder.test.tsx`
- Modify: `src/app/worker/incidents/[incidentId]/capture/page.tsx`
- Modify: `src/app/worker/incidents/actions.ts`
- Modify: `src/app/worker/incidents/[incidentId]/transcript/page.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: browser `MediaRecorder`, server upload/transcription action, and speech evidence view.
- Produces: explicit permission, recording, elapsed, cancel, processing, ready, and recovery UI states.

- [ ] **Step 1: Write failing component tests** proving no page-load recording, deliberate permission request, cancel before upload, elapsed time, denied permission, unusable audio, upload failure, timeout/provider recovery, and working typed/preset alternatives.
- [ ] **Step 2: Run** `pnpm test -- src/app/worker/incidents/[incidentId]/capture/voice-recorder.test.tsx` and verify failure.
- [ ] **Step 3: Implement the recorder** with the required privacy notice, `Hold to record`, 15-second stop, preview/cancel, and accessible live status.
- [ ] **Step 4: Add the server action** that validates file type/size/duration, calls the configured provider, persists only validated output, and returns a safe typed result union.
- [ ] **Step 5: Update transcript confirmation** to show native transcript, detected language/code-mix, quality state, edit preservation, and `Record again` without fabricated confidence percentages.
- [ ] **Step 6: Run focused component tests, lint, and typecheck** and verify they pass.

### Task 5: Voice evals and end-to-end recovery

**Files:**
- Create: `evals/voice-suite.ts`
- Create: `evals/voice.eval.test.ts`
- Modify: `tests/e2e/public-routes.spec.ts`

**Interfaces:**
- Consumes: fixture speech cases and the real capture/transcript pages.
- Produces: at least 12 named offline voice fixtures and mobile browser coverage.

- [ ] **Step 1: Add 12 named voice fixtures** covering Hindi, Marathi, code-mix, task price as a human claim, silence, short input, noise/unusable, malformed result, timeout, provider failure, typed fallback, and reviewed preset fallback.
- [ ] **Step 2: Write Playwright tests** for deliberate recording controls at 360px, denied permission recovery, unusable fixture recovery, and successful native transcript confirmation.
- [ ] **Step 3: Run** `pnpm test:evals` and the focused Playwright voice tests.
- [ ] **Step 4: Run** `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- [ ] **Step 5: Mark Ticket 9 completed and create the Git checkpoint** only after all relevant commands pass; report that live Sarvam was not exercised when credentials are absent.

## Self-review

- Every Ticket 9 acceptance item maps to Tasks 1–5.
- The plan keeps media, speech provider, persistence, and browser UI behind separate interfaces.
- No failure path substitutes invented transcript text.
- Typed/preset fallbacks and the existing confirmation gate remain intact.
- Live calls are optional and credential-gated; offline tests are mandatory.

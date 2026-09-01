# 09: Add real voice capture

**What to build:** A worker can deliberately record a short Hindi, Marathi or code-mixed retelling, receive a native transcript from the configured speech provider and recover safely through retry, typing or a reviewed preset when audio or the provider is unusable.

**Blocked by:** 03: Capture and confirm a typed request.

**Status:** ready-for-agent

- [ ] Recording never starts automatically, names its privacy boundary and exposes cancel, elapsed-time and permission states.
- [ ] The speech provider is behind a validated interface and all responses are schema-checked before persistence.
- [ ] Silence, short/unusable input, upload failure, timeout and provider failure produce recovery rather than invented text.
- [ ] Original and edited transcripts, provider/model metadata and concise quality signals are persisted and traced.
- [ ] Raw worker audio expires after the configured short retention and deletion is tested without breaking structured evidence.
- [ ] Live-provider tests are optional and credential-gated; deterministic fixture tests always pass offline.

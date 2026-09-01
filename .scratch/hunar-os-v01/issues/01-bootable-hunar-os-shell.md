# 01: Bootable Hunar OS shell

**What to build:** A deployable mobile-first Hunar OS application shell that establishes the repository, quality harness and shared visual foundation. A visitor can open `/`, be redirected to the Hunar OS landing shell and navigate to the KaamSaathi landing shell while every required development command is available.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] The application uses Next.js App Router, strict TypeScript, Convex and pnpm, with provider boundaries ready to grow behind interfaces.
- [x] `/` redirects to `/hunar-os`; `/hunar-os` and `/kaam-saathi` render accessible responsive shells using `DESIGN.md` tokens and the correct lead brand.
- [x] English and Hindi copy infrastructure exists, with Devanagari-safe typography and visible keyboard focus.
- [x] `pnpm dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `test:evals` and `seed` exist and relevant foundation checks pass.
- [x] Environment inputs are validated and no secret is exposed to the browser.

## Answer

Implemented the Phase 0 application shell, quality harness, local design fonts, validated environment boundary, provider schemas, CI, and browser-backed route checks. The root redirect, 360px and desktop layouts, and keyboard focus are covered by Playwright.

## Comments

- 2026-09-01: Resolved as the initial Git checkpoint. Phase 1 domain fixtures remain deliberately unimplemented.

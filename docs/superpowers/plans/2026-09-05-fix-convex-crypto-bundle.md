# Convex Crypto Bundle Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Phase 9 Vercel build deploy Convex functions without changing the SHA-256 decision and idempotency contracts.

**Architecture:** Put synchronous SHA-256 encoding behind one framework-free domain helper backed by `@noble/hashes`. Domain modules imported by Convex use that helper, so they remain deterministic and bundle in Convex's default runtime without moving mutations into Node-only actions.

**Tech Stack:** TypeScript strict mode, Convex default runtime, Vitest, esbuild bundle smoke check, `@noble/hashes@1.8.0`.

**Spec:** `HUNAR_OS_MASTER_BUILD_SPEC.md` sections 12.7, 12.9, 23.5, 26 Phase 9, 27, and 28.

## Global Constraints

- Preserve SHA-256 decision hashes, request hashes, and idempotency keys as 64 lowercase hexadecimal characters.
- Keep deterministic domain logic in pure modules under `src/domain` with no framework imports or network access.
- Do not move Convex queries or mutations into the Node.js runtime.
- Keep the diff limited to the hashing boundary, its dependency, tests, and release checkpoint.
- Do not stage unrelated working-tree files.

---

### Task 1: Add a Convex-safe SHA-256 boundary

**Files:**
- Create: `src/domain/sha256.ts`
- Create: `src/domain/sha256.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: UTF-8 strings passed by deterministic domain modules.
- Produces: `sha256Hex(value: string): string`, returning a 64-character lowercase hexadecimal SHA-256 digest.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { sha256Hex } from "./sha256";

describe("sha256Hex", () => {
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  ])("hashes UTF-8 text with SHA-256", (value, expected) => {
    expect(sha256Hex(value)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx --yes pnpm@9.15.9 test -- src/domain/sha256.test.ts`

Expected: FAIL because `src/domain/sha256.ts` does not exist.

- [ ] **Step 3: Add the audited browser-safe dependency and implementation**

Add `@noble/hashes@1.8.0` to production dependencies, then create:

```ts
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export function sha256Hex(value: string): string {
  return bytesToHex(sha256(utf8ToBytes(value)));
}
```

- [ ] **Step 4: Run the focused test**

Run: `npx --yes pnpm@9.15.9 test -- src/domain/sha256.test.ts`

Expected: PASS for both NIST-known digest vectors.

### Task 2: Remove Node-only crypto from Convex-imported domain code

**Files:**
- Modify: `src/domain/action-execution.ts`
- Modify: `src/domain/policy-decision.ts`
- Modify: `src/domain/demo-session.ts`
- Test: `src/domain/action-execution.test.ts`
- Test: `src/domain/policy-decision.test.ts`
- Test: `src/domain/demo-session.test.ts`

**Interfaces:**
- Consumes: `sha256Hex(value: string): string` from Task 1.
- Produces: Existing public domain APIs with unchanged synchronous signatures and hash values.

- [ ] **Step 1: Replace each domain `node:crypto` SHA-256 call**

Import `sha256Hex` from `./sha256`; preserve canonical input construction and call the helper instead of `createHash`.

- [ ] **Step 2: Run focused domain tests**

Run: `npx --yes pnpm@9.15.9 test -- src/domain/sha256.test.ts src/domain/action-execution.test.ts src/domain/policy-decision.test.ts src/domain/demo-session.test.ts`

Expected: PASS with unchanged authority, policy, token, and idempotency behaviour.

- [ ] **Step 3: Run the original Convex bundle reproducer**

Run: `node node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/bin/esbuild convex/actionExecutions.ts convex/policyDecisionSupport.ts --bundle --platform=browser --outdir=.scratch/convex-bundle-check`

Expected: PASS; no `Could not resolve "node:crypto"` error.

### Task 3: Verify and trigger the corrected deployment

**Files:**
- Modify only if verification finds a scoped defect: files already listed above.

**Interfaces:**
- Consumes: the corrected browser-safe domain bundle.
- Produces: a Git checkpoint on `main` that triggers the linked Vercel project.

- [ ] **Step 1: Run repository gates**

Run: `npx --yes pnpm@9.15.9 lint`, `npx --yes pnpm@9.15.9 typecheck`, `npx --yes pnpm@9.15.9 test`, and `npx --yes pnpm@9.15.9 build`.

Expected: all commands pass. If a command cannot run, report its exact reason and do not claim completion.

- [ ] **Step 2: Confirm the diff contains no unrelated files**

Run: `git status --short` and `git diff -- package.json pnpm-lock.yaml src/domain/sha256.ts src/domain/sha256.test.ts src/domain/action-execution.ts src/domain/policy-decision.ts src/domain/demo-session.ts`.

Expected: only the planned hashing boundary and dependency changes appear in the fix diff.

- [ ] **Step 3: Create and push the checkpoint**

Stage only the planned files and this plan, commit with `fix: make domain hashes Convex-safe`, then push `main`.

- [ ] **Step 4: Verify Vercel**

Expected: the Vercel build advances past Convex bundling. Record the final status or the next exact redacted error; do not claim the site is ready until the deployment succeeds.

## Self-review

- Spec coverage: preserves deterministic policy hashing, action idempotency, pure domain modules, Phase 9 deployment, and required verification gates.
- Placeholder scan: no implementation placeholders remain.
- Type consistency: `sha256Hex(value: string): string` is identical across all tasks and keeps existing callers synchronous.

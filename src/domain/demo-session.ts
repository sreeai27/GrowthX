import { createHash } from "node:crypto";

export { canAccessDemoRun, demoResumeExpiresAt } from "./demo-session-policy";
export type { DemoRun, DemoRunStatus } from "./demo-session-policy";

export function hashDemoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashCompletionToken(token: string): string {
  return createHash("sha256")
    .update(`completion-customer:v1:${token}`)
    .digest("hex");
}

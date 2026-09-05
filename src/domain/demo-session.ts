import { sha256Hex } from "./sha256";

export { canAccessDemoRun, demoResumeExpiresAt } from "./demo-session-policy";
export type { DemoRun, DemoRunStatus } from "./demo-session-policy";

export function hashDemoToken(token: string): string {
  return sha256Hex(token);
}

export function hashCompletionToken(token: string): string {
  return sha256Hex(`completion-customer:v1:${token}`);
}

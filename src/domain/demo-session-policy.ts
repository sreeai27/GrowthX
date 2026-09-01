export const DEMO_RESUME_WINDOW_MS = 24 * 60 * 60 * 1_000;

export type DemoRunStatus = "ACTIVE" | "ABANDONED" | "COMPLETED";

export interface DemoRun {
  readonly tenantId: string;
  readonly publicRunId: string;
  readonly browserTokenHash: string;
  readonly status: DemoRunStatus;
  readonly startedAt: string;
  readonly lastActiveAt: string;
  readonly resumeExpiresAt: string;
  readonly abandonedAt?: string;
}

export function demoResumeExpiresAt(now: Date): string {
  return new Date(now.getTime() + DEMO_RESUME_WINDOW_MS).toISOString();
}

export function canAccessDemoRun<
  T extends Pick<DemoRun, "status" | "browserTokenHash" | "resumeExpiresAt">,
>(
  run: T | undefined,
  tokenHash: string,
  now: Date,
): run is T {
  return Boolean(
    run &&
    run.status === "ACTIVE" &&
    run.browserTokenHash === tokenHash &&
    Date.parse(run.resumeExpiresAt) > now.getTime(),
  );
}

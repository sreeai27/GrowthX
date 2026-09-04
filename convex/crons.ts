import { cronJobs, makeFunctionReference } from "convex/server";

const crons = cronJobs();
const cleanupExpiredAudio = makeFunctionReference<"mutation", Record<string, never>, { deleted: number }>(
  "incidentAudio:deleteExpiredRawAudioScheduled",
);
const expirePublicDemoRuns = makeFunctionReference<"mutation", Record<string, never>, { deletedRuns: number }>(
  "demoRetention:expirePublicDemoRuns",
);

crons.interval(
  "delete expired worker audio",
  { hours: 1 },
  cleanupExpiredAudio,
  {},
);

crons.interval("delete expired public demo runs", { hours: 1 }, expirePublicDemoRuns, {});

export default crons;

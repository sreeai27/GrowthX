import { cronJobs, makeFunctionReference } from "convex/server";

const crons = cronJobs();
const cleanupExpiredAudio = makeFunctionReference<"mutation", Record<string, never>, { deleted: number }>(
  "incidentAudio:deleteExpiredRawAudioScheduled",
);

crons.interval(
  "delete expired worker audio",
  { hours: 1 },
  cleanupExpiredAudio,
  {},
);

export default crons;

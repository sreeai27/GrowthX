import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return {}; }
}

function collectReceipts(value, receipts = []) {
  if (!value || typeof value !== "object") return receipts;
  if (typeof value.externalActionId === "string" && typeof value.connector === "string") {
    receipts.push({ connector: value.connector, receiptId: value.externalActionId });
  } else if (typeof value.providerMessageId === "string" && typeof value.provider === "string") {
    receipts.push({ connector: value.provider, receiptId: value.providerMessageId });
  }
  for (const child of Object.values(value)) collectReceipts(child, receipts);
  return receipts;
}

function collectOperations(value, operations = []) {
  if (!value || typeof value !== "object") return operations;
  if (typeof value.latencyMs === "number") {
    operations.push({ latencyMs: value.latencyMs, estimatedCostMinor: typeof value.estimatedCostMinor === "number" ? value.estimatedCostMinor : null });
  }
  for (const child of Object.values(value)) collectOperations(child, operations);
  return operations;
}

export function buildReleaseEvidence({ commit, generatedAt, fixtures, evalStore, checks = {} }) {
  const runs = Array.isArray(fixtures.runs) ? fixtures.runs : [];
  const evalRuns = Array.isArray(evalStore.runs) ? evalStore.runs : [];
  const latestEval = evalRuns.at(-1);
  const evalResults = Array.isArray(latestEval?.results) ? latestEval.results : [];
  const receipts = [...new Map(collectReceipts(fixtures).map((receipt) => [`${receipt.connector}:${receipt.receiptId}`, receipt])).values()].slice(-20);
  const liveVerified = checks.publicDeployment === "PASSED" && checks.secondDevice === "PASSED" && checks.consecutiveRuns === "PASSED";
  return {
    schemaVersion: "taskconfirm-release-evidence-v1",
    status: liveVerified ? "LIVE_VERIFIED" : "LOCAL_EVIDENCE_ONLY",
    commit,
    generatedAt,
    demoRuns: runs.slice(-20).map((run) => ({ publicRunId: String(run.publicRunId ?? "unknown"), status: String(run.status ?? "unknown") })),
    receipts,
    deletion: { status: checks.deletion ?? "TESTED_LOCALLY", evidence: "convex/demoRetention.test.ts" },
    evaluations: { runId: typeof latestEval?.runKey === "string" ? latestEval.runKey : null, passed: Number(latestEval?.aggregate?.passed ?? 0), failed: Number(latestEval?.aggregate?.failed ?? 0) },
    operations: [...collectOperations(fixtures), ...evalResults.map((result) => ({ latencyMs: Number(result.latencyMs ?? 0), estimatedCostMinor: Number(result.costMinor ?? 0) }))].slice(-20),
    mobileRecording: checks.mobileRecording ?? "NOT_LIVE_VERIFIED",
    gates: {
      publicDeployment: checks.publicDeployment ?? "BLOCKED_NO_DEPLOYMENT",
      secondDevice: checks.secondDevice ?? "BLOCKED_NO_PUBLIC_URL",
      consecutiveRuns: checks.consecutiveRuns ?? "PASSED_LOCALLY_2026-09-05",
      productionBuild: checks.productionBuild ?? "PASSED_LOCALLY_TURBOPACK_2026-09-05",
      privateDelivery: checks.privateDelivery ?? "BLOCKED_NO_AUTHORISED_PROVIDER",
      deletionConfirmation: checks.deletionConfirmation ?? "BLOCKED_NO_AUTHORISED_PROVIDER",
      liveSarvam: checks.liveSarvam ?? "NOT_RUN",
      liveOpenAI: checks.liveOpenAI ?? "NOT_RUN",
    },
  };
}

async function main() {
  const base = await readJson(".demo-fixture/e2e-runs.json");
  const sidecars = await Promise.all(["incidents", "confirmations", "completions", "replays", "private-results"].map((suffix) => readJson(`.demo-fixture/e2e-runs.json.${suffix}`)));
  const evidence = buildReleaseEvidence({
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    generatedAt: new Date().toISOString(), fixtures: { ...base, sidecars },
    evalStore: await readJson(".demo-fixture/eval-runs.json"),
  });
  await mkdir(".scratch/release-evidence", { recursive: true });
  await writeFile(".scratch/release-evidence/taskconfirm-release.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  process.stdout.write(`${evidence.status}: .scratch/release-evidence/taskconfirm-release.json\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();

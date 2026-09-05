import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

const ownedFixtureFiles = [
  ".demo-fixture/e2e-runs.json",
  ".demo-fixture/e2e-runs.json.incidents",
  ".demo-fixture/e2e-runs.json.confirmations",
  ".demo-fixture/e2e-runs.json.completions",
  ".demo-fixture/e2e-runs.json.replays",
  ".demo-fixture/e2e-runs.json.private-results",
  ".demo-fixture/eval-runs.json",
  ".demo-fixture/studio-sessions.json",
];
await Promise.all(ownedFixtureFiles.map((path) => rm(path, { force: true })));

const isWindows = process.platform === "win32";
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1"],
  {
    detached: !isWindows,
    stdio: "inherit",
    env: {
      ...process.env,
      FEATURE_FIXTURE_MODE: "true",
      FEATURE_VOICE_CAPTURE: "true",
      DEMO_FIXTURE_STORE_PATH: ".demo-fixture/e2e-runs.json",
      DEMO_SESSION_COOKIE_SECRET:
        "fixture-only-cookie-secret-at-least-32-bytes",
      STUDIO_REVIEWER_TOKEN: "fixture-reviewer-token",
      STUDIO_OPERATOR_TOKEN: "fixture-operator-once",
      STUDIO_ADMIN_MEERA_TOKEN: "fixture-admin-meera-once",
      STUDIO_ADMIN_KABIR_TOKEN: "fixture-admin-kabir-once",
      STUDIO_SESSION_SECRET: "fixture-studio-session-secret-at-least-32-bytes",
    },
  },
);

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:3000/hunar-os");
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Next.js did not start within 60 seconds.");
}

function runPlaywright() {
  return new Promise((resolve, reject) => {
    const cli = spawn(
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        ...process.argv.slice(2),
      ],
      {
        stdio: "inherit",
      },
    );
    cli.once("error", reject);
    cli.once("exit", (code) => resolve(code ?? 1));
  });
}

function stopServer() {
  if (!server.pid) return Promise.resolve();
  if (!isWindows) {
    process.kill(-server.pid, "SIGTERM");
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const stop = spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    stop.once("exit", resolve);
  });
}

let exitCode = 1;
try {
  await waitForServer();
  exitCode = await runPlaywright();
} finally {
  await stopServer();
}
process.exit(exitCode);

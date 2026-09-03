import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  expect: { timeout: 45_000 },
  use: { baseURL: "http://127.0.0.1:3000" },
});

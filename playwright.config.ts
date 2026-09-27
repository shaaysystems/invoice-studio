import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  use: { baseURL: "http://localhost:3000", viewport: { width: 1600, height: 1000 } },
  webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true },
});

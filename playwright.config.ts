import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:1420",
    headless: true,
  },
  webServer: {
    command: "pnpm exec vite preview --port 1420 --strictPort",
    port: 1420,
    reuseExistingServer: true,
    timeout: 15000,
  },
});

import { defineConfig, devices } from "@playwright/test";

// The previous config delegated to `lovable-agent-playwright-config`, a
// package that isn't declared in package.json/bun.lock and doesn't resolve
// outside Lovable's own environment — with zero *.spec.ts files ever added,
// nothing here actually ran. This uses the real, already-installed
// `@playwright/test` directly so `bunx playwright test` works in CI and locally.
//
// Tests run against a local `vite preview` server serving the real
// production build, talking to the same remote Supabase backend the app
// always uses (via the committed .env) — this exercises actual build output,
// which is what caught both outages earlier (wrong env var, bad query param
// baked into the bundle), not just source-level behaviour.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "bun run preview -- --port 4173 --strictPort",
        url: "http://localhost:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});

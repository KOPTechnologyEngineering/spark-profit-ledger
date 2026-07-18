import { test, expect } from "../playwright-fixture";

// Smoke test for the exact failure class behind this project's two production
// outages: a broken build (wrong env var, then a bad query param) left
// ProtectedRoute's approval-status check permanently stuck, so every
// logged-in user saw an infinite spinner instead of the dashboard. Neither
// bug was runtime-detectable by tsc/vitest/build, since both were only
// visible once the real bundle made a real network call — this test logs in
// against the actual production build and confirms the dashboard renders.
//
// Requires a dedicated, already-approved test account's credentials via
// E2E_TEST_EMAIL / E2E_TEST_PASSWORD (repo/CI secrets, never hardcoded here).
// Skips gracefully — not a failure — when they aren't configured.
test("login lands on the dashboard, not a stuck spinner or error screen", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  test.skip(!email || !password, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run this test");

  await page.goto("/auth");
  await page.locator("#email").fill(email!);
  await page.locator("#password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();

  // ProtectedRoute renders either one of its own gate screens (loading
  // spinner, error, pending, rejected) OR `children` -- never both. So the
  // Dashboard heading becoming visible is already sufficient proof the
  // approval check resolved to "approved" rather than getting stuck; no
  // separate check for the spinner/error text is needed (and asserting on
  // CSS classes like the spinner's would be fragile against unrelated
  // widgets that might reuse it). Give it a full poll cycle (ProtectedRoute
  // retries every 15s) before failing, so a merely slow first response isn't
  // mistaken for the bug.
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 20_000 });
});

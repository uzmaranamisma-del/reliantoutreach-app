import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure", channel:process.env.PLAYWRIGHT_CHANNEL },
  webServer: {
    command: "npm start",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 60000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});

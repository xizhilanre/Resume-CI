// tests/e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: 'pnpm dev:web',
      port: 3000,
      timeout: 30000,
      reuseExistingServer: true,
    },
    {
      command: 'cd services/fastapi && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000',
      port: 8000,
      timeout: 15000,
      reuseExistingServer: true,
    },
  ],
});

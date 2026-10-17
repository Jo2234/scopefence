import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5179', browserName: 'chromium', viewport: { width: 1280, height: 800 }, trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'pnpm build && SCOPEFENCE_MODE=fixture SCOPEFENCE_PORT=5179 pnpm start',
      url: 'http://127.0.0.1:5179/api/health', reuseExistingServer: false, timeout: 120000,
    },
    {
      command: 'SCOPEFENCE_MODE=live SCOPEFENCE_PORT=5180 SCOPEFENCE_LLM_URL=http://127.0.0.1:9 pnpm start',
      url: 'http://127.0.0.1:5180/api/health', reuseExistingServer: false, timeout: 30000,
    },
  ],
});

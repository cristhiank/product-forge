# CI Integration with Playwright

## GitHub Actions E2E Setup

For CI, use the **Playwright test runner** (not MCP). MCP is for interactive agent sessions; the test runner is for automated CI pipelines.

### Basic Workflow

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      # Install frontend dependencies + Playwright browsers
      - run: npm ci
        working-directory: ./frontend
      - run: npx playwright install chromium --with-deps
        working-directory: ./frontend

      # Start backend (adjust for your stack)
      - run: |
          # .NET example:
          dotnet run --project ./backend &
          # Node example:
          # npm start --prefix ./backend &
        env:
          ASPNETCORE_URLS: http://localhost:5000

      # Wait for backend to be ready
      - run: npx wait-on http://localhost:5000/health --timeout 60000

      # Run E2E tests
      - run: npm run test:e2e
        working-directory: ./frontend
        env:
          CI: true
          API_BASE_URL: http://localhost:5000

      # Upload test artifacts on failure
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

### Auth in CI

**Option A: Mock all APIs** (fastest, no backend dependency for auth tests)
Use `page.route()` in your test fixtures to mock auth endpoints.

**Option B: Real auth with storageState** (most realistic)
1. Create a setup project that logs in and saves storage state
2. Other test projects load the saved state

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
});

// auth.setup.ts
import { test as setup } from '@playwright/test';
setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', process.env.E2E_USER!);
  await page.fill('[name=password]', process.env.E2E_PASS!);
  await page.click('button[type=submit]');
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: '.auth/user.json' });
});
```

### Playwright Config for CI

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

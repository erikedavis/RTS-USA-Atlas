import { defineConfig } from '@playwright/test';

// In GitHub Actions, the workflow starts and stops the HTTP server itself.
// This avoids Playwright waiting for a server process (or one of its children)
// to exit after the browser tests have already completed.
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  globalTimeout: ci ? 300_000 : undefined,
  expect: { timeout: 35_000 },
  workers: 1,
  retries: ci ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8001',
    browserName: 'chromium',
    headless: !ci,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      // Isolated trusted test browser. Explicit software-WebGL opt-in.
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--enable-unsafe-swiftshader'
      ]
    }
  },
  webServer: ci ? undefined : {
    command: 'python tools/serve.py --port 8001 --no-browser',
    url: 'http://127.0.0.1:8001',
    timeout: 40_000,
    reuseExistingServer: true,
    env: { ATLAS_NO_BROWSER: '1' }
  }
});

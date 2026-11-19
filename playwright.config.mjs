import { defineConfig } from '@playwright/test';

// GitHub Actions runs headed Chromium inside Xvfb, allowing software WebGL.
// Local runs default to headless. Neither mode guarantees WebGL: the smoke
// test MUST verify the actual context before visual QA can be called passed.
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 35_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8001',
    browserName: 'chromium',
    headless: !process.env.CI,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      // Run only against trusted local app, inside the isolated test runner.
      // --enable-unsafe-swiftshader permits software GL fallback when needed.
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--enable-unsafe-swiftshader'
      ]
    }
  },
  webServer: {
    command: 'python3 tools/serve.py',
    url: 'http://127.0.0.1:8001',
    timeout: 40_000,
    reuseExistingServer: !process.env.CI
  }
});

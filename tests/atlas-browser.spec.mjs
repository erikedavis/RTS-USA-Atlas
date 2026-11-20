import { test, expect } from '@playwright/test';

/** A passing HTTP fetch or JS syntax test is not proof that the map rendered. */
async function assertRendered(page, testInfo) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'The atlas must respond over HTTP').toBe(true);
  await expect(page.locator('#map-loading'), 'Atlas loading overlay must disappear').toBeHidden({ timeout: 50_000 });
  await expect(page.locator('#source-tag')).toContainText('CENSUS 2025');
  await expect(page.locator('canvas.maplibregl-canvas')).toHaveCount(1);
  const renderer = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.maplibregl-canvas');
    if (!canvas) return { available: false, reason: 'Missing MapLibre canvas' };
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { available: false, reason: 'No WebGL context' };
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      available: true,
      width: canvas.width,
      height: canvas.height,
      renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION)
    };
  });
  await testInfo.attach('webgl-environment.json', {
    body: JSON.stringify({ renderer, pageErrors: errors }, null, 2),
    contentType: 'application/json'
  });
  expect(renderer.available, 'No working WebGL: visual map QA is BLOCKED, not passed').toBe(true);
  expect(renderer.width).toBeGreaterThan(0);
  expect(renderer.height).toBeGreaterThan(0);
  expect(errors, 'Uncaught JS errors during startup').toEqual([]);
}

async function screenshot(page, testInfo, label) {
  await page.screenshot({ path: testInfo.outputPath(`${label}.png`), fullPage: true, animations: 'disabled' });
}

test('desktop national map loads, has working WebGL, and renders', async ({ page }, testInfo) => {
  await assertRendered(page, testInfo);
  await page.waitForTimeout(1000);
  await screenshot(page, testInfo, 'national-desktop');
});

test('Idaho selection and county toggle render without losing state selection', async ({ page }, testInfo) => {
  await assertRendered(page, testInfo);
  const state = page.getByRole('button', { name: 'Select Idaho' });
  await expect(state).toBeVisible();
  await state.click();
  await expect(page.locator('#panel-content h1')).toContainText('Idaho');
  await screenshot(page, testInfo, 'idaho-selected-outline');
  await page.locator('#toggle-counties').click();
  await expect(page.locator('#toggle-counties')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#reset-view').click();
  await expect(page.locator('#selection-status')).toContainText('AWAITING');
});

test('major city searches work and produce checkable screenshots', async ({ page }, testInfo) => {
  await assertRendered(page, testInfo);
  for (const name of ['Chicago', 'Denver', 'Phoenix', 'Houston']) {
    await page.locator('#search').fill(name);
    const first = page.locator('#search-results button').first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page.locator('#panel-content h1')).toContainText(name);
    await page.waitForTimeout(1100);
    await screenshot(page, testInfo, `${name.toLowerCase()}-selected`);
  }
});

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });

  test('wide state labels and swipe-dock controls are available', async ({ page }, testInfo) => {
    await assertRendered(page, testInfo);
    await expect(page.locator('.topbar #search')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Minnesota', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select California', exact: true })).toBeVisible();
    await screenshot(page, testInfo, 'national-mobile-390x844');

    await page.getByRole('button', { name: 'Show map tools' }).tap();
    await expect(page.locator('#toggle-counties')).toBeVisible();
    await page.locator('#search').fill('IN');
    await page.locator('#search').press('Enter');
    await expect(page.locator('#panel-content h1')).toHaveText('Indiana');
    await expect(page.getByRole('button', { name: /Indianapolis/ })).toBeVisible();
  });
});

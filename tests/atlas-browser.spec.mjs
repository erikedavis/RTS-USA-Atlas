import { test, expect } from '@playwright/test';

const activeGold = 'rgb(243, 217, 158)';

/** A passing HTTP fetch or JS syntax test is not proof that the map rendered. */
async function assertRendered(page, testInfo) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), 'The atlas must respond over HTTP').toBe(true);
  await expect(page.locator('#map-loading'), 'Atlas loading overlay must disappear').toBeHidden({ timeout: 50_000 });
  await expect(page.locator('meta[name="atlas-version"]')).toHaveAttribute('content', 'ALPHA 0.8L');
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

async function exposeMap(page) {
  await page.route('**/js/atlas.mjs?*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()) + '\nexport { map, cityLayers };' });
  });
}

async function readMap(page) {
  await page.evaluate(async () => {
    const atlas = await import(document.querySelector('script[type=module]').src);
    window.testMap = atlas.map;
    window.testCityLayers = atlas.cityLayers;
  });
}

async function searchFor(page, name) {
  const search = page.locator('#search');
  await search.fill(name);
  await expect(page.locator('#search-results button').first()).toBeVisible();
  await search.press('Enter');
}

async function waitForCamera(page) {
  await page.waitForFunction(() => !testMap.isMoving());
}

async function camera(page) {
  return page.evaluate(() => [...testMap.getCenter().toArray(), testMap.getZoom(), testMap.getBearing()]
    .map(value => Number(value.toFixed(5))));
}

async function expectBearing(page, expected) {
  await expect.poll(() => page.evaluate(() => {
    if (testMap.isMoving()) return null;
    return Math.round((testMap.getBearing() + 360) % 360) % 360;
  })).toBe(expected);
}

async function tapRoseSpoke(page, isPhone = false) {
  const { x, y, width, height } = await page.locator('#compass-home').boundingBox();
  const point = [x + width / 2 + 31, y + height / 2];
  if (isPhone) await page.touchscreen.tap(...point);
  else await page.mouse.click(...point);
}

async function bottomHudGeometry(page, isPhone = false) {
  return page.evaluate(isPhone => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect();
    const glyph = selector => {
      const svg = document.querySelector(`${selector} svg`);
      const box = svg.getBBox(), matrix = svg.getScreenCTM();
      return { top: new DOMPoint(0, box.y).matrixTransform(matrix).y,
        bottom: new DOMPoint(0, box.y + box.height).matrixTransform(matrix).y };
    };
    const home = isPhone ? '#phone-home' : '#reset-view';
    const tray = rect('#phone-tray');
    const edge = isPhone && tray.height > 0 ? tray.top : rect('#map').bottom;
    const key = glyph('#map-key-toggle'), zoom = rect('#zoom-text');
    return { homeGap: edge - glyph(home).bottom, keyGap: edge - key.bottom,
      hitOffset: Math.max(Math.abs(rect(home).bottom - edge), Math.abs(rect('#map-key-toggle').bottom - edge)),
      zoomOffset: Math.abs((zoom.top + zoom.bottom - key.top - key.bottom) / 2) };
  }, isPhone);
}

async function countyStates(page) {
  return page.evaluate(() => [...new Set(testMap.queryRenderedFeatures({ layers: ['county-lines'] })
    .map(feature => feature.properties.state_fips))].sort());
}

test('desktop national map loads, has working WebGL, and renders', async ({ page }, testInfo) => {
  await assertRendered(page, testInfo);
  const hud = await bottomHudGeometry(page);
  expect(hud.hitOffset).toBeLessThan(1);
  for (const gap of [hud.homeGap, hud.keyGap]) {
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(6);
  }
  await expect(page.locator('.topbar #search')).toBeVisible();
  await expect(page.locator('#go-ak, #go-hi, #go-pr, .toolbar, #source-tag, .city-legend')).toHaveCount(0);
  const summary = page.locator('#view-menu summary');
  await summary.click();
  await expect(page.getByRole('button', { name: 'GEOGRAPHIC', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'STRATEGIC', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#view-menu')).not.toHaveAttribute('open', '');
  await expect(summary).toHaveText('VIEW: STATISTICAL');
  const zoomIn = page.getByRole('button', { name: 'Zoom in' });
  await expect(zoomIn).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(zoomIn).toHaveCSS('opacity', '0.65');
  await zoomIn.hover();
  await expect(zoomIn).toHaveCSS('opacity', '1');
  await page.mouse.move(550, 105);
  await page.waitForTimeout(1000);
  await screenshot(page, testInfo, 'national-desktop');
});

test('desktop compass turns with the map and highlights one direction on hover', async ({ page }, testInfo) => {
  await exposeMap(page);
  await assertRendered(page, testInfo);
  await readMap(page);
  const controls = page.getByRole('group', { name: 'Map rotation' });
  const rose = page.locator('#compass-home');
  const lock = page.locator('#rotation-lock');
  const north = controls.getByRole('button', { name: 'North up', exact: true });
  const east = controls.getByRole('button', { name: 'East up', exact: true });

  await expect(controls.locator('[data-bearing]')).toHaveCount(8);
  await expect(controls).toHaveClass(/rotation-north-locked/);
  await expect(rose.locator('.compass-light')).toHaveCSS('fill', 'rgb(167, 196, 216)');
  await expect(lock).toHaveCSS('color', activeGold);
  await north.hover();
  await expect(north.locator('span')).toHaveCSS('transform', 'matrix(1.22, 0, 0, 1.22, 0, 0)');
  await expect(east.locator('span')).toHaveCSS('opacity', '0.66');
  await expectBearing(page, 0);
  await screenshot(page, testInfo, 'compass-hover-desktop');

  const initial = await camera(page);
  await east.click();
  await expectBearing(page, 90);
  await expect(lock).toHaveAttribute('aria-pressed', 'true');
  expect((await camera(page)).slice(0, 3)).toEqual(initial.slice(0, 3));
  const northGeometry = await north.evaluate(button => {
    const dial = button.parentElement;
    const rect = dial.getBoundingClientRect(), label = button.getBoundingClientRect();
    const rotation = new DOMMatrixReadOnly(getComputedStyle(dial).transform)
      .multiply(new DOMMatrixReadOnly(getComputedStyle(button).transform));
    return { x: label.left + label.width / 2 - rect.left - rect.width / 2,
      y: label.top + label.height / 2 - rect.top - rect.height / 2, upright: Math.abs(rotation.b) < .001 };
  });
  expect(northGeometry.x).toBeLessThan(-40);
  expect(Math.abs(northGeometry.y)).toBeLessThan(1);
  expect(northGeometry.upright).toBe(true);

  await lock.click();
  await expect(lock).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('r');
  await expectBearing(page, 0);
  await expect(lock).toHaveAttribute('aria-pressed', 'false');
  await tapRoseSpoke(page);
  await expect(lock).toHaveAttribute('aria-pressed', 'true');
  await expect(controls).toHaveClass(/rotation-north-locked/);
});

test('desktop Atlas expands, restores a rotated camera, and reopens the hidden sidebar on selection', async ({ page }, testInfo) => {
  await exposeMap(page);
  await assertRendered(page, testInfo);
  await readMap(page);
  const sidebar = page.locator('#info-panel');
  const heading = page.locator('#panel-content h1');
  const atlas = page.locator('#desktop-atlas-toggle');

  await page.getByRole('button', { name: 'Hide stats' }).click();
  await expect(page.getByRole('button', { name: 'Show stats' })).toBeVisible();
  expect((await sidebar.boundingBox()).width).toBe(0);
  await searchFor(page, 'Kansas');
  await expect(heading).toHaveText('Kansas');
  await waitForCamera(page);
  await page.evaluate(() => testMap.jumpTo({ center: [-96, 37.6], zoom: 4.3, bearing: 45 }));
  const stateCamera = await camera(page);
  await page.getByRole('button', { name: 'Show counties', exact: true }).click();
  await expect.poll(() => countyStates(page)).toEqual(['20']);
  expect(await camera(page)).toEqual(stateCamera);
  await page.locator('#toggle-counties').click();
  const compactWidth = (await sidebar.boundingBox()).width;
  await atlas.click();
  await expect(page.locator('.app')).toHaveAttribute('data-desktop-atlas', 'state');
  expect((await sidebar.boundingBox()).width).toBeGreaterThan(compactWidth);
  await waitForCamera(page);
  expect((await camera(page))[2]).toBeGreaterThan(stateCamera[2]);
  expect(await page.evaluate(() => testMap.getPaintProperty('state-surface', 'fill-opacity'))).toBe(0);
  await screenshot(page, testInfo, 'desktop-state-atlas');
  const stateAtlasCamera = await camera(page);
  await page.getByRole('button', { name: /STATE CAPITAL.*Topeka/ }).click();
  await expect(page.locator('.app')).toHaveAttribute('data-desktop-atlas', 'place');
  await expect(heading).toHaveText('Topeka');
  await atlas.click();
  await expect(page.locator('.app')).toHaveAttribute('data-desktop-atlas', 'state');
  expect(await camera(page)).toEqual(stateAtlasCamera);
  await atlas.click();
  await waitForCamera(page);
  expect(await camera(page)).toEqual(stateCamera);

  await page.locator('#search').fill('Rochester, MN');
  const metro = page.getByRole('button', { name: /Rochester, MN.*METRO/ }).first();
  await metro.click();
  await expect(heading).toHaveText('Rochester, MN');
  await waitForCamera(page);
  const metroCamera = await camera(page);
  await atlas.click();
  await expect(page.locator('.app')).toHaveAttribute('data-desktop-atlas', 'metro');
  await page.getByText('Cities and places', { exact: true }).click();
  await expect(page.locator('.metro-place-list')).toContainText('Rochester, MN');
  await atlas.click();
  await waitForCamera(page);
  expect(await camera(page)).toEqual(metroCamera);

  await page.evaluate(() => testMap.jumpTo({ center: [-88.5, 25.5], zoom: 5.45, bearing: 45 }));
  const puertoRico = page.getByRole('button', { name: 'Select Puerto Rico' });
  await expect(puertoRico).toHaveText('PR');
  await expect(page.getByText('PUERTO RICO', { exact: true })).toBeVisible();
  await expect.poll(() => puertoRico.evaluate(label => {
    const bounds = label.getBoundingClientRect();
    const map = testMap.getContainer().getBoundingClientRect();
    return testMap.queryRenderedFeatures(
      [bounds.x + bounds.width / 2 - map.left, bounds.y + bounds.height / 2 - map.top],
      { layers: ['state-hit'] }
    ).some(feature => feature.properties.geoid === '72');
  })).toBe(true);
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

test('all five Great Lake shorelines render on the regional map and rotate with it', async ({ page }, testInfo) => {
  await exposeMap(page);
  await assertRendered(page, testInfo);
  await readMap(page);
  const lakeNames = () => page.evaluate(() => [...new Set(testMap
    .queryRenderedFeatures({layers:['great-lakes-shoreline']}).map(lake => lake.properties.name))].sort());
  const expected = ['Lake Erie','Lake Huron','Lake Michigan','Lake Ontario','Lake Superior'];
  for (const bearing of [0, 34]) {
    await page.evaluate(bearing => testMap.jumpTo({center:[-84.5,44.9],zoom:5,bearing}), bearing);
    await expect.poll(lakeNames).toEqual(expected);
  }
  await screenshot(page, testInfo, 'great-lakes');
});

for (const isPhone of [false, true]) {
  test.describe(isPhone ? 'phone Atlas' : 'desktop Atlas', () => {
    if (isPhone) test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('metro outlines follow the state selection at a rotated overview zoom', async ({ page }, testInfo) => {
      await exposeMap(page);
      await assertRendered(page, testInfo);
      await readMap(page);
      await searchFor(page, 'Tennessee');
      await expect(page.locator('#panel-content h1')).toHaveText('Tennessee');
      await waitForCamera(page);
      await page.evaluate(() => testMap.jumpTo({ center: [-88, 36.4], zoom: 4.05, bearing: 38 }));

      const beforeToggle = await camera(page);
      const msa = page.locator('#toggle-metros');
      if (isPhone) await msa.tap();
      else await page.getByRole('button', { name: 'Show metros', exact: true }).click();
      await expect(msa).toHaveAttribute('aria-pressed', 'true');
      await expect(msa).toHaveCSS('color', activeGold);
      expect(await camera(page)).toEqual(beforeToggle);

      const metros = () => page.evaluate(() => [...new Set(testMap.queryRenderedFeatures({ layers: ['metro-lines'] })
        .map(feature => feature.properties.name))]);
      await expect.poll(metros).toContain('Memphis, TN-MS-AR');
      expect((await metros()).every(name => name.split(', ').at(-1).split('-').includes('TN'))).toBe(true);

      const activate = button => isPhone ? button.tap() : button.click();
      await activate(isPhone ? page.getByRole('button', { name: 'Open state atlas' }) : page.locator('#desktop-atlas-toggle'));
      await waitForCamera(page);
      const atlasCamera = await camera(page);
      const atlasCounties = page.getByRole('button', { name: 'Show counties', exact: true });
      const atlasMetros = page.getByRole('button', { name: 'Show metros', exact: true });
      const cty = page.locator('#toggle-counties');
      await expect(atlasMetros).toHaveAttribute('aria-pressed', 'true');
      await expect(atlasMetros).toHaveCSS('color', activeGold);
      await expect(page.locator('#panel-content .fact-sources')).toBeHidden();
      await expect(page.locator('#panel-content .facts-date')).toBeHidden();
      await expect(page.locator('#panel-content .census-record')).toBeHidden();

      await activate(atlasMetros);
      await expect(msa).toHaveAttribute('aria-pressed', 'false');
      await expect(atlasMetros).toHaveAttribute('aria-pressed', 'false');
      await expect(atlasMetros).not.toHaveCSS('color', activeGold);
      await expect.poll(metros).toEqual([]);
      await activate(atlasCounties);
      await expect(cty).toHaveAttribute('aria-pressed', 'true');
      await expect(atlasCounties).toHaveAttribute('aria-pressed', 'true');
      await expect(atlasCounties).toHaveCSS('color', activeGold);
      await expect(cty).toHaveCSS('color', activeGold);
      await expect.poll(() => countyStates(page)).toEqual(['47']);
      await activate(atlasCounties);
      await expect(cty).toHaveAttribute('aria-pressed', 'false');
      await expect(atlasCounties).toHaveAttribute('aria-pressed', 'false');
      await expect(atlasCounties).not.toHaveCSS('color', activeGold);
      await expect.poll(() => countyStates(page)).toEqual([]);
      await activate(atlasMetros);
      await expect(msa).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(metros).toContain('Memphis, TN-MS-AR');
      expect(await camera(page)).toEqual(atlasCamera);
      await activate(isPhone ? page.locator('#phone-atlas-back') : page.locator('#desktop-atlas-toggle'));
      await waitForCamera(page);

      if (isPhone) await page.getByRole('button', { name: 'Clear state selection' }).tap();
      else await page.keyboard.press('Escape');
      await expect.poll(async () => (await metros()).some(name => !name.split(', ').at(-1).split('-').includes('TN'))).toBe(true);
      if (isPhone) await msa.tap();
      else await msa.click();
      await expect.poll(metros).toEqual([]);
    });

    test('the city state link selects and fits California from San Diego Atlas', async ({ page }, testInfo) => {
      await exposeMap(page);
      await assertRendered(page, testInfo);
      await readMap(page);
      await page.locator('#search').fill('San Diego');
      const city = page.getByRole('button', {name:/^San Diego, CA\s*PLACE$/});
      if (isPhone) await city.tap();
      else await city.click();
      const heading = page.locator('#panel-content h1');
      await expect(heading).toHaveText('San Diego');
      await waitForCamera(page);
      const stateLink = page.getByRole('button', {name:'California',exact:true});
      await expect(stateLink).toBeVisible();
      const linkOnRight = await stateLink.evaluate(button => {
        const title = button.closest('.place-heading').querySelector('h1');
        return button.getBoundingClientRect().left > title.getBoundingClientRect().right;
      });
      expect(linkOnRight).toBe(true);

      const atlas = isPhone ? page.getByRole('button', {name:'Open city atlas'}) : page.locator('#desktop-atlas-toggle');
      if (isPhone) await atlas.tap();
      else await atlas.click();
      const app = page.locator('.app');
      const atlasKind = isPhone ? 'data-phone-atlas-kind' : 'data-desktop-atlas';
      await expect(app).toHaveAttribute(atlasKind, 'place');
      await waitForCamera(page);
      await screenshot(page, testInfo, 'san-diego-state-link');
      const initial = await camera(page);
      if (isPhone) await stateLink.tap();
      else await stateLink.click();
      await expect(heading).toHaveText('California');
      await expect(app).not.toHaveAttribute(atlasKind);
      await waitForCamera(page);
      const fitted = await camera(page);
      expect(fitted[2]).toBeLessThan(initial[2] - 1);
      expect(fitted[3]).toBe(initial[3]);
      await expect.poll(() => page.evaluate(() => testMap.getFilter('state-selected')?.at(-1))).toBe('06');
    });
  });
}

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });

  test('phone compass keeps all eight directions and the lock tappable', async ({ page }, testInfo) => {
    await exposeMap(page);
    await assertRendered(page, testInfo);
    await readMap(page);
    const controls = page.getByRole('group', { name: 'Map rotation' });
    const lock = page.locator('#rotation-lock');
    const lockGlyph = lock.locator('svg');
    await expect(controls.locator('[data-bearing]')).toHaveCount(8);
    await expect(lock).toHaveCSS('color', activeGold);
    const aligned = await lock.evaluate(el => {
      const lock = el.getBoundingClientRect(), rose = document.querySelector('.compass-rose').getBoundingClientRect();
      return Math.max(Math.abs((lock.left + lock.right - rose.left - rose.right) / 2),
        Math.abs((lock.top + lock.bottom - rose.top - rose.bottom) / 2));
    });
    expect(aligned).toBeLessThan(1);
    await screenshot(page, testInfo, 'compass-locked-phone');

    await lock.tap();
    await expect(lock).toHaveAttribute('aria-pressed', 'false');
    await expect(lockGlyph).toHaveCSS('animation-name', 'compass-lock-release');
    await expect(lockGlyph).toHaveCSS('opacity', '0');
    await controls.getByRole('button', { name: 'Southeast up', exact: true }).tap();
    await expectBearing(page, 135);
    await lock.tap();
    await expect(lock).toHaveAttribute('aria-pressed', 'true');
    await expect(lockGlyph).toHaveCSS('opacity', '1');
    await expectBearing(page, 135);
    await expect(controls).not.toHaveClass(/rotation-north-locked/);
    await screenshot(page, testInfo, 'compass-locked-angle-phone');

    await page.setViewportSize({ width: 744, height: 390 });
    await searchFor(page, 'CO');
    await expect(page.locator('#panel-content h1')).toHaveText('Colorado');
    await expectBearing(page, 135);
    await lock.tap();
    await expect(lock).toHaveAttribute('aria-pressed', 'false');
    await tapRoseSpoke(page, true);
    await expectBearing(page, 0);
    await expect(controls).toHaveClass(/rotation-north-locked/);
    await page.getByRole('button', { name: 'Open state atlas' }).tap();
    await expect(page.locator('.rotation-tools')).toHaveAttribute('inert', '');
  });

  test('phone startup hides the desktop sidebar while the map loads', async ({ page }) => {
    await page.route('**/js/atlas.mjs?*', route => route.abort());
    await page.goto('/');
    await expect(page.locator('.app')).not.toHaveClass(/phone-layout/);
    await expect(page.locator('#map-loading')).toBeVisible();
    await expect(page.locator('#info-panel')).toBeHidden();
    await expect(page.locator('#sidebar-toggle')).toBeHidden();
    const map = await page.locator('.map-shell').boundingBox();
    expect(map.width).toBe(390);
  });

  test('phone View shares the header with Search in portrait and landscape', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 680 });
    await assertRendered(page, testInfo);
    const search = page.getByRole('textbox', { name: 'Find a state, county or city' });
    const view = page.locator('#view-menu summary');
    const results = page.locator('#search-results');
    const geographic = page.getByRole('button', { name: 'GEOGRAPHIC', exact: true });
    for (const viewport of [{ width: 320, height: 680 }, { width: 744, height: 390 }]) {
      await page.setViewportSize(viewport);
      const idleSearch = await search.boundingBox();
      const idleView = await view.boundingBox();
      expect(idleSearch.x + idleSearch.width).toBeLessThan(idleView.x);
      expect(idleView.width).toBeGreaterThanOrEqual(44);

      await search.tap();
      await search.fill('MN');
      await expect(results).toBeVisible();
      expect((await search.boundingBox()).width).toBeGreaterThan(idleSearch.width);
      expect((await view.boundingBox()).width).toBeLessThan(idleView.width);

      await view.tap();
      await expect(results).toBeHidden();
      await expect(search).not.toBeFocused();
      await expect(page.locator('#view-menu [aria-current]')).toHaveText('STATISTICAL');
      await expect(geographic).toBeVisible();
      await expect(page.getByRole('button', { name: 'STRATEGIC', exact: true })).toBeVisible();
      const menu = await page.locator('.view-options').boundingBox();
      expect(menu.x + menu.width).toBeLessThanOrEqual(viewport.width);
      expect(menu.y).toBeGreaterThan(idleView.y + idleView.height);
      await screenshot(page, testInfo, `phone-view-${viewport.width}`);

      await geographic.tap();
      await expect(geographic).toBeHidden();
      await expect(page.locator('#toast')).toContainText('GEOGRAPHIC view is reserved');
      await view.tap();
      await search.tap();
      await expect(geographic).toBeHidden();
      await search.fill('CO');
      await results.getByRole('button', { name: /Colorado/ }).tap();
      await expect(page.locator('#panel-content h1')).toHaveText('Colorado');
    }
  });

  test('phone Home, Zoom and Key follow the top of the tools and stats bar', async ({ page }, testInfo) => {
    await assertRendered(page, testInfo);
    const app = page.locator('.app');
    const key = page.getByRole('button', { name: 'Map key', exact: true });
    const home = page.getByRole('button', { name: 'National view', exact: true });
    const checkDock = async stage => {
      await expect(app).toHaveAttribute('data-phone-stage', stage);
      await expect.poll(async () => (await bottomHudGeometry(page, true)).hitOffset).toBeLessThan(1);
      const hud = await bottomHudGeometry(page, true);
      for (const gap of [hud.homeGap, hud.keyGap]) {
        expect(gap).toBeGreaterThanOrEqual(0);
        expect(gap).toBeLessThanOrEqual(6);
      }
      expect(hud.zoomOffset).toBeLessThan(2);
    };
    await checkDock('closed');
    await key.tap();
    await expect(page.locator('#map-key')).toBeVisible();
    await expect(key).toHaveCSS('color', activeGold);
    await key.tap();
    await expect(page.locator('#map-key')).toBeHidden();
    await page.getByRole('button', { name: 'Show map tools' }).tap();
    await checkDock('tools');
    await searchFor(page, 'Minnesota');
    await checkDock('summary');
    await home.tap();
    await checkDock('closed');
  });

  for (const { state, center, bearing } of [
    { state: 'Colorado', center: [-105.5, 39], bearing: 0 },
    { state: 'Illinois', center: [-89, 40], bearing: 38 }
  ]) {
    test(`direct state hold fits ${state} above the facts on the first open`, async ({ page }, testInfo) => {
      if (bearing) await page.setViewportSize({ width: 744, height: 390 });
      await exposeMap(page);
      await assertRendered(page, testInfo);
      await readMap(page);
      await page.evaluate(({ center, bearing }) => testMap.jumpTo({ center, zoom: 5.4, bearing }), { center, bearing });
      if (bearing) await page.getByRole('button', { name: 'Show map tools' }).tap();
      const label = page.getByRole('button', { name: `Select ${state}`, exact: true });
      await expect(label).toBeVisible();
      const { x, y, width, height } = await label.boundingBox();
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart', touchPoints: [{ x: x + width / 2, y: y + height / 2 }]
      });
      await expect(page.locator('.app')).toHaveAttribute('data-phone-atlas-kind', 'state');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(page.locator('#panel-content h1')).toHaveText(state);
      await waitForCamera(page);
      await page.waitForFunction(() => testMap.queryRenderedFeatures({ layers: ['state-atlas-surface'] }).length > 0);
      const framed = await page.evaluate(async name => {
        const { features } = await fetch('/data/states.geojson').then(response => response.json());
        const { coordinates, type } = features.find(feature => feature.properties.name === name).geometry;
        const points = coordinates.flat(type === 'MultiPolygon' ? 2 : 1).map(point => testMap.project(point));
        const rect = testMap.getContainer().getBoundingClientRect();
        const top = document.querySelector('#phone-atlas-back').getBoundingClientRect().bottom - rect.top;
        const bottom = document.querySelector('.phone-sheet').getBoundingClientRect().top - rect.top;
        return points.every(({ x, y }) => x >= 0 && x <= rect.width && y >= top && y <= bottom);
      }, state);
      expect(framed).toBe(true);
      await screenshot(page, testInfo, `${state.toLowerCase()}-direct-phone-atlas`);
      const first = await camera(page);
      expect(first[3]).toBe(bearing);
      await page.locator('#phone-atlas-back').tap();
      await page.getByRole('button', { name: 'Open state atlas' }).tap();
      await waitForCamera(page);
      expect(await camera(page)).toEqual(first);
    });
  }

  test('wide state labels and swipe-dock controls are available', async ({ page }, testInfo) => {
    await assertRendered(page, testInfo);
    await expect(page.locator('.topbar #search')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Minnesota', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select California', exact: true })).toBeVisible();
    await screenshot(page, testInfo, 'national-mobile-390x844');

    await page.getByRole('button', { name: 'Show map tools' }).tap();
    await expect(page.locator('#toggle-counties')).toBeVisible();
    await page.getByRole('button', { name: 'Select Minnesota', exact: true }).tap();
    await expect(page.locator('#panel-content h1')).toHaveText('Minnesota');
    await page.getByRole('button', { name: 'Clear state selection' }).tap();
    await expect(page.locator('#selection-status')).toContainText('AWAITING');
    await page.locator('#search').fill('IN');
    await page.locator('#search').press('Enter');
    await expect(page.locator('#panel-content h1')).toHaveText('Indiana');
    await expect(page.getByRole('button', { name: /Indianapolis/ })).toBeVisible();
  });

  for (const { name, viewport, bearing } of [
    { name: 'portrait', viewport: { width: 390, height: 844 }, bearing: 0 },
    { name: 'rotated landscape', viewport: { width: 744, height: 390 }, bearing: 38 }
  ]) {
    test(`one clean tap selects state land and map gestures stay separate in ${name}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await exposeMap(page);
      await assertRendered(page, testInfo);
      await readMap(page);
      const app = page.locator('.app');
      const heading = page.locator('#panel-content h1');
      const cdp = await page.context().newCDPSession(page);
      const touch = (type, ...touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
      const statePoint = async () => {
        await page.evaluate(bearing => testMap.jumpTo({ center: [-107.5, 39.9], zoom: 5.4, bearing }), bearing);
        return (await page.waitForFunction(() => {
          const map = testMap;
          const point = map.project([-107.5, 39.9]);
          const rect = map.getContainer().getBoundingClientRect();
          const x = Math.round(rect.left + point.x), y = Math.round(rect.top + point.y);
          if (document.elementFromPoint(x, y) !== map.getCanvas() ||
              !map.queryRenderedFeatures(point, { layers: ['state-hit'] }).some(f => f.properties.name === 'Colorado')) return;
          return { x, y, id: 0 };
        })).jsonValue();
      };

      let point = await statePoint();
      let before = await camera(page);
      await touch('touchStart', point);
      await expect(app).toHaveAttribute('data-phone-stage', 'closed');
      await touch('touchEnd');
      await expect(heading).toHaveText('Colorado', { timeout: 950 });
      await expect(app).toHaveAttribute('data-phone-stage', 'summary');
      expect(await camera(page)).toEqual(before);
      await page.getByRole('button', { name: 'National view', exact: true }).tap();
      await waitForCamera(page);

      point = await statePoint();
      before = await camera(page);
      await touch('touchStart', point);
      for (const dx of [5, 10, 16, 24, 34]) {
        await touch('touchMove', { ...point, x: point.x + dx });
        await page.waitForTimeout(35);
      }
      await touch('touchEnd');
      await expect.poll(async () => (await camera(page))[0]).not.toBe(before[0]);
      await page.waitForTimeout(550);
      await expect(app).toHaveAttribute('data-phone-stage', 'closed');

      point = await statePoint();
      before = await camera(page);
      await touch('touchStart', point);
      await touch('touchStart', point, { x: point.x + 44, y: point.y, id: 1 });
      for (const dx of [9, 18, 30, 44]) {
        await touch('touchMove', { ...point, x: point.x - dx }, { x: point.x + 44 + dx, y: point.y, id: 1 });
      }
      await touch('touchEnd');
      await expect.poll(async () => (await camera(page))[2]).toBeGreaterThan(before[2] + .3);
      await page.waitForTimeout(550);
      await expect(app).toHaveAttribute('data-phone-stage', 'closed');

      point = await statePoint();
      await touch('touchStart', point);
      await touch('touchCancel');
      await page.waitForTimeout(650);
      await expect(app).toHaveAttribute('data-phone-stage', 'closed');

      point = await statePoint();
      before = await camera(page);
      await page.touchscreen.tap(point.x, point.y);
      await page.touchscreen.tap(point.x, point.y);
      await expect.poll(async () => (await camera(page))[2]).toBeCloseTo(before[2] + 2, 3);
      await page.waitForTimeout(550);
      await expect(app).toHaveAttribute('data-phone-stage', 'closed');
    });
  }

  test('one tap switches states immediately with county mode enabled and keeps county scope', async ({ page }, testInfo) => {
    await exposeMap(page);
    await assertRendered(page, testInfo);
    await readMap(page);
    await searchFor(page, 'Tennessee');
    const heading = page.locator('#panel-content h1');
    await expect(heading).toHaveText('Tennessee');
    await waitForCamera(page);
    await page.locator('#toggle-counties').tap();
    await page.evaluate(() => testMap.jumpTo({ center: [-85.8, 36.4], zoom: 4.1, bearing: 38 }));
    await expect.poll(() => countyStates(page)).toEqual(['47']);
    const beforeTap = await camera(page);
    const point = await page.evaluate(() => {
      const map = testMap;
      const point = map.project([-85.7, 37.45]);
      const { left, top } = map.getContainer().getBoundingClientRect();
      return [left + point.x, top + point.y];
    });
    await page.touchscreen.tap(...point);
    expect(await heading.textContent(), 'Selection should change on the first tap without waiting for a second tap').toBe('Kentucky');
    expect(await camera(page)).toEqual(beforeTap);
    await expect.poll(() => countyStates(page)).toEqual(['21']);
    await page.getByRole('button', { name: 'Clear state selection' }).tap();
    await expect.poll(async () => (await countyStates(page)).length).toBeGreaterThan(3);
  });

  test('phone State Atlas keeps the camera on exit and releases a deliberate drag', async ({ page }, testInfo) => {
    await exposeMap(page);
    await assertRendered(page, testInfo);
    await readMap(page);
    await searchFor(page, 'Kansas');
    await expect(page.locator('#panel-content h1')).toHaveText('Kansas');
    await waitForCamera(page);

    const app = page.locator('.app');
    const cdp = await page.context().newCDPSession(page);
    async function touch(type, x, y) {
      await cdp.send('Input.dispatchTouchEvent', {
        type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }]
      });
    }
    async function swipe(x, y, dx, dy) {
      await touch('touchStart', x, y);
      for (let i = 1; i <= 5; i++) await touch('touchMove', x + dx * i / 5, y + dy * i / 5);
      await touch('touchEnd');
    }

    const stats = page.locator('#panel-content');
    const compact = await stats.boundingBox();
    await swipe(compact.x + compact.width / 2, compact.y + 78, 0, -57);
    await expect(app).toHaveAttribute('data-phone-stage', 'atlas');
    await waitForCamera(page);
    const framed = await camera(page);
    const expanded = await stats.boundingBox();
    await swipe(expanded.x + expanded.width / 2, expanded.y + 15, 0, 63);
    await expect(app).toHaveAttribute('data-phone-stage', 'summary');
    await waitForCamera(page);
    expect(await camera(page)).toEqual(framed);

    await page.getByRole('button', { name: 'Open state atlas' }).tap();
    await expect(app).toHaveAttribute('data-phone-stage', 'atlas');
    await waitForCamera(page);
    const start = await camera(page);
    const projectedLongitude = () => page.evaluate(position => {
      const point = testMap.project(position.slice(0, 2));
      return point.x - testMap.getContainer().clientWidth / 2;
    }, start);
    await touch('touchStart', 100, 118);
    for (let x = 108; x <= 148; x += 8) await touch('touchMove', x, 118);
    await expect.poll(projectedLongitude).toBeGreaterThan(5);
    expect(await projectedLongitude()).toBeLessThan(40);
    await expect(app).toHaveAttribute('data-phone-stage', 'atlas');
    await touch('touchEnd');
    await waitForCamera(page);
    await expect.poll(projectedLongitude).toBeLessThan(21);
    await expect(app).toHaveAttribute('data-phone-stage', 'atlas');

    await touch('touchStart', 100, 118);
    for (let x = 110; x <= 210; x += 10) await touch('touchMove', x, 118);
    await expect(app).toHaveAttribute('data-phone-stage', 'summary');
    const release = await camera(page);
    for (let x = 220; x <= 260; x += 10) await touch('touchMove', x, 118);
    await expect.poll(async () => (await camera(page))[0]).toBeLessThan(release[0]);
    await touch('touchEnd');
    await waitForCamera(page);
    await expect(app).not.toHaveClass(/phone-atlas-panning/);
    expect((await camera(page)).slice(2)).toEqual(start.slice(2));
    await expect(page.locator('#panel-content h1')).toHaveText('Kansas');
    expect(await page.evaluate(() => testMap.getPaintProperty('state-surface', 'fill-opacity'))).toBe(.98);
  });

  for (const mode of ['portrait', 'rotated landscape', 'missing outline']) {
    test(`a city-name hold opens and frames City Atlas in ${mode}`, async ({ page }, testInfo) => {
      const bearing = mode === 'rotated landscape' ? 38 : 0;
      const fallback = mode === 'missing outline';
      if (bearing) await page.setViewportSize({ width: 744, height: 390 });
      if (fallback) {
        await page.route('**/data/places/27_shapes.geojson', route =>
          route.fulfill({ json: { type: 'FeatureCollection', features: [] } }));
      }
      await exposeMap(page);
      await assertRendered(page, testInfo);
      await readMap(page);
      await page.evaluate(bearing => testMap.jumpTo({ center: [-92.76, 44.10], zoom: 7.2, bearing }), bearing);

      const label = await (await page.waitForFunction(() => {
        const city = testCityLayers.getLayoutState().items.find(item => item.id === '2754880');
        if (!city?.placement) return;
        const { x0, x1, y0, y1 } = city.placement.box;
        const x = (x0 + x1) / 2, y = (y0 + y1) / 2;
        const rect = testMap.getContainer().getBoundingClientRect();
        if (testCityLayers.labelNear({ x, y })?.properties.geoid !== city.id ||
            document.elementFromPoint(x + rect.left, y + rect.top) !== testMap.getCanvas()) return;
        return { x: x + rect.left, y: y + rect.top, marker: testMap.unproject([city.x, city.y]).toArray() };
      })).jsonValue();

      const cdp = await page.context().newCDPSession(page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
        type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }]
      });
      await touch('touchStart', label.x, label.y);
      const app = page.locator('.app');
      await expect(app).toHaveAttribute('data-phone-atlas-kind', 'place');
      await touch('touchEnd');
      await expect(page.locator('#panel-content h1')).toHaveText('Rochester');
      await expect.poll(async () => (await camera(page))[2]).toBeGreaterThan(8);
      await waitForCamera(page);
      if (fallback) expect((await camera(page))[2]).toBe(8.8);
      expect((await camera(page))[3]).toBe(bearing);

      const framed = await page.evaluate(async ({ marker, fallback }) => {
        const map = testMap, rect = map.getContainer().getBoundingClientRect();
        const top = document.querySelector('#phone-atlas-back').getBoundingClientRect().bottom - rect.top;
        const bottom = document.querySelector('.phone-sheet').getBoundingClientRect().top - rect.top;
        let corners = [marker];
        if (!fallback) {
          const data = await fetch('/data/places/27_shapes.geojson').then(response => response.json());
          const geometry = data.features.find(feature => feature.properties.geoid === '2754880').geometry;
          const vertices = geometry.coordinates.flat(geometry.type === 'MultiPolygon' ? 2 : 1);
          const lngs = vertices.map(point => point[0]), lats = vertices.map(point => point[1]);
          const west = Math.min(...lngs), east = Math.max(...lngs), south = Math.min(...lats), north = Math.max(...lats);
          corners = [[west, south], [west, north], [east, south], [east, north]];
        }
        const points = corners.map(point => map.project(point));
        const left = Math.min(...points.map(point => point.x)), right = Math.max(...points.map(point => point.x));
        const upper = Math.min(...points.map(point => point.y)), lower = Math.max(...points.map(point => point.y));
        return {
          xError: Math.abs((left + right - rect.width) / 2),
          yError: Math.abs((upper + lower - top - bottom) / 2),
          inside: left >= 0 && upper >= top && right <= rect.width && lower <= bottom,
          normalBackground: map.getPaintProperty('state-surface', 'fill-opacity') === .98
        };
      }, { marker: label.marker, fallback });
      expect(framed.inside).toBe(true);
      expect(framed.xError).toBeLessThan(4);
      expect(framed.yError).toBeLessThan(4);
      expect(framed.normalBackground).toBe(true);

      if (mode !== 'portrait') return;
      const framedCamera = await camera(page);
      await touch('touchStart', 65, 114);
      await touch('touchMove', 85, 114);
      await expect.poll(async () => (await camera(page))[0]).toBeLessThan(framedCamera[0]);
      await page.waitForTimeout(150);
      await touch('touchEnd');
      await waitForCamera(page);
      await expect(app).toHaveAttribute('data-phone-stage', 'atlas');

      await touch('touchStart', 72, 220);
      for (let x = 82; x <= 202; x += 10) await touch('touchMove', x, 220);
      await expect(app).toHaveAttribute('data-phone-stage', 'summary', { timeout: 3000 });
      const release = await camera(page);
      for (let x = 212; x <= 252; x += 10) await touch('touchMove', x, 220);
      await expect.poll(async () => (await camera(page))[0]).toBeLessThan(release[0]);
      await touch('touchEnd');
      await waitForCamera(page);
      await expect(page.locator('#panel-content h1')).toHaveText('Rochester');
      expect((await camera(page)).slice(2)).toEqual(framedCamera.slice(2));
    });
  }
});

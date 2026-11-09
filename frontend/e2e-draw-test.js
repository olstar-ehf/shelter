/**
 * E2E regression test for the NestJS windbreak grant application.
 *
 * Session 1: draw flow + validation (inside / outside / crossing).
 * Session 2: full submission -> server-side validation -> confirmation page.
 *
 * Run with the backend (:5000) and the NestJS server (:8000) running:
 *   PLAYWRIGHT_BROWSERS_PATH=/workspace/shelter/.pw-browsers \
 *   LD_LIBRARY_PATH=/workspace/shelter/.pw-libs/root/lib/x86_64-linux-gnu:/workspace/shelter/.pw-libs/root/usr/lib/x86_64-linux-gnu \
 *   node e2e-draw-test.js
 *
 * NOTE: submissions create an in-memory Zendesk mock ticket
 * (ZENDESK_MOCK=true) - no files or databases are written.
 */
const { chromium } = require('playwright-core');

const APP_URL = process.env.APP_URL || 'http://localhost:8000/';
const SHOT_DIR = '/tmp';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Origin guard: the browser may only ever talk to our own origins - the
  // app host and the basemap tile proxy the server configured. Any other
  // request (a stray CDN, a leaked third-party URL) fails the whole run.
  const allowedOrigins = new Set([new URL(APP_URL).origin]);
  const externalRequests = [];
  {
    const html = await fetch(new URL('/apply?lang=en', APP_URL).href).then(
      (r) => r.text(),
    );
    const tile = html.match(/"tileUrl":"([^"]+)"/);
    if (tile) {
      allowedOrigins.add(
        new URL(tile[1].replace(/\{[xyz]\}/g, '0')).origin,
      );
    }
  }
  // CSP guard: the island.is-style Content-Security-Policy must be present
  // and enforced by default (no opt-out flag) on every page.
  const cspHeader =
    (await fetch(new URL('/', APP_URL).href).then((r) =>
      r.headers.get('content-security-policy'),
    )) ?? '';
  const cspOk = cspHeader.includes("default-src 'self'");
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      return;
    }
    let origin;
    try {
      origin = new URL(url).origin;
    } catch {
      externalRequests.push(url);
      return;
    }
    if (!allowedOrigins.has(origin)) {
      externalRequests.push(url);
    }
  });

  // Popups on the windbreak/parcel layers can cover the next click point
  // while drawing; suppress them for the test (Leaflet opens popups on the
  // layer prototype, so patching it after the app loads is enough).
  await page.addInitScript(() => {
    const patch = () => {
      const L = window.L;
      if (L && L.Layer && L.Layer.prototype) {
        L.Layer.prototype._openPopup = function () {};
        return;
      }
      setTimeout(patch, 50);
    };
    patch();
  });

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`${msg.text()} [${msg.location().url}]`);
    }
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  const openApplyPage = async () => {
    // ?lang=en makes the rest of the run (and the cookie) English, so the
    // assertions below stay stable across locales.
    await page.goto(`${APP_URL}?lang=en`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('text=Apply for windbreak', { timeout: 120000 });
    await page.click('a:has-text("Apply for windbreak")');
    await page.waitForURL('**/apply', { timeout: 120000 });
    await page.waitForSelector('.map-container', { timeout: 120000 });
    await page.waitForSelector('.leaflet-overlay-pane path', { timeout: 120000 });
    await page.waitForTimeout(1500);
  };

  // Icelandic spot check: default locale renders the Icelandic catalog.
  await page.goto(`${APP_URL}?lang=is`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('text=Sækja um skjólbelti', { timeout: 120000 });
  const isLanding = await page.evaluate(() => ({
    cta: document.body.textContent.includes('Sækja um skjólbelti'),
    title: document.body.textContent.includes('Sækja um styrk til að gróðursetja skjólbelti'),
  }));
  console.log('Icelandic landing:', JSON.stringify(isLanding));

  const drawState = () =>
    page.evaluate(() => ({
      startPageVisible:
        !!document.querySelector('h1') &&
        document.querySelector('h1').textContent.includes('Apply for a grant'),
      summaryText: document.querySelector('.lines-summary')
        ? document.querySelector('.lines-summary').textContent
        : null,
      okChips: document.querySelectorAll('.lines-summary .chip-ok').length,
      errorChips: document.querySelectorAll('.lines-summary .chip-error').length,
      reviewEnabled: (() => {
        const btn = document.getElementById('review-btn');
        return btn ? !btn.disabled : null;
      })(),
      stepper: Array.from(document.querySelectorAll('#stepper li')).map((li) =>
        li.classList.contains('active') ? Number(li.getAttribute('data-step')) : 0,
      ),
    }));

  const parcelPts = () =>
    page.evaluate(() => {
      const container = document.querySelector('.map-container');
      const rect = container.getBoundingClientRect();
      const path = document.querySelector('.leaflet-overlay-pane path');
      const b = path.getBBox();
      // Fractions of the Garpsdalur parcel bbox, verified (turf) to lie
      // inside the land and clear of the mock established windbreak. The
      // two points must stay >20 px apart: leaflet-draw's vertex marker
      // (20x20 touch icon) would otherwise swallow the second mousedown.
      return {
        p1: { x: rect.left + b.x + b.width * 0.40, y: rect.top + b.y + b.height * 0.30 },
        p2: { x: rect.left + b.x + b.width * 0.50, y: rect.top + b.y + b.height * 0.30 },
        bbox: { x: b.x, y: b.y, w: b.width, h: b.height },
        rect: { left: rect.left, top: rect.top, w: rect.width, h: rect.height },
      };
    });

  const drawToolEnabled = () =>
    page.evaluate(() =>
      document
        .querySelector('a.leaflet-draw-draw-polyline')
        ?.classList.contains('leaflet-draw-toolbar-button-enabled'),
    );

  // The toolbar's click handler is attached in a React effect; retry until
  // the polyline button is actually enabled (avoids losing the first draw).
  const activateDrawTool = async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (await drawToolEnabled()) {
        return;
      }
      await page.click('a.leaflet-draw-draw-polyline');
      await page.waitForTimeout(300);
      if (await drawToolEnabled()) {
        return;
      }
    }
    throw new Error('draw tool did not activate');
  };

  const drawLine = async (from, to, finishAt) => {
    await activateDrawTool();
    await page.waitForTimeout(200);
    await page.mouse.click(from.x, from.y);
    await page.waitForTimeout(250);
    await page.mouse.click(to.x, to.y);
    await page.waitForTimeout(250);
    // The line being drawn must show up as WKT in the coordinate box.
    const draftWkt = await page
      .inputValue('#coords-input')
      .catch(() => null);
    await page.mouse.dblclick(finishAt.x, finishAt.y, { delay: 80 });
    await page.waitForTimeout(1200);
    return draftWkt;
  };

  // ================= Session 1: draw + validation =================
  await openApplyPage();
  console.log('SESSION 1 OK: apply page rendered');

  const pts = await parcelPts();
  console.log('parcel bbox:', JSON.stringify(pts.bbox));

  // 1a. line inside the parcel
  const mouseDraftWkt = await drawLine(pts.p1, pts.p2, pts.p2);
  const s1 = await drawState();
  console.log('STEP 1a state:', JSON.stringify(s1));
  console.log('mouse-mode draft WKT:', mouseDraftWkt);

  // 1b. line outside the parcels (left edge of the map view, turf-verified
  // outside the Garpsdalur polygon)
  const outPts = [
    { x: pts.rect.left + pts.rect.w * 0.04, y: pts.rect.top + pts.rect.h * 0.78 },
    { x: pts.rect.left + pts.rect.w * 0.10, y: pts.rect.top + pts.rect.h * 0.78 },
  ];
  await drawLine(outPts[0], outPts[1], outPts[1]);
  const s2 = await drawState();
  console.log('STEP 1b state:', JSON.stringify(s2));

  // 1c. draw a vertical line through the established windbreak's midpoint.
  //     Vertical in screen space means constant longitude, so the drawn
  //     segment passes exactly through the windbreak's midpoint lat/lng and
  //     must be rejected as crossing it. (Endpoints ~30 px off the
  //     windbreak - turf-verified to stay inside the land.)
  const windbreakPts = await page.evaluate(() => {
    const path = document.querySelector('.leaflet-overlay-pane path[stroke="#14532d"]');
    if (!path) return null;
    const len = path.getTotalLength();
    const ctm = path.getScreenCTM();
    const mid = path.getPointAtLength(len / 2).matrixTransform(ctm);
    return {
      p1: { x: mid.x, y: mid.y - 30 },
      p2: { x: mid.x, y: mid.y + 30 },
    };
  });
  if (!windbreakPts) {
    throw new Error('established windbreak path not found');
  }
  await drawLine(windbreakPts.p1, windbreakPts.p2, windbreakPts.p2);
  const s3 = await drawState();
  console.log('STEP 1c state:', JSON.stringify(s3));
  await page.screenshot({ path: `${SHOT_DIR}/nest-e2e-validation.png`, fullPage: true });

  // Invalid lines must render red on the map (line 2 is outside the land,
  // line 3 crosses the established windbreak); the valid line stays green.
  const mapColors = await page.evaluate(() => ({
    red: document.querySelectorAll('.leaflet-overlay-pane path[stroke="#b3261e"]').length,
    green: document.querySelectorAll('.leaflet-overlay-pane path[stroke="#2e7d32"]').length,
  }));
  console.log('MAP COLOURS:', JSON.stringify(mapColors));

  const session1Ok =
    !s1.startPageVisible && s1.okChips >= 1 && s1.reviewEnabled === true &&
    !s2.startPageVisible && s2.errorChips >= 1 &&
    !s3.startPageVisible && s3.summaryText.includes('Crosses or touches') &&
    mapColors.red >= 2 && mapColors.green >= 1;
  console.log(session1Ok ? 'SESSION 1: PASS' : 'SESSION 1: FAIL');

  // ================= Session 2: submission =================
  await page.goto(`${APP_URL}apply`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.leaflet-overlay-pane path', { timeout: 120000 });
  await page.waitForTimeout(1500);
  const pts2 = await parcelPts();
  await drawLine(pts2.p1, pts2.p2, pts2.p2);
  const s4 = await drawState();
  console.log('STEP 2a state:', JSON.stringify(s4));

  await page.click('#review-btn');
  await page.waitForTimeout(400);
  const reviewState = await page.evaluate(() => ({
    reviewVisible: !document.getElementById('review-panel').hidden,
    step3Active: document.querySelector('#stepper li[data-step="3"]').classList.contains('active'),
    step4Active: document.querySelector('#stepper li[data-step="4"]').classList.contains('active'),
    reviewBtnHidden: document.getElementById('review-btn').hidden,
    drawToolbarGone: document.querySelector('.leaflet-draw') === null,
    title: document.getElementById('step-title').textContent,
    drawHelpHidden: document.getElementById('draw-help').hidden,
    reviewHelpHidden: document.getElementById('review-help').hidden,
  }));
  console.log('review state:', JSON.stringify(reviewState));

  // Back to map must return the stepper to step 2 and restore drawing
  await page.click('#back-btn');
  await page.waitForTimeout(300);
  const backState = await page.evaluate(() => ({
    step3Active: document.querySelector('#stepper li[data-step="3"]').classList.contains('active'),
    step2Active: document.querySelector('#stepper li[data-step="2"]').classList.contains('active'),
    reviewBtnHidden: document.getElementById('review-btn').hidden,
    drawToolbarBack: document.querySelector('.leaflet-draw') !== null,
    title: document.getElementById('step-title').textContent,
    drawHelpHidden: document.getElementById('draw-help').hidden,
  }));
  console.log('back state:', JSON.stringify(backState));

  // Review again and submit
  await page.click('#review-btn');
  await page.waitForTimeout(300);
  await page.click('#submit-btn');
  await page.waitForURL('**/submitted/**', { timeout: 30000 });
  await page.waitForTimeout(800);
  const submitted = await page.evaluate(() => ({
    url: window.location.pathname,
    hasTicketHeading: document.body.textContent.includes('Zendesk ticket'),
    hasApplicationRef: document.body.textContent.includes('WB-'),
    hasTicketNo: /Ticket no\./.test(document.body.textContent) &&
      /\d+/.test(document.body.textContent),
    startPageVisible: !!document.querySelector('h1') &&
      document.querySelector('h1').textContent.includes('Apply for a grant'),
  }));
  console.log('STEP 2b state:', JSON.stringify(submitted));
  await page.screenshot({ path: `${SHOT_DIR}/nest-e2e-submitted.png`, fullPage: true });

  const session2Ok =
    s4.okChips >= 1 && s4.reviewEnabled === true &&
    reviewState.reviewVisible &&
    reviewState.step3Active && !reviewState.step4Active &&
    reviewState.reviewBtnHidden && reviewState.drawToolbarGone &&
    reviewState.title.includes('Review your application') &&
    reviewState.drawHelpHidden && !reviewState.reviewHelpHidden &&
    backState.step2Active && !backState.step3Active &&
    !backState.reviewBtnHidden && backState.drawToolbarBack &&
    backState.title.includes('Draw your windbreak') &&
    !backState.drawHelpHidden &&
    submitted.hasTicketHeading && submitted.hasApplicationRef &&
    submitted.hasTicketNo && !submitted.startPageVisible;
  console.log(session2Ok ? 'SESSION 2: PASS' : 'SESSION 2: FAIL');


  // ================= Session 3: keyboard-only input =================
  // Aim-and-shoot: place a line with the keyboard only (arrows + Enter),
  // then add a line by pasting WKT coordinates.
  await page.goto(`${APP_URL}apply?lang=en`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.map-container', { timeout: 120000 });
  await page.waitForSelector('.leaflet-overlay-pane path', { timeout: 120000 });
  await page.waitForTimeout(1500);

  // Pointer-mode toolbar: only the draw-line button; the edit-layer and
  // trash-can buttons are removed and there is no Finish-line button.
  const toolbar = await page.evaluate(() => ({
    finishBtn: !!document.querySelector('.camera-finish'),
    editBtn: !!document.querySelector('.leaflet-draw-edit-edit'),
    removeBtn: !!document.querySelector('.leaflet-draw-edit-remove'),
    drawPolyline: !!document.querySelector('.leaflet-draw-draw-polyline'),
  }));

  const coordsValue = () =>
    page.evaluate(
      () =>
        document.querySelector('.map-coords-value')?.textContent?.trim() ??
        null,
    );
  const coordsPattern = /^-?\d+\.\d{7}, -?\d+\.\d{7}$/;
  // Pointer mode: the readout follows the mouse, at 7 decimals (~1 cm).
  const mapBox = await page.evaluate(() => {
    const rect = document.querySelector('.map-container').getBoundingClientRect();
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  });
  await page.mouse.move(mapBox.x + mapBox.w * 0.3, mapBox.y + mapBox.h * 0.4);
  await page.waitForTimeout(250);
  const pointerCoordsA = await coordsValue();
  await page.mouse.move(mapBox.x + mapBox.w * 0.7, mapBox.y + mapBox.h * 0.6);
  await page.waitForTimeout(250);
  const pointerCoordsB = await coordsValue();

  await page.click('.camera-toggle');
  await page.waitForTimeout(400);
  const cameraPressed = await page.evaluate(() =>
    document.querySelector('.camera-toggle').getAttribute('aria-pressed'),
  );
  // Camera mode: the readout follows the crosshair (map centre).
  const cameraCoordsA = await coordsValue();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const cameraCoordsB = await coordsValue();
  const zoomLevel = () =>
    page.evaluate(() => {
      const live = document.querySelector('.windbreak-map [role="status"]');
      const match = (live?.textContent ?? '').match(/\d+/);
      return match ? Number(match[0]) : null;
    });
  // One x tap announces a baseline level; holding z must raise it, holding
  // x must lower it again.
  await page.keyboard.press('x');
  await page.waitForTimeout(300);
  const zoomStart = await zoomLevel();
  await page.keyboard.down('z');
  await page.waitForTimeout(700);
  await page.keyboard.up('z');
  await page.waitForTimeout(300);
  const zoomedIn = await zoomLevel();
  await page.keyboard.down('x');
  await page.waitForTimeout(700);
  await page.keyboard.up('x');
  await page.waitForTimeout(300);
  const zoomedOut = await zoomLevel();
  // Place two points with the spacebar, then double-tap space to finish.
  await page.keyboard.press(' ');
  await page.waitForTimeout(500);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const cameraDraftWkt = await page.inputValue('#coords-input').catch(() => null);
  await page.keyboard.press(' ');
  await page.waitForTimeout(80);
  await page.keyboard.press(' ');
  await page.waitForTimeout(700);
  const cameraAnnouncement = await page.evaluate(() => {
    const live = document.querySelector('.windbreak-map [role="status"]');
    return live ? live.textContent.trim() : null;
  });
  // Finishing a line must KEEP camera mode on for the next line.
  const afterCamera = await page.evaluate(() => ({
    count: document.getElementById('line-count').textContent.trim(),
    reviewEnabled: !document.getElementById('review-btn').disabled,
    pressed: document.querySelector('.camera-toggle').getAttribute('aria-pressed'),
  }));
  const lineLength = (row) =>
    page.evaluate((index) => {
      const rows = [...document.querySelectorAll('#lines-body tr')];
      const cells = rows[index] ? [...rows[index].querySelectorAll('td')] : [];
      const match = cells[1] ? cells[1].textContent.match(/[\d.]+/) : null;
      return match ? Number(match[0]) : null;
    }, row);
  const line1Length = await lineLength(0);

  // Second line in the SAME camera-mode session, moved by holding the key:
  // the held pan must make the line much longer than the tapped one.
  await page.keyboard.press(' ');
  await page.waitForTimeout(200);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(120);
  await page.keyboard.press(' ');
  await page.waitForTimeout(80);
  await page.keyboard.press(' ');
  await page.waitForTimeout(600);
  const afterSecondLine = await page.evaluate(() => ({
    count: document.getElementById('line-count').textContent.trim(),
    pressed: document.querySelector('.camera-toggle').getAttribute('aria-pressed'),
  }));
  const line2Length = await lineLength(1);

  // The panel may already be open (it auto-opens while drawing in camera
  // mode), so only toggle it when it is closed.
  const coordsOpen = await page.evaluate(
    () => document.querySelector('.coords-entry')?.open ?? false,
  );
  if (!coordsOpen) {
    await page.click('.coords-entry summary');
  }
  await page.fill(
    '#coords-input',
    'LINESTRING (-21.805 65.485, -21.795 65.485)',
  );
  await page.click('.coords-entry button');
  await page.waitForTimeout(700);
  const afterCoords = await page.evaluate(() => ({
    count: document.getElementById('line-count').textContent.trim(),
    info: document.querySelector('.coords-entry [role="status"]')?.textContent.trim() ?? null,
  }));
  // Keyboard focus on a row previews its windbreak on the map (like hover),
  // without selecting it.
  let focusedRow = false;
  for (let i = 0; i < 80 && !focusedRow; i += 1) {
    await page.keyboard.press('Tab');
    focusedRow = await page.evaluate(
      () => document.activeElement?.tagName === 'TR',
    );
  }
  await page.waitForTimeout(300);
  const focusPreview = await page.evaluate(() => ({
    focusedRow: document.activeElement?.tagName === 'TR',
    bluePaths: [...document.querySelectorAll('.leaflet-overlay-pane path')]
      .filter((path) => path.getAttribute('stroke') === '#1565c0').length,
    ariaCurrent: document.activeElement?.getAttribute('aria-current'),
  }));
  // Pointer hover on a row previews it too, and clearing it removes the
  // highlight again.
  await page.hover('#lines-body tr:nth-child(3)');
  await page.waitForTimeout(300);
  const hoverPreview = await page.evaluate(
    () =>
      [...document.querySelectorAll('.leaflet-overlay-pane path')].filter(
        (path) => path.getAttribute('stroke') === '#1565c0',
      ).length,
  );
  await page.mouse.move(8, 8);
  await page.waitForTimeout(300);
  const hoverCleared = await page.evaluate(
    () =>
      [...document.querySelectorAll('.leaflet-overlay-pane path')].filter(
        (path) => path.getAttribute('stroke') === '#1565c0',
      ).length,
  );

  // Selecting a table row highlights that windbreak on the map.
  const selectedInfo = () =>
    page.evaluate(() => ({
      bluePaths: [...document.querySelectorAll('.leaflet-overlay-pane path')]
        .filter((path) => path.getAttribute('stroke') === '#1565c0').length,
    }));
  await page.click('#lines-body tr:nth-child(1)');
  await page.waitForTimeout(400);
  const selection1 = await page.evaluate(() => ({
    current: document.querySelector('#lines-body tr:nth-child(1)').getAttribute('aria-current'),
    selectedClass: document.querySelector('#lines-body tr:nth-child(1)').classList.contains('selected'),
    ...{},
  }));
  selection1.bluePaths = (await selectedInfo()).bluePaths;
  await page.click('#lines-body tr:nth-child(2)');
  await page.waitForTimeout(400);
  const selection2 = await page.evaluate(() => ({
    firstCurrent: document.querySelector('#lines-body tr:nth-child(1)').getAttribute('aria-current'),
    secondCurrent: document.querySelector('#lines-body tr:nth-child(2)').getAttribute('aria-current'),
  }));
  selection2.bluePaths = (await selectedInfo()).bluePaths;

  // Each drawn windbreak has a remove button in the table; use the last one.
  const removeButtonCount = await page.evaluate(
    () => document.querySelectorAll('#lines-body .line-remove').length,
  );
  await page.click('#lines-body tr:last-child .line-remove');
  await page.waitForTimeout(500);
  const afterDelete = await page.evaluate(() => ({
    count: document.getElementById('line-count').textContent.trim(),
    rows: document.querySelectorAll('#lines-body tr').length,
  }));

  await page.click('.camera-toggle');
  await page.waitForTimeout(300);
  const afterExit = await page.evaluate(() => ({
    pressed: document.querySelector('.camera-toggle').getAttribute('aria-pressed'),
  }));

  const wktOk = (wkt) =>
    typeof wkt === 'string' &&
    wkt.startsWith('LINESTRING (') &&
    wkt.endsWith(')') &&
    wkt.split(',').length >= 2;
  const session3Ok =
    wktOk(cameraDraftWkt) &&
    typeof pointerCoordsA === 'string' &&
    typeof pointerCoordsB === 'string' &&
    coordsPattern.test(pointerCoordsA) && coordsPattern.test(pointerCoordsB) &&
    pointerCoordsA !== pointerCoordsB &&
    typeof cameraCoordsA === 'string' &&
    typeof cameraCoordsB === 'string' &&
    coordsPattern.test(cameraCoordsB) &&
    cameraCoordsA !== cameraCoordsB &&
    toolbar.finishBtn === false &&
    toolbar.editBtn === false &&
    toolbar.removeBtn === false &&
    toolbar.drawPolyline === true &&
    cameraPressed === 'true' &&
    typeof zoomStart === 'number' &&
    zoomedIn > zoomStart &&
    zoomedOut < zoomedIn &&
    typeof cameraAnnouncement === 'string' && cameraAnnouncement.length > 0 &&
    afterCamera.count === '1' && afterCamera.reviewEnabled === true &&
    afterCamera.pressed === 'true' &&
    typeof line1Length === 'number' && typeof line2Length === 'number' &&
    line2Length > line1Length * 2 &&
    afterSecondLine.count === '2' && afterSecondLine.pressed === 'true' &&
    afterCoords.count === '3' &&
    typeof afterCoords.info === 'string' && afterCoords.info.length > 0 &&
    focusPreview.focusedRow === true &&
    focusPreview.bluePaths >= 1 && focusPreview.ariaCurrent === null &&
    hoverPreview >= 1 && hoverCleared === 0 &&
    selection1.current === 'true' && selection1.selectedClass === true &&
    selection1.bluePaths >= 1 &&
    selection2.firstCurrent === null && selection2.secondCurrent === 'true' &&
    selection2.bluePaths >= 1 &&
    removeButtonCount === 3 &&
    afterDelete.count === '2' && afterDelete.rows === 2 &&
    afterExit.pressed === 'false';
  console.log(
    'SESSION 3:',
    session3Ok ? 'PASS' : 'FAIL',
    JSON.stringify({
      cameraPressed,
      cameraDraftWkt,
      pointerCoordsA,
      pointerCoordsB,
      cameraCoordsA,
      cameraCoordsB,
      toolbar,
      zoomStart,
      zoomedIn,
      zoomedOut,
      cameraAnnouncement,
      afterCamera,
      line1Length,
      afterSecondLine,
      line2Length,
      afterCoords,
      focusPreview,
      hoverPreview,
      hoverCleared,
      selection1,
      selection2,
      removeButtonCount,
      afterDelete,
      afterExit,
    }),
  );

  // Basemap attribution is localized (institution name).
  const attributionText = () =>
    page.evaluate(() =>
      (document.querySelector('.leaflet-control-attribution')?.textContent ?? '').trim(),
    );
  await page.goto(`${APP_URL}apply?lang=is`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.leaflet-control-attribution', { timeout: 120000 });
  const attributionIs = await attributionText();
  await page.goto(`${APP_URL}apply?lang=en`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.leaflet-control-attribution', { timeout: 120000 });
  const attributionEn = await attributionText();
  const attributionOk =
    attributionIs.includes('Kortagögn: Náttúrufræðistofnun') &&
    attributionEn.includes('Nature Science Institute of Iceland');
  console.log('basemap attribution:', JSON.stringify({ attributionIs, attributionEn, attributionOk }));

  console.log('pageerrors:', pageErrors.length ? pageErrors : 'none');
  console.log('console errors:', consoleErrors.length ? consoleErrors.slice(0, 5) : 'none');
  console.log(
    cspOk
      ? "csp header: PASS (enforced Content-Security-Policy present)"
      : `csp header: FAIL (missing or weak - got "${cspHeader.slice(0, 60)}")`,
  );

  const leaked = [...new Set(externalRequests)];
  const originsOk = leaked.length === 0;
  console.log(
    originsOk
      ? 'origin guard: PASS (browser only talked to our own origins)'
      : `origin guard: FAIL - external requests: ${leaked.join(', ')}`,
  );

  const pass =
    isLanding.cta && isLanding.title &&
    wktOk(mouseDraftWkt) &&
    attributionOk &&
    session1Ok && session2Ok && session3Ok &&
    pageErrors.length === 0 && originsOk && cspOk;
  console.log(pass ? 'E2E RESULT: PASS' : 'E2E RESULT: FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('E2E crashed:', err);
  process.exit(2);
});

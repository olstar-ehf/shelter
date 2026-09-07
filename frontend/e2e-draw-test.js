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
 * NOTE: the submission scenario appends a line to
 * backend/data/windbreak_applications.json - restore the seed file afterwards.
 */
const { chromium } = require('playwright-core');

const APP_URL = 'http://localhost:8000/';
const SHOT_DIR = '/tmp';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

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
      // Fractions of the parcel bbox verified (via shapely) to lie inside
      // the land and clear of the existing windbreaks.
      return {
        p1: { x: rect.left + b.x + b.width * 0.4276, y: rect.top + b.y + b.height * 0.5454 },
        p2: { x: rect.left + b.x + b.width * 0.4676, y: rect.top + b.y + b.height * 0.5454 },
        bbox: { x: b.x, y: b.y, w: b.width, h: b.height },
        rect: { left: rect.left, top: rect.top, w: rect.width, h: rect.height },
      };
    });

  const drawLine = async (from, to, finishAt) => {
    await page.click('a.leaflet-draw-draw-polyline');
    await page.waitForTimeout(300);
    await page.mouse.click(from.x, from.y);
    await page.waitForTimeout(250);
    await page.mouse.click(to.x, to.y);
    await page.waitForTimeout(250);
    await page.mouse.dblclick(finishAt.x, finishAt.y, { delay: 80 });
    await page.waitForTimeout(1200);
  };

  // ================= Session 1: draw + validation =================
  await openApplyPage();
  console.log('SESSION 1 OK: apply page rendered');

  const pts = await parcelPts();
  console.log('parcel bbox:', JSON.stringify(pts.bbox));

  // 1a. line inside the parcel
  await drawLine(pts.p1, pts.p2, pts.p2);
  const s1 = await drawState();
  console.log('STEP 1a state:', JSON.stringify(s1));

  // 1b. line outside the parcels (bottom-left corner, clear of controls)
  const outPts = [
    { x: pts.rect.left + pts.rect.w * 0.05, y: pts.rect.top + pts.rect.h * 0.88 },
    { x: pts.rect.left + pts.rect.w * 0.12, y: pts.rect.top + pts.rect.h * 0.88 },
  ];
  await drawLine(outPts[0], outPts[1], outPts[1]);
  const s2 = await drawState();
  console.log('STEP 1b state:', JSON.stringify(s2));

  // 1c. draw a vertical line through the established windbreak's midpoint.
  //     Vertical in screen space means constant longitude, so the drawn
  //     segment passes exactly through the windbreak's midpoint lat/lng and
  //     must be rejected as crossing it. (Endpoints ~470 m off the
  //     windbreak - verified with shapely to stay inside the land.)
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

  const session1Ok =
    !s1.startPageVisible && s1.okChips >= 1 && s1.reviewEnabled === true &&
    !s2.startPageVisible && s2.errorChips >= 1 &&
    !s3.startPageVisible && s3.summaryText.includes('Crosses or touches');
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
    hasPending: document.body.textContent.includes('pending — not accepted yet'),
    hasStoredLine: document.body.textContent.includes('Stored in the backend'),
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
    submitted.hasPending && submitted.hasStoredLine && !submitted.startPageVisible;
  console.log(session2Ok ? 'SESSION 2: PASS' : 'SESSION 2: FAIL');

  console.log('pageerrors:', pageErrors.length ? pageErrors : 'none');
  console.log('console errors:', consoleErrors.length ? consoleErrors.slice(0, 5) : 'none');

  const pass =
    isLanding.cta && isLanding.title &&
    session1Ok && session2Ok && pageErrors.length === 0;
  console.log(pass ? 'E2E RESULT: PASS' : 'E2E RESULT: FAIL');
  await browser.close();
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('E2E crashed:', err);
  process.exit(2);
});

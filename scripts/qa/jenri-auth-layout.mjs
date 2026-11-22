import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.JENRI_QA_URL || 'http://127.0.0.1:4173';
const vectorAssets = ['jenri-logo.svg', 'google.svg', 'apple.svg', 'back.svg', 'icon-projects.svg', 'icon-team.svg', 'icon-tasks.svg', 'info.svg', 'workspace-illustration.svg', 'project-illustration.svg', 'completion-illustration.svg'];
for (const name of vectorAssets) {
  const data = await readFile(`public/jenri/${name}`, 'utf-8');
  assert.match(data, /^<svg\\b/, `${name} must be a real SVG`);
  assert.doesNotMatch(data, /<image\\b|data:image\\/|base64,/i, `${name} contains raster imagery`);
}
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const output = 'qa-artifacts/jenri-social-first';
await mkdir(output, { recursive: true });

const within = (actual, expected, tolerance, label) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} ±${tolerance}, got ${actual}`);
};
const bbox = async (page, selector) => {
  const node = page.locator(selector);
  await node.waitFor({ state: 'visible', timeout: 15000 });
  const bounds = await node.boundingBox();
  assert.ok(bounds, `No bounds for ${selector}`);
  return bounds;
};

try {
  for (const viewport of [{ width: 430, height: 932, label: 'mobile' }, { width: 1440, height: 960, label: 'desktop' }]) {
    for (const screen of [{ path: '/auth', label: 'signin', mode: 'Sign in' }, { path: '/auth/sign-up', label: 'signup', mode: 'Sign up' }]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
      const runtimeErrors = [];
      page.on('pageerror', error => runtimeErrors.push(error.message));
      await page.goto(base + screen.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator('.jenri-auth-intro').waitFor({ state: 'visible', timeout: 15000 });
      await page.locator('.jenri-social-button').first().waitFor({ state: 'visible' });

      const [google, apple, email, account] = await Promise.all([
        bbox(page, '.jenri-social-button:has-text("Google")'),
        bbox(page, '.jenri-social-button:has-text("Apple")'),
        bbox(page, 'input[aria-label="Email address"]'),
        bbox(page, '.jenri-auth-intro .jenri-auth-switch'),
      ]);
      assert.ok(google.y < apple.y && apple.y < email.y, `Invalid social-first order: ${screen.label}/${viewport.label}`);
      assert.ok(account.y < google.y, `Account switch must follow heading, above social options`);
      const fieldNames = await page.locator('.jenri-field-split input').count();
      assert.equal(fieldNames, screen.label === 'signup' ? 2 : 0, 'Name input fidelity');
      assert.equal(await page.getByRole('button', { name: 'Show password' }).count(), 1);
      assert.equal(await page.locator('.jenri-auth-separator').innerText(), 'Or');

      const header = page.locator('.jenri-auth-intro h1');
      const headingText = await header.innerText();
      if (screen.label === 'signin') assert.equal(headingText.trim(), 'Welcome back', 'Exact approved sign-in copy');
      const fontStyles = await page.evaluate(() => {
        const get = selector => getComputedStyle(document.querySelector(selector));
        return {
          headingWeight: get('.jenri-auth-intro h1').fontWeight,
          accountWeight: get('.jenri-auth-intro .jenri-auth-switch').fontWeight,
          linkWeight: get('.jenri-auth-intro .jenri-auth-switch a').fontWeight,
          fontStack: get('.jenri-auth-intro h1').fontFamily,
        };
      });
      assert.equal(fontStyles.headingWeight, '700', 'Figma heading Bold weight');
      assert.equal(fontStyles.accountWeight, '500', 'Figma account copy Medium weight');
      assert.equal(fontStyles.linkWeight, '700', 'Figma account link Bold weight');
      assert.ok(fontStyles.fontStack.includes('Circular Std') && fontStyles.fontStack.includes('DM Sans'), 'Licensed font first, stable fallback');
      const googleIcon = await bbox(page, '.jenri-social-button[data-provider="google"] img');
      const appleIcon = await bbox(page, '.jenri-social-button[data-provider="apple"] img');
      within(googleIcon.width, 18, 0.5, 'Google native vector width');
      within(googleIcon.height, 18, 0.5, 'Google native vector height');
      within(appleIcon.width, 17, 0.5, 'Apple native vector width');
      within(appleIcon.height, 21, 0.5, 'Apple native vector height');
      assert.equal(await page.locator('.jenri-social-button img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)), true, 'Social vector assets must load');


      if (viewport.label === 'mobile') {
        const logo = await bbox(page, '.jenri-auth-mobile-header .jenri-logo');
        const panel = await bbox(page, '.jenri-auth-panel');
        within(logo.width, 109, 1, 'mobile logo width');
        within(logo.height, 38, 1, 'mobile logo height');
        within(logo.y, 30, 1, 'mobile logo top');
        within(panel.y, 92, 1, 'mobile white panel top');
        within(panel.width, 430, 1, 'mobile panel width');
        if (screen.label === 'signin') {
          const h1 = await bbox(page, '.jenri-auth-intro h1');
          within(h1.y, 163, 2, 'mobile sign-in heading top');
          within(h1.x + h1.width / 2, viewport.width / 2, 1, 'mobile heading centered');
          assert.ok(h1.height <= 32, 'Welcome back should occupy one line, not wrap');
          assert.equal(await page.locator('.jenri-forgot').isVisible(), false);
          const style = await page.locator('.jenri-primary-button').evaluate(el => getComputedStyle(el).backgroundImage);
          assert.equal(style, 'none', 'Sign-in mobile CTA must be flat brown');
        }
      } else {
        const photo = await bbox(page, '.jenri-auth-photo');
        within(photo.x, 24, 1, 'desktop photo x');
        within(photo.width, 640, 2, 'desktop photo width');
        within(photo.height, 912, 2, 'desktop photo height');
        if (screen.label === 'signin') {
          assert.equal(await page.locator('.jenri-forgot').isVisible(), true, 'Forgot link visible on desktop');
          const logo = await bbox(page, '.jenri-auth-photo .jenri-logo');
          within(logo.height, 38, 2, 'desktop wordmark height');
        }
      }
      assert.deepEqual(runtimeErrors, [], `Uncaught browser errors: ${screen.label}/${viewport.label}`);
      await page.screenshot({ path: `${output}/${screen.label}-${viewport.label}.png`, fullPage: true });
      console.log(`PASS ${screen.label} ${viewport.label}: logo, panel, social order, inputs, responsive geometry`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}

#!/usr/bin/env node
/**
 * End-to-end smoke test: starts Vite in mock mode (MSW, no backend) and
 * clicks through every screen in a real Chrome. Fails on a broken flow or
 * any console error.
 *
 *   pnpm smoke                 # uses your installed Chrome
 *   CHROME_PATH=/path pnpm smoke
 *   SMOKE_SHOTS=1 pnpm smoke   # also saves a screenshot per step
 */
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

process.env.VITE_MOCK_API = '1';
const SHOTS = process.env.SMOKE_SHOTS ? join(tmpdir(), 'remy-smoke') : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const server = await createServer({ logLevel: 'error', server: { port: 5190, strictPort: false, host: '127.0.0.1' } });
await server.listen();
const base = server.resolvedUrls?.local[0] ?? 'http://127.0.0.1:5190/';

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' },
);
// The mock user lives in Tashkent; the fixtures are built in the browser's zone.
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tashkent' });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

let step = 0;
let failed = false;
async function check(name, fn) {
  step += 1;
  try {
    await fn();
    if (errors.length) throw new Error(errors.splice(0).join('\n'));
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `${String(step).padStart(2, '0')}-${name.replace(/\W+/g, '-')}.png`) });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed = true;
    console.log(`  ✗ ${name}\n    ${String(error.message ?? error).split('\n').join('\n    ')}`);
    await page.screenshot({ path: join(tmpdir(), `remy-smoke-failed-${step}.png`) }).catch(() => {});
  }
}

const mainButton = () => page.locator('[data-dev-chrome] button').last();
const toast = () => page.locator('[role=status]');
const open = async (hash, query = '') => {
  await page.goto(`${base}${query}#${hash}`);
  await page.waitForLoadState('networkidle');
};
/** Polls until the text matches (saves and toasts land a moment later). */
const expectText = async (locator, pattern, timeout = 5000) => {
  const until = Date.now() + timeout;
  let text = '';
  while (Date.now() < until) {
    text = (await locator.first().textContent({ timeout }).catch(() => '')) ?? '';
    if (pattern.test(text)) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`expected ${pattern}, got "${text}"`);
};

console.log(`Remy smoke test on ${base}`);

await check('Today opens in Timeline with blocks and a NOW line', async () => {
  await open('/');
  await page.locator('[data-block]').first().waitFor();
  await page.locator('[data-now]').waitFor();
});

await check('List view groups the day', async () => {
  await page.getByRole('radio', { name: 'List' }).click();
  await page.getByText(/^Later today · \d+/).waitFor();
  await page.getByText(/^Overdue · \d+/).waitFor();
});

await check('Done on a one-off, then Undo', async () => {
  const row = page.locator('div[role=button]', { hasText: 'Send standup' });
  await row.getByRole('button', { name: 'Mark as done' }).click();
  await expectText(toast(), /^Done: Send standup/);
  await toast().getByRole('button', { name: 'Undo' }).click();
  await row.getByRole('button', { name: 'Mark as done' }).waitFor();
});

await check('Detail opens; a sheet closes on Back without leaving', async () => {
  await page.locator('div[role=button]', { hasText: 'Call the dentist' }).first().click();
  await page.getByRole('textbox', { name: 'Title' }).waitFor();
  await expectText(mainButton(), /Mark as done/);
  await page.getByRole('button', { name: /^When/ }).click();
  await page.getByRole('dialog').waitFor();
  await page.locator('[data-dev-chrome] button', { hasText: 'Back' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  if (!page.url().includes('#/tasks/')) throw new Error(`left Detail: ${page.url()}`);
});

await check('Priority saves from its sheet', async () => {
  await page.getByRole('button', { name: /^Priority/ }).click();
  await page.getByRole('dialog').getByText('Low', { exact: true }).click();
  await expectText(page.getByRole('button', { name: /^Priority/ }), /Low/);
});

await check('Back returns to Today', async () => {
  await page.locator('[data-dev-chrome] button', { hasText: 'Back' }).click();
  await page.getByText('September').or(page.locator('h1')).first().waitFor();
  if (!/#\/?$/.test(page.url())) throw new Error(`not on Today: ${page.url()}`);
});

await check('Create turns a sentence into tokens and adds it', async () => {
  await open('/create');
  await page.getByRole('textbox', { name: /What should Remy/ }).fill('call mom tomorrow at 5 every week #personal');
  await page.getByRole('button', { name: /^or 0?5:00/ }).click({ timeout: 5000 });
  await expectText(page.getByLabel('What Remy understood'), /05:00.*Every week.*Personal/);
  await mainButton().click();
  await expectText(toast(), /^Added for Tomorrow 05:00/);
});

await check('Catch-up handles a card', async () => {
  await open('/catchup');
  const first = await page.locator('article h2').textContent();
  await page.locator('article').getByRole('button', { name: 'Done' }).click();
  await page.waitForFunction((title) => document.querySelector('article h2')?.textContent !== title, first);
});

await check('Week shows seven days and the Inbox', async () => {
  await open('/week');
  await page.getByText('Buy new headphones').waitFor();
  const rows = await page.locator('main button', { hasText: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/ }).count();
  if (rows < 7) throw new Error(`expected 7 day rows, got ${rows}`);
});

await check('Search finds by words', async () => {
  await open('/search');
  await page.getByRole('searchbox', { name: 'Search reminders' }).fill('dent');
  await page.locator('main').getByText('Call the dentist to move the appointment').waitFor();
});

await check('Settings and Quiet hours load', async () => {
  await open('/settings');
  await page.getByText('Morning brief').waitFor();
  await page.getByRole('button', { name: /^Quiet hours/ }).click();
  await page.getByText('Quiet hours & nudges').waitFor();
});

await check('Categories editor adds one', async () => {
  await open('/settings/categories');
  await page.getByRole('button', { name: 'New category' }).click();
  await page.getByRole('dialog').locator('input').first().fill('Study');
  await page.getByRole('button', { name: 'Add category' }).click();
  await page.getByText('Study', { exact: true }).waitFor();
});

await check('Light theme renders Today, remembering the view', async () => {
  // A new query string reloads the page; List was chosen earlier and is kept.
  await open('/', '?theme=light');
  await page.getByText(/^Later today · \d+/).waitFor();
  await page.getByRole('radio', { name: 'Timeline' }).click();
  await page.locator('[data-block]').first().waitFor();
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  if (theme !== 'light') throw new Error(`data-theme is ${theme}`);
});

await browser.close();
await server.close();
console.log(failed ? '\nSmoke test FAILED (screenshots in the temp dir)' : `\nAll ${step} checks passed${SHOTS ? ` (screenshots in ${SHOTS})` : ''}`);
process.exit(failed ? 1 : 0);

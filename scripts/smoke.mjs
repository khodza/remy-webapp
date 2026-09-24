#!/usr/bin/env node
/**
 * End-to-end smoke test: starts Vite in mock mode (MSW, no backend) and
 * clicks through every screen in a real Chrome. Fails on a broken flow or
 * any console error.
 *
 *   pnpm smoke                 # uses your installed Chrome
 *   CHROME_PATH=/path pnpm smoke   # any Chromium binary (CI, a Playwright download)
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
// The webfont comes from Google; a runner without that network (or behind a
// TLS-inspecting proxy) would log a console error on every fresh load. The
// flows do not need it, so serve an empty stylesheet instead.
await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
  route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
);

const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  // Chrome logs every non-2xx response; a 422 is the parser's designed
  // answer to text that holds no reminder, not a broken flow.
  if (message.type() === 'error' && !/Failed to load resource: .*\b422\b/.test(message.text())) {
    errors.push(`console: ${message.text()}`);
  }
});

let step = 0;
let failed = false;
async function check(name, fn) {
  step += 1;
  try {
    await fn();
    if (errors.length) throw new Error(errors.splice(0).join('\n'));
    if (SHOTS)
      await page.screenshot({ path: join(SHOTS, `${String(step).padStart(2, '0')}-${name.replace(/\W+/g, '-')}.png`) });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed = true;
    console.log(
      `  ✗ ${name}\n    ${String(error.message ?? error)
        .split('\n')
        .join('\n    ')}`,
    );
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
    text =
      (await locator
        .first()
        .textContent({ timeout })
        .catch(() => '')) ?? '';
    if (pattern.test(text)) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`expected ${pattern}, got "${text}"`);
};

console.log(`Remy smoke test on ${base}`);

await check('Today opens in Timeline with blocks, a NOW line and the all-day strip', async () => {
  await open('/');
  await page.locator('[data-block]').first().waitFor();
  await page.locator('[data-now]').waitFor();
  // A date with no time sits above the hour grid, not at 09:00 in it.
  await page.locator('[data-all-day]').getByText('Sort out the visa papers').waitFor();
});

await check('List view groups the day; a repeating task done today stays in Done', async () => {
  await page.getByRole('radio', { name: 'List' }).click();
  await page.getByText(/^Later today · \d+/).waitFor();
  await page.getByText(/^Overdue · \d+/).waitFor();
  // Gap 1: Vitamins was ticked this morning; its series is on tomorrow.
  await page.getByText(/^Done · \d+/).waitFor();
  const vitamins = page.locator('div[role=button]', { hasText: 'Vitamins' }).first();
  await vitamins.waitFor();
  await vitamins.getByRole('button', { name: 'Mark as not done' }).click();
  await expectText(toast(), /^Already done\. Next: /);
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

await check('Detail of a repeating task: history, × N times, Show source message', async () => {
  await page.locator('div[role=button]', { hasText: 'Vitamins' }).first().click();
  await page.getByText(/^Done 12 times/).waitFor();
  await page
    .getByText(/done \d{1,2}:\d{2}/)
    .first()
    .waitFor();
  await page.getByRole('button', { name: 'Show source message' }).click();
  await expectText(toast(), /^Sent to the chat/);
  // "× 12 times" is edited in the Repeat sheet.
  await page.locator('[data-dev-chrome] button', { hasText: 'Back' }).click();
  await page.locator('div[role=button]', { hasText: 'Pay the electricity bill' }).first().click();
  await expectText(page.getByRole('button', { name: /^Repeat/ }), /Every month × 12 times/);
  await page.getByRole('button', { name: /^Repeat/ }).click();
  await page.getByRole('button', { name: 'More times' }).click();
  await page.getByRole('button', { name: 'Set how many times' }).click();
  await expectText(page.getByRole('button', { name: /^Repeat/ }), /× 13 times/);
  await page.locator('[data-dev-chrome] button', { hasText: 'Back' }).click();
});

await check('Create turns a sentence into tokens and adds it', async () => {
  await open('/create');
  await page.getByRole('textbox', { name: /What should Remy/ }).fill('call mom tomorrow at 5 every week #personal');
  await page.getByRole('button', { name: /^or 0?5:00/ }).click({ timeout: 5000 });
  await expectText(page.getByLabel('What Remy understood'), /05:00.*Every week.*Personal/);
  await mainButton().click();
  await expectText(toast(), /^Added for Tomorrow 05:00/);
});

await check('Create: a sentence with two reminders becomes a list, added together', async () => {
  await open('/create');
  await page.getByRole('textbox', { name: /What should Remy/ }).fill('buy oat milk; call the bank tomorrow at 11');
  await page.getByText(/^2 reminders · 2 to add/).waitFor({ timeout: 5000 });
  await expectText(mainButton(), /Add 2 reminders/);
  await mainButton().click();
  await expectText(toast(), /^Added 2 reminders/);
});

await check('Create: small talk is refused with the reason, and can still be added', async () => {
  await open('/create');
  await page.getByRole('textbox', { name: /What should Remy/ }).fill('hello there');
  await expectText(page.locator('[data-parse-rejected]'), /doesn't look like a reminder/);
  await expectText(mainButton(), /Add to Inbox/);
});

await check('Catch-up handles a card', async () => {
  await open('/catchup');
  const first = await page.locator('article h2').textContent();
  await page.locator('article').getByRole('button', { name: 'Done' }).click();
  await page.waitForFunction((title) => document.querySelector('article h2')?.textContent !== title, first);
});

await check('Catch-up skips this occurrence of a repeating task', async () => {
  // The electricity bill (monthly) is next in the stack.
  await page.locator('article h2', { hasText: 'Pay the electricity bill' }).waitFor();
  await page.getByRole('button', { name: 'Skip this time →' }).click();
  await expectText(toast(), /^Skipped\. Next: /);
});

await check('Week shows seven days and the Inbox grouped by list', async () => {
  await open('/week');
  await page.getByText('Buy new headphones').waitFor();
  const rows = await page.locator('main button', { hasText: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/ }).count();
  if (rows < 7) throw new Error(`expected 7 day rows, got ${rows}`);
  await page.locator('[data-inbox-list=shopping]').getByText('Olive oil').waitFor();
  // The chip filters the Inbox to one list.
  await page.getByRole('button', { name: /^Shopping · \d/ }).click();
  await page.locator('[data-inbox-list=none]').waitFor({ state: 'detached' });
  await page.locator('[data-inbox-list=shopping]').getByText('Milk', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.locator('[data-inbox-list=none]').waitFor();
});

await check('Search asks the server, open and done', async () => {
  await open('/search');
  await page.getByRole('searchbox', { name: 'Search reminders' }).fill('dent');
  await page.locator('main').getByText('Call the dentist to move the appointment').waitFor();
  await page.getByRole('searchbox', { name: 'Search reminders' }).fill('landlord');
  await page.getByText(/^Done · 1/).waitFor();
  await page.locator('main').getByText('Reply to the landlord').waitFor();
});

await check('Settings and Quiet hours load', async () => {
  await open('/settings');
  await page.getByText('Morning brief', { exact: true }).waitFor();
  await page.getByRole('switch', { name: 'Voice brief' }).waitFor();
  await page.getByRole('switch', { name: 'Pinned agenda in chat' }).waitFor();
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

await check('Calendar feed turns on, shows a link, and a new link replaces it', async () => {
  await open('/settings/calendar');
  await page.getByRole('switch', { name: 'Calendar feed' }).click();
  const link = page.getByRole('textbox', { name: 'Calendar link' });
  await link.waitFor();
  const first = await link.inputValue();
  if (!/\/api\/v1\/calendar\/[A-Za-z0-9_-]{43}\.ics$/.test(first)) throw new Error(`odd link: ${first}`);
  await page.getByRole('button', { name: 'Get a new link' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Get a new link' }).click();
  await page.waitForFunction(
    (old) => document.querySelector('input[aria-label="Calendar link"]')?.value !== old,
    first,
  );
});

await check('Export sends a file to the chat, the calendar file too', async () => {
  await open('/settings');
  await page.getByRole('button', { name: /^Export/ }).click();
  await page.getByRole('dialog').getByText('Spreadsheet (CSV)').click();
  await expectText(toast(), /^Sent remy-\d{4}-\d{2}-\d{2}\.csv to your chat/);
  await page.getByRole('button', { name: /^Export/ }).click();
  await page.getByRole('dialog').getByText('Calendar file (.ics)').click();
  await expectText(toast(), /^Sent remy-\d{4}-\d{2}-\d{2}\.ics to your chat \(\d+ reminders\)/);
});

await check('Import reads a list, skips one line, and adds the rest', async () => {
  await open('/settings/import');
  await page
    .getByRole('textbox', { name: 'Your list' })
    .fill('- buy milk\n- dentist tomorrow at 10\n- renew passport someday');
  await mainButton().click();
  await page.getByText(/^3 found · 3 to add/).waitFor();
  await page.getByRole('button', { name: /^Skip Renew passport/ }).click();
  await expectText(mainButton(), /Add 2 reminders/);
  await mainButton().click();
  await expectText(toast(), /^Added 2 reminders/);
  if (!/#\/?$/.test(page.url())) throw new Error(`not back on Today: ${page.url()}`);
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

await check('Delete all data needs DELETE typed, then Today is empty', async () => {
  await open('/settings');
  await page.getByRole('button', { name: /^Delete all data/ }).click();
  const button = page.getByRole('button', { name: 'Delete everything' });
  if (!(await button.isDisabled())) throw new Error('Delete everything was enabled before DELETE was typed');
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await button.click();
  await expectText(toast(), /^Deleted \d+ tasks\. Remy starts fresh\./);
  if (!/#\/?$/.test(page.url())) throw new Error(`not back on Today: ${page.url()}`);
  await page.getByText('Nothing left today.').waitFor();
  const blocks = await page.locator('[data-block]').count();
  if (blocks !== 0) throw new Error(`expected an empty Today, got ${blocks} blocks`);
});

await browser.close();
await server.close();
console.log(
  failed
    ? '\nSmoke test FAILED (screenshots in the temp dir)'
    : `\nAll ${step} checks passed${SHOTS ? ` (screenshots in ${SHOTS})` : ''}`,
);
process.exit(failed ? 1 : 0);

import { expect, test, type Page } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const screenshots = path.resolve('docs/screenshots');
async function shot(page: Page, name: string) {
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: path.join(screenshots, `${name}.png`), animations: 'disabled' });
}
async function demo(page: Page, injection = false) {
  await page.goto('/');
  await page.getByRole('button', { name: injection ? 'Load injection demo' : 'Load synthetic demo', exact: true }).click();
  await page.getByRole('button', { name: 'Analyse with local Gemma', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Client requests and verified brief evidence' })).toBeVisible();
}

test('E1 recorded demo, deterministic pricing edits, approval, Markdown and HTML exports', async ({ page }) => {
  await demo(page);
  await expect(page.getByText('FIXTURE MODE: replaying recorded output, not a live model call.', { exact: true })).toBeVisible();
  await expect(page.getByText(/recorded: gemma-4-e2b-it-q4_0/)).toBeVisible();
  const rows = page.getByRole('table', { name: 'Client requests and verified brief evidence' }).locator('tbody tr');
  // The recorded E2B output has four requests, including its own interpretation
  // of the tagline as extra work. Keep that honest; never improve the fixture.
  await expect(rows).toHaveCount(4);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'results-demo-1');
  await page.getByLabel('Row 1 hours', { exact: true }).fill('3');
  await expect(page.getByLabel('Row 1 hours', { exact: true })).toHaveValue('3');
  await expect(page.getByTestId('row-I1').locator('.amount')).toContainText('SGD 240.00');
  await expect(page.getByTestId('order-total')).toHaveText('SGD 0.00');
  await page.getByRole('button', { name: 'Approve all remaining', exact: true }).click();
  // Hand calculation from demo-1's rate card and the recorded output:
  // tagline: edited 3 h × SGD 80; social kit: 1 × SGD 350;
  // menu board: effort s = 1.5 h × SGD 80. Clarification costs nothing.
  const expectedMinor = 3 * 8000 + 35000 + 1.5 * 8000;
  expect(expectedMinor).toBe(71000);
  const expectedTotal = 'SGD 710.00';
  await expect(page.getByTestId('order-total')).toHaveText(expectedTotal);
  // Falsify a UI that displays a static total after subsequent edits.
  await page.getByLabel('Row 1 hours', { exact: true }).fill('2');
  await expect(page.getByTestId('order-total')).toHaveText('SGD 630.00');
  await page.getByLabel('Row 1 hours', { exact: true }).fill('3');
  await expect(page.getByTestId('order-total')).toHaveText(expectedTotal);
  await page.getByRole('heading', { name: '3 Change order' }).scrollIntoViewIfNeeded();
  await shot(page, 'change-order-panel');
  const md = page.getByRole('textbox', { name: 'Editable Markdown' });
  await md.fill((await md.inputValue()) + '\nA personal note for the fictional client.\n');
  const mdDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .md', exact: true }).click();
  const downloaded = await mdDownload;
  expect(downloaded.suggestedFilename()).toMatch(/^change-order-SF-[a-f0-9]{8}\.md$/);
  const content = await readFile((await downloaded.path())!, 'utf8');
  expect(content).toContain(expectedTotal);
  expect(content).toContain('A personal note for the fictional client.');
  await page.getByLabel('Row 1 hours', { exact: true }).fill('4');
  await expect(md).toHaveValue(content);
  const regenerate = page.getByRole('button', { name: 'Regenerate from table (overwrites your text edits)', exact: true });
  await expect(regenerate).toBeVisible();
  const htmlDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .html', exact: true }).click();
  const htmlFile = await htmlDownload;
  expect(htmlFile.suggestedFilename()).toMatch(/^change-order-SF-[a-f0-9]{8}\.html$/);
  const html = await readFile((await htmlFile.path())!, 'utf8');
  expect(html).toContain('SGD 790.00');
  expect(html).not.toContain('A personal note for the fictional client.');
  expect(html).not.toMatch(/<script\b/i);
  await regenerate.click();
  await expect(md).toHaveValue(/SGD 790\.00/);
  await expect(md).not.toHaveValue(/A personal note/);
});

test('E2 injection demo is amber and has no Included label', async ({ page }) => {
  await demo(page, true);
  await expect(page.getByTestId('injection-banner')).toBeVisible();
  await expect(page.getByTestId('injection-banner')).toHaveCSS('background-color', 'rgb(255, 248, 232)');
  await expect(page.locator('tbody tr[data-label="included"]')).toHaveCount(0);
  await expect(page.locator('.message-copy .injection-mark')).not.toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'injection-demo');
});

test('E3 live server with closed model port shows startup command and keeps inputs', async ({ page }) => {
  await page.goto('http://127.0.0.1:5180');
  await expect(page.getByText('Local model is not running', { exact: true })).toBeVisible();
  await expect(page.getByText('Local model is not running. Start it in a terminal: pnpm model:start', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Load synthetic demo', exact: true }).click();
  const original = await page.getByRole('textbox', { name: 'Brief', exact: true }).inputValue();
  await page.getByRole('button', { name: 'Analyse with local Gemma', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('pnpm model:start');
  await expect(page.getByRole('textbox', { name: 'Brief', exact: true })).toHaveValue(original);
  await expect(page.getByText('FIXTURE MODE:', { exact: false })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'model-unreachable');
});

test('E4 exports wait for every row; invalid hours block export; exclusion and re-include work', async ({ page }) => {
  await demo(page);
  await expect(page.getByRole('button', { name: 'Download .md', exact: true })).toBeDisabled();
  await expect(page.getByText('Review 4 more rows', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Row 1 Approve', exact: true }).click();
  await expect(page.getByText('Review 3 more rows', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Row 1 Exclude', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Row 1 Re-include', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Row 1 Approve', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Row 1 Re-include', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Row 1 Approve', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Approve all remaining', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download .md', exact: true })).toBeEnabled();
  await page.getByLabel('Row 1 hours', { exact: true }).fill('0');
  await expect(page.getByText('hours_invalid', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download .md', exact: true })).toBeDisabled();
  await page.getByLabel('Row 1 hours', { exact: true }).fill('2.5');
  await expect(page.getByRole('button', { name: 'Download .md', exact: true })).toBeEnabled();
});

test('E5 filter shows only needs-clarification rows and selecting evidence highlights quotes', async ({ page }) => {
  await demo(page);
  await page.getByRole('button', { name: 'Select row 1 evidence', exact: true }).click();
  await expect(page.locator('.clauses mark')).toHaveText('Develop one selected logo with the bakery tagline.');
  await expect(page.locator('.message-copy mark[data-selected="true"]')).toHaveText("Please don't change the logo, just make the tagline a bit bigger.");
  await page.getByRole('button', { name: 'Needs clarification 1', exact: true }).click();
  await expect(page.locator('.evidence-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.evidence-table tbody tr')).toHaveAttribute('data-label', 'needs_clarification');
  await expect(page.getByRole('textbox', { name: 'Row 4 question', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'All 4', exact: true }).click();
  await expect(page.locator('.evidence-table tbody tr')).toHaveCount(4);
});

test('empty, delayed real fixture request and Cancel restore the previous reviewed analysis', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText("Paste the agreed brief and the client's new message, or load the synthetic demo.", { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analyse with local Gemma', exact: true })).toBeDisabled();
  await shot(page, 'empty');
  await demo(page);
  await page.getByRole('button', { name: 'Approve all remaining', exact: true }).click();
  await expect(page.getByTestId('order-total')).toHaveText('SGD 510.00');
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/analyse', async route => {
    // Hold the request only to inspect the deliberate loading/abort UI. The
    // eventual response still comes from the real fixture-mode local server.
    await held;
    await route.continue().catch(() => {});
  });
  await page.getByRole('button', { name: 'Analyse with local Gemma', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Analysing' })).toBeVisible();
  await expect(page.getByText('Usually about a minute on this laptop.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Gemma is reading.*1 s/ })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'loading');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  release();
  await expect(page.getByRole('status', { name: 'Analysing' })).toHaveCount(0);
  await expect(page.getByTestId('order-total')).toHaveText('SGD 510.00');
  await expect(page.getByRole('button', { name: 'Download .md', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Row 1 Approve', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('only the rate card persists, and it can be forgotten', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load synthetic demo', exact: true }).click();
  await page.getByRole('textbox', { name: 'Hourly rate', exact: true }).fill('95.25');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Hourly rate', exact: true })).toHaveValue('95.25');
  await expect(page.getByRole('textbox', { name: 'Brief', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Client message', exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Forget saved rate card', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('scopefence.rate_card.v1'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Hourly rate', exact: true })).toHaveValue('80.00');
});

for (const fault of [
  { code: 'model_busy', status: 429, copy: 'Another analysis is still running. Wait for it to finish.' },
  { code: 'model_timeout', status: 504, copy: 'The model took longer than 4 minutes. Try a shorter message or restart the model.' },
  { code: 'model_output_invalid', status: 502, copy: 'Gemma did not return valid structured output after 3 attempts.' },
  { code: 'fixture_missing', status: 404, copy: 'No recorded fixture matches these inputs. Load a synthetic demo or switch to live mode.' },
]) {
  test(`API fault ${fault.code} has actionable copy and preserves inputs`, async ({ page }) => {
    // These are injected HTTP failures, not fabricated Gemma analyses.
    await page.route('**/api/analyse', route => route.fulfill({ status: fault.status, contentType: 'application/json', body: JSON.stringify({ error: { code: fault.code, ...(fault.code === 'model_output_invalid' ? { attempts: 3, raw: 'synthetic invalid-output fault' } : {}) } }) }));
    await page.goto('/');
    await page.getByRole('button', { name: 'Load synthetic demo', exact: true }).click();
    const original = await page.getByRole('textbox', { name: 'Client message', exact: true }).inputValue();
    await page.getByRole('button', { name: 'Analyse with local Gemma', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(fault.copy);
    await expect(page.getByRole('textbox', { name: 'Client message', exact: true })).toHaveValue(original);
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
    if (fault.code === 'model_output_invalid') {
      await page.getByText('Show raw output', { exact: true }).click();
      await expect(page.getByText('synthetic invalid-output fault', { exact: true })).toBeVisible();
    }
  });
}

test('rate validation uses the domain contract, and inputs-changed keeps the table', async ({ page }) => {
  await demo(page);
  await page.getByRole('textbox', { name: 'Hourly rate', exact: true }).fill('80.001');
  await expect(page.getByText('Hourly rate must be a positive amount with at most 2 decimals.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analyse with local Gemma', exact: true })).toBeDisabled();
  await expect(page.locator('.evidence-table tbody tr')).toHaveCount(4);
  await expect(page.getByText('Inputs changed since this analysis. Re-analyse to update.', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Hourly rate', exact: true }).fill('80');
  await expect(page.getByRole('button', { name: 'Analyse with local Gemma', exact: true })).toBeEnabled();
  const brief = page.getByRole('textbox', { name: 'Brief', exact: true });
  await brief.fill((await brief.inputValue()) + '\nA new clause added after analysis.');
  await expect(page.getByText('Inputs changed since this analysis. Re-analyse to update.', { exact: true })).toBeVisible();
  await expect(page.locator('.evidence-table tbody tr')).toHaveCount(4);
});

test('workspace stacks below 900px and row evidence is keyboard accessible', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await demo(page);
  const inputs = await page.getByRole('region', { name: '1 The agreed scope' }).boundingBox();
  const results = await page.getByRole('group', { name: 'Analysis results', exact: true }).boundingBox();
  expect(inputs).not.toBeNull(); expect(results).not.toBeNull();
  expect(results!.y).toBeGreaterThan(inputs!.y + inputs!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const select = page.getByRole('button', { name: 'Select row 3 evidence', exact: true });
  await select.focus(); await page.keyboard.press('Enter');
  await expect(select).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.clauses mark')).toHaveText('Design one A2 menu board.');
});

import {
  accountSetting,
  openProject,
  putBackAccountSetting,
  resetLayout,
  showPanel,
} from './helpers';
import { expect, test } from './test';

/** The tips put away are an account setting, which outlives tests (and the CI retry). */
let dismissed: unknown;
test.beforeEach(async ({ page }) => {
  dismissed = await accountSetting(page, 'tips.dismissed');
});
test.afterEach(async ({ page }) => {
  await putBackAccountSetting(page, 'tips.dismissed', dismissed);
});

test('a panel tip shows until put away, and stays away', async ({ page }) => {
  await openProject(page, 'pong');
  await page.waitForURL(/\/project\//);
  await resetLayout(page);
  await showPanel(page, 'History');
  const panel = page.getByRole('region', { name: 'History', exact: true });
  const tip = panel.getByRole('complementary', { name: 'Tip' });
  await expect(tip).toContainText('The steps of what you are working on.');
  await expect(tip.getByRole('link', { name: 'Learn more' })).toHaveAttribute(
    'href',
    'https://docs.nanoforge.eu/docs/editor/overview',
  );
  await tip.getByRole('button', { name: 'Got it' }).click();
  await expect(tip).toHaveCount(0);
  /** Account settings are pushed after 500 ms. */
  await page.waitForTimeout(900);
  await page.reload();
  await showPanel(page, 'History');
  await expect(page.getByRole('region', { name: 'History', exact: true })).toBeVisible();
  await expect(tip).toHaveCount(0);
  await resetLayout(page);
});

import { expect, test } from '@playwright/test';

test('home page has expected span', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('span')).toBeVisible();
});

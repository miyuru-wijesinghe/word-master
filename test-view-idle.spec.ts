import { test, expect } from '@playwright/test';

test.describe('View Page Idle State', () => {
  test('remains on ready message without incoming events', async ({ page }) => {
    await page.goto('/view');

    const readyMessage = page.getByTestId('view-ready-message');
    await expect(readyMessage).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(5000);

    await expect(readyMessage).toBeVisible();
    const timerText = page.locator('text=/\\d+:\\d+/').first();
    await expect(timerText).toBeHidden({ timeout: 1000 });
  });
});


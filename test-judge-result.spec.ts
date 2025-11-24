import { test, expect } from '@playwright/test';

test.describe('Judge Result Display', () => {
  test('Spelled Word should be displayed on View and Control screens after Send Result Now', async ({ page, context }) => {
    // Open Control Panel in first tab
    await page.goto('http://localhost:5173/action');
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Control Panel")', { timeout: 10000 });
    
    // Open Judge Page in new tab
    const judgePage = await context.newPage();
    await judgePage.goto('http://localhost:5173/judge');
    await judgePage.waitForSelector('h1:has-text("Judge Console")', { timeout: 10000 });
    
    // Open View Page in new tab
    const viewPage = await context.newPage();
    await viewPage.goto('http://localhost:5173/view');
    await viewPage.waitForSelector('text=Word Master', { timeout: 10000 });
    
    // Simulate: Select a word and start timer (if Firestore is enabled, create quiz first)
    // For now, we'll assume there's data or we'll create it
    
    // On Judge Page: Type a word
    const testWord = 'TestWord123';
    await judgePage.fill('textarea[placeholder*="word"]', testWord);
    await judgePage.waitForTimeout(500); // Wait for state update
    
    // Click "Send Result Now" button
    await judgePage.click('button:has-text("Send Result Now")');
    await judgePage.waitForTimeout(1000); // Wait for message to be sent
    
    // Check Control Panel: Spelled Word should be visible
    await page.waitForTimeout(2000); // Wait for message to arrive
    const controlPanelSpelledWord = await page.locator('text=Spelled Word').locator('..').locator('p').last();
    await expect(controlPanelSpelledWord).toBeVisible({ timeout: 5000 });
    const controlSpelledText = await controlPanelSpelledWord.textContent();
    console.log('Control Panel Spelled Word:', controlSpelledText);
    expect(controlSpelledText).toBe(testWord);
    
    // Check View Page: Spelled Word should be visible
    await viewPage.waitForTimeout(2000); // Wait for message to arrive
    const viewPageSpelledWord = await viewPage.locator('text=Spelled Word').locator('..').locator('p').last();
    await expect(viewPageSpelledWord).toBeVisible({ timeout: 5000 });
    const viewSpelledText = await viewPageSpelledWord.textContent();
    console.log('View Page Spelled Word:', viewSpelledText);
    expect(viewSpelledText).toBe(testWord);
    
    // Cleanup
    await judgePage.close();
    await viewPage.close();
  });
  
  test('Spelled Word should show — when empty', async ({ page, context }) => {
    // Open Control Panel
    await page.goto('http://localhost:5173/action');
    await page.waitForSelector('h1:has-text("Control Panel")', { timeout: 10000 });
    
    // Open Judge Page
    const judgePage = await context.newPage();
    await judgePage.goto('http://localhost:5173/judge');
    await judgePage.waitForSelector('h1:has-text("Judge Console")', { timeout: 10000 });
    
    // Open View Page
    const viewPage = await context.newPage();
    await viewPage.goto('http://localhost:5173/view');
    await viewPage.waitForSelector('text=Word Master', { timeout: 10000 });
    
    // Don't type anything, just click Send Result Now
    await judgePage.click('button:has-text("Send Result Now")');
    await judgePage.waitForTimeout(1000);
    
    // Check Control Panel: Should show —
    await page.waitForTimeout(2000);
    const controlPanelSpelledWord = await page.locator('text=Spelled Word').locator('..').locator('p').last();
    await expect(controlPanelSpelledWord).toBeVisible({ timeout: 5000 });
    const controlSpelledText = await controlPanelSpelledWord.textContent();
    expect(controlSpelledText?.trim()).toBe('—');
    
    // Check View Page: Should show —
    await viewPage.waitForTimeout(2000);
    const viewPageSpelledWord = await viewPage.locator('text=Spelled Word').locator('..').locator('p').last();
    await expect(viewPageSpelledWord).toBeVisible({ timeout: 5000 });
    const viewSpelledText = await viewPageSpelledWord.textContent();
    expect(viewSpelledText?.trim()).toBe('—');
    
    await judgePage.close();
    await viewPage.close();
  });
});


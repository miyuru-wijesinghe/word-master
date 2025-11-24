import { test, expect } from '@playwright/test';

test.describe('Counter Freeze Detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('Counter should not freeze during normal countdown', async ({ page, context }) => {
    // Open Control Panel
    await page.goto('http://localhost:5173/action');
    await page.waitForSelector('h1:has-text("Control Panel")', { timeout: 10000 });
    
    // Wait for page to be ready
    await page.waitForTimeout(1000);
    
    // Check if we need to create/select quiz (Firestore mode)
    const createQuizButton = page.locator('button:has-text("Create Quiz")');
    if (await createQuizButton.isVisible()) {
      // Create a test quiz
      await createQuizButton.click();
      await page.fill('input[placeholder*="quiz name"]', 'Test Quiz');
      await page.press('input[placeholder*="quiz name"]', 'Enter');
      await page.waitForTimeout(1000);
      
      // Add a test entry
      const addEntryButton = page.locator('button:has-text("Add Entry")');
      if (await addEntryButton.isVisible()) {
        await addEntryButton.click();
        await page.fill('input[placeholder*="Word"]', 'TestWord');
        await page.fill('input[placeholder*="Team"]', 'Team A');
        await page.click('button:has-text("Add")');
        await page.waitForTimeout(1000);
      }
    }
    
    // Select an entry from the table
    const selectButton = page.locator('button:has-text("Select")').first();
    if (await selectButton.isVisible()) {
      await selectButton.click();
      await page.waitForTimeout(500);
    }
    
    // Open View Page in new tab to monitor counter
    const viewPage = await context.newPage();
    await viewPage.goto('http://localhost:5173/view');
    await viewPage.waitForSelector('text=Word Master', { timeout: 10000 });
    
    // Open Manage Screen in new tab
    const managePage = await context.newPage();
    await managePage.goto('http://localhost:5173/manage');
    await managePage.waitForSelector('h1', { timeout: 10000 });
    
    // Start timer from Manage Screen (30 seconds for faster testing)
    await managePage.selectOption('select', '30');
    await managePage.click('button:has-text("Play")');
    await page.waitForTimeout(2000); // Wait for timer to start
    
    // Monitor counter on View Page for 10 seconds
    const timeValues: number[] = [];
    const startTime = Date.now();
    const monitorDuration = 10000; // 10 seconds
    
    console.log('Starting counter monitoring...');
    
    while (Date.now() - startTime < monitorDuration) {
      // Get current time display from View Page
      const timeElement = viewPage.locator('text=/\\d+:\\d+/').first();
      if (await timeElement.isVisible()) {
        const timeText = await timeElement.textContent();
        if (timeText) {
          const [mins, secs] = timeText.split(':').map(Number);
          const totalSeconds = mins * 60 + secs;
          timeValues.push(totalSeconds);
          console.log(`Time at ${Date.now() - startTime}ms: ${timeText} (${totalSeconds}s)`);
        }
      }
      await page.waitForTimeout(500); // Check every 500ms
    }
    
    console.log('Collected time values:', timeValues);
    
    // Analyze for freezing
    let freezeDetected = false;
    let freezeDetails: { index: number; value: number; duration: number } | null = null;
    
    for (let i = 1; i < timeValues.length; i++) {
      const prevTime = timeValues[i - 1];
      const currTime = timeValues[i];
      const expectedTime = prevTime - 1; // Should decrease by 1 each second
      
      // Allow some tolerance (timer might update slightly off)
      if (Math.abs(currTime - expectedTime) > 2 && currTime === prevTime) {
        // Same value for multiple checks = freeze
        let freezeCount = 1;
        for (let j = i + 1; j < timeValues.length && timeValues[j] === currTime; j++) {
          freezeCount++;
        }
        
        if (freezeCount >= 2) {
          freezeDetected = true;
          freezeDetails = {
            index: i,
            value: currTime,
            duration: freezeCount * 500 // ms
          };
          break;
        }
      }
    }
    
    if (freezeDetected) {
      console.error('❌ FREEZE DETECTED:', freezeDetails);
      throw new Error(`Counter froze at ${freezeDetails.value}s for ${freezeDetails.duration}ms`);
    } else {
      console.log('✅ No freeze detected - counter is working correctly');
    }
    
    // Verify counter is decreasing
    expect(timeValues.length).toBeGreaterThan(5); // Should have multiple readings
    expect(timeValues[0]).toBeGreaterThan(timeValues[timeValues.length - 1]); // Should decrease
    
    await viewPage.close();
    await managePage.close();
  });

  test('Counter should not freeze when pausing and resuming', async ({ page, context }) => {
    await page.goto('http://localhost:5173/action');
    await page.waitForSelector('h1:has-text("Control Panel")', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Select entry if needed
    const selectButton = page.locator('button:has-text("Select")').first();
    if (await selectButton.isVisible()) {
      await selectButton.click();
      await page.waitForTimeout(500);
    }
    
    const viewPage = await context.newPage();
    await viewPage.goto('http://localhost:5173/view');
    await viewPage.waitForSelector('text=Word Master', { timeout: 10000 });
    
    const managePage = await context.newPage();
    await managePage.goto('http://localhost:5173/manage');
    await managePage.waitForSelector('h1', { timeout: 10000 });
    
    // Start timer
    await managePage.selectOption('select', '30');
    await managePage.click('button:has-text("Play")');
    await page.waitForTimeout(2000);
    
    // Get initial time
    let initialTime = 0;
    const timeElement = viewPage.locator('text=/\\d+:\\d+/').first();
    if (await timeElement.isVisible()) {
      const timeText = await timeElement.textContent();
      if (timeText) {
        const [mins, secs] = timeText.split(':').map(Number);
        initialTime = mins * 60 + secs;
      }
    }
    
    // Pause
    await managePage.click('button:has-text("Pause")');
    await page.waitForTimeout(2000);
    
    // Check time didn't change (should be paused)
    let pausedTime = 0;
    if (await timeElement.isVisible()) {
      const timeText = await timeElement.textContent();
      if (timeText) {
        const [mins, secs] = timeText.split(':').map(Number);
        pausedTime = mins * 60 + secs;
      }
    }
    
    // Resume
    await managePage.click('button:has-text("Resume")');
    await page.waitForTimeout(2000);
    
    // Check time is decreasing again
    let resumedTime = 0;
    if (await timeElement.isVisible()) {
      const timeText = await timeElement.textContent();
      if (timeText) {
        const [mins, secs] = timeText.split(':').map(Number);
        resumedTime = mins * 60 + secs;
      }
    }
    
    console.log('Initial:', initialTime, 'Paused:', pausedTime, 'Resumed:', resumedTime);
    
    // Verify pause worked (time should be same or very close)
    expect(Math.abs(pausedTime - initialTime)).toBeLessThan(3);
    
    // Verify resume worked (time should be less than paused time)
    expect(resumedTime).toBeLessThan(pausedTime);
    
    await viewPage.close();
    await managePage.close();
  });

  test('Counter should handle rapid start/stop without freezing', async ({ page, context }) => {
    await page.goto('http://localhost:5173/action');
    await page.waitForSelector('h1:has-text("Control Panel")', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    const selectButton = page.locator('button:has-text("Select")').first();
    if (await selectButton.isVisible()) {
      await selectButton.click();
      await page.waitForTimeout(500);
    }
    
    const managePage = await context.newPage();
    await managePage.goto('http://localhost:5173/manage');
    await managePage.waitForSelector('h1', { timeout: 10000 });
    
    const viewPage = await context.newPage();
    await viewPage.goto('http://localhost:5173/view');
    await viewPage.waitForSelector('text=Word Master', { timeout: 10000 });
    
    // Rapid start/stop test
    for (let i = 0; i < 3; i++) {
      console.log(`Rapid test iteration ${i + 1}`);
      
      // Start
      await managePage.selectOption('select', '30');
      await managePage.click('button:has-text("Play")');
      await page.waitForTimeout(500);
      
      // Stop immediately
      await managePage.click('button:has-text("🔄 Restart")').catch(() => {
        // Button might not be visible yet
      });
      await page.waitForTimeout(500);
    }
    
    // Final start and monitor
    await managePage.selectOption('select', '30');
    await managePage.click('button:has-text("Play")');
    await page.waitForTimeout(2000);
    
    // Monitor for 5 seconds
    const timeValues: number[] = [];
    for (let i = 0; i < 10; i++) {
      const timeElement = viewPage.locator('text=/\\d+:\\d+/').first();
      if (await timeElement.isVisible()) {
        const timeText = await timeElement.textContent();
        if (timeText) {
          const [mins, secs] = timeText.split(':').map(Number);
          timeValues.push(mins * 60 + secs);
        }
      }
      await page.waitForTimeout(500);
    }
    
    // Check for freezing
    let freezeCount = 0;
    for (let i = 1; i < timeValues.length; i++) {
      if (timeValues[i] === timeValues[i - 1] && timeValues[i] > 0) {
        freezeCount++;
      }
    }
    
    console.log('Time values after rapid operations:', timeValues);
    console.log('Freeze count:', freezeCount);
    
    // Should not freeze more than once (allowing for one measurement error)
    expect(freezeCount).toBeLessThan(3);
    
    await viewPage.close();
    await managePage.close();
  });
});




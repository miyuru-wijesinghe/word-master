import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;
const TEST_DATA_FILE = join(__dirname, 'test-data.xlsx');

async function testFixes() {
  console.log('🚀 Starting Puppeteer tests...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const actionPage = await browser.newPage();
    const viewPage = await browser.newPage();
    const judgePage = await browser.newPage();
    const managePage = await browser.newPage();

    console.log('📄 Opening pages...');
    await Promise.all([
      actionPage.goto(`${BASE_URL}/action`, { waitUntil: 'domcontentloaded' }),
      viewPage.goto(`${BASE_URL}/view`, { waitUntil: 'domcontentloaded' }),
      judgePage.goto(`${BASE_URL}/judge`, { waitUntil: 'domcontentloaded' }),
      managePage.goto(`${BASE_URL}/manage`, { waitUntil: 'domcontentloaded' })
    ]);

    await Promise.all([
      actionPage.waitForSelector('body', { timeout: 10000 }),
      viewPage.waitForSelector('body', { timeout: 10000 }),
      judgePage.waitForSelector('body', { timeout: 10000 }),
      managePage.waitForSelector('body', { timeout: 10000 })
    ]);
    console.log('✅ All pages loaded\n');

    await uploadSampleData(actionPage);
    const selectedWord = await selectFirstEntry(actionPage);
    await startRoundFromAction(actionPage);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await submitJudgeResult(judgePage, selectedWord);
    await verifyViewResultLifecycle(viewPage, { expectTimerEnded: false });
    await verifyTimerSync(viewPage, judgePage);

    console.log('✅ End-to-end Puppeteer flow completed\n');

  } catch (error) {
    console.error('❌ Test error:', error);
    throw error;
  } finally {
    await browser.close();
    console.log('✅ Tests completed');
  }
}

async function uploadSampleData(actionPage) {
  console.log('   - Uploading sample Excel data');
  const fileInput = await actionPage.waitForSelector('input[type="file"][accept*="xls"]', { timeout: 5000 });
  if (!fileInput) {
    throw new Error('Control Panel file input not found');
  }
  await fileInput.uploadFile(TEST_DATA_FILE);
  await actionPage.waitForSelector('table tbody tr', { timeout: 10000 });
}

async function selectFirstEntry(actionPage) {
  console.log('   - Selecting first row in Control Panel');
  const result = await actionPage.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((btn) => {
      const text = (btn.textContent || '').trim();
      return text === 'Select' || text === '✓ Selected';
    });
    if (target) {
      const row = target.closest('tr');
      const wordCell = row?.querySelectorAll('td')?.[1];
      const word = (wordCell?.textContent || '').trim();
      target.click();
      return { clicked: true, word };
    }
    return { clicked: false, word: '' };
  });

  if (!result.clicked) {
    throw new Error('Unable to find Select button on Control Panel');
  }

  await actionPage.waitForFunction(() =>
    Array.from(document.querySelectorAll('button')).some((btn) => (btn.textContent || '').includes('✓ Selected')),
    { timeout: 5000 }
  );
  console.log('   ✅ Control Panel selection broadcasted');
  return result.word;
}

async function startRoundFromAction(actionPage) {
  console.log('   - Starting round via Control Panel (Ctrl+S)');
  await actionPage.bringToFront();
  await actionPage.keyboard.down('Control');
  await actionPage.keyboard.press('s');
  await actionPage.keyboard.up('Control');
}

async function submitJudgeResult(judgePage, actualWord) {
  if (!actualWord) {
    throw new Error('No word available to submit judge result');
  }
  console.log('   - Submitting judge result via UI');
  await judgePage.bringToFront();
  await judgePage.waitForSelector('textarea', { timeout: 10000 });
  await judgePage.waitForFunction(
    (word) => document.body.textContent?.includes(word),
    { timeout: 15000 },
    actualWord
  );
  await judgePage.focus('textarea');
  await judgePage.evaluate(() => {
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.value = '';
    }
  });
  await judgePage.type('textarea', actualWord);
  const clicked = await clickButtonByText(judgePage, 'Send Result Now');
  if (!clicked) {
    throw new Error('Unable to find Send Result Now button on Judge page');
  }
}

async function verifyViewResultLifecycle(viewPage, { expectTimerEnded = true } = {}) {
  if (expectTimerEnded) {
    console.log('   - Waiting for View page timer end');
    const timerEndedSeen = await waitForText(viewPage, 'Timer Ended', 20000);
    if (!timerEndedSeen) {
      console.warn('   ⚠️  Timer Ended banner not observed before timeout');
    }
  }
  console.log('   - Waiting for Latest Result display');
  const latestResultSeen = await waitForText(viewPage, 'Latest Result', 20000);
  if (!latestResultSeen) {
    const snapshot = await viewPage.evaluate(() => document.body.innerText);
    console.error('--- View Page Snapshot ---\n', snapshot);
    console.error('--------------------------');
    throw new Error('Latest Result never appeared on View page');
  }
  console.log('   ✅ View page result lifecycle verified');
}

async function verifyTimerSync(viewPage, judgePage) {
  const [viewSnapshot, judgeSnapshot] = await Promise.all([
    viewPage.evaluate(() => {
      const timerEl = document.querySelector('h2.text-5xl')?.parentElement;
      return timerEl ? timerEl.textContent : '';
    }),
    judgePage.evaluate(() => {
      const timerEl = document.querySelector('p.text-2xl');
      return timerEl ? timerEl.textContent : '';
    })
  ]);

  console.log(`   - View timer snapshot: ${viewSnapshot}`);
  console.log(`   - Judge timer snapshot: ${judgeSnapshot}`);
}

async function clickButtonByText(page, text) {
  return page.evaluate((label) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((btn) => (btn.textContent || '').trim().includes(label));
    if (target) {
      target.click();
      return true;
    }
    return false;
  }, text);
}

async function waitForText(page, text, timeout) {
  try {
    await page.waitForFunction(
      (target) => document.body.textContent?.includes(target),
      { timeout },
      text
    );
    return true;
  } catch {
    return false;
  }
}

async function checkServer() {
  return new Promise((resolve) => {
    const req = http.request(BASE_URL, { method: 'HEAD' }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function waitForServerReady(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkServer()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Dev server failed to start within timeout');
}

async function startDevServer() {
  console.log('⚙️  Starting dev server...');
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const serverProcess = spawn(
    npmCommand,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    {
      cwd: join(__dirname, '.'),
      env: { ...process.env, BROWSER: 'none' },
      stdio: 'inherit'
    }
  );

  try {
    await waitForServerReady();
    console.log('✅ Dev server is running\n');
    return serverProcess;
  } catch (error) {
    serverProcess.kill();
    throw error;
  }
}

// Main execution
(async () => {
  console.log('🔍 Checking if dev server is running...');
  let serverProcess = null;
  let serverRunning = await checkServer();

  try {
    if (!serverRunning) {
      serverProcess = await startDevServer();
      serverRunning = true;
    }

    await testFixes();
  } catch (error) {
    console.error('❌ Puppeteer test run failed:', error);
    process.exitCode = 1;
  } finally {
    if (serverProcess) {
      console.log('🛑 Stopping dev server...');
      serverProcess.kill('SIGINT');
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          serverProcess.kill('SIGTERM');
        }, 2000);
        serverProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }
})();


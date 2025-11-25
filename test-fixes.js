import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

async function testFixes() {
  console.log('🚀 Starting Puppeteer tests...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // Open three pages: Action, View, and Judge
    const actionPage = await browser.newPage();
    const viewPage = await browser.newPage();
    const judgePage = await browser.newPage();

    console.log('📄 Opening pages...');
    await Promise.all([
      actionPage.goto(`${BASE_URL}/action`),
      viewPage.goto(`${BASE_URL}/view`),
      judgePage.goto(`${BASE_URL}/judge`)
    ]);

    // Wait for pages to load
    await Promise.all([
      actionPage.waitForSelector('body', { timeout: 10000 }),
      viewPage.waitForSelector('body', { timeout: 10000 }),
      judgePage.waitForSelector('body', { timeout: 10000 })
    ]);

    console.log('✅ All pages loaded\n');

    // Test 1: Result not reappearing after clearing
    console.log('🧪 Test 1: Result not reappearing after clearing');
    console.log('   - Starting timer...');
    
    // Start timer from action page
    const startClicked = await actionPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find((btn) => {
        const text = (btn.textContent || '').toLowerCase();
        return text.includes('start') || text.includes('play');
      });
      if (target) {
        target.click();
        return true;
      }
      return false;
    });
    if (startClicked) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for timer to start
    } else {
      console.warn('   ⚠️  Could not find Start/Play button automatically.');
    }

    // Wait for timer to complete (or simulate end)
    console.log('   - Waiting for timer to end...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if result appears on view page
    const resultAppeared = await viewPage.evaluate(() => {
      const resultText = document.body.textContent || '';
      return resultText.includes('Latest Result') || resultText.includes('Timer Ended');
    });

    if (resultAppeared) {
      console.log('   ✅ Result appeared');
      
      // Wait for result to clear
      console.log('   - Waiting for result to clear...');
      await new Promise(resolve => setTimeout(resolve, 12000)); // Wait for RESULT_DISPLAY_MS (10000) + buffer
      
      // Check if result reappears
      const resultReappeared = await viewPage.evaluate(() => {
        const resultText = document.body.textContent || '';
        return resultText.includes('Latest Result') && !resultText.includes('Timer Ended');
      });

      if (!resultReappeared) {
        console.log('   ✅ Result did NOT reappear after clearing - PASS\n');
      } else {
        console.log('   ❌ Result reappeared after clearing - FAIL\n');
      }
    } else {
      console.log('   ⚠️  Result did not appear (may need manual trigger)\n');
    }

    // Test 2: Timer synchronization
    console.log('🧪 Test 2: Timer synchronization between Judge and View pages');
    
    // Get timer values from both pages
    const timerValues = await Promise.all([
      viewPage.evaluate(() => {
        const timerEl = document.querySelector('[class*="text-"]');
        return timerEl ? timerEl.textContent : '';
      }),
      judgePage.evaluate(() => {
        const timerEl = document.querySelector('p.text-2xl');
        return timerEl ? timerEl.textContent : '';
      })
    ]);

    const viewTimer = timerValues[0];
    const judgeTimer = timerValues[1];

    console.log(`   - View page timer: ${viewTimer}`);
    console.log(`   - Judge page timer: ${judgeTimer}`);

    // Check if timers are synchronized (within 1 second difference)
    if (viewTimer && judgeTimer) {
      const parseTime = (timeStr) => {
        const match = timeStr.match(/(\d+):(\d+)/);
        if (match) {
          return parseInt(match[1]) * 60 + parseInt(match[2]);
        }
        return null;
      };

      const viewSeconds = parseTime(viewTimer);
      const judgeSeconds = parseTime(judgeTimer);

      if (viewSeconds !== null && judgeSeconds !== null) {
        const diff = Math.abs(viewSeconds - judgeSeconds);
        if (diff <= 1) {
          console.log(`   ✅ Timers are synchronized (difference: ${diff}s) - PASS\n`);
        } else {
          console.log(`   ❌ Timers are NOT synchronized (difference: ${diff}s) - FAIL\n`);
        }
      } else {
        console.log('   ⚠️  Could not parse timer values\n');
      }
    } else {
      console.log('   ⚠️  Could not read timer values\n');
    }

    // Keep browser open for manual inspection
    console.log('🔍 Keeping browser open for 10 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await browser.close();
    console.log('✅ Tests completed');
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


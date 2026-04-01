import { chromium } from 'playwright-core';
import { readBrowserInstance, requireVisibleBrowserInstance } from '../src/runtime/browser-instance.js';

async function test() {
  const cdpUrl = process.env.CHROME_CDP_URL || 'http://localhost:9222';
  console.log(`Connecting to browser on ${cdpUrl}...`);
  try {
    const instance = await readBrowserInstance(cdpUrl);
    const instanceError = requireVisibleBrowserInstance(instance, 'real browser check');
    if (instanceError) throw new Error(instanceError);

    const browser = await chromium.connectOverCDP(cdpUrl);
    const context = browser.contexts()[0];
    const existingPage = context.pages()[0] || null;
    const page = existingPage || await context.newPage();
    
    const target = 'https://www.baidu.com';
    console.log(`Navigating to ${target}...`);
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    
    const title = await page.title();
    const url = page.url();
    
    console.log('--- Real Browser Test Result ---');
    console.log(`Instance: ${instance?.browser ?? 'unknown browser'}`);
    console.log(`Title: ${title}`);
    console.log(`URL: ${url}`);

    if (!existingPage) {
      await page.close();
    }

    await browser.close();
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

test();

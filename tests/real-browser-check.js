import { chromium } from 'playwright-core';

async function test() {
  console.log('Connecting to browser on localhost:9222...');
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();
    
    const target = 'https://www.baidu.com';
    console.log(`Navigating to ${target}...`);
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    
    const title = await page.title();
    const url = page.url();
    
    console.log('--- Real Browser Test Result ---');
    console.log(`Title: ${title}`);
    console.log(`URL: ${url}`);
    
    await browser.close();
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

test();

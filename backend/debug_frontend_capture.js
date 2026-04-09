const puppeteer = require('puppeteer');

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: true }); // headless
  const page = await browser.newPage();

  // Capture console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));
  page.on('requestfailed', request => console.error('FAILED REQUEST:', request.url(), request.failure().errorText));

  try {
    console.log("Navigating to login...");
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    
    // Check if we are at login
    const title = await page.title();
    console.log("Page Title:", title);
    
    // If login is required, we might be stuck there.
    // Try to login if inputs exist
    // Assuming simple login form
    // await page.type('input[placeholder="Usuario"]', 'admin'); 
    // await page.type('input[placeholder="Contraseña"]', 'admin');
    // await page.click('button[type="submit"]');
    
    console.log("Navigating to creation module...");
    await page.goto('http://localhost:5173/creation', { waitUntil: 'networkidle0' });
    
    // Take screenshot
    await page.screenshot({ path: 'debug_screenshot.png' });
    console.log("Screenshot saved.");

    // Check specific elements
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log("Body Text Preview:", bodyText.substring(0, 200));

  } catch (error) {
    console.error("Navigation Error:", error);
  } finally {
    await browser.close();
  }
})();

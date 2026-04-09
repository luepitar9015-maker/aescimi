const puppeteer = require('puppeteer');

(async () => {
  console.log("Launching debugger...");
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Listen for console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  // Listen for uncaught errors
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  // Listen for failed requests
  page.on('requestfailed', request => {
    console.log(`REQUEST FAILED: ${request.url()} ${request.failure().errorText}`);
  });

  try {
    console.log("Navigating to frontend...");
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle0', timeout: 30000 });
    console.log("Navigation complete.");
    
    // Check if root has content
    const rootContent = await page.$eval('#root', el => el.innerHTML);
    console.log(`Root content length: ${rootContent.length}`);
    console.log(`Root content preview: ${rootContent.substring(0, 100)}`);

  } catch (err) {
    console.error("Navigation error:", err);
  } finally {
    await browser.close();
  }
})();

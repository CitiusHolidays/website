const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/pilgrimage');
  await page.waitForLoadState('networkidle');
  
  await page.screenshot({ 
    path: 'pilgrimage-hero-screenshot.png',
    fullPage: false
  });
  
  console.log('Screenshot saved to pilgrimage-hero-screenshot.png');
  
  await browser.close();
})();

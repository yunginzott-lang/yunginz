const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 2000 });
  const base = 'https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AOhY9196iP2jgrvJwYH_w8c?rlkey=fveetntu8ts50k9qvnucnlo1k&st=ygfuptgl&dl=0';

  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  try {
    const btn = await page.locator('button:has-text("Accept All")').first();
    if (await btn.isVisible({ timeout: 2000 })) { await btn.click(); await page.waitForTimeout(1000); }
  } catch(e) {}

  // Check what links are available
  const allLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .map(a => ({ text: a.textContent.trim().substring(0, 50), href: a.href.substring(0, 120), cls: a.className }))
      .filter(f => f.text && f.href.includes('dropbox'))
      .slice(0, 40);
  });
  
  console.log('Links on root page:');
  allLinks.forEach(l => console.log(`  "${l.text}" -> ${l.href} (${l.cls})`));

  // Navigate to Detroit
  const detroitUrl = 'https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AJTI3jmc63E6nehth6hcmRU/Detroit?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0';
  await page.goto(detroitUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const detroitLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .map(a => ({ text: a.textContent.trim().substring(0, 60), href: a.href.substring(0, 150), cls: a.className?.substring(0, 30) }))
      .filter(f => f.text && f.href.includes('dropbox'))
      .slice(0, 30);
  });

  console.log('\nLinks on Detroit page:');
  detroitLinks.forEach(l => console.log(`  "${l.text}" -> ${l.href} (${l.cls})`));

  await browser.close();
})();

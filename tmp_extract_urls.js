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

  // Navigate to Caribbean to verify file link hrefs
  const caribbeanUrl = 'https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AP8A94v77z0SgwRPSDFj_AQ/Caribbean?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0';
  await page.goto(caribbeanUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const fileInfo = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const result = [];
    for (const a of links) {
      const text = a.textContent.trim();
      const href = a.href;
      if (text && href && (text.includes('.mp3') || text.includes('.wav') || text.includes('.m4a'))) {
        result.push({ text, href: href.length > 200 ? href.substring(0,200) : href });
      }
    }
    return result;
  });

  console.log('File links found on Caribbean page:');
  fileInfo.forEach(f => console.log(`\n  Name: ${f.text}\n  Href: ${f.href}`));

  if (fileInfo.length === 0) {
    // Check the HTML source directly for file rows
    const html = await page.evaluate(() => document.body.innerHTML.substring(0, 5000));
    console.log('\nNo file links found. First 5k of body HTML:');
    console.log(html);
  }

  await browser.close();
})();

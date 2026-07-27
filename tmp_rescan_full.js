const { chromium } = require('playwright');
const fs = require('fs');

const DROPBOX_URL = 'https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AOhY9196iP2jgrvJwYH_w8c?rlkey=fveetntu8ts50k9qvnucnlo1k&st=ygfuptgl&dl=0';

async function extractAllFiles(page) {
  // Scroll repeatedly to trigger lazy loading, then get all audio file links
  let prevCount = -1;
  for (let i = 0; i < 20; i++) {
    // Get current count
    const count = await page.evaluate(() => {
      return document.querySelectorAll('a[href*="/scl/fi/"]').length;
    });
    if (count === prevCount && i > 3) break;
    prevCount = count;
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
  }
  
  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const files = [];
    const seen = new Set();
    for (const a of links) {
      const text = a.textContent.trim();
      const href = a.href;
      if (!text || !href || seen.has(href)) continue;
      seen.add(href);
      if (/\.(mp3|wav|m4a|flac)$/i.test(text) && text.length > 3) {
        files.push({ name: text, href });
      }
    }
    return files;
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 2000 });
  
  // Load root and get folder links
  await page.goto(DROPBOX_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  
  // Accept cookies
  try {
    const btn = await page.locator('button:has-text("Accept")').first();
    if (await btn.isVisible({ timeout: 2000 })) { await btn.click(); await page.waitForTimeout(1000); }
  } catch(e) {}
  
  // Scroll root to trigger lazy loading
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
  }
  
  // Get all root folders
  const rootItems = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="scl/fo/"][href*="dl=0"]'));
    const items = [];
    const seen = new Set();
    for (const a of links) {
      const name = a.textContent.trim();
      if (name && !seen.has(name) && name.length < 100 && !name.includes('Privacy') && !name.includes('Dropbox') && !name.includes('Tags')) {
        seen.add(name);
        items.push({ name, href: a.href });
      }
    }
    return items;
  });
  
  console.log(`Root folders: ${rootItems.length}`);
  rootItems.forEach(f => console.log(`  ${f.name}`));
  
  // Visit each folder and extract ALL files
  const allFolderFiles = {};
  
  for (const item of rootItems) {
    process.stdout.write(`\n${item.name}: `);
    try {
      await page.goto(item.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
      
      const files = await extractAllFiles(page);
      allFolderFiles[item.name] = files;
      process.stdout.write(`${files.length} files`);
      
      // Check for subfolders
      const subLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href*="scl/fo/"]'))
          .map(a => ({ name: a.textContent.trim(), href: a.href }));
      });
      const realSubs = subLinks.filter(s => s.name && !s.name.includes(' ') && s.name !== item.name && !s.name.includes('Privacy') && !s.name.includes('Dropbox'));
      // Deduplicate
      const subMap = new Map();
      realSubs.forEach(s => subMap.set(s.name, s));
      
      for (const [name, sub] of subMap) {
        process.stdout.write(` ->${name}: `);
        try {
          await page.goto(sub.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(1500);
          const subFiles = await extractAllFiles(page);
          allFolderFiles[`${item.name}/${name}`] = subFiles;
          process.stdout.write(`${subFiles.length} files`);
        } catch(e) {
          process.stdout.write('error');
        }
      }
    } catch(e) {
      process.stdout.write(`error: ${e.message.substring(0,60)}`);
    }
  }
  
  // Save results
  fs.writeFileSync('/Users/melodyte/Documents/Yunginz/tmp_full_rescan.json', JSON.stringify(allFolderFiles, null, 2));
  
  let totalFiles = 0;
  let report = '';
  for (const [folder, files] of Object.entries(allFolderFiles).sort()) {
    report += `\n${folder} (${files.length}):\n`;
    for (const f of files.sort((a,b) => a.name.localeCompare(b.name))) {
      report += `  ${f.name}\n`;
      totalFiles++;
    }
  }
  report = `TOTAL: ${totalFiles} files\n${report}`;
  fs.writeFileSync('/Users/melodyte/Documents/Yunginz/tmp_full_rescan_report.txt', report);
  
  console.log(`\n\n=== TOTAL: ${totalFiles} files across ${Object.keys(allFolderFiles).length} folders ===`);
  
  await browser.close();
})();

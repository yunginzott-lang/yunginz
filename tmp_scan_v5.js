const { chromium } = require('playwright');
const fs = require('fs');

const DROPBOX_URL = 'https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AOhY9196iP2jgrvJwYH_w8c?rlkey=fveetntu8ts50k9qvnucnlo1k&st=ygfuptgl&dl=0';
const SKIP_FOLDERS = ['Caribbean']; // Already scanned

async function getFolderData(page, url, parentUrl) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  } catch(e) {
    // Timeout but page may still be usable
  }
  await page.waitForTimeout(2000);
  
  return await page.evaluate((parentUrl) => {
    const links = Array.from(document.querySelectorAll('a'));
    const files = [];
    const subdirs = [];
    const hrefSet = new Set();
    
    for (const a of links) {
      const text = a.textContent.trim();
      const href = a.href;
      if (!text || !href) continue;
      
      if (/\.(mp3|wav|m4a|flac)$/i.test(text) && text.length > 3) {
        if (!hrefSet.has(href)) {
          hrefSet.add(href);
          files.push({ name: text, href });
        }
      } else if (text.length < 100 && !text.includes('.') && href.includes('scl/fo/') && href !== parentUrl && !hrefSet.has(href) && !text.includes('Privacy') && !text.includes('Dropbox')) {
        hrefSet.add(href);
        subdirs.push({ name: text, href });
      }
    }
    return { files, subdirs: subdirs.filter(s => s.name) };
  }, parentUrl);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 2000 });
  
  // Load root
  await page.goto(DROPBOX_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  
  // Accept cookies
  try {
    const btn = await page.locator('button:has-text("Accept")').first();
    if (await btn.isVisible({ timeout: 2000 })) { await btn.click(); await page.waitForTimeout(1000); }
  } catch(e) {}
  
  // Scroll to trigger lazy loading
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
  }
  
  // Get root folders
  const rootItems = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="scl/fo/"][href*="dl=0"]'));
    const items = [];
    const seen = new Set();
    for (const a of links) {
      const name = a.textContent.trim();
      if (name && !seen.has(name) && name.length < 100 && !name.includes('Privacy') && !name.includes('Dropbox')) {
        seen.add(name);
        items.push({ name, href: a.href });
      }
    }
    return items;
  });
  
  console.log(`Root folders: ${rootItems.length}`);
  rootItems.forEach(f => console.log(`  ${f.name}`));
  
  const allFolders = {};
  
  // Scan each root folder
  for (const item of rootItems) {
    if (SKIP_FOLDERS.includes(item.name)) {
      console.log(`\nSkipping ${item.name} (already done)`);
      continue;
    }
    
    process.stdout.write(`\n${item.name}: `);
    const data = await getFolderData(page, item.href, DROPBOX_URL);
    process.stdout.write(`${data.files.length} files`);
    
    if (data.files.length > 0) {
      allFolders[item.name] = data.files.map(f => ({ name: f.name, url: f.href }));
    }
    
    if (data.subdirs.length > 0) {
      process.stdout.write(`, ${data.subdirs.length} subdirs`);
      
      for (const sub of data.subdirs) {
        process.stdout.write(`\n  ->${sub.name}: `);
        try {
          const subData = await getFolderData(page, sub.href, item.href);
          process.stdout.write(`${subData.files.length} files`);
          
          if (subData.files.length > 0) {
            const key = `${item.name}/${sub.name}`;
            allFolders[key] = subData.files.map(f => ({ name: f.name, url: f.href }));
          }
        } catch(e) {
          process.stdout.write(`error`);
        }
      }
    }
  }
  
  // Write report
  fs.writeFileSync('/Users/melodyte/Documents/Yunginz/tmp_full_scan.json', JSON.stringify(allFolders, null, 2));
  
  let total = 0;
  let report = '';
  for (const [folder, files] of Object.entries(allFolders).sort()) {
    report += `\n${folder} (${files.length}):\n`;
    for (const f of files.sort((a,b) => a.name.localeCompare(b.name))) {
      report += `  ${f.name}\n`;
      total++;
    }
  }
  report = `TOTAL AUDIO FILES: ${total}\n${report}`;
  
  fs.writeFileSync('/Users/melodyte/Documents/Yunginz/tmp_full_scan_report.txt', report);
  console.log(`\n\n=== DONE: ${total} total files across ${Object.keys(allFolders).length} folders ===`);
  console.log('Report: tmp_full_scan_report.txt');
  
  await browser.close();
})();

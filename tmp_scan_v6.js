const { chromium } = require('playwright');
const fs = require('fs');

const DROPBOX_URL = 'https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AOhY9196iP2jgrvJwYH_w8c?rlkey=fveetntu8ts50k9qvnucnlo1k&st=ygfuptgl&dl=0';

async function getFilesIn(url, page) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
  } catch(e) {
    await page.waitForTimeout(3000);
  }
  
  return await page.evaluate((parentUrl) => {
    const links = Array.from(document.querySelectorAll('a'));
    const files = [];
    const subdirs = [];
    
    for (const a of links) {
      const text = a.textContent.trim();
      const href = a.href;
      if (!text || !href) continue;
      
      if (/\.(mp3|wav|m4a|flac)$/i.test(text) && text.length > 3) {
        files.push({ name: text, href });
      } else if (text.length < 100 && !text.includes('.') && href.includes('scl/fo/') && href !== parentUrl && !text.includes('Privacy') && !text.includes('Dropbox') && !text.includes(' ')) {
        subdirs.push({ name: text, href });
      }
    }
    return { files: [...new Map(files.map(f => [f.name, f])).values()], subdirs: [...new Map(subdirs.map(s => [s.name, s])).values()] };
  }, url);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 2000 });
  
  const results = {};
  const errors = [];
  
  // Get root folders
  await page.goto(DROPBOX_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
  }
  
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
  
  for (const item of rootItems) {
    if (item.name === 'Caribbean') {
      console.log(`\n[SKIP] ${item.name}`);
      continue;
    }
    
    try {
      console.log(`\n[FOLDER] ${item.name}`);
      const data = await getFilesIn(item.href, page);
      
      if (data.files.length > 0) {
        results[item.name] = data.files;
        console.log(`  Files (${data.files.length}):`);
        data.files.slice(0, 5).forEach(f => console.log(`    ${f.name}`));
        if (data.files.length > 5) console.log(`    ... and ${data.files.length - 5} more`);
      } else {
        console.log(`  0 files directly`);
      }
      
      // Process subdirs
      if (data.subdirs.length > 0) {
        console.log(`  Subdirs: ${data.subdirs.map(s => s.name).join(', ')}`);
        
        for (const sub of data.subdirs) {
          try {
            const subData = await getFilesIn(sub.href, page);
            const key = `${item.name}/${sub.name}`;
            results[key] = subData.files;
            console.log(`    ->${sub.name}: ${subData.files.length} files`);
            subData.files.slice(0, 3).forEach(f => console.log(`      ${f.name}`));
          } catch(e) {
            console.log(`    ->${sub.name}: ERROR ${e.message.substring(0, 60)}`);
            errors.push(`${key}: ${e.message}`);
          }
        }
      }
    } catch(e) {
      console.log(`  ERROR: ${e.message.substring(0, 100)}`);
      errors.push(`${item.name}: ${e.message}`);
    }
    
    // Save after each folder
    fs.writeFileSync('/Users/melodyte/Documents/Yunginz/tmp_full_scan_v6.json', JSON.stringify({ results, errors, lastFolder: item.name }, null, 2));
    
    // Generate report
    let total = 0;
    let report = '';
    for (const [folder, files] of Object.entries(results).sort()) {
      report += `\n${folder} (${files.length}):\n`;
      for (const f of files.sort((a,b) => a.name.localeCompare(b.name))) {
        report += `  ${f.name}\n`;
        total++;
      }
    }
    report = `TOTAL: ${total} files\nERRORS: ${errors.length}\n${report}`;
    fs.writeFileSync('/Users/melodyte/Documents/Yunginz/tmp_full_scan_v6_report.txt', report);
  }
  
  console.log(`\n\n=== FINAL: ${Object.values(results).reduce((a,b) => a + b.length, 0)} files across ${Object.keys(results).length} folders ===`);
  console.log(`Errors: ${errors.length}`);
  
  await browser.close();
})();

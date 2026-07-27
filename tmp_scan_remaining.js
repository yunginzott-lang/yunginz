const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DROPBOX_URL = 'https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AOhY9196iP2jgrvJwYH_w8c?rlkey=fveetntu8ts50k9qvnucnlo1k&st=ygfuptgl&dl=0';

async function extractLinks(page) {
  // Wait for the file listing to load
  await page.waitForTimeout(2000);
  
  // Get all anchor elements that contain file/folder links
  const links = await page.evaluate(() => {
    const items = [];
    // Look for file/folder rows or links
    const anchors = document.querySelectorAll('a[data-testid^="file-row-"], a[href*="/scl/fi/"], a[href*="/scl/fo/"]');
    anchors.forEach(a => {
      const href = a.getAttribute('href');
      if (href && (href.includes('/scl/fi/') || href.includes('/scl/fo/'))) {
        items.push({
          href: href.startsWith('http') ? href : 'https://www.dropbox.com' + href,
          name: a.querySelector('[data-testid="file-name-text"]')?.textContent || a.textContent?.trim() || ''
        });
      }
    });
    // Also try searching for all links
    document.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href');
      if (href && (href.includes('/scl/fi/') || href.includes('/scl/fo/'))) {
        const name = a.querySelector('[data-testid="file-name-text"]')?.textContent || a.textContent?.trim() || '';
        const exists = items.some(i => i.href === href);
        if (!exists) {
          items.push({
            href: href.startsWith('http') ? href : 'https://www.dropbox.com' + href,
            name
          });
        }
      }
    });
    return items;
  });
  
  return links;
}

async function scanFolder(page, folderUrl, folderName, depth = 0) {
  if (depth > 3) return [];
  const results = [];
  console.log(`  Scanning: ${folderName}`);
  
  try {
    await page.goto(folderUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const links = await extractLinks(page);
    
    for (const link of links) {
      if (link.href.includes('/scl/fo/')) {
        // It's a subfolder - recurse
        const subName = link.name || link.href.split('/').pop() || 'unknown';
        const subResults = await scanFolder(page, link.href, `${folderName}/${subName}`, depth + 1);
        results.push(...subResults);
      } else if (link.href.includes('/scl/fi/')) {
        // It's a file
        const name = link.name;
        if (name && /\.(mp3|wav|m4a)$/i.test(name)) {
          results.push({ name, url: link.href, folder: folderName });
        }
      }
    }
  } catch (e) {
    console.log(`  Error scanning ${folderName}: ${e.message.substring(0, 100)}`);
  }
  
  return results;
}

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // See root folder contents
  console.log('Loading root Dropbox folder...');
  await page.goto(DROPBOX_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const rootLinks = await extractLinks(page);
  console.log(`Found ${rootLinks.length} root items`);
  
  // Scan each subfolder (skip Caribbean which we already did)
  let allFiles = [];
  for (const link of rootLinks) {
    if (link.href.includes('/scl/fo/')) {
      const folderName = link.name || link.href.split('/').pop();
      console.log(`\nFolder: ${folderName}`);
      const files = await scanFolder(page, link.href, folderName, 1);
      allFiles.push(...files);
      console.log(`  Found ${files.length} audio files`);
    }
  }
  
  console.log(`\nTotal audio files found across all folders: ${allFiles.length}`);
  
  // Write results to file grouped by folder
  const grouped = {};
  for (const f of allFiles) {
    if (!grouped[f.folder]) grouped[f.folder] = [];
    grouped[f.folder].push({ name: f.name, url: f.url });
  }
  
  // Write readable report
  let report = '';
  for (const [folder, files] of Object.entries(grouped).sort()) {
    report += `\n${folder} (${files.length} files):\n`;
    for (const f of files.sort((a,b) => a.name.localeCompare(b.name))) {
      report += `  ${f.name}\n    ${f.url}\n`;
    }
  }
  
  fs.writeFileSync('/Users/melodyte/Documents/Yunginz/tmp_dropbox_scan.txt', report);
  
  // Also write the JSON of just filenames for cross-referencing
  const dbPath = '/Users/melodyte/Documents/Yunginz/tmp_dropbox_files.json';
  fs.writeFileSync(dbPath, JSON.stringify(allFiles, null, 2));
  
  console.log(`\nReport written to tmp_dropbox_scan.txt`);
  console.log(`Data written to ${dbPath}`);
  
  await browser.close();
})();

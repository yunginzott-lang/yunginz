const { chromium } = require('playwright');
const fs = require('fs');

const DROPBOX_URL = 'https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AOhY9196iP2jgrvJwYH_w8c?rlkey=fveetntu8ts50k9qvnucnlo1k&st=ygfuptgl&dl=0';

async function getFilesOnPage(page) {
  // Extract all file names and their Dropbox URLs from current page
  return await page.evaluate(() => {
    const result = [];
    const links = document.querySelectorAll('a[href*="/scl/fi/"]');
    links.forEach(a => {
      const href = a.getAttribute('href');
      let name = '';
      const nameEl = a.querySelector('[data-testid="file-name-text"]');
      if (nameEl) name = nameEl.textContent?.trim() || '';
      if (!name) name = a.textContent?.trim() || '';
      if (!name && href) {
        const parts = decodeURIComponent(href).split('/');
        name = parts[parts.length - 1].split('?')[0];
      }
      const fullUrl = href.startsWith('http') ? href : 'https://www.dropbox.com' + href;
      if (href && !result.some(r => r.href === fullUrl)) {
        result.push({ name, href: fullUrl });
      }
    });
    return result;
  });
}

async function getSubfolderLinks(page) {
  // Get links to subfolders
  return await page.evaluate(() => {
    const result = [];
    const links = document.querySelectorAll('a[href*="/scl/fo/"]');
    links.forEach(a => {
      const href = a.getAttribute('href');
      const name = a.querySelector('[data-testid="file-name-text"]')?.textContent?.trim() || 
                    a.textContent?.trim() || '';
      const fullUrl = href.startsWith('http') ? href : 'https://www.dropbox.com' + href;
      // Exclude the root folder link
      if (fullUrl !== window.location.href && !result.some(r => r.href === fullUrl)) {
        result.push({ name, href: fullUrl });
      }
    });
    return result;
  });
}

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Bigger viewport to avoid mobile rendering
  await page.setViewportSize({ width: 1280, height: 800 });
  
  console.log('Loading root folder...');
  await page.goto(DROPBOX_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Get all top-level subfolders
  const rootFolders = await getSubfolderLinks(page);
  console.log(`Found ${rootFolders.length} top-level subfolders`);
  
  // Get all files in root (files not in subfolders)
  let rootFiles = await getFilesOnPage(page);
  console.log(`Found ${rootFiles.length} files at root level`);
  
  // Visit each subfolder to get its files
  const allSubfolderFiles = {};
  
  for (const folder of rootFolders) {
    console.log(`\nVisiting: ${folder.name || 'unnamed'}`);
    try {
      await page.goto(folder.href, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2000);
      
      // Get files in this folder
      const files = await getFilesOnPage(page);
      console.log(`  Found ${files.length} files`);
      allSubfolderFiles[folder.name || 'unnamed'] = files;
      
      // Check if there are sub-subfolders
      const subFolders = await getSubfolderLinks(page);
      if (subFolders.length > 0) {
        console.log(`  Has ${subFolders.length} sub-subfolders`);
        for (const sub of subFolders) {
          console.log(`    Visiting sub: ${sub.name || 'unnamed'}`);
          try {
            await page.goto(sub.href, { waitUntil: 'networkidle', timeout: 60000 });
            await page.waitForTimeout(2000);
            const subFiles = await getFilesOnPage(page);
            console.log(`    Found ${subFiles.length} files`);
            allSubfolderFiles[`${folder.name || 'unnamed'}/${sub.name || 'unnamed'}`] = subFiles;
          } catch(e) {
            console.log(`    Error: ${e.message.substring(0,80)}`);
          }
        }
      }
    } catch(e) {
      console.log(`  Error: ${e.message.substring(0,80)}`);
    }
  }
  
  // Combine all results
  const allFiles = [];
  allFiles.push(...rootFiles.map(f => ({ name: f.name, url: f.href, folder: 'root' })));
  for (const [folder, files] of Object.entries(allSubfolderFiles)) {
    for (const f of files) {
      allFiles.push({ name: f.name, url: f.href, folder });
    }
  }
  
  console.log(`\n\n=== TOTAL: ${allFiles.length} audio files ===`);
  
  // Write report
  const grouped = {};
  for (const f of allFiles) {
    if (!grouped[f.folder]) grouped[f.folder] = [];
    grouped[f.folder].push(f);
  }
  
  let report = '';
  for (const [folder, files] of Object.entries(grouped).sort()) {
    report += `\n${folder} (${files.length}):\n`;
    for (const f of files.sort((a,b) => a.name.localeCompare(b.name))) {
      report += `  ${f.name}\n`;
    }
  }
  
  fs.writeFileSync('/Users/melodyte/Documents/Yunginz/tmp_full_scan_report.txt', report);
  fs.writeFileSync('/Users/melodyte/Documents/Yunginz/tmp_full_scan_data.json', JSON.stringify(allFiles, null, 2));
  console.log('Report written to tmp_full_scan_report.txt');
  
  await browser.close();
  console.log('Done');
})();

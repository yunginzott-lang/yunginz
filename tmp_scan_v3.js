const { chromium } = require('playwright');
const fs = require('fs');

const DROPBOX_URL = 'https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AOhY9196iP2jgrvJwYH_w8c?rlkey=fveetntu8ts50k9qvnucnlo1k&st=ygfuptgl&dl=0';

async function extractFolderContent(page) {
  return await page.evaluate(() => {
    const rows = document.querySelectorAll('[role="row"], [data-testid^="file-row-"], [class*="file-row"], tr');
    const items = [];
    
    rows.forEach(row => {
      // Look for file name text
      const nameEl = row.querySelector('[data-testid="file-name-text"], [class*="file-name"], a[href*="/scl/"]');
      if (!nameEl) return;
      
      const name = nameEl.textContent?.trim();
      if (!name) return;
      
      // Get the link
      const link = nameEl.closest('a') || nameEl.querySelector('a');
      const href = link?.getAttribute('href');
      
      const isFolder = name.includes('/'); // folders end with /
      // Check file extension
      const hasAudioExt = /\.(mp3|wav|m4a)$/i.test(name);
      
      items.push({ name, href: href || '', type: isFolder ? 'folder' : hasAudioExt ? 'audio' : 'other' });
    });
    
    return items;
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  console.log('Loading root...');
  await page.goto(DROPBOX_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  
  // Get root level content
  let rootItems = await extractFolderContent(page);
  console.log('Root items:', rootItems.length);
  
  // Instead of navigating, let's just dump the page structure
  const pageStructure = await page.evaluate(() => {
    // Get all text content that looks like filenames
    const allText = [];
    const walker = document.createTreeWalker(document.body, 4 /* NodeFilter.SHOW_TEXT */);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent.trim();
      if (text && text.length > 3 && text.length < 100 && /\.(mp3|wav|m4a|png|jpg|mp4)$/i.test(text)) {
        allText.push(text);
      }
    }
    return allText;
  });
  
  console.log('Page text with file extensions:', pageStructure.length);
  pageStructure.forEach(t => console.log('  ', t));
  
  await browser.close();
}

main().catch(console.error);

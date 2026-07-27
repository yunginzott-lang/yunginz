const { chromium } = require('playwright');
const fs = require('fs');

const DROPBOX_URL = 'https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AOhY9196iP2jgrvJwYH_w8c?rlkey=fveetntu8ts50k9qvnucnlo1k&st=ygfuptgl&dl=0';

async function extractFileLinks(page) {
  // Get ALL links with /scl/ in href
  const allLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.map(a => ({
      href: a.getAttribute('href'),
      text: a.textContent?.trim().substring(0, 80),
      innerHtml: a.innerHTML?.substring(0, 100)
    })).filter(l => l.href && l.href.includes('/scl/'));
  });
  return allLinks;
}

async function navigateAndExtract(page, url, name) {
  console.log(`\n${name}:`);
  console.log(`  URL: ${url.substring(0, 100)}...`);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    
    // Try to extract file links
    const links = await extractFileLinks(page);
    console.log(`  Found ${links.length} /scl/ links`);
    
    // Filter to only audio files
    const audioLinks = links.filter(l => /\.mp3|\.wav|\.m4a/i.test(l.href));
    console.log(`  Audio files: ${audioLinks.length}`);
    
    // If no links found, dump some HTML for debugging
    if (links.length === 0) {
      const htmlSnippet = await page.evaluate(() => {
        // Check if main content area exists
        const main = document.querySelector('[role="main"], main, .page-content, .content');
        return main?.innerHTML?.substring(0, 500) || document.body?.innerHTML?.substring(0, 1000) || 'no body';
      });
      console.log(`  HTML snippet: ${htmlSnippet.substring(0, 300)}`);
    }
    
    return audioLinks.map(l => ({ name: l.text, href: l.href }));
  } catch (e) {
    console.log(`  Error: ${e.message.substring(0, 100)}`);
    return [];
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  console.log('Loading root...');
  await page.goto(DROPBOX_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  
  // Get root folders
  const rootLinks = await extractFileLinks(page);
  const rootFolders = rootLinks.filter(l => l.href.includes('/scl/fo/'));
  console.log(`\nRoot has ${rootFolders.length} folder links:`);
  
  // Try navigating to a few known folders to see if we can extract files
  const results = {};
  
  for (const folder of rootFolders) {
    const name = folder.text || 'unnamed';
    const audio = await navigateAndExtract(page, folder.href, name);
    
    if (audio.length > 0) {
      results[name] = audio;
      
      // Also check for subfolders inside
      const subfolderLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href*="/scl/fo/"]'))
          .map(a => ({ href: a.getAttribute('href'), text: a.textContent?.trim() }));
      });
      
      // Exclude the current folder link
      const realSubs = subfolderLinks.filter(l => !folder.href.includes(l.href?.split('?')[0]));
      
      if (realSubs.length > 0) {
        console.log(`  Subfolders: ${realSubs.length}`);
        for (const sub of realSubs.slice(0, 5)) {
          const subName = `${name}/${sub.text}`;
          const subAudio = await navigateAndExtract(page, sub.href, subName);
          if (subAudio.length > 0) {
            results[subName] = subAudio;
          }
        }
      }
    }
    
    // Break after a few to test
    if (Object.keys(results).length >= 3) break;
  }
  
  console.log('\n\n=== Results ===');
  for (const [folder, files] of Object.entries(results)) {
    console.log(`\n${folder}:`);
    files.forEach(f => console.log(`  ${f.name.substring(0, 60)}`));
  }
  
  await browser.close();
})();

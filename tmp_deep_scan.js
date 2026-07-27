const { chromium } = require('playwright');

async function getFiles(page, url, depth = 0) {
  if (depth > 4) return [];
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
  } catch(e) { 
    await page.waitForTimeout(3000);
  }

  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const folders = [];
    const files = [];
    
    for (const a of links) {
      const text = a.textContent.trim();
      const href = a.href;
      if (!text || !href || !href.includes('dropbox.com/scl/')) continue;
      
      // Detect if it's a file or folder
      if (text.toLowerCase().endsWith('.mp3') || text.toLowerCase().endsWith('.wav') || 
          text.toLowerCase().endsWith('.m4a') || text.toLowerCase().endsWith('.aac')) {
        files.push({ name: text, href, type: text.split('.').pop().toLowerCase() });
      } else if (!text.includes(' ')) {
        // Could be a folder name (single word)
        folders.push({ name: text, href });
      }
    }
    
    // Also get visible text for all rows
    const rows = document.body ? document.body.innerText.split('\n').filter(l => l.trim()) : [];
    const audioLines = rows.filter(l => 
      l.toLowerCase().includes('.mp3') || l.toLowerCase().includes('.wav') || 
      l.toLowerCase().includes('.m4a') || l.toLowerCase().includes('.aac')
    );
    
    return { folders: folders.filter(f => !f.name.includes('.')), files, audioLines };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 2000 });

  const baseUrl = 'https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AOhY9196iP2jgrvJwYH_w8c?rlkey=fveetntu8ts50k9qvnucnlo1k&st=ygfuptgl&dl=0';

  // Get root folders
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  
  // Accept cookies
  try {
    const acceptBtn = await page.locator('button:has-text("Accept All")').first();
    if (await acceptBtn.isVisible({ timeout: 3000 })) {
      await acceptBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch(e) {}

  const rootData = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="dl=0"]');
    return Array.from(links).map(a => ({ name: a.textContent.trim(), href: a.href }))
      .filter(f => f.name && !f.name.includes('Privacy') && !f.name.includes('Dropbox') && !f.name.includes('http'));
  });

  console.log(`Root folders: ${rootData.length}`);

  // Scan each folder recursively
  const allDropboxMP3s = [];

  for (const folder of rootData) {
    process.stdout.write(`\n${folder.name}: `);
    const result = await getFiles(page, folder.href);
    
    // Check for audio files at this level
    for (const f of result.files) {
      allDropboxMP3s.push({ path: folder.name + '/' + f.name, ...f });
    }
    
    // Check audio in visible text
    for (const line of result.audioLines) {
      if (!allDropboxMP3s.some(m => m.name === line.trim())) {
        allDropboxMP3s.push({ path: folder.name + '/' + line.trim(), name: line.trim(), type: 'mp3', href: '' });
      }
    }
    
    process.stdout.write(`${result.files.length} files, ${result.audioLines.length} text matches`);
    
    // Navigate into subfolders (Mp3, mp3, MP3, collabs, stems, afrobeats, etc.)
    const subfolders = result.folders;
    if (subfolders.length > 0) {
      process.stdout.write(` (${subfolders.length} subdirs)`);
      
      // Look for audio in up to 5 subfolders
      let subCount = 0;
      for (const sub of subfolders.slice(0, 5)) {
        const subResult = await getFiles(page, sub.href);
        for (const f of subResult.files) {
          allDropboxMP3s.push({ path: folder.name + '/' + sub.name + '/' + f.name, ...f });
        }
        for (const line of subResult.audioLines) {
          if (!allDropboxMP3s.some(m => m.name === line.trim())) {
            allDropboxMP3s.push({ path: folder.name + '/' + sub.name + '/' + line.trim(), name: line.trim(), type: 'mp3', href: '' });
          }
        }
        subCount += subResult.files.length + subResult.audioLines.length;
      }
      if (subCount > 0) process.stdout.write(` -> +${subCount} from subdirs`);
    }
  }

  // De-duplicate by name
  const seen = new Set();
  const uniqueMP3s = allDropboxMP3s.filter(m => {
    const key = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\n\n=== TOTAL UNIQUE AUDIO FILES IN DROPBOX: ${uniqueMP3s.length} ===`);
  uniqueMP3s.sort((a, b) => a.path.localeCompare(b.path));
  uniqueMP3s.forEach(m => console.log(`  ${m.path}`));

  await browser.close();
})();

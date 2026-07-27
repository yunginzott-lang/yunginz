const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright');

(async () => {
  // 1. Get all DB beats - extract unique file suffix from preview URLs
  const prisma = new PrismaClient();
  const dbBeats = await prisma.beat.findMany({ select: { title: true, slug: true, previewMp3Url: true } });
  
  // Build set of unique file identifiers from DB
  const dbFileSuffixes = new Set();
  const dbFilenames = new Set();
  for (const b of dbBeats) {
    const url = b.previewMp3Url;
    // For /scl/fo/ URLs: extract after "5zhuwdzkqf8w5b9r71swh/"
    const foMatch = url.match(/\/scl\/fo\/5zhuwdzkqf8w5b9r71swh\/([^?]+)/);
    if (foMatch) {
      dbFileSuffixes.add(decodeURIComponent(foMatch[1]));
    }
    // For /scl/fi/ URLs: extract unique ID
    const fiMatch = url.match(/\/scl\/fi\/([^/]+)\/([^?]+)/);
    if (fiMatch) {
      dbFilenames.add(decodeURIComponent(fiMatch[2]).toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
    // Also add title-based lookup
    dbFilenames.add(b.title.toLowerCase().replace(/[^a-z0-9]/g, ''));
  }
  console.log(`DB has ${dbBeats.length} beats, ${dbFileSuffixes.size} unique /scl/fo/ paths`);

  // 2. Scan Dropbox folder for files
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

  const rootItems = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="scl/fo/"][href*="dl=0"]'))
      .map(a => ({ name: a.textContent.trim(), href: a.href }))
      .filter(f => f.name && !f.name.includes('Privacy') && !f.name.includes('Dropbox') && f.name.length < 100);
  });

  async function getFiles(page, url) {
    try { await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }); } catch(e) {}
    await page.waitForTimeout(1000);
    
    return await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const files = [];
      const subdirs = [];
      
      for (const a of links) {
        const text = a.textContent.trim();
        const href = a.href;
        if (!text || !href) continue;
        
        if (/\.(mp3|wav|m4a|flac)$/i.test(text) && text.length > 3) {
          // Extract the unique file path after the root folder ID
          const pathMatch = href.match(/\/scl\/fo\/5zhuwdzkqf8w5b9r71swh\/([^?]+)/);
          const path = pathMatch ? decodeURIComponent(pathMatch[1]) : '';
          files.push({ name: text, href, path });
        } else if (!text.includes('.') && text.length < 100 && !text.includes(' ') && href.includes('scl/fo/') && href.includes('dl=0') && href !== url) {
          subdirs.push({ name: text, href });
        }
      }
      return { files: files.filter(f => f.path.length > 5), subdirs };
    });
  }

  const allFiles = [];
  
  for (const item of rootItems) {
    process.stdout.write(`\n${item.name}: `);
    const data = await getFiles(page, item.href);
    
    for (const f of data.files) {
      allFiles.push(f);
      const isInDb = dbFileSuffixes.has(f.path);
      if (!isInDb) {
        // Also check by filename
        const fn = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        let found = false;
        for (const dbFn of dbFilenames) {
          if (fn.includes(dbFn) || dbFn.includes(fn)) { found = true; break; }
        }
        if (!found) {
          console.log(`\n  MISSING: "${f.name}"`);
          console.log(`    Path: ${f.path}`);
        }
      }
    }
    process.stdout.write(`${data.files.length} files, ${data.subdirs.length} subdirs`);

    // Subfolders
    for (const sub of data.subdirs.slice(0, 5)) {
      process.stdout.write(`\n  [${sub.name}]: `);
      const subData = await getFiles(page, sub.href);
      for (const f of subData.files) {
        allFiles.push(f);
        const isInDb = dbFileSuffixes.has(f.path);
        if (!isInDb) {
          const fn = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          let found = false;
          for (const dbFn of dbFilenames) {
            if (fn.includes(dbFn) || dbFn.includes(fn)) { found = true; break; }
          }
          if (!found) {
            console.log(`\n  MISSING: "${f.name}"`);
            console.log(`    Path: ${f.path}`);
          }
        }
      }
      process.stdout.write(`${subData.files.length} files`);
    }
  }

  console.log(`\n\n=== TOTAL FILES SCANNED: ${allFiles.length} ===`);

  await browser.close();
  await prisma.$disconnect();
})();

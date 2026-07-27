const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright');

(async () => {
  // 1. Get all DB beats
  const prisma = new PrismaClient();
  const dbBeats = await prisma.beat.findMany({ select: { title: true, slug: true, previewMp3Url: true } });
  const dbTitles = new Set(dbBeats.map(b => b.title.toLowerCase()));
  console.log(`DB has ${dbBeats.length} beats`);

  // Helper to normalize title for comparison
  function getTitleFromFile(filename) {
    let name = filename.replace(/\.(mp3|wav|m4a|flac)$/i, '').trim();
    // Remove leading tags like "(melodic, ambient)", "(dark, trap)" etc.
    name = name.replace(/^\([^)]*\)\s*-\s*/i, '');
    name = name.replace(/^\([^)]*\)\s*/i, '');
    // Remove trailing tags like @yunginz.prod etc.
    name = name.replace(/\s+@\S+/g, '');
    // Strip bpm info
    name = name.replace(/\d+\s*bpm\b/i, '');
    // Strip leading numbering like "#1", "10.", "101"
    name = name.replace(/^[\d#]+\s+/, '');
    // Clean up
    name = name.replace(/\[[^\]]*\]/g, '').trim();
    name = name.replace(/\s+/g, ' ').trim();
    return name;
  }

  async function scanForFiles(page, url, label) {
    try { await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }); } catch(e) {}
    await page.waitForTimeout(1000);
    
    const result = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const fileLinks = [];
      const subfolders = [];
      
      for (const a of links) {
        const text = a.textContent.trim();
        const href = a.href;
        if (!text || !href) continue;
        
        if (/\.(mp3|wav|m4a|flac)$/i.test(text)) {
          fileLinks.push({ name: text, href });
        } else if (!text.includes('.') && text.length < 100 && !text.includes(' ') && href.includes('scl/fo/') && href.includes('dl=0')) {
          subfolders.push({ name: text, href });
        }
      }
      return { fileLinks: fileLinks.filter(f => f.name.length > 3), subfolders };
    });

    // Check each file against DB
    const missing = [];
    for (const f of result.fileLinks) {
      const derived = getTitleFromFile(f.name);
      // Also normalize the filename
      const normalizedFile = f.name.replace(/\.(mp3|wav|m4a)$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      
      let found = false;
      for (const t of dbTitles) {
        const normalizedTitle = t.replace(/[^a-z0-9]/g, '');
        if (normalizedFile.includes(normalizedTitle) || normalizedTitle.includes(normalizedFile)) {
          found = true;
          break;
        }
      }
      
      if (!found) {
        missing.push({ name: f.name, href: f.href, folder: label });
      }
    }
    
    return { missing, subfolders: result.subfolders.filter(s => s && s.name) };
  }

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

  const allMissing = [];

  for (const item of rootItems) {
    process.stdout.write(`\n${item.name}: `);
    const result = await scanForFiles(page, item.href, item.name);
    
    if (result.missing.length > 0) {
      process.stdout.write(`${result.missing.length} NEW`);
      result.missing.forEach(m => process.stdout.write(`\n  "${m.name}"`));
      allMissing.push(...result.missing);
    } else {
      process.stdout.write(`0 missing`);
    }

    // Scan subfolders (up to 5)
    for (const sub of result.subfolders.slice(0, 5)) {
      process.stdout.write(`\n  [${sub.name}]: `);
      const subResult = await scanForFiles(page, sub.href, `${item.name}/${sub.name}`);
      
      if (subResult.missing.length > 0) {
        process.stdout.write(`${subResult.missing.length} NEW`);
        subResult.missing.forEach(m => process.stdout.write(`\n    "${m.name}"`));
        allMissing.push(...subResult.missing);
      } else {
        process.stdout.write(`0 missing`);
      }
    }
  }

  console.log(`\n\n=== MISSING BEATS: ${allMissing.length} ===`);
  allMissing.forEach(m => {
    console.log(`\nFolder: ${m.folder}`);
    console.log(`  Title: ${m.name}`);
    console.log(`  URL: ${m.href}`);
  });

  await browser.close();
  await prisma.$disconnect();
})();

const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright');

(async () => {
  const prisma = new PrismaClient();
  const dbBeats = await prisma.beat.findMany({ select: { title: true, slug: true, previewMp3Url: true } });
  
  // Build DB lookup sets
  const dbFoPaths = new Set();
  const dbAllNames = new Set();
  for (const b of dbBeats) {
    const url = b.previewMp3Url;
    const foMatch = url.match(/\/scl\/fo\/5zhuwdzkqf8w5b9r71swh\/([^?]+)/);
    if (foMatch) dbFoPaths.add(decodeURIComponent(foMatch[1]));
    dbAllNames.add(b.title.toLowerCase().replace(/[^a-z0-9]/g, ''));
    // Also from filename in URL
    const fn = url.split('/').pop()?.split('?')[0];
    if (fn) dbAllNames.add(decodeURIComponent(fn).toLowerCase().replace(/[^a-z0-9]/g, ''));
  }
  console.log(`DB: ${dbBeats.length} beats, ${dbFoPaths.size} fo paths`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 2000 });
  const base = 'https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AOhY9196iP2jgrvJwYH_w8c?rlkey=fveetntu8ts50k9qvnucnlo1k&st=ygfuptgl&dl=0';

  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  
  // Accept cookies
  try {
    const btn = await page.locator('button:has-text("Accept")').first();
    if (await btn.isVisible({ timeout: 2000 })) { await btn.click(); await page.waitForTimeout(1000); }
  } catch(e) {}

  // Scroll to trigger lazy loading of all folder links
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
  }

  const rootItems = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="scl/fo/"][href*="dl=0"]'));
    const items = [];
    const seen = new Set();
    for (const a of links) {
      const name = a.textContent.trim();
      if (name && !seen.has(name) && name.length < 100 && !name.includes('Privacy') && !name.includes('Dropbox') && !name.includes(' ')) {
        seen.add(name);
        items.push({ name, href: a.href });
      }
    }
    return items;
  });

  console.log(`Root folders: ${rootItems.length}`);
  rootItems.slice(0, 5).forEach(f => console.log(`  ${f.name}`));

  async function getFiles(page, url) {
    try { await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }); } catch(e) { console.log(`    TIMEOUT: ${url.substring(0,80)}`); }
    await page.waitForTimeout(1000);
    
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
          const pathMatch = href.match(/\/scl\/fo\/5zhuwdzkqf8w5b9r71swh\/([^?]+)/);
          if (pathMatch) {
            const path = decodeURIComponent(pathMatch[1]);
            if (!hrefSet.has(path)) {
              hrefSet.add(path);
              files.push({ name: text, href, path });
            }
          }
        } else if (text.length < 100 && !text.includes('.') && href.includes('scl/fo/') && href.includes('dl=0') && href !== parentUrl && !hrefSet.has(href) && !text.includes('Privacy')) {
          hrefSet.add(href);
          subdirs.push({ name: text, href });
        }
      }
      return { files, subdirs: subdirs.filter(s => s.name && !s.name.includes(' ')) };
    }, url);
  }

  const allMissing = [];

  for (const item of rootItems) {
    process.stdout.write(`\n${item.name}: `);
    try {
      const data = await getFiles(page, item.href);
      process.stdout.write(`${data.files.length} files, ${data.subdirs.length} subdirs`);
      
      for (const f of data.files) {
        const byPath = dbFoPaths.has(f.path);
        const fn = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const byName = [...dbAllNames].some(dbn => fn.includes(dbn) || dbn.includes(fn));
        
        if (!byPath && !byName) {
          console.log(`\n  MISSING: "${f.name}"`);
          allMissing.push(f);
        }
      }

      for (const sub of data.subdirs.slice(0, 5)) {
        process.stdout.write(`\n  ->${sub.name}: `);
        try {
          const subData = await getFiles(page, sub.href);
          process.stdout.write(`${subData.files.length} files`);
          
          for (const f of subData.files) {
            const byPath = dbFoPaths.has(f.path);
            const fn = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const byName = [...dbAllNames].some(dbn => fn.includes(dbn) || dbn.includes(fn));
            
            if (!byPath && !byName) {
              console.log(`\n    MISSING: "${f.name}"`);
              allMissing.push(f);
            }
          }
        } catch(e) { process.stdout.write('error'); }
      }
    } catch(e) { process.stdout.write(`error: ${e.message.substring(0, 50)}`); }
  }

  console.log(`\n\n=== MISSING BEATS: ${allMissing.length} ===`);
  allMissing.forEach(m => {
    console.log(`\n  "${m.name}"`);
    console.log(`  URL: ${m.href}`);
  });

  await browser.close();
  await prisma.$disconnect();
})();

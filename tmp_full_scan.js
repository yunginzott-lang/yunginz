const { chromium } = require('playwright');

(async () => {
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

  async function scanFolder(url, label) {
    try { await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }); } catch(e) {}
    await page.waitForTimeout(1000);
    
    return await page.evaluate((lbl) => {
      const text = document.body ? document.body.innerText : '';
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      
      // Get all links with their text and href
      const links = Array.from(document.querySelectorAll('a'));
      const fileLinks = links
        .map(a => ({ name: a.textContent.trim(), href: a.href }))
        .filter(f => f.name && f.href && /\.(mp3|wav|m4a|flac)$/i.test(f.name));
      
      // Also get audio from text
      const audioNames = lines.filter(l => /\.(mp3|wav|m4a|flac)$/i.test(l));
      
      // Get subfolder links
      const subfolders = links
        .map(a => ({ name: a.textContent.trim(), href: a.href }))
        .filter(f => f.name && f.href && f.href.includes('scl/fo/') && f.href.includes('dl=0') && f.name.length < 100 && !f.name.includes('.') && f.name !== lbl && !f.name.includes('Privacy'));
      
      return { fileLinks, audioNames, subfolders: subfolders.filter(s => s && s.name) };
    }, label);
  }

  const allResults = {};

  for (const item of rootItems) {
    process.stdout.write(`\n--- ${item.name} ---`);
    const data = await scanFolder(item.href, item.name);
    allResults[item.name] = { files: data.fileLinks, audio: data.audioNames, subs: {} };
    
    // Log files found directly
    if (data.fileLinks.length > 0) {
      process.stdout.write(`\n  Files (${data.fileLinks.length}):`);
      data.fileLinks.forEach(f => process.stdout.write(`\n    ${f.name}`));
    } else if (data.audioNames.length > 0) {
      process.stdout.write(`\n  Audio names (${data.audioNames.length}):`);
      data.audioNames.slice(0, 5).forEach(a => process.stdout.write(`\n    ${a}`));
      if (data.audioNames.length > 5) process.stdout.write(`\n    ... and ${data.audioNames.length - 5} more`);
    } else {
      process.stdout.write(` (${data.subfolders.length} subdirs)`);
    }

    // Scan subfolders (Mp3, collabs, etc.)
    for (const sub of data.subfolders) {
      process.stdout.write(`\n  -> ${sub.name}: `);
      const subData = await scanFolder(sub.href, sub.name);
      allResults[item.name].subs[sub.name] = subData;
      
      if (subData.fileLinks.length > 0) {
        process.stdout.write(`${subData.fileLinks.length} files`);
        subData.fileLinks.forEach(f => process.stdout.write(`\n      ${f.name}`));
      } else if (subData.audioNames.length > 0) {
        process.stdout.write(`${subData.audioNames.length} audio`);
        subData.audioNames.slice(0, 30).forEach(a => process.stdout.write(`\n      ${a}`));
      } else {
        process.stdout.write(`0 audio`);
      }
    }
  }

  // Print summary
  console.log('\n\n=== COMPLETE FILE LISTING ===\n');
  for (const [folder, data] of Object.entries(allResults)) {
    console.log(`\n${folder}:`);
    for (const f of data.files) console.log(`  [FILE] ${f.name} @ ${f.href}`);
    for (const a of data.audio) console.log(`  [AUDIO] ${a}`);
    for (const [sub, subData] of Object.entries(data.subs)) {
      console.log(`  [${sub}]:`);
      for (const f of subData.fileLinks) console.log(`    [FILE] ${f.name} @ ${f.href}`);
      for (const a of subData.audio) console.log(`    [AUDIO] ${a}`);
    }
  }

  await browser.close();
})();

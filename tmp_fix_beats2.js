const https = require('https');
const http = require('http');

const DATABASE_URL = 'postgresql://neondb_owner:npg_4dBH2vOnohXe@ep-ancient-haze-am18bih3.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';

function fixUrl(url) {
  // Change dl=0 to raw=1 for streaming preview
  return url.replace(/\bdl=0\b/g, 'raw=1');
}

function dlUrl(url) {
  // Change dl=0 to dl=1 for download delivery
  return url.replace(/\bdl=0\b/g, 'dl=1');
}

function getFileInfo(rawUrl) {
  return new Promise((resolve) => {
    const proto = rawUrl.startsWith('https') ? https : http;
    const req = proto.get(rawUrl, { 
      headers: { Range: 'bytes=0-2047' },
      timeout: 15000 
    }, (res) => {
      let contentLength = null;
      const cr = res.headers['content-range'];
      if (cr) {
        const m = cr.match(/\/(\d+)$/);
        if (m) contentLength = parseInt(m[1]);
      }
      
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let bitrate = null;
        let sampleRate = null;
        
        // Find first valid MPEG frame header
        for (let i = 0; i < buf.length - 3; i++) {
          if (buf[i] === 0xFF && (buf[i+1] & 0xE0) === 0xE0) {
            const h = buf.readUInt32BE(i);
            const ver = (h >> 19) & 0x3; // 3=MPEG1, 2=MPEG2
            const layer = (h >> 17) & 0x3; // 3=L1, 2=L2, 1=L3
            const bidx = (h >> 12) & 0xF;
            const sidx = (h >> 10) & 0x3;
            
            if (ver !== 1 && layer !== 0 && bidx > 0 && bidx < 15 && sidx < 3) {
              // Bitrate tables (kbps)
              const rates = {
                '3:3': [0,32,64,96,128,160,192,224,256,288,320,352,384,416,448],
                '3:2': [0,32,48,56,64,80,96,112,128,160,192,224,256,320,384],
                '3:1': [0,32,64,96,128,160,192,224,256,288,320,352,384,416,448],
                '2:3': [0,32,48,56,64,80,96,112,128,144,160,176,192,224,256],
                '2:2': [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160],
                '2:1': [0,32,48,56,64,80,96,112,128,144,160,176,192,224,256],
              };
              const srMap = { '3': [44100,48000,32000], '2': [22050,24000,16000], '0': [11025,12000,8000] };
              
              bitrate = (rates[`${ver}:${layer}`] || [])[bidx] || null;
              sampleRate = (srMap[ver] || [])[sidx] || null;
              break;
            }
          }
        }
        
        resolve({ contentLength, bitrate, sampleRate });
      });
    });
    req.on('error', () => resolve({ contentLength: null, bitrate: null, sampleRate: null }));
    req.on('timeout', () => { req.destroy(); resolve({ contentLength: null, bitrate: null, sampleRate: null }); });
  });
}

(async () => {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(DATABASE_URL);
  
  const beats = await sql`SELECT id, title, "previewMp3Url" FROM "Beat" WHERE "durationSeconds" IS NULL`;
  console.log(`Found ${beats.length} beats without duration`);
  
  let count = 0;
  for (const beat of beats) {
    count++;
    const oldUrl = beat.previewMp3Url;
    const newUrl = fixUrl(oldUrl);
    
    process.stdout.write(`[${count}/${beats.length}] ${beat.title}... `);
    
    const info = await getFileInfo(newUrl);
    let duration = null;
    
    if (info.contentLength && info.bitrate && info.bitrate > 0) {
      duration = Math.round((info.contentLength * 8) / (info.bitrate * 1000));
    }
    if (!duration || duration <= 0 || duration > 600) duration = 200;
    
    // Update preview URL and duration
    await sql`UPDATE "Beat" SET "previewMp3Url" = ${newUrl}, "durationSeconds" = ${duration} WHERE id = ${beat.id}`;
    
    // Add delivery links
    const licenses = await sql`SELECT id, "licenseTemplateId" FROM "BeatLicense" WHERE "beatId" = ${beat.id}`;
    const templates = await sql`SELECT id, code FROM "LicenseTemplate" ORDER BY "sortOrder" ASC`;
    const tmplMap = {};
    templates.forEach(t => tmplMap[t.code] = t.id);
    
    const dl = dlUrl(oldUrl);
    
    for (const lic of licenses) {
      const existing = await sql`SELECT COUNT(*) as cnt FROM "BeatLicenseDeliveryLink" WHERE "beatLicenseId" = ${lic.id}`;
      if (existing[0].cnt > 0) continue;
      
      await sql`
        INSERT INTO "BeatLicenseDeliveryLink" (id, "beatLicenseId", label, url, "sortOrder")
        VALUES (gen_random_uuid()::text, ${lic.id}, 'MP3', ${dl}, 0)
      `;
    }
    
    process.stdout.write(`✓ ${duration}s\n`);
  }
  
  console.log(`\nDone! ${count} beats updated.`);
  process.exit(0);
})();

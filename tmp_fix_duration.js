const https = require('https');
const http = require('http');
const DATABASE_URL = 'postgresql://neondb_owner:npg_4dBH2vOnohXe@ep-ancient-haze-am18bih3.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function getDuration(rawUrl) {
  const { contentLength, buf } = await fetchRange(rawUrl, 'bytes=0-2047');
  if (!buf || buf.length < 10) return 200;
  
  // Skip ID3 tag
  let offset = 0;
  if (buf.slice(0,3).toString() === 'ID3') {
    const size = ((buf[6] & 0x7F) << 21) | ((buf[7] & 0x7F) << 14) | ((buf[8] & 0x7F) << 7) | (buf[9] & 0x7F);
    offset = 10 + size;
  }
  
  // Find first valid MPEG frame header
  for (let i = offset; i < Math.min(buf.length - 3, offset + 200); i++) {
    if (buf[i] === 0xFF && (buf[i+1] & 0xE0) === 0xE0) {
      const h = buf.readUInt32BE(i);
      const ver = (h >> 19) & 0x3;
      const layer = (h >> 17) & 0x3;
      const bidx = (h >> 12) & 0xF;
      const sidx = (h >> 10) & 0x3;
      const pad = (h >> 9) & 0x1;
      
      if (ver !== 1 && layer !== 0 && bidx > 0 && bidx < 15 && sidx < 3) {
        const rates = {
          '3:3':[0,32,64,96,128,160,192,224,256,288,320,352,384,416,448],
          '3:2':[0,32,48,56,64,80,96,112,128,160,192,224,256,320,384],
          '3:1':[0,32,64,96,128,160,192,224,256,288,320,352,384,416,448],
          '2:3':[0,32,48,56,64,80,96,112,128,144,160,176,192,224,256],
          '2:2':[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160],
          '2:1':[0,32,48,56,64,80,96,112,128,144,160,176,192,224,256],
        };
        const srs = { '3':[44100,48000,32000], '2':[22050,24000,16000], '0':[11025,12000,8000] };
        
        const bitrate = (rates[`${ver}:${layer}`] || [])[bidx];
        const sr = (srs[ver] || [])[sidx];
        
        if (bitrate && sr) {
          // Try to find Xing/Info header for exact frame count
          for (let j = i + 4; j < buf.length - 4 && j < i + 200; j++) {
            const tag = buf.slice(j, j+4).toString();
            if (tag === 'Xing' || tag === 'Info') {
              const flags = buf.readUInt32BE(j + 4);
              let foff = j + 8;
              if (flags & 1) { // has frame count
                const numFrames = buf.readUInt32BE(foff);
                const samples = ver === 3 ? (layer === 3 ? 384 : 1152) : (layer === 3 ? 384 : 576);
                const dur = Math.round((numFrames * samples) / sr);
                if (dur > 0 && dur < 600) return dur;
              }
              break;
            }
          }
          
          // Fallback: estimate from frame size
          if (contentLength) {
            const samples = ver === 3 ? (layer === 3 ? 384 : 1152) : (layer === 3 ? 384 : 576);
            const frameSize = layer === 3 
              ? Math.floor((12000 * bitrate) / sr + pad) * 4
              : Math.floor((144000 * bitrate) / sr + pad);
            if (frameSize > 0) {
              const numFrames = Math.floor(contentLength / frameSize);
              const dur = Math.round((numFrames * samples) / sr);
              if (dur > 0 && dur < 600) return dur;
            }
          }
        }
        break;
      }
    }
  }
  return 200;
}

function fetchRange(url, range) {
  return new Promise((resolve) => {
    const follow = (u, depth) => {
      if (depth > 5) { resolve({}); return; }
      const proto = u.startsWith('https') ? https : http;
      const req = proto.get(u, { headers: { Range: range }, timeout: 15000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, depth + 1);
        } else {
          const cr = res.headers['content-range'];
          let contentLength = null;
          if (cr) { const m = cr.match(/\/(\d+)$/); if (m) contentLength = parseInt(m[1]); }
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve({ contentLength, buf: Buffer.concat(chunks) }));
        }
      });
      req.on('error', () => resolve({}));
      req.on('timeout', () => { req.destroy(); resolve({}); });
    };
    follow(url, 0);
  });
}

(async () => {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(DATABASE_URL);
  
  const beats = await sql`SELECT id, title, "previewMp3Url" FROM "Beat" WHERE "durationSeconds" = 200`;
  console.log(`Found ${beats.length} beats with placeholder duration\n`);
  
  let count = 0;
  for (const beat of beats) {
    count++;
    process.stdout.write(`[${count}/${beats.length}] ${beat.title}... `);
    const dur = await getDuration(beat.previewMp3Url);
    await sql`UPDATE "Beat" SET "durationSeconds" = ${dur} WHERE id = ${beat.id}`;
    process.stdout.write(`${dur}s\n`);
  }
  
  console.log(`\nDone! Updated ${count} beats.`);
  process.exit(0);
})();

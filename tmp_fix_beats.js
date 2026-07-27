const { PrismaClient } = require('@prisma/client');
const https = require('https');
const http = require('http');

const prisma = new PrismaClient();

// Fix 1: Change preview URLs from dl=0 to raw=1 for streaming
function fixPreviewUrl(url) {
  return url.replace(/\bdl=0\b/, 'raw=1');
}

// Fix 2: Get MP3 duration from HTTP stream
function getMp3Duration(url) {
  return new Promise((resolve) => {
    const rawUrl = url.replace(/\bdl=0\b/, 'raw=1');
    const proto = rawUrl.startsWith('https') ? https : http;
    
    // Request first 2KB to find MP3 header
    const req = proto.get(rawUrl, { headers: { Range: 'bytes=0-4095' } }, (res) => {
      const chunks = [];
      let totalSize = null;
      
      // Get content length from Content-Range or Content-Length
      const contentRange = res.headers['content-range'];
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) totalSize = parseInt(match[1]);
      }
      if (!totalSize && res.headers['content-length']) {
        const cl = parseInt(res.headers['content-length']);
        // If we requested a range, the full size is in content-range
        // Otherwise content-length might be just the response size
      }
      
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        // Try to find Xing/Info header (VBR files)
        // Xing header is at a fixed offset in the first MP3 frame
        let duration = null;
        
        // Search for Xing/Info header
        for (let i = 0; i < buffer.length - 4; i++) {
          const tag = buffer.toString('utf8', i, i + 4);
          if (tag === 'Xing' || tag === 'Info') {
            // VBR header found
            // Offset 4 bytes from tag: flags (4 bytes)
            // If flag 0x0001 set: frame count (4 bytes) at offset 8
            // If flag 0x0002 set: bytes count (4 bytes) at offset 12
            // If flag 0x0004 set: TOC (100 bytes) at offset 16
            // If flag 0x0008 set: VBR scale (4 bytes)
            
            const flags = buffer.readUInt32BE(i + 4);
            let offset = i + 8;
            
            let numFrames = null;
            let numBytes = null;
            
            if (flags & 1) { // Frames flag
              numFrames = buffer.readUInt32BE(offset);
              offset += 4;
            }
            if (flags & 2) { // Bytes flag
              numBytes = buffer.readUInt32BE(offset);
              offset += 4;
            }
            
            if (numFrames && totalSize) {
              // Need sample rate to calculate duration
              // Find first MPEG frame header (before Xing tag)
              const frameHeader = findFrameHeader(buffer, i);
              if (frameHeader) {
                const sampleRate = getSampleRate(frameHeader);
                const samplesPerFrame = getSamplesPerFrame(frameHeader);
                if (sampleRate && samplesPerFrame) {
                  duration = (numFrames * samplesPerFrame) / sampleRate;
                }
              }
            }
            break;
          }
        }
        
        // If no Xing header, try CBR calculation from first frame header
        if (!duration) {
          const frameHeader = findFrameHeader(buffer, 0);
          if (frameHeader) {
            const bitrate = getBitrate(frameHeader);
            const sampleRate = getSampleRate(frameHeader);
            if (bitrate && sampleRate && totalSize) {
              // For CBR: duration = fileSize * 8 / bitrate (bits per second)
              duration = (totalSize * 8) / (bitrate * 1000);
            } else if (frameHeader) {
              // Fallback: estimate from frame size
              const frameSize = getFrameSize(frameHeader);
              const samplesPerFrame = getSamplesPerFrame(frameHeader);
              if (frameSize > 0 && totalSize) {
                const numFrames = Math.floor(totalSize / frameSize);
                duration = (numFrames * samplesPerFrame) / sampleRate;
              }
            }
          }
        }
        
        // Fallback: use 200 seconds
        if (!duration || isNaN(duration) || duration <= 0) {
          duration = 200;
        }
        
        resolve(Math.round(duration));
      });
    });
    
    req.on('error', () => resolve(200));
    req.setTimeout(10000, () => { req.destroy(); resolve(200); });
  });
}

function findFrameHeader(buffer, startOffset) {
  for (let i = Math.max(0, startOffset - 10); i < Math.min(buffer.length - 4, startOffset + 100); i++) {
    if (buffer[i] === 0xFF && (buffer[i + 1] & 0xE0) === 0xE0) {
      // Check for valid MPEG audio sync word
      const header = buffer.readUInt32BE(i);
      // Verify it's a valid frame (not a false sync)
      const version = (header >> 19) & 0x3;
      const layer = (header >> 17) & 0x3;
      const bitrateIdx = (header >> 12) & 0xF;
      const sampleRateIdx = (header >> 10) & 0x3;
      
      if (version !== 1 && layer !== 0 && bitrateIdx !== 0 && bitrateIdx !== 0xF && sampleRateIdx !== 3) {
        return header;
      }
    }
  }
  return null;
}

function getBitrate(header) {
  const bitrateTable = {
    // MPEG1
    '3:3': [0,32,64,96,128,160,192,224,256,288,320,352,384,416,448],
    '3:2': [0,32,48,56,64,80,96,112,128,160,192,224,256,320,384],
    '3:1': [0,32,64,96,128,160,192,224,256,288,320,352,384,416,448],
    // MPEG2
    '2:3': [0,32,48,56,64,80,96,112,128,144,160,176,192,224,256],
    '2:2': [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160],
    '2:1': [0,32,48,56,64,80,96,112,128,144,160,176,192,224,256],
  };
  
  const version = (header >> 19) & 0x3;
  const layer = (header >> 17) & 0x3;
  const idx = (header >> 12) & 0xF;
  
  const key = `${version}:${layer}`;
  const table = bitrateTable[key];
  return table ? table[idx] : null;
}

function getSampleRate(header) {
  const version = (header >> 19) & 0x3;
  const idx = (header >> 10) & 0x3;
  
  if (version === 3) { // MPEG1
    return [44100, 48000, 32000, null][idx];
  } else if (version === 2) { // MPEG2
    return [22050, 24000, 16000, null][idx];
  } else if (version === 0) { // MPEG2.5
    return [11025, 12000, 8000, null][idx];
  }
  return null;
}

function getSamplesPerFrame(header) {
  const version = (header >> 19) & 0x3;
  const layer = (header >> 17) & 0x3;
  
  if (version === 3) { // MPEG1
    return [384, 1152, 1152, null][layer];
  } else { // MPEG2/2.5
    return [384, 1152, 576, null][layer];
  }
}

function getFrameSize(header) {
  const version = (header >> 19) & 0x3;
  const layer = (header >> 17) & 0x3;
  const bitrate = getBitrate(header);
  const sampleRate = getSampleRate(header);
  const padding = (header >> 9) & 0x1;
  
  if (!bitrate || !sampleRate) return 0;
  
  if (layer === 3) { // Layer I
    return Math.floor((12000 * bitrate) / sampleRate + padding) * 4;
  } else { // Layer II/III
    const slotSize = version === 3 ? 1 : 1; // MPEG2.5 uses 1 byte slots
    return Math.floor((144000 * bitrate) / sampleRate + padding) * slotSize;
  }
}

(async () => {
  // Find new beats (added recently, no duration)
  const newBeats = await prisma.beat.findMany({
    where: { durationSeconds: null },
    select: {
      id: true, title: true, slug: true, previewMp3Url: true,
      licenses: { select: { id: true, licenseTemplate: { select: { name: true, code: true, sortOrder: true } } } }
    }
  });
  
  console.log(`Found ${newBeats.length} beats without duration`);
  
  // Connect to Neon DB
  const { neon } = require('@neondatabase/serverless');
  const sql = neon('postgresql://neondb_owner:npg_4dBH2vOnohXe@ep-ancient-haze-am18bih3.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require');
  
  let count = 0;
  for (const beat of newBeats) {
    count++;
    const oldUrl = beat.previewMp3Url;
    const newUrl = fixPreviewUrl(oldUrl);
    
    // Get duration
    console.log(`[${count}/${newBeats.length}] ${beat.title} - fetching...`);
    const duration = await getMp3Duration(oldUrl);
    console.log(`  duration: ${duration}s`);
    
    // Update beat: fix URL and set duration
    await sql`
      UPDATE "Beat" SET "previewMp3Url" = ${newUrl}, "durationSeconds" = ${duration} WHERE id = ${beat.id}
    `;
    
    // Add basic MP3 delivery link to Premium license (basic/sortOrder 0)
    const premiumLicense = beat.licenses.find(l => l.licenseTemplate.code === 'basic');
    if (premiumLicense) {
      const dlUrl = oldUrl.replace(/\bdl=0\b/, 'dl=1');
      await sql`
        INSERT INTO "BeatLicenseDeliveryLink" (id, "beatLicenseId", label, url, "sortOrder")
        VALUES (gen_random_uuid()::text, ${premiumLicense.id}, 'MP3', ${dlUrl}, 0)
      `;
    }
    
    // Add MP3 + WAV to PRO license
    const proLicense = beat.licenses.find(l => l.licenseTemplate.code === 'standard');
    if (proLicense) {
      const dlUrl = oldUrl.replace(/\bdl=0\b/, 'dl=1');
      await sql`
        INSERT INTO "BeatLicenseDeliveryLink" (id, "beatLicenseId", label, url, "sortOrder")
        VALUES (gen_random_uuid()::text, ${proLicense.id}, 'MP3', ${dlUrl}, 0)
      `;
    }
    
    // Add MP3 + WAV + Stems to Unlimited license
    const unlimitedLicense = beat.licenses.find(l => l.licenseTemplate.code === 'unlimited');
    if (unlimitedLicense) {
      const dlUrl = oldUrl.replace(/\bdl=0\b/, 'dl=1');
      await sql`
        INSERT INTO "BeatLicenseDeliveryLink" (id, "beatLicenseId", label, url, "sortOrder")
        VALUES (gen_random_uuid()::text, ${unlimitedLicense.id}, 'MP3', ${dlUrl}, 0)
      `;
    }
    
    // Add MP3 + WAV + Stems to Exclusive license
    const exclusiveLicense = beat.licenses.find(l => l.licenseTemplate.code === 'exclusive');
    if (exclusiveLicense) {
      const dlUrl = oldUrl.replace(/\bdl=0\b/, 'dl=1');
      await sql`
        INSERT INTO "BeatLicenseDeliveryLink" (id, "beatLicenseId", label, url, "sortOrder")
        VALUES (gen_random_uuid()::text, ${exclusiveLicense.id}, 'MP3', ${dlUrl}, 0)
      `;
    }
    
    console.log(`  ✓ updated`);
  }
  
  console.log(`\nDone! ${count} beats updated`);
  process.exit(0);
})();

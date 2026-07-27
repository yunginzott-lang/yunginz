const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseBpm(name) {
  const m = name.match(/(\d+)\s*bpm/i);
  return m ? parseInt(m[1]) : null;
}

function parseKey(name) {
  const m = name.match(/([A-G][#b]?\s*(?:maj|min|m|M)?)\b/i);
  if (!m) return 'N/A';
  let key = m[1];
  // Normalize
  key = key.replace(/\s+/g, '');
  if (key.length <= 2) {
    if (key.endsWith('m')) return key.charAt(0).toUpperCase() + '#' + 'min'.substring(key.includes('#') ? 1 : 0) + 'm';
    return key.toUpperCase();
  }
  if (key.toLowerCase().includes('maj')) return key.replace(/maj/i, '').toUpperCase();
  if (key.toLowerCase().includes('min')) return key.replace(/min/i, '').toUpperCase() + 'm';
  return key;
}

function extractMood(filename, genre) {
  const lower = filename.toLowerCase();
  if (lower.includes('dark')) return 'Dark';
  if (lower.includes('melodic')) return 'Melodic';
  if (lower.includes('wavy')) return 'Wavy';
  if (lower.includes('hard')) return 'Hard';
  if (lower.includes('soul')) return 'Soulful';
  if (lower.includes('ambient')) return 'Ambient';
  if (lower.includes('anthem')) return 'Anthem';
  if (lower.includes('club')) return 'Club';
  if (lower.includes('throwback')) return 'Throwback';
  if (lower.includes('soca') || lower.includes('bouyon')) return 'Energetic';
  if (lower.includes('afro')) return 'Afro';
  if (lower.includes('trapsoul') || lower.includes('rnb')) return 'R&B';
  if (genre === 'Dancehall') return 'Energetic';
  if (genre === 'Afrobeats') return 'Afro';
  if (genre === 'Soca') return 'Energetic';
  return 'Energetic';
}

function extractTitle(filename) {
  let name = filename.replace(/\.(mp3|wav|m4a)$/i, '').trim();
  // Remove leading parenthetical tags: "(dark, dancehall)" or "(melodic, ambient)"
  name = name.replace(/^\([^)]*\)\s*/g, '');
  // Remove @mentions
  name = name.replace(/\s+@\S+/g, '');
  // Remove bracketed content like [134bpm - D#m], [tagged]
  name = name.replace(/\[[^\]]*\]/g, '');
  // Remove BPM and key info like "108bpm Gm"
  name = name.replace(/\s*\d+\s*bpm[\s\S]*?(\s*-\s*|$)/i, '');
  // Remove trailing " - " or "prod." patterns
  name = name.replace(/\s*-\s*$/, '');
  name = name.replace(/\s*prod\..*$/i, '');
  // Remove "x" separator patterns at end  
  name = name.replace(/\s*x\s*@?\w+\s*$/i, '');
  // Remove "Yunginz - " or "yunginz - " prefix (but keep the rest)
  name = name.replace(/^Yunginz\s*[-–]\s*/i, '');
  name = name.replace(/^yunginz\s+-\s+/i, '');
  // Remove trailing commas, prices, and "x" patterns
  name = name.replace(/\s*,\s*$/, '');
  name = name.replace(/\s+x\s*$/, '');
  // Clean up extra spaces
  name = name.replace(/\s+/g, ' ').trim();
  return name || 'Unknown';
}

const missingBeats = [
  {
    filename: "Need Space - 100bpm @yunginz.prod (rough).mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/ALVKSyOv5jkmo-3dn_9n1Js/Caribbean/afrobeats/Need%20Space%20-%20100bpm%20%40yunginz.prod%20%28rough%29.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "NOTHIN 2 HIDE [ 104 BPM - Emaj ] prod. yunginz, choi$e, jelani.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/APx_FWsc13sERf1uGYSgTJ0/Caribbean/afrobeats/NOTHIN%202%20HIDE%20%5B%20104%20BPM%20-%20Emaj%20%5D%20prod.%20yunginz%2C%20choi%24e%2C%20jelani.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Praise 112bpm - @yunginz.prod.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/APtzU7r8qEBiqbnw8hDhitI/Caribbean/afrobeats/Praise%20112bpm%20-%20%40yunginz.prod.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Smoke 105BPM @yunginz.prod @4ORMANT.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/APcSwE8KflOLp1HoZY4AHlM/Caribbean/afrobeats/Smoke%20105BPM%20%40yunginz.prod%20%404ORMANT.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Somebody New 106bpm - @yunginz.prod.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AAPwMlhCVbItpO-aeM-zbFI/Caribbean/afrobeats/Somebody%20New%20106bpm%20-%20%40yunginz.prod.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Something about her [ 98 bpm ] @yunginz.prod x Choi$e x Bloke.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AHJvBjeAYTOb2sHkXwv1QfQ/Caribbean/afrobeats/Something%20about%20her%20%5B%2098%20bpm%20%5D%20%40yunginz.prod%20x%20Choi%24e%20x%20Bloke.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Stand By Me - Yunginz x Choi$e [ 104 bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/ABePWe7m4LhvumrkyLNKidQ/Caribbean/afrobeats/Stand%20By%20Me%20-%20Yunginz%20x%20Choi%EF%BF%BDe%20%5B%20104%20bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats",
    title: "Stand By Me"
  },
  {
    filename: "Stand By Me - Yunginz x Choi$e x Jelani [ 104 bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AJgUsjD3qr0BpJxUfr6xu8w/Caribbean/afrobeats/Stand%20By%20Me%20-%20Yunginz%20x%20Choi%EF%BF%BDe%20x%20Jelani%20%5B%20104%20bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats",
    title: "Stand By Me (Remix)"
  },
  {
    filename: "Tears 101bpm - @yunginz.prod, @prodbychoise, @jelaniwatson.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/ALmtfQekU7zhYjrgbIjcjeU/Caribbean/afrobeats/Tears%20101bpm%20-%20%40yunginz.prod%2C%20%40prodbychoise%2C%20%40jelaniwatson.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Walk Slow [ 99 bpm ] @yunginz.prod, @prodbychoise.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AMhHtzqXH2xaekWIuBtKobM/Caribbean/afrobeats/Walk%20Slow%20%5B%2099%20bpm%20%5D%20%40yunginz.prod%2C%20%40prodbychoise.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Yunginz - Fantasy 108bpm Gm.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AGsxwH9_oqO9qRthXzWPKgI/Caribbean/afrobeats/Yunginz%20-%20Fantasy%20108bpm%20Gm.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Yunginz - Head High 103bpm F#m.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AFT7oTFDWNpdYEUh5A_lu2A/Caribbean/afrobeats/Yunginz%20-%20Head%20High%20103bpm%20F%23m.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Yunginz - Holy Name 92bpm D#m.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AISMxWKSyoLm5TZ_poVIjZs/Caribbean/afrobeats/Yunginz%20-%20Holy%20Name%2092bpm%20D%23m.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "yunginz - love for who 101bpm.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AM3TXBIwe-p7JVjQ2b94tdM/Caribbean/afrobeats/yunginz%20-%20love%20for%20who%20101bpm.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Yunginz - lush DEMO 101BPM.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AIVpNeoPU09YgfZKbmy_55s/Caribbean/afrobeats/Yunginz%20-%20lush%20DEMO%20101BPM.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Yunginz - Smooth Sailing demo 102bpm.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AP_gbbrdYOhdhYGK5XdNg-4/Caribbean/afrobeats/Yunginz%20-%20Smooth%20Sailing%20demo%20102bpm.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Yunginz - Snap 194bpm.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/ABGqJ1bLd6XE3C7L7_g0vHU/Caribbean/afrobeats/Yunginz%20-%20Snap%20194bpm.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Yunginz - The Greatest 104bpm C#m.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AE8NmdmaP8C5lkWlA8Zyy84/Caribbean/afrobeats/Yunginz%20-%20The%20Greatest%20104bpm%20C%23m.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Yunginz Choi$e x Jamai - Pad Thai [ 94 bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/APDjgjmv1q8HK9-9RFtpJPo/Caribbean/afrobeats/Yunginz%20Choi%24e%20x%20Jamai%20-%20Pad%20Thai%20%5B%2094%20bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Yunginz X Choi$e - Island Breeze [ 105 bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AJRIO-calK9mMhFIQmT4QXk/Caribbean/afrobeats/Yunginz%20X%20Choi%24e%20-%20Island%20Breeze%20%5B%20105%20bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  {
    filename: "Yunginz x Choi$e x Eyez - So Strong [ 100 bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/APN0UD7nxApCWhzUi5F79Us/Caribbean/afrobeats/Yunginz%20x%20Choi%24e%20x%20Eyez%20-%20So%20Strong%20%5B%20100%20bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats"
  },
  // Dancehall
  {
    filename: "Not a Chance [ 104 bpm ] @prodbychoise x @yunginz.prod.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AJZ2LDZljJo1qmVOIs_PYaA/Caribbean/dancehall/Not%20a%20Chance%20%5B%20104%20bpm%20%5D%20%40prodbychoise%20x%20%40yunginz.prod.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall"
  },
  {
    filename: "One more [ 187 bpm ] @prodbychoise x @yunginz.prod x @eyesenterspace.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AO5zvndL_0iv7gq6HpaNTEM/Caribbean/dancehall/One%20more%20%5B%20187%20bpm%20%5D%20%40prodbychoise%20x%20%40yunginz.prod%20x%20%40eyesenterspace.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall",
    title: "One More"
  },
  {
    filename: "Pressure 181bpm - @yunginz.prod x @prodbychoise [ F Maj].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AJ29Vo_rq1SL-TMpzxmO_2A/Caribbean/dancehall/Pressure%20181bpm%20-%20%40yunginz.prod%20x%20%40prodbychoise%20%5B%20F%20Maj%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall"
  },
  {
    filename: "TARGET [ 96 bpm A# Min ] @prodbychoise x @yunginz.prod.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AO-iGBI78KHiEKRkWR94pHs/Caribbean/dancehall/TARGET%20%5B%2096%20bpm%20A%23%20Min%20%5D%20%40prodbychoise%20x%20%40yunginz.prod.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall",
    title: "Target"
  },
  {
    filename: "Yunginz - Aggression 100bpm.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/APB_Ubq8taruV69Tio8G92E/Caribbean/dancehall/Yunginz%20-%20Aggression%20100bpm.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall"
  },
  {
    filename: "Yunginz - Crazy Cash 102bpm.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AAcYr8xlqCVLpJyThLtpAqw/Caribbean/dancehall/Yunginz%20-%20Crazy%20Cash%20102bpm.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall"
  },
  {
    filename: "Yunginz - Villain.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AJ8NzAKdKR2RZ2JVZnLPf3g/Caribbean/dancehall/Yunginz%20-%20Villain.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall"
  },
  {
    filename: "yunginz 73 demo (dancehall).mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AIbMRA5zL2TAyiGCtfgticQ/Caribbean/dancehall/yunginz%2073%20demo%20%28dancehall%29.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall",
    title: "73 Demo"
  },
  {
    filename: "Yunginz x Choi_e - Bandito [ 104 bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AD8ZP-pxYuVMCPazsHtOxkU/Caribbean/dancehall/Yunginz%20x%20Choi_e%20-%20Bandito%20%5B%20104%20bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall"
  },
  {
    filename: "Yunginz x Choi_e - Bruddaz [ 197bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AOV49Jv6YwAm-r7Fau8vMEk/Caribbean/dancehall/Yunginz%20x%20Choi_e%20-%20Bruddaz%20%5B%20197bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall"
  },
  {
    filename: "Yunginz x Choi_e - Distance [ 147bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/ABSpNpf2kbcnIVvxLo5wNv8/Caribbean/dancehall/Yunginz%20x%20Choi_e%20-%20Distance%20%5B%20147bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall"
  },
  {
    filename: "Yunginz x Choi_e - Speed [ 194 bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AFqpHOG2YTBLDbiA0el7UH8/Caribbean/dancehall/Yunginz%20x%20Choi_e%20-%20Speed%20%5B%20194%20bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall"
  },
  {
    filename: "Yunginz x Choi$e - Black Flag 178bpm.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/ACBLZoa75ETHUOTJAPM-VE4/Caribbean/dancehall/Yunginz%20x%20Choi%24e%20-%20Black%20Flag%20178bpm.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall"
  },
  {
    filename: "Yunginz x Choi$e - HILL TOP [ 184 bpm - Emaj ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/ADE_yAU1Tf-od7ajg9v69w8/Caribbean/dancehall/Yunginz%20x%20Choi%24e%20-%20HILL%20TOP%20%5B%20184%20bpm%20-%20Emaj%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall",
    title: "Hill Top"
  },
  {
    filename: "Yunginz x Choi$e - Overstand [ 189 bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AIZ1bNP_98_jITEtzDfDUlg/Caribbean/dancehall/Yunginz%20x%20Choi%24e%20-%20Overstand%20%5B%20189%20bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall"
  },
  {
    filename: "Yunginz x Choi$e x Grassy - Soul of a hero.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AOhG95FLQPFH52fDKMkLVHs/Caribbean/dancehall/Yunginz%20x%20Choi%24e%20x%20Grassy%20-%20Soul%20of%20a%20hero.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall",
    title: "Soul Of A Hero"
  },
];

(async () => {
  const templates = await prisma.licenseTemplate.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log(`Found ${templates.length} license templates`);

  let added = 0;
  let skipped = 0;

  for (const beat of missingBeats) {
    const title = beat.title || extractTitle(beat.filename);
    const slug = slugify(title);
    
    // Check if already exists
    const existing = await prisma.beat.findUnique({ where: { slug } });
    if (existing) {
      console.log(`SKIP (exists): ${title} (${slug})`);
      skipped++;
      continue;
    }

    const bpm = parseBpm(beat.filename) || 100;
    const musicalKey = parseKey(beat.filename);
    const mood = extractMood(beat.filename, beat.genre);
    const tags = [beat.genre.toLowerCase(), mood.toLowerCase()];

    // Determine tags based on genre
    if (beat.genre === 'Afrobeats') {
      tags.push('afro', 'caribbean');
    } else if (beat.genre === 'Dancehall') {
      tags.push('dancehall', 'caribbean');
    }

    try {
      const created = await prisma.beat.create({
        data: {
          title,
          slug,
          producerName: 'Yunginz',
          previewMp3Url: beat.url,
          bpm,
          musicalKey,
          genre: beat.genre,
          mood,
          status: 'PUBLISHED',
          tags: {
            create: [...new Set(tags)].map(t => ({ value: t }))
          },
          licenses: {
            create: templates.map(t => ({
              licenseTemplateId: t.id,
              active: true
            }))
          }
        }
      });
      console.log(`ADDED: ${title} (${slug}) - ${bpm}bpm ${musicalKey}`);
      added++;
    } catch(e) {
      console.log(`ERROR adding ${title}: ${e.message.substring(0, 100)}`);
    }
  }

  console.log(`\nDone: ${added} added, ${skipped} skipped`);
  await prisma.$disconnect();
})();

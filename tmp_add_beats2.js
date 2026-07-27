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
  const m = name.match(/([A-G][#b]?)\s*(m(?:in|aj)?)\b/i) || name.match(/([A-G][#b]?)\s*$/);
  if (!m) return 'N/A';
  const root = m[1].toUpperCase();
  const quality = m[2] ? (m[2].toLowerCase().startsWith('m') ? 'm' : '') : '';
  return root + quality;
}

function extractTitle(filename) {
  let name = filename.replace(/\.(mp3|wav|m4a)$/i, '').trim();
  name = name.replace(/^\([^)]*\)\s*/g, '');
  name = name.replace(/\s+@\S+/g, '');
  name = name.replace(/\[[^\]]*\]/g, '');
  name = name.replace(/\s*\d+\s*bpm[\s\S]*?($|-\s*)/i, '$1');
  name = name.replace(/\s*-\s*$/, '');
  name = name.replace(/\s*prod\..*$/i, '');
  name = name.replace(/^Yunginz\s*[-–]\s*/i, '');
  name = name.replace(/^yunginz\s+/i, '');
  name = name.replace(/\s+x\s*$/, '');
  name = name.replace(/\s+/g, ' ').trim();
  // Title case
  name = name.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));
  return name || 'Unknown';
}

const missingBeats = [
  {
    filename: "Not a Chance [ 104 bpm ] @prodbychoise x @yunginz.prod.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AJZ2LDZljJo1qmVOIs_PYaA/Caribbean/dancehall/Not%20a%20Chance%20%5B%20104%20bpm%20%5D%20%40prodbychoise%20x%20%40yunginz.prod.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall", title: "Not A Chance"
  },
  {
    filename: "One more [ 187 bpm ] @prodbychoise x @yunginz.prod x @eyesenterspace.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AO5zvndL_0iv7gq6HpaNTEM/Caribbean/dancehall/One%20more%20%5B%20187%20bpm%20%5D%20%40prodbychoise%20x%20%40yunginz.prod%20x%20%40eyesenterspace.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall", title: "One More"
  },
  {
    filename: "Pressure 181bpm - @yunginz.prod x @prodbychoise [ F Maj].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AJ29Vo_rq1SL-TMpzxmO_2A/Caribbean/dancehall/Pressure%20181bpm%20-%20%40yunginz.prod%20x%20%40prodbychoise%20%5B%20F%20Maj%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall"
  },
  {
    filename: "TARGET [ 96 bpm A# Min ] @prodbychoise x @yunginz.prod.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AO-iGBI78KHiEKRkWR94pHs/Caribbean/dancehall/TARGET%20%5B%2096%20bpm%20A%23%20Min%20%5D%20%40prodbychoise%20x%20%40yunginz.prod.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall", title: "Target"
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
    genre: "Dancehall", title: "73 Demo"
  },
  {
    filename: "Yunginz x Choi_e - Bandito [ 104 bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AD8ZP-pxYuVMCPazsHtOxkU/Caribbean/dancehall/Yunginz%20x%20Choi_e%20-%20Bandito%20%5B%20104%20bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall", title: "Bandito"
  },
  {
    filename: "Yunginz x Choi_e - Bruddaz [ 197bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AOV49Jv6YwAm-r7Fau8vMEk/Caribbean/dancehall/Yunginz%20x%20Choi_e%20-%20Bruddaz%20%5B%20197bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall", title: "Bruddaz"
  },
  {
    filename: "Yunginz x Choi_e - Distance [ 147bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/ABSpNpf2kbcnIVvxLo5wNv8/Caribbean/dancehall/Yunginz%20x%20Choi_e%20-%20Distance%20%5B%20147bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall", title: "Distance"
  },
  {
    filename: "Yunginz x Choi_e - Speed [ 194 bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AFqpHOG2YTBLDbiA0el7UH8/Caribbean/dancehall/Yunginz%20x%20Choi_e%20-%20Speed%20%5B%20194%20bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall", title: "Speed"
  },
  {
    filename: "Yunginz x Choi$e - Black Flag 178bpm.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/ACBLZoa75ETHUOTJAPM-VE4/Caribbean/dancehall/Yunginz%20x%20Choi%24e%20-%20Black%20Flag%20178bpm.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall", title: "Black Flag"
  },
  {
    filename: "Yunginz x Choi$e - HILL TOP [ 184 bpm - Emaj ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/ADE_yAU1Tf-od7ajg9v69w8/Caribbean/dancehall/Yunginz%20x%20Choi%24e%20-%20HILL%20TOP%20%5B%20184%20bpm%20-%20Emaj%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall", title: "Hill Top"
  },
  {
    filename: "Yunginz x Choi$e - Overstand [ 189 bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AIZ1bNP_98_jITEtzDfDUlg/Caribbean/dancehall/Yunginz%20x%20Choi%24e%20-%20Overstand%20%5B%20189%20bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall", title: "Overstand"
  },
  {
    filename: "Yunginz x Choi$e x Grassy - Soul of a hero.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AOhG95FLQPFH52fDKMkLVHs/Caribbean/dancehall/Yunginz%20x%20Choi%24e%20x%20Grassy%20-%20Soul%20of%20a%20hero.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Dancehall", title: "Soul Of A Hero"
  },
  // Also re-add ones that had bad titles
  {
    filename: "Something about her [ 98 bpm ] @yunginz.prod x Choi$e x Bloke.mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AHJvBjeAYTOb2sHkXwv1QfQ/Caribbean/afrobeats/Something%20about%20her%20%5B%2098%20bpm%20%5D%20%40yunginz.prod%20x%20Choi%24e%20x%20Bloke.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats", title: "Something About Her"
  },
  {
    filename: "Yunginz Choi$e x Jamai - Pad Thai [ 94 bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/APDjgjmv1q8HK9-9RFtpJPo/Caribbean/afrobeats/Yunginz%20Choi%24e%20x%20Jamai%20-%20Pad%20Thai%20%5B%2094%20bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats", title: "Pad Thai"
  },
  {
    filename: "Yunginz X Choi$e - Island Breeze [ 105 bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AJRIO-calK9mMhFIQmT4QXk/Caribbean/afrobeats/Yunginz%20X%20Choi%24e%20-%20Island%20Breeze%20%5B%20105%20bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats", title: "Island Breeze"
  },
  {
    filename: "Yunginz x Choi$e x Eyez - So Strong [ 100 bpm ].mp3",
    url: "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/APN0UD7nxApCWhzUi5F79Us/Caribbean/afrobeats/Yunginz%20x%20Choi%24e%20x%20Eyez%20-%20So%20Strong%20%5B%20100%20bpm%20%5D.mp3?rlkey=fveetntu8ts50k9qvnucnlo1k&dl=0",
    genre: "Afrobeats", title: "So Strong"
  },
];

(async () => {
  const templates = await prisma.licenseTemplate.findMany({ orderBy: { sortOrder: 'asc' } });

  let added = 0;
  let skipped = 0;

  for (const beat of missingBeats) {
    const title = beat.title || extractTitle(beat.filename);
    const slug = slugify(title);
    
    const existing = await prisma.beat.findUnique({ where: { slug } });
    if (existing) {
      console.log(`SKIP: ${title}`);
      skipped++;
      continue;
    }

    const bpm = parseBpm(beat.filename) || 100;
    const musicalKey = parseKey(beat.filename);
    const mood = beat.genre === 'Dancehall' ? 'Energetic' : 'Afro';
    const tags = [beat.genre.toLowerCase(), mood.toLowerCase(), 'caribbean'];
    if (beat.genre === 'Dancehall') tags.push('dancehall');
    else tags.push('afro');

    try {
      await prisma.beat.create({
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
          tags: { create: [...new Set(tags)].map(t => ({ value: t })) },
          licenses: { create: templates.map(t => ({ licenseTemplateId: t.id, active: true })) }
        }
      });
      console.log(`ADDED: ${title} (${slug}) - ${bpm}bpm ${musicalKey}`);
      added++;
    } catch(e) {
      if (e.code === 'P2002') {
        console.log(`SKIP (dup): ${title}`);
        skipped++;
      } else {
        console.log(`ERROR ${title}: ${e.message.substring(0, 100)}`);
      }
    }
  }

  console.log(`\nDone: ${added} added, ${skipped} skipped`);
  await prisma.$disconnect();
})();

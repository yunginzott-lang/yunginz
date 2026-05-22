import { PrismaClient, SoundKitStatus } from "@prisma/client";

import { normalizeDropboxPreviewUrl } from "@/lib/dropbox";
import { SHARED_SOUND_KIT_TERMS, SHARED_SOUND_KIT_TERMS_URL } from "@/lib/sound-kit-terms";

const prisma = new PrismaClient();

const wavyHorizonsPreviewUrl =
  "https://www.dropbox.com/scl/fi/4yky1faaz4200i6nz23ef/wavy-experimental-float-124bpm-yung1nz.mp3?rlkey=quzmrz244tq9fvmzjx3f6ff4x&st=00eflar4&dl=0";

async function main() {
  await prisma.soundKit.upsert({
    where: { slug: "wavy-horizons-kit" },
    update: {
      title: "Wavy Horizons Kit",
      description:
        "WAVY HORIZONS - LOOP KIT\n\nA curated collection of melodic, ambient loop starters built for modern emotion-driven production. Wavy Horizons blends atmospheric textures, dreamy chords, and hypnotic melodies inspired by the sound worlds of artists like Gunna and NAV - smooth, spacious, and effortlessly vibey.\n\nEvery loop is crafted to feel like a moment: late-night drives, distant city lights, and floating emotion stitched into sound. Designed to spark ideas instantly, whether you're building placements, sending packs to artists, or cooking up your next signature record.\n\nInside you'll find:\n\n* Ambient melodic loops with emotional depth\n* Wavy, trap-ready progressions\n* Dark, airy textures with cinematic space\n* Clean stems for fast workflow and flipping\n* Industry-inspired sound design built for placements\n\nMade for producers who move with intention - not just making beats, but building records that land.\n\nIf you're trying to elevate your sound, lock into a lane, and create loops that artists actually want to live on... this pack is built for that.",
      priceCents: 1000,
      coverImageUrl: normalizeDropboxPreviewUrl(
        "https://www.dropbox.com/scl/fi/h32akqjouk68h30749j5y/Photo-2026-04-22-4-23-11-AM.png?rlkey=zevaxkhoah7gukwx619gd5fn5&st=o15mppgf&dl=0"
      ),
      previewMp3Url: normalizeDropboxPreviewUrl(wavyHorizonsPreviewUrl),
      downloadUrl: normalizeDropboxPreviewUrl(
        "https://www.dropbox.com/scl/fi/7lcjw7eub07dnhck7g7xd/WAVY-HORIZONS-KIT-melodic-Ambient-Gunna-Nav-Wavy.zip?rlkey=1bif5zrj0bc5s2dumb4xhk6z6&st=h7w3s9nt&dl=0"
      ),
      termsUrl: normalizeDropboxPreviewUrl(
        SHARED_SOUND_KIT_TERMS_URL
      ),
      termsPreviewText: SHARED_SOUND_KIT_TERMS,
      category: "Sample pack",
      tags: "ambient, melodic, wavy, trap, gunna, nav",
      status: SoundKitStatus.PUBLISHED,
      isFeatured: true
    },
    create: {
      title: "Wavy Horizons Kit",
      slug: "wavy-horizons-kit",
      description:
        "WAVY HORIZONS - LOOP KIT\n\nA curated collection of melodic, ambient loop starters built for modern emotion-driven production. Wavy Horizons blends atmospheric textures, dreamy chords, and hypnotic melodies inspired by the sound worlds of artists like Gunna and NAV - smooth, spacious, and effortlessly vibey.\n\nEvery loop is crafted to feel like a moment: late-night drives, distant city lights, and floating emotion stitched into sound. Designed to spark ideas instantly, whether you're building placements, sending packs to artists, or cooking up your next signature record.\n\nInside you'll find:\n\n* Ambient melodic loops with emotional depth\n* Wavy, trap-ready progressions\n* Dark, airy textures with cinematic space\n* Clean stems for fast workflow and flipping\n* Industry-inspired sound design built for placements\n\nMade for producers who move with intention - not just making beats, but building records that land.\n\nIf you're trying to elevate your sound, lock into a lane, and create loops that artists actually want to live on... this pack is built for that.",
      priceCents: 1000,
      coverImageUrl: normalizeDropboxPreviewUrl(
        "https://www.dropbox.com/scl/fi/h32akqjouk68h30749j5y/Photo-2026-04-22-4-23-11-AM.png?rlkey=zevaxkhoah7gukwx619gd5fn5&st=o15mppgf&dl=0"
      ),
      previewMp3Url: normalizeDropboxPreviewUrl(wavyHorizonsPreviewUrl),
      downloadUrl: normalizeDropboxPreviewUrl(
        "https://www.dropbox.com/scl/fi/7lcjw7eub07dnhck7g7xd/WAVY-HORIZONS-KIT-melodic-Ambient-Gunna-Nav-Wavy.zip?rlkey=1bif5zrj0bc5s2dumb4xhk6z6&st=h7w3s9nt&dl=0"
      ),
      termsUrl: normalizeDropboxPreviewUrl(
        SHARED_SOUND_KIT_TERMS_URL
      ),
      termsPreviewText: SHARED_SOUND_KIT_TERMS,
      category: "Sample pack",
      tags: "ambient, melodic, wavy, trap, gunna, nav",
      status: SoundKitStatus.PUBLISHED,
      isFeatured: true
    }
  });

  console.log("Sound kit seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

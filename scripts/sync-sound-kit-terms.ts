import { PrismaClient } from "@prisma/client";

import { normalizeDropboxPreviewUrl } from "@/lib/dropbox";
import { SHARED_SOUND_KIT_TERMS, SHARED_SOUND_KIT_TERMS_URL } from "@/lib/sound-kit-terms";

const prisma = new PrismaClient();

const wavyHorizonsPreviewUrl = normalizeDropboxPreviewUrl(
  "https://www.dropbox.com/scl/fi/4yky1faaz4200i6nz23ef/wavy-experimental-float-124bpm-yung1nz.mp3?rlkey=quzmrz244tq9fvmzjx3f6ff4x&st=00eflar4&dl=0"
);

async function main() {
  const termsUrl = normalizeDropboxPreviewUrl(SHARED_SOUND_KIT_TERMS_URL);

  const termsUpdate = await prisma.soundKit.updateMany({
    data: {
      termsUrl,
      termsPreviewText: SHARED_SOUND_KIT_TERMS
    }
  });

  const priceUpdate = await prisma.soundKit.updateMany({
    where: { slug: "wavy-horizons-kit" },
    data: {
      priceCents: 1000,
      previewMp3Url: wavyHorizonsPreviewUrl
    }
  });

  console.log(
    `Synced terms for ${termsUpdate.count} kit(s); updated Wavy Horizons price on ${priceUpdate.count} kit(s).`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

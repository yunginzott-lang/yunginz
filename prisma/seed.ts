import bcrypt from "bcryptjs";
import { PrismaClient, BeatStatus, SoundKitStatus } from "@prisma/client";

import { normalizeDropboxPreviewUrl } from "@/lib/dropbox";
import { SHARED_SOUND_KIT_TERMS, SHARED_SOUND_KIT_TERMS_URL } from "@/lib/sound-kit-terms";

const prisma = new PrismaClient();

const previewUrl =
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
const wavyHorizonsPreviewUrl =
  "https://www.dropbox.com/scl/fi/4yky1faaz4200i6nz23ef/wavy-experimental-float-124bpm-yung1nz.mp3?rlkey=quzmrz244tq9fvmzjx3f6ff4x&st=00eflar4&dl=0";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@yunginz.prod";
  const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://yunginz.vercel.app";
  const notifyEmail = process.env.NOTIFY_TO_EMAIL || "yunginzprod@gmail.com";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Yunginz Admin",
      email: adminEmail,
      passwordHash
    }
  });

  const licenses = [
    {
      code: "basic",
      name: "Basic",
      description: "MP3 lease for artists shaping a focused release with premium clarity.",
      priceCents: 3000,
      minOfferCents: null,
      active: true,
      isExclusive: false,
      sortOrder: 1,
      publicSummary: [
        "1 song",
        "High-quality MP3 delivery",
        "500 downloads / physical units",
        "50,000 streams",
        "Live performance use included"
      ],
      rightsJson: {
        distribution: 500,
        streams: 50000,
        musicVideos: 1,
        files: ["MP3"],
        termYears: 10
      }
    },
    {
      code: "standard",
      name: "Standard",
      description: "MP3 + WAV lease for artists rolling out a serious release campaign.",
      priceCents: 5000,
      minOfferCents: null,
      active: true,
      isExclusive: false,
      sortOrder: 2,
      publicSummary: [
        "1 song",
        "MP3 + WAV delivery",
        "2,500 sales",
        "500,000 audio streams",
        "Expanded commercial use"
      ],
      rightsJson: {
        distribution: 2500,
        streams: 500000,
        musicVideos: 1,
        monetizedVideos: 1,
        files: ["MP3", "WAV"],
        termYears: 10
      }
    },
    {
      code: "unlimited",
      name: "Unlimited",
      description: "WAV, MP3, and stems with elevated commercial usage rights.",
      priceCents: 20000,
      minOfferCents: null,
      active: true,
      isExclusive: false,
      sortOrder: 3,
      publicSummary: [
        "Unlimited streams",
        "Unlimited sales",
        "Unlimited videos",
        "MP3 + WAV + stems",
        "Manual stems delivery after purchase"
      ],
      rightsJson: {
        distribution: "unlimited",
        streams: "unlimited",
        musicVideos: "unlimited",
        files: ["MP3", "WAV", "STEMS"],
        termYears: 10
      },
      fileNotes: "Stems are delivered manually after payment confirmation."
    },
    {
      code: "exclusive",
      name: "Exclusive",
      description: "Make an offer to lock the beat and remove it from future licensing.",
      priceCents: null,
      minOfferCents: 100000,
      active: true,
      isExclusive: true,
      sortOrder: 4,
      publicSummary: [
        "Beat removed from future sales",
        "Unlimited commercial exploitation",
        "MP3 + WAV + stems",
        "Offer-based starting at $1,000"
      ],
      rightsJson: {
        distribution: "unlimited",
        streams: "unlimited",
        musicVideos: "unlimited",
        files: ["MP3", "WAV", "STEMS"],
        termYears: 10,
        exclusive: true
      },
      fileNotes: "Final terms and stem delivery are handled manually."
    }
  ];

  for (const license of licenses) {
    await prisma.licenseTemplate.upsert({
      where: { code: license.code },
      update: license,
      create: license
    });
  }

  await prisma.siteSettings.deleteMany();
  await prisma.siteSettings.create({
    data: {
      siteName: "Yunginz Productions",
      siteUrl,
      defaultSeoTitle: "Yunginz Productions | Beats, recording, mixing, and production",
      defaultSeoDescription:
        "Browse premium beats, tap into loop kits and sound banks, and work directly with Yunginz Productions.",
      producerName: "Yunginz",
      producerTagline: "Versatile producer, composer, and recording engineer.",
      contactEmail: "yunginzsession@gmail.com",
      instagramUrl: "https://instagram.com/yunginz.prod",
      youtubeUrl: null,
      soundcloudUrl: null,
      xUrl: "https://www.snapchat.com/add/yung1nz",
      newsletterTitle: "Tap in with every new drop",
      newsletterDescription:
        "Fresh loop kits, drum kits, sound banks, exclusive beat drops, and direct release updates.",
      heroStats: [
        { label: "Beats", value: "500+" },
        { label: "Streams", value: "500K+" },
        { label: "Years Experience", value: "7+" }
      ],
      footerPolicies: [
        { label: "Licensing Info", href: "#plans" },
        { label: "Privacy", href: "#footer" },
        { label: "Terms", href: "#footer" }
      ]
    }
  });

  await prisma.soundKit.deleteMany();
  await prisma.soundKit.create({
    data: {
      title: "Wavy Horizons Kit",
      slug: "wavy-horizons-kit",
      description:
        "A melodic ambient sample pack for modern trap, wave, and atmospheric records.",
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

  const sections = [
    {
      key: "hero",
      title: "Independent producer",
      subtitle: "Est. 2020",
      content: {
        kicker: "EST. 2020 · INDEPENDENT PRODUCER",
        headingPrimary: "Yunginz",
        headingAccent: "Productions",
        genres: ["Trap", "Afro", "R&B", "Dancehall", "Soul"],
        primaryCtaLabel: "Browse Beats",
        secondaryCtaLabel: "View Plans"
      }
    },
    {
      key: "about",
      title: "Built from the ground up",
      subtitle: "The producer",
      content: {
        body:
          "Yunginz is a versatile music producer, composer, and recording engineer crafting records across R&B, Hip Hop, Afrobeats, Pop, and Trap. With years of hands-on experience in sessions and collaborations, his sound is rooted in both technical precision and raw musical instinct.",
        body2:
          "From building full records in the studio to creating industry-ready melodies and beats, Yunginz focuses on one thing: making music that connects and lasts. His work speaks through placements, artist collaborations, and consistent output, always evolving and never boxed into one sound. Whether you're looking for a standout record, a foundation for your next project, or a producer who understands the full creative process, Yunginz brings both the sound and the experience to deliver.",
        pills: ["Trap", "Afrobeats", "R&B", "Dancehall", "Soul", "Hip-Hop"]
      }
    },
    {
      key: "services",
      title: "What I offer",
      subtitle: "Work together",
      content: [
        {
          number: "01",
          title: "Custom Beats",
          description:
            "Built from scratch around your references, direction, and artist identity.",
          priceHint: "Starting at $150",
          ctaLabel: "Inquire"
        },
        {
          number: "02",
          title: "Mixing & Mastering",
          description:
            "Release-ready balance, impact, and clarity that helps your record translate with confidence.",
          priceHint: "Starting at $150",
          ctaLabel: "Inquire"
        },
        {
          number: "03",
          title: "Recording",
          description:
            "Vocal tracking with clean, release-ready polish and a session flow built to keep performances sharp and natural.",
          priceHint: "Inquire for pricing ($40-$65 range)",
          ctaLabel: "Inquire"
        }
      ]
    },
    {
      key: "contact",
      title: "Let's build",
      subtitle: "Contact",
      content: {
        description:
          "Whether you need a custom beat, a mix, a recording session, or a booking, serious inquiries are always welcome."
      }
    }
  ];

  await prisma.homepageSection.deleteMany();
  await prisma.homepageSection.createMany({ data: sections });

  await prisma.beatTag.deleteMany();
  await prisma.beatLicenseDeliveryLink.deleteMany();
  await prisma.beatLicense.deleteMany();
  await prisma.beat.deleteMany();

  const beatData = [
    {
      title: "Midnight Glory",
      slug: "midnight-glory",
      bpm: 140,
      musicalKey: "F Min",
      genre: "Trap",
      mood: "Cinematic",
      description: "Dark piano layers, sharp percussion, and a heavyweight low end.",
      tags: ["dark", "cinematic", "808", "anthemic"],
      isFeatured: true
    },
    {
      title: "Crown Season",
      slug: "crown-season",
      bpm: 145,
      musicalKey: "Ab Maj",
      genre: "Drill",
      mood: "Aggressive",
      description: "A cold UK drill bounce with brass tension and club energy.",
      tags: ["drill", "uk", "club", "hard"],
      isFeatured: true
    },
    {
      title: "Late Nite Feels",
      slug: "late-nite-feels",
      bpm: 92,
      musicalKey: "D Min",
      genre: "R&B",
      mood: "Late Night",
      description: "Smooth keys and vocal textures built for intimate records.",
      tags: ["r&b", "smooth", "slow jam", "moody"],
      isFeatured: true
    },
    {
      title: "Golden Ratio",
      slug: "golden-ratio",
      bpm: 128,
      musicalKey: "G Maj",
      genre: "Afro",
      mood: "Uplifting",
      description: "Warm percussion, melody pockets, and crossover bounce.",
      tags: ["afro", "summer", "bounce", "clean"],
      isFeatured: true
    },
    {
      title: "Street Gospel",
      slug: "street-gospel",
      bpm: 138,
      musicalKey: "B Min",
      genre: "Trap",
      mood: "Reflective",
      description: "Choir textures and heavy drums for pain-to-power records.",
      tags: ["gospel", "trap", "soulful", "street"],
      isFeatured: true
    },
    {
      title: "Sovereign",
      slug: "sovereign",
      bpm: 82,
      musicalKey: "Eb Min",
      genre: "Soul",
      mood: "Luxurious",
      description: "Soulful guitar and live-feel movement for premium storytelling.",
      tags: ["soul", "live", "luxury", "warm"],
      isFeatured: true
    }
  ];

  const licenseTemplates = await prisma.licenseTemplate.findMany();

  for (const beat of beatData) {
    const createdBeat = await prisma.beat.create({
      data: {
        title: beat.title,
        slug: beat.slug,
        producerName: "Yunginz",
        previewMp3Url: previewUrl,
        coverImageUrl:
          "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80",
        bpm: beat.bpm,
        musicalKey: beat.musicalKey,
        genre: beat.genre,
        mood: beat.mood,
        description: beat.description,
        status: BeatStatus.PUBLISHED,
        isFeatured: beat.isFeatured
      }
    });

    await prisma.beatTag.createMany({
      data: beat.tags.map((value) => ({ beatId: createdBeat.id, value }))
    });

    for (const template of licenseTemplates) {
      const beatLicense = await prisma.beatLicense.create({
        data: {
          beatId: createdBeat.id,
          licenseTemplateId: template.id,
          active: true,
          manualFulfillmentRequired:
            template.code === "unlimited" || template.code === "exclusive",
          deliveryNotes:
            template.code === "exclusive"
              ? "Exclusive offers are handled manually after review."
              : "Dropbox delivery links appear after payment. Stem-inclusive licenses are partially fulfilled manually.",
          fileNotes: template.fileNotes
        }
      });

      if (!template.isExclusive) {
        await prisma.beatLicenseDeliveryLink.createMany({
          data: [
            {
              beatLicenseId: beatLicense.id,
              label: `${template.name} license files`,
              url: `https://www.dropbox.com/scl/fo/demo-${beat.slug}-${template.code}?dl=0`,
              sortOrder: 1
            }
          ]
        });
      }
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

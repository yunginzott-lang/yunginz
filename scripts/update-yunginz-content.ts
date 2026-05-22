import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.siteSettings.updateMany({
    data: {
      siteName: "Yunginz Productions",
      defaultSeoTitle: "Yunginz Productions | Beats, recording, mixing, and production",
      defaultSeoDescription:
        "Browse premium beats, tap into loop kits and sound banks, and work directly with Yunginz Productions.",
      producerName: "Yunginz",
      producerTagline: "Versatile producer, composer, and recording engineer.",
      contactEmail: "yunginzsessions@gmail.com",
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
      ]
    }
  });

  await prisma.homepageSection.upsert({
    where: { key: "hero" },
    update: {
      title: "Yunginz Productions",
      subtitle: "Independent producer",
      content: {
        kicker: "EST. 2019 - INDEPENDENT PRODUCER",
        headingPrimary: "Yunginz",
        headingAccent: "Productions",
        genres: ["Trap", "Afro", "R&B", "Dancehall", "Amapiano", "Neo Soul", "Soul"],
        primaryCtaLabel: "Browse Beats",
        secondaryCtaLabel: "View Plans"
      }
    },
    create: {
      key: "hero",
      title: "Yunginz Productions",
      subtitle: "Independent producer",
      content: {
        kicker: "EST. 2019 - INDEPENDENT PRODUCER",
        headingPrimary: "Yunginz",
        headingAccent: "Productions",
        genres: ["Trap", "Afro", "R&B", "Dancehall", "Amapiano", "Neo Soul", "Soul"],
        primaryCtaLabel: "Browse Beats",
        secondaryCtaLabel: "View Plans"
      }
    }
  });

  await prisma.homepageSection.upsert({
    where: { key: "about" },
    update: {
      title: "Built from the ground up",
      subtitle: "The producer",
      content: {
        body:
          "Yunginz is a versatile music producer, composer, and recording engineer crafting records across R&B, Hip Hop, Afrobeats, Pop, and Trap. With years of hands-on experience in sessions and collaborations, his sound is rooted in both technical precision and raw musical instinct.",
        body2:
          "From building full records in the studio to creating industry-ready melodies and beats, Yunginz focuses on one thing: making music that connects and lasts. His work speaks through placements, artist collaborations, and consistent output, always evolving and never boxed into one sound. Whether you're looking for a standout record, a foundation for your next project, or a producer who understands the full creative process, Yunginz brings both the sound and the experience to deliver.",
        pills: ["Trap", "Afrobeats", "R&B", "Dancehall", "Amapiano", "Neo Soul", "Soul", "Hip-Hop"]
      }
    },
    create: {
      key: "about",
      title: "Built from the ground up",
      subtitle: "The producer",
      content: {
        body:
          "Yunginz is a versatile music producer, composer, and recording engineer crafting records across R&B, Hip Hop, Afrobeats, Pop, and Trap. With years of hands-on experience in sessions and collaborations, his sound is rooted in both technical precision and raw musical instinct.",
        body2:
          "From building full records in the studio to creating industry-ready melodies and beats, Yunginz focuses on one thing: making music that connects and lasts. His work speaks through placements, artist collaborations, and consistent output, always evolving and never boxed into one sound. Whether you're looking for a standout record, a foundation for your next project, or a producer who understands the full creative process, Yunginz brings both the sound and the experience to deliver.",
        pills: ["Trap", "Afrobeats", "R&B", "Dancehall", "Amapiano", "Neo Soul", "Soul", "Hip-Hop"]
      }
    }
  });

  await prisma.homepageSection.upsert({
    where: { key: "services" },
    update: {
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
    create: {
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
    }
  });

  await prisma.homepageSection.upsert({
    where: { key: "contact" },
    update: {
      title: "Let's build",
      subtitle: "Contact",
      content: {
        description:
          "Whether you need a custom beat, a mix, a recording session, or a booking, serious inquiries are always welcome."
      }
    },
    create: {
      key: "contact",
      title: "Let's build",
      subtitle: "Contact",
      content: {
        description:
          "Whether you need a custom beat, a mix, a recording session, or a booking, serious inquiries are always welcome."
      }
    }
  });

  await prisma.licenseTemplate.updateMany({
    where: { code: "basic" },
    data: {
      publicSummary: [
        "1 song",
        "High-quality MP3 delivery",
        "500 distribution copies",
        "50,000 audio streams",
        "Live performance use included"
      ]
    }
  });

  await prisma.licenseTemplate.updateMany({
    where: { code: "standard" },
    data: {
      publicSummary: [
        "1 song",
        "MP3 + WAV delivery",
        "2,500 distribution copies",
        "500,000 audio streams",
        "Expanded commercial use"
      ]
    }
  });

  await prisma.licenseTemplate.updateMany({
    where: { code: "unlimited" },
    data: {
      publicSummary: [
        "Unlimited streams",
        "Unlimited distribution",
        "MP3 + WAV + stems",
        "Priority commercial rights",
        "Manual stems delivery after purchase"
      ]
    }
  });

  await prisma.licenseTemplate.updateMany({
    where: { code: "exclusive" },
    data: {
      publicSummary: [
        "Beat removed from future sales",
        "Unlimited commercial exploitation",
        "MP3 + WAV + stems",
        "Offer-based starting at $1,000"
      ],
      minOfferCents: 100000
    }
  });
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

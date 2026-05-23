import { Prisma } from "@prisma/client";

import { getLeasePreview, sanitizeLeasePreviewText } from "@/lib/lease-document";
import { prisma } from "@/lib/prisma";
import type { CatalogFilters } from "@/lib/types";

export async function getPublicSiteData(filters: CatalogFilters = {}) {
  const where: Prisma.BeatWhereInput = {
    status: "PUBLISHED",
    ...(filters.genre ? { genre: filters.genre } : {}),
    ...(filters.mood ? { mood: filters.mood } : {}),
    ...(filters.key ? { musicalKey: filters.key } : {}),
    ...(filters.featured ? { isFeatured: true } : {}),
    ...(filters.query
      ? {
          OR: [
            { title: { contains: filters.query, mode: "insensitive" } },
            { genre: { contains: filters.query, mode: "insensitive" } },
            { mood: { contains: filters.query, mode: "insensitive" } },
            {
              tags: {
                some: { value: { contains: filters.query, mode: "insensitive" } }
              }
            }
          ]
        }
      : {})
  };

  const orderBy =
    filters.sort === "oldest"
      ? { createdAt: "asc" as const }
      : filters.sort === "price-asc" || filters.sort === "price-desc"
        ? { createdAt: "desc" as const }
        : filters.sort === "title"
          ? { title: "asc" as const }
          : { createdAt: "desc" as const };

  let [beats, licenses, soundKits, sections, settings] = await Promise.all([
    prisma.beat.findMany({
      where,
      orderBy,
      select: {
        id: true,
        title: true,
        slug: true,
        producerName: true,
        previewMp3Url: true,
        coverImageUrl: true,
        bpm: true,
        durationSeconds: true,
        genre: true,
        mood: true,
        description: true,
        status: true,
        isFeatured: true,
        createdAt: true,
        tags: {
          select: {
            value: true
          }
        },
        licenses: {
          where: { active: true },
          select: {
            id: true,
            customName: true,
            customDescription: true,
            customPriceCents: true,
            licenseTemplate: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
                priceCents: true,
                isExclusive: true
              }
            }
          }
        }
      }
    }),
    prisma.licenseTemplate.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        priceCents: true,
        minOfferCents: true,
        active: true,
        isExclusive: true,
        sortOrder: true,
        publicSummary: true,
        contractPreviewPlain: true
      }
    }),
    prisma.soundKit.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        priceCents: true,
        coverImageUrl: true,
        previewMp3Url: true,
        downloadUrl: true,
        termsUrl: true,
        termsPreviewText: true,
        category: true,
        tags: true,
        status: true,
        isFeatured: true,
        createdAt: true
      }
    }),
    prisma.homepageSection.findMany({
      orderBy: { createdAt: "asc" }
    }),
    prisma.siteSettings.findFirst()
  ]);

  const resolvedLicenses = await Promise.all(
    licenses.map(async (license) => ({
      ...license,
      contractPreviewPlain:
        sanitizeLeasePreviewText(
          license.contractPreviewPlain || (await getLeasePreview(license.code))
        )
    }))
  );

  if (filters.sort === "price-asc") {
    beats = beats.sort((a, b) => {
      const aPrice = Math.min(...a.licenses.map((l) => l.customPriceCents ?? l.licenseTemplate.priceCents ?? Infinity));
      const bPrice = Math.min(...b.licenses.map((l) => l.customPriceCents ?? l.licenseTemplate.priceCents ?? Infinity));
      return aPrice - bPrice;
    });
  } else if (filters.sort === "price-desc") {
    beats = beats.sort((a, b) => {
      const aPrice = Math.min(...a.licenses.map((l) => l.customPriceCents ?? l.licenseTemplate.priceCents ?? 0));
      const bPrice = Math.min(...b.licenses.map((l) => l.customPriceCents ?? l.licenseTemplate.priceCents ?? 0));
      return bPrice - aPrice;
    });
  }

  return { beats, licenses: resolvedLicenses, soundKits, sections, settings };
}

export async function getBeatBySlug(slug: string) {
  return prisma.beat.findUnique({
    where: { slug },
    include: {
      tags: true,
      licenses: {
        where: { active: true },
        include: {
          licenseTemplate: true,
          deliveryLinks: true
        }
      }
    }
  });
}

export async function getBeatForExclusive(beatId: string) {
  return prisma.beat.findUnique({
    where: { id: beatId },
    include: {
      licenses: {
        include: { licenseTemplate: true }
      }
    }
  });
}

export async function getSoundKitBySlug(slug: string) {
  return prisma.soundKit.findUnique({
    where: { slug }
  });
}

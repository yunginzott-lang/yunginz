import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [newestBeat, newestSoundKit] = process.env.DATABASE_URL
    ? await Promise.all([
        prisma.beat
          .findFirst({
            where: { status: "PUBLISHED" },
            select: { updatedAt: true },
            orderBy: { updatedAt: "desc" }
          })
          .catch(() => null),
        prisma.soundKit
          .findFirst({
            where: { status: "PUBLISHED" },
            select: { updatedAt: true },
            orderBy: { updatedAt: "desc" }
          })
          .catch(() => null)
      ])
    : [null, null];

  return [
    {
      url: getBaseUrl(),
      lastModified: newestBeat?.updatedAt ?? new Date()
    },
    {
      url: `${getBaseUrl()}/sound-kits`,
      lastModified: newestSoundKit?.updatedAt ?? new Date()
    }
  ];
}

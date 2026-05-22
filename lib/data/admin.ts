import { prisma } from "@/lib/prisma";

export async function getAdminDashboardData({
  query = "",
  page = 1,
  pageSize = 15
}: {
  query?: string;
  page?: number;
  pageSize?: number;
}) {
  const beatWhere = query
    ? {
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { slug: { contains: query, mode: "insensitive" as const } },
          { genre: { contains: query, mode: "insensitive" as const } },
          { mood: { contains: query, mode: "insensitive" as const } }
        ]
      }
    : undefined;

  const [
    beats,
    totalBeats,
    licenses,
    soundKits,
    orders,
    messages,
    offers,
    settings,
    sections,
    activityLogs
  ] =
    await Promise.all([
      prisma.beat.findMany({
        where: beatWhere,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: {
              orderItems: true
            }
          },
          tags: true,
          licenses: {
            orderBy: { licenseTemplate: { sortOrder: "asc" } },
            include: { licenseTemplate: true, deliveryLinks: true }
          }
        }
      }),
      prisma.beat.count({
        where: beatWhere
      }),
      prisma.licenseTemplate.findMany({
        orderBy: { sortOrder: "asc" }
      }),
      prisma.soundKit.findMany({
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }]
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        include: { customer: true, items: true }
      }),
      prisma.contactSubmission.findMany({
        orderBy: { createdAt: "desc" }
      }),
      prisma.exclusiveOffer.findMany({
        orderBy: { createdAt: "desc" },
        include: { beat: true }
      }),
      prisma.siteSettings.findFirst(),
      prisma.homepageSection.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.adminActivityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          adminUser: {
            select: { name: true, email: true }
          }
        }
      })
    ]);

  return {
    beats,
    totalBeats,
    totalPages: Math.max(1, Math.ceil(totalBeats / pageSize)),
    currentPage: page,
    pageSize,
    licenses,
    soundKits,
    orders,
    messages,
    offers,
    settings,
    sections,
    activityLogs
  };
}

export async function getAdminSoundKitData() {
  const [soundKits, settings] = await Promise.all([
    prisma.soundKit.findMany({
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }]
    }),
    prisma.siteSettings.findFirst()
  ]);

  return {
    soundKits,
    settings
  };
}

export async function getAdminContentData() {
  const [settings, sections] = await Promise.all([
    prisma.siteSettings.findFirst(),
    prisma.homepageSection.findMany({ orderBy: { createdAt: "asc" } })
  ]);

  return {
    settings,
    sections
  };
}

"use server";

import { revalidatePath } from "next/cache";

import { logAdminActivity } from "@/lib/admin-activity";
import { requireAdmin } from "@/lib/auth/session";
import { normalizeDropboxPreviewUrl } from "@/lib/dropbox";
import { prisma } from "@/lib/prisma";
import { SHARED_SOUND_KIT_TERMS, SHARED_SOUND_KIT_TERMS_URL } from "@/lib/sound-kit-terms";
import { deletePublicAsset } from "@/lib/storage";
import { slugify } from "@/lib/utils";

function parseStringList(input: FormDataEntryValue | null) {
  return String(input ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJson(input: FormDataEntryValue | null, fallback: unknown = {}) {
  try {
    return JSON.parse(String(input ?? "")) || fallback;
  } catch {
    return fallback;
  }
}

function parseDurationToSeconds(input: string) {
  const value = input.trim();
  if (!value) return null;

  const clockMatch = value.match(/^(\d+):([0-5]\d)$/);
  if (clockMatch) {
    return Number(clockMatch[1]) * 60 + Number(clockMatch[2]);
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.round(numeric);
  }

  return null;
}

function parseSoundKitTags(input: FormDataEntryValue | null) {
  return parseStringList(input);
}

export async function createLicensesForBeat(formData: FormData) {
  const session = await requireAdmin();
  
  const beatId = String(formData.get("id") ?? "");
  if (!beatId) return;
  
  const existingLicenses = await prisma.beatLicense.findMany({
    where: { beatId }
  });
  
  if (existingLicenses.length > 0) {
    return;
  }
  
  const templates = await prisma.licenseTemplate.findMany({
    where: { active: true }
  });
  
  for (const template of templates) {
    await prisma.beatLicense.create({
      data: {
        beatId,
        licenseTemplateId: template.id,
        active: true,
        manualFulfillmentRequired:
          template.code === "unlimited" || template.code === "exclusive"
      }
    });
  }
  
  revalidatePath("/admin");
  await logAdminActivity({
    adminUserId: session.user!.id,
    action: "CREATE_LICENSES",
    targetType: "BEAT",
    targetId: beatId
  });
}

export async function generateLicensesForAllBeats() {
  const session = await requireAdmin();
  
  const beats = await prisma.beat.findMany({
    include: { licenses: true }
  });
  
  const templates = await prisma.licenseTemplate.findMany({
    where: { active: true }
  });
  
  for (const beat of beats) {
    if (beat.licenses.length === 0) {
      for (const template of templates) {
        await prisma.beatLicense.create({
          data: {
            beatId: beat.id,
            licenseTemplateId: template.id,
            active: true,
            manualFulfillmentRequired:
              template.code === "unlimited" || template.code === "exclusive"
          }
        });
      }
    }
  }
  
  revalidatePath("/admin");
  await logAdminActivity({
    adminUserId: session.user!.id,
    action: "GENERATE_LICENSES_FOR_ALL",
    targetType: "BEAT"
  });
}

async function syncBeatLicensesFromForm(beatId: string, formData: FormData) {
  const templates = await prisma.licenseTemplate.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" }
  });

  for (const template of templates) {
    const beatLicense = await prisma.beatLicense.upsert({
      where: {
        beatId_licenseTemplateId: {
          beatId,
          licenseTemplateId: template.id
        }
      },
      update: {
        active: true,
        manualFulfillmentRequired:
          template.code === "unlimited" || template.code === "exclusive"
      },
      create: {
        beatId,
        licenseTemplateId: template.id,
        active: true,
        manualFulfillmentRequired:
          template.code === "unlimited" || template.code === "exclusive"
      }
    });

    const links: { label: string; url: string }[] = [];
    const prefix = `license_${template.code}`;
    const mp3Link = String(formData.get(`${prefix}_mp3Link`) ?? "").trim();
    const wavLink = String(formData.get(`${prefix}_wavLink`) ?? "").trim();
    const stemsLink = String(formData.get(`${prefix}_stemsLink`) ?? "").trim();
    const producersTagLink = String(formData.get(`${prefix}_producersTagLink`) ?? "").trim();

    if (mp3Link) links.push({ label: "MP3", url: mp3Link });
    if (wavLink) links.push({ label: "WAV", url: wavLink });
    if (stemsLink) links.push({ label: "Stems", url: stemsLink });
    if (producersTagLink) links.push({ label: "Producers Tag", url: producersTagLink });

    if (links.length) {
      await prisma.beatLicenseDeliveryLink.deleteMany({
        where: { beatLicenseId: beatLicense.id }
      });

      await prisma.beatLicenseDeliveryLink.createMany({
        data: links.map((link, index) => ({
          beatLicenseId: beatLicense.id,
          label: link.label,
          url: link.url,
          sortOrder: index
        }))
      });
    }
  }
}

export async function saveBeat(formData: FormData) {
  const session = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "");
  const slug = slugify(String(formData.get("slug") ?? title));
  const directPreviewUrl = String(formData.get("previewMp3Url") ?? "").trim();
  const uploadedPreviewUrl = String(formData.get("uploadedPreviewMp3Url") ?? "").trim();
  const previewMp3Url = normalizeDropboxPreviewUrl(directPreviewUrl || uploadedPreviewUrl);
  const coverImageUrl = String(formData.get("coverImageUrl") ?? "");
  const bpm = Number(formData.get("bpm") ?? 0);
  const durationSecondsValue = String(formData.get("durationSeconds") ?? "").trim();
  const durationSeconds = parseDurationToSeconds(durationSecondsValue);

  if (!previewMp3Url) {
    throw new Error("Preview MP3 URL is required.");
  }

  const payload = {
    title,
    slug,
    previewMp3Url,
    coverImageUrl: coverImageUrl || null,
    bpm,
    durationSeconds,
    musicalKey: "N/A",
    genre: String(formData.get("genre") ?? ""),
    mood: String(formData.get("mood") ?? ""),
    description: String(formData.get("description") ?? "").trim() || null,
    status: String(formData.get("status") ?? "DRAFT") as "DRAFT" | "PUBLISHED" | "SOLD",
    isFeatured: formData.get("isFeatured") === "on"
  };

  let beatId = id;

  try {
    let savedBeatLabel = title;
    if (id) {
      await prisma.beat.update({
        where: { id },
        data: payload
      });
      await logAdminActivity({
        adminUserId: session.user!.id,
        action: "UPDATE_BEAT",
        targetType: "BEAT",
        targetId: id,
        targetLabel: savedBeatLabel,
        metadata: {
          bpm,
          durationSeconds,
          genre: payload.genre,
          mood: payload.mood,
          status: payload.status
        }
      });
    } else {
      const beat = await prisma.beat.create({
        data: {
          ...payload,
          producerName: "Yunginz"
        }
      });
      beatId = beat.id;
      savedBeatLabel = beat.title;
      await logAdminActivity({
        adminUserId: session.user!.id,
        action: "CREATE_BEAT",
        targetType: "BEAT",
        targetId: beat.id,
        targetLabel: beat.title,
        metadata: {
          bpm,
          durationSeconds,
          genre: payload.genre,
          mood: payload.mood,
          status: payload.status
        }
      });
    }

    await prisma.beatTag.deleteMany({ where: { beatId } });
    const tags = parseStringList(formData.get("tags"));

    if (tags.length) {
      await prisma.beatTag.createMany({
        data: tags.map((value) => ({ beatId, value }))
      });
    }

    await syncBeatLicensesFromForm(beatId, formData);
  } catch (error) {
    console.error("Failed to save beat", {
      id,
      title,
      error
    });

    throw error;
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/content");
}

export async function deleteBeat(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const beat = await prisma.beat.findUnique({
    where: { id }
  });

  if (!beat) return;

  try {
    await prisma.beat.delete({ where: { id } });
    await logAdminActivity({
      adminUserId: session.user!.id,
      action: "DELETE_BEAT",
      targetType: "BEAT",
      targetId: id,
      targetLabel: beat.title
    });

    try {
      await deletePublicAsset(beat.previewMp3Url);
      await deletePublicAsset(beat.coverImageUrl);
    } catch (assetError) {
      console.warn("Beat deleted but asset cleanup failed", {
        id,
        assetError
      });
    }
  } catch (error) {
    console.error("Beat delete failed", {
      id,
      error
    });
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/content");
}

export async function saveSoundKit(formData: FormData) {
  const session = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? title));
  const coverImageUrl = String(formData.get("coverImageUrl") ?? "").trim();
  const previewMp3Url = String(formData.get("previewMp3Url") ?? "").trim();
  const downloadUrl = normalizeDropboxPreviewUrl(String(formData.get("downloadUrl") ?? "").trim());
  const priceCents = Number(formData.get("priceCents") ?? 0);

  if (!title || !slug || !downloadUrl || !priceCents) {
    throw new Error("Sound kit title, slug, download URL, and price are required.");
  }

  const payload = {
    title,
    slug,
    description: String(formData.get("description") ?? "").trim() || null,
    priceCents,
    coverImageUrl: coverImageUrl || null,
    previewMp3Url: previewMp3Url ? normalizeDropboxPreviewUrl(previewMp3Url) : null,
    downloadUrl,
    termsUrl: normalizeDropboxPreviewUrl(SHARED_SOUND_KIT_TERMS_URL),
    termsPreviewText: SHARED_SOUND_KIT_TERMS,
    category: String(formData.get("category") ?? "").trim() || null,
    tags: parseSoundKitTags(formData.get("tags")).join(", "),
    status: String(formData.get("status") ?? "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    isFeatured: ["on", "true"].includes(String(formData.get("isFeatured") ?? ""))
  };

  let soundKitId = id;
  let savedLabel = title;

  if (id) {
    await prisma.soundKit.update({
      where: { id },
      data: payload
    });

    await logAdminActivity({
      adminUserId: session.user!.id,
      action: "UPDATE_SOUND_KIT",
      targetType: "SOUND_KIT",
      targetId: id,
      targetLabel: savedLabel,
      metadata: {
        priceCents,
        category: payload.category,
        status: payload.status,
        featured: payload.isFeatured
      }
    });
  } else {
    const kit = await prisma.soundKit.create({ data: payload });
    soundKitId = kit.id;
    savedLabel = kit.title;

    await logAdminActivity({
      adminUserId: session.user!.id,
      action: "CREATE_SOUND_KIT",
      targetType: "SOUND_KIT",
      targetId: kit.id,
      targetLabel: kit.title,
      metadata: {
        priceCents,
        category: payload.category,
        status: payload.status,
        featured: payload.isFeatured
      }
    });
  }

  if (payload.coverImageUrl) {
    await prisma.soundKit.update({
      where: { id: soundKitId },
      data: {
        coverImageUrl: payload.coverImageUrl
      }
    });
  }

  revalidatePath("/");
  revalidatePath("/sound-kits");
  revalidatePath("/admin");
  revalidatePath("/admin/kits");
}

export async function deleteSoundKit(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const soundKit = await prisma.soundKit.findUnique({
    where: { id }
  });

  if (!soundKit) return;

  try {
    await prisma.soundKit.delete({ where: { id } });
    await logAdminActivity({
      adminUserId: session.user!.id,
      action: "DELETE_SOUND_KIT",
      targetType: "SOUND_KIT",
      targetId: id,
      targetLabel: soundKit.title
    });

    try {
      await deletePublicAsset(soundKit.coverImageUrl);
    } catch (assetError) {
      console.warn("Sound kit deleted but asset cleanup failed", {
        id,
        assetError
      });
    }
  } catch (error) {
    console.error("Sound kit delete failed", {
      id,
      error
    });
  }

  revalidatePath("/");
  revalidatePath("/sound-kits");
  revalidatePath("/admin");
  revalidatePath("/admin/kits");
}

export async function saveLicenseTemplate(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const payload = {
    code: slugify(String(formData.get("code") ?? "")),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    priceCents: formData.get("priceCents") ? Number(formData.get("priceCents")) : null,
    minOfferCents: formData.get("minOfferCents")
      ? Number(formData.get("minOfferCents"))
      : null,
    active: formData.get("active") === "on",
    isExclusive: formData.get("isExclusive") === "on",
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    publicSummary: parseStringList(formData.get("publicSummary")),
    rightsJson: parseJson(formData.get("rightsJson"), {}),
    contractPreviewPlain: String(formData.get("contractPreviewPlain") ?? "") || null,
    contractPreviewRtf: String(formData.get("contractPreviewRtf") ?? "") || null,
    fileNotes: String(formData.get("fileNotes") ?? "") || null
  };

  if (id) {
    await prisma.licenseTemplate.update({
      where: { id },
      data: payload
    });
  } else {
    await prisma.licenseTemplate.create({ data: payload });
  }

  revalidatePath("/");
  revalidatePath("/sound-kits");
  revalidatePath("/admin");
}

export async function deleteLicenseTemplate(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.licenseTemplate.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/sound-kits");
  revalidatePath("/admin");
}

export async function saveBeatLicenseOverride(formData: FormData) {
  const session = await requireAdmin();

  const beatId = String(formData.get("beatId") ?? "");
  const licenseTemplateId = String(formData.get("licenseTemplateId") ?? "");
  const template = await prisma.licenseTemplate.findUnique({
    where: { id: licenseTemplateId }
  });

  const links: { label: string; url: string }[] = [];

  const mp3Link = String(formData.get("mp3Link") ?? "");
  const wavLink = String(formData.get("wavLink") ?? "");
  const stemsLink = String(formData.get("stemsLink") ?? "");
  const producersTagLink = String(formData.get("producersTagLink") ?? "");

  // Add non-empty links
  if (mp3Link) links.push({ label: "MP3", url: mp3Link });
  if (wavLink) links.push({ label: "WAV", url: wavLink });
  if (stemsLink) links.push({ label: "Stems", url: stemsLink });
  if (producersTagLink) links.push({ label: "Producers Tag", url: producersTagLink });

  const beatLicense = await prisma.beatLicense.upsert({
    where: {
      beatId_licenseTemplateId: {
        beatId,
        licenseTemplateId
      }
    },
    update: {
      active: true,
      deliveryNotes: String(formData.get("deliveryNotes") ?? "") || null,
      fileNotes: String(formData.get("fileNotes") ?? "") || null,
      manualFulfillmentRequired:
        template?.code === "unlimited" || template?.code === "exclusive"
    },
    create: {
      beatId,
      licenseTemplateId,
      active: true,
      deliveryNotes: String(formData.get("deliveryNotes") ?? "") || null,
      fileNotes: String(formData.get("fileNotes") ?? "") || null,
      manualFulfillmentRequired:
        template?.code === "unlimited" || template?.code === "exclusive"
    }
  });

  await prisma.beatLicenseDeliveryLink.deleteMany({
    where: { beatLicenseId: beatLicense.id }
  });

  if (links.length) {
    await prisma.beatLicenseDeliveryLink.createMany({
      data: links.map((link, index) => ({
        beatLicenseId: beatLicense.id,
        label: link.label,
        url: link.url,
        sortOrder: index
      }))
    });
  }

  await logAdminActivity({
    adminUserId: session.user!.id,
    action: "UPDATE_BEAT_LICENSE",
    targetType: "BEAT_LICENSE",
    targetId: beatLicense.id,
    targetLabel: template?.name ?? licenseTemplateId,
    metadata: {
      beatId,
      licenseTemplateId,
      links: links.map((link) => link.label)
    }
  });

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function saveSiteSettings(formData: FormData) {
  await requireAdmin();
  const existing = await prisma.siteSettings.findFirst();

  const payload = {
    siteName: String(formData.get("siteName") ?? "Yunginz.Prod"),
    siteUrl: String(formData.get("siteUrl") ?? ""),
    defaultSeoTitle: String(formData.get("defaultSeoTitle") ?? ""),
    defaultSeoDescription: String(formData.get("defaultSeoDescription") ?? ""),
    producerName: String(formData.get("producerName") ?? "Yunginz"),
    producerTagline: String(formData.get("producerTagline") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    instagramUrl: String(formData.get("instagramUrl") ?? "") || null,
    youtubeUrl: String(formData.get("youtubeUrl") ?? "") || null,
    soundcloudUrl: String(formData.get("soundcloudUrl") ?? "") || null,
    xUrl: String(formData.get("xUrl") ?? "") || null,
    newsletterTitle: String(formData.get("newsletterTitle") ?? "") || null,
    newsletterDescription: String(formData.get("newsletterDescription") ?? "") || null,
    heroStats: parseJson(formData.get("heroStats"), []),
    footerPolicies: parseJson(formData.get("footerPolicies"), [])
  };

  if (existing) {
    await prisma.siteSettings.update({
      where: { id: existing.id },
      data: payload
    });
  } else {
    await prisma.siteSettings.create({ data: payload });
  }

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function saveHomepageSection(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.homepageSection.update({
    where: { id },
    data: {
      title: String(formData.get("title") ?? ""),
      subtitle: String(formData.get("subtitle") ?? "") || null,
      content: parseJson(formData.get("content"), {})
    }
  });

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function updateInquiryStatus(formData: FormData) {
  await requireAdmin();
  const type = String(formData.get("type") ?? "");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "IN_PROGRESS") as
    | "NEW"
    | "IN_PROGRESS"
    | "CLOSED";

  if (type === "contact") {
    await prisma.contactSubmission.update({ where: { id }, data: { status } });
  }

  if (type === "offer") {
    await prisma.exclusiveOffer.update({ where: { id }, data: { status } });
  }

  revalidatePath("/admin");
}

export async function updateOrderStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const fulfillmentStatus = String(formData.get("fulfillmentStatus") ?? "DELIVERED") as
    | "PENDING"
    | "PARTIAL"
    | "DELIVERED";

  await prisma.order.update({
    where: { id },
    data: { fulfillmentStatus }
  });

  revalidatePath("/admin");
}

export async function bulkUpdateBeatDurations(formData: FormData) {
  const session = await requireAdmin();

  const rawInput = String(formData.get("durationBatch") ?? "");
  const lines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let updatedCount = 0;
  for (const line of lines) {
    const parts = line
      .split(/[,=|]/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length < 2) continue;

    const identifier = parts[0];
    const duration = parseDurationToSeconds(parts[1]);

    if (!duration) continue;

    const normalizedSlug = slugify(identifier);

    const beat = await prisma.beat.findFirst({
      where: {
        OR: [
          { slug: normalizedSlug },
          { title: { equals: identifier, mode: "insensitive" } }
        ]
      },
      select: { id: true }
    });

    if (!beat) continue;

    await prisma.beat.update({
      where: { id: beat.id },
      data: { durationSeconds: duration }
    });
    updatedCount += 1;
  }

  await logAdminActivity({
    adminUserId: session.user!.id,
    action: "BULK_UPDATE_DURATIONS",
    targetType: "BEAT",
    metadata: {
      updatedCount
    }
  });

  revalidatePath("/");
  revalidatePath("/admin");
}

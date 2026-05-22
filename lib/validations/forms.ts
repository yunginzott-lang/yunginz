import { z } from "zod";

export const contactSubmissionSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  inquiryType: z.string().min(2).max(50),
  subject: z.string().min(3).max(120),
  message: z.string().min(20).max(2000)
});

export const exclusiveOfferSchema = z.object({
  beatId: z.string().min(1),
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().max(40).optional().or(z.literal("")),
  offerAmountCents: z.coerce.number().int().min(100000),
  message: z.string().max(2000).optional().or(z.literal(""))
});

export const cartCheckoutSchema = z.object({
  items: z
    .array(
      z.union([
        z.object({
          itemKey: z.string(),
          productType: z.literal("BEAT_LICENSE"),
          beatLicenseId: z.string(),
          beatId: z.string(),
          beatSlug: z.string(),
          beatTitle: z.string(),
          licenseName: z.string(),
          priceCents: z.number().int().positive(),
          coverImageUrl: z.string().nullable().optional()
        }),
        z.object({
          itemKey: z.string(),
          productType: z.literal("SOUND_KIT"),
          soundKitId: z.string(),
          soundKitTitle: z.string(),
          soundKitDescription: z.string().nullable().optional(),
          soundKitDownloadUrl: z.string().url().optional(),
          soundKitTermsUrl: z.string().url().nullable().optional(),
          soundKitTermsText: z.string().nullable().optional(),
          soundKitCoverImageUrl: z.string().nullable().optional(),
          priceCents: z.number().int().positive()
        })
      ])
    )
    .min(1),
  customerName: z.string().min(2).max(80),
  customerEmail: z.string().email(),
  customerAddress: z.string().min(5).max(240),
  buyerNotes: z.string().max(1000).optional().or(z.literal(""))
});

export const beatSchema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  previewMp3Url: z.string().url(),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  bpm: z.coerce.number().int().min(1).max(300),
  musicalKey: z.string().min(1),
  genre: z.string().min(1),
  mood: z.string().min(1),
  description: z.string().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED", "SOLD"]),
  isFeatured: z.boolean().optional(),
  tags: z.array(z.string()).default([])
});

export const licenseTemplateSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  description: z.string().min(10),
  priceCents: z.coerce.number().int().nullable().optional(),
  minOfferCents: z.coerce.number().int().nullable().optional(),
  active: z.boolean().optional(),
  isExclusive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().default(0),
  publicSummary: z.array(z.string()).default([]),
  rightsJson: z.record(z.string(), z.any()),
  contractPreviewPlain: z.string().optional().or(z.literal("")),
  contractPreviewRtf: z.string().optional().or(z.literal("")),
  fileNotes: z.string().optional().or(z.literal(""))
});

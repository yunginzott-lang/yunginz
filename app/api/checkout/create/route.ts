import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { createPaypalOrder } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, getRequestIp } from "@/lib/rate-limit";
import { generatePublicOrderId } from "@/lib/utils";
import { cartCheckoutSchema } from "@/lib/validations/forms";

export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    const rateLimit = await enforceRateLimit({
      action: "checkout",
      identifier: ip,
      limit: 8,
      windowMs: 1000 * 60 * 15
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many checkout attempts. Please wait a bit and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds)
          }
        }
      );
    }

    const payload = await request.json();
    const parsed = cartCheckoutSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout data." }, { status: 400 });
    }

    const beatItems = parsed.data.items.filter((item) => item.productType === "BEAT_LICENSE");
    const soundKitItems = parsed.data.items.filter((item) => item.productType === "SOUND_KIT");

    const beatLicenseIds = beatItems.map((item) => item.beatLicenseId);
    const soundKitIds = soundKitItems.map((item) => item.soundKitId);

    const licenses = await prisma.beatLicense.findMany({
      where: {
        id: { in: beatLicenseIds },
        active: true
      },
      include: {
        beat: true,
        licenseTemplate: true,
        deliveryLinks: true
      }
    });

    const soundKits = await prisma.soundKit.findMany({
      where: {
        id: { in: soundKitIds },
        status: "PUBLISHED"
      }
    });

    if (licenses.length !== beatLicenseIds.length) {
      return NextResponse.json(
        { error: "One or more beat licenses are unavailable." },
        { status: 400 }
      );
    }

    if (soundKits.length !== soundKitIds.length) {
      return NextResponse.json(
        { error: "One or more sound kits are unavailable." },
        { status: 400 }
      );
    }

    const uniqueBeatIds = new Set(licenses.map((license) => license.beatId));
    if (uniqueBeatIds.size !== licenses.length) {
      return NextResponse.json(
        { error: "Choose only one license per beat before checkout." },
        { status: 400 }
      );
    }

    const subtotalCents =
      licenses.reduce((sum, license) => {
        const price = license.customPriceCents ?? license.licenseTemplate.priceCents;
        return sum + (price ?? 0);
      }, 0) +
      soundKits.reduce((sum, kit) => sum + kit.priceCents, 0);

    if (subtotalCents <= 0) {
      return NextResponse.json(
        { error: "This checkout has no payable items." },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.upsert({
      where: { email: parsed.data.customerEmail },
      update: {
        name: parsed.data.customerName,
        address: parsed.data.customerAddress
      },
      create: {
        email: parsed.data.customerEmail,
        name: parsed.data.customerName,
        address: parsed.data.customerAddress
      }
    });

    const order = await prisma.order.create({
      data: {
        publicId: generatePublicOrderId(),
        customerId: customer.id,
        subtotalCents,
        buyerNotes: parsed.data.buyerNotes || null
      }
    });

    await prisma.orderItem.createMany({
      data: [
        ...licenses.map((license) => ({
          orderId: order.id,
          productType: "BEAT_LICENSE" as const,
          beatId: license.beatId,
          beatLicenseId: license.id,
          beatTitleSnapshot: license.beat.title,
          licenseNameSnapshot: license.customName ?? license.licenseTemplate.name,
          priceCentsSnapshot: license.customPriceCents ?? license.licenseTemplate.priceCents ?? 0,
          deliveryNotesSnapshot: license.deliveryNotes,
          fileNotesSnapshot: license.fileNotes ?? license.licenseTemplate.fileNotes,
          publicSummarySnapshot: license.licenseTemplate.publicSummary,
          rightsJsonSnapshot: (license.licenseTemplate.rightsJson ?? {}) as Prisma.InputJsonValue,
          deliveryLinksSnapshot: (license.deliveryLinks ?? []) as Prisma.InputJsonValue,
          manualFulfillmentRequired: license.manualFulfillmentRequired
        })),
        ...soundKits.map((kit) => ({
          orderId: order.id,
          productType: "SOUND_KIT" as const,
          soundKitId: kit.id,
          beatTitleSnapshot: kit.title,
          licenseNameSnapshot: "Sound kit",
          priceCentsSnapshot: kit.priceCents,
          deliveryNotesSnapshot: kit.termsPreviewText,
          fileNotesSnapshot: kit.category,
          publicSummarySnapshot: [
            kit.description || "Sound kit download included.",
            kit.termsPreviewText || "Terms included after purchase."
          ],
          rightsJsonSnapshot: ({ files: ["ZIP"] } as Prisma.InputJsonValue),
          deliveryLinksSnapshot: [
            {
              label: "ZIP Download",
              url: kit.downloadUrl
            }
          ] as Prisma.InputJsonValue,
          soundKitTitleSnapshot: kit.title,
          soundKitDescriptionSnapshot: kit.description,
          soundKitDownloadUrlSnapshot: kit.downloadUrl,
          soundKitTermsUrlSnapshot: kit.termsUrl,
          soundKitTermsTextSnapshot: kit.termsPreviewText,
          soundKitCoverImageUrlSnapshot: kit.coverImageUrl,
          manualFulfillmentRequired: false
        }))
      ]
    });

    const paypalOrder = await createPaypalOrder({
      orderId: order.id,
      amountCents: subtotalCents,
      description: `Yunginz order ${order.publicId}`
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paypalOrderId: paypalOrder.id
      }
    });

    const approvalUrl = paypalOrder.links?.find((link: any) => link.rel === "approve")?.href;

    if (!approvalUrl) {
      return NextResponse.json(
        {
          error:
            "PayPal did not return an approval link. Please try again in a moment."
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ approvalUrl });
  } catch (error) {
    console.error("Checkout creation failed", error);
    const message =
      error instanceof Error ? error.message : "Unknown checkout error.";
    const hint = /authenticate with paypal|credentials|client|secret|unauthorized/i.test(message)
      ? " PayPal credentials may be mismatched with PAYPAL_ENVIRONMENT."
      : "";
    return NextResponse.json(
      {
        error: `Unable to start checkout right now. Please try again shortly.${hint}`
      },
      { status: 500 }
    );
  }
}

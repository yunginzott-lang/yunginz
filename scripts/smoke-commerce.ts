import { PrismaClient } from "@prisma/client";

import { sendAdminNotification, sendOrderEmail } from "@/lib/email";
import { createPaypalOrder } from "@/lib/paypal";
import { formatCurrency, generatePublicOrderId } from "@/lib/utils";
import { cartCheckoutSchema } from "@/lib/validations/forms";

const prisma = new PrismaClient();

async function main() {
  const kit = await prisma.soundKit.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" }
  });

  if (!kit) {
    throw new Error("No published sound kit exists for smoke testing.");
  }

  const cartPayload = {
    items: [
      {
        itemKey: `sound-kit-${kit.id}`,
        productType: "SOUND_KIT" as const,
        soundKitId: kit.id,
        soundKitTitle: kit.title,
        soundKitDescription: kit.description,
        soundKitTermsUrl: kit.termsUrl,
        soundKitTermsText: kit.termsPreviewText,
        soundKitCoverImageUrl: kit.coverImageUrl,
        priceCents: kit.priceCents
      }
    ],
    customerName: "Yunginz Smoke Test",
    customerEmail:
      process.env.SMOKE_TEST_EMAIL ||
      process.env.NOTIFY_TO_EMAIL ||
      process.env.ADMIN_EMAIL ||
      "yunginzbeats@gmail.com",
    customerAddress: "Smoke test, production verification",
    buyerNotes: "Smoke test only. No payment captured."
  };

  const parsed = cartCheckoutSchema.safeParse(cartPayload);
  if (!parsed.success) {
    throw new Error(`Cart payload validation failed: ${parsed.error.message}`);
  }

  const paypalOrder = await createPaypalOrder({
    orderId: `smoke-${Date.now()}`,
    amountCents: kit.priceCents,
    description: `Yunginz smoke test - ${kit.title}`
  });

  const approvalUrl = paypalOrder.links?.find((link: { rel: string }) => link.rel === "approve")?.href;
  if (!approvalUrl) {
    throw new Error("PayPal did not return an approval URL.");
  }

  console.log(`PayPal smoke order created for ${formatCurrency(kit.priceCents)}.`);
  console.log(`Approval URL received: ${approvalUrl}`);

  const now = new Date();
  const testOrder = {
    id: `smoke-${Date.now()}`,
    publicId: generatePublicOrderId(),
    customerId: "smoke-customer",
    status: "PAID" as const,
    fulfillmentStatus: "DELIVERED" as const,
    paymentProvider: "PAYPAL",
    paypalOrderId: paypalOrder.id,
    currency: "USD",
    subtotalCents: kit.priceCents,
    amountPaidCents: kit.priceCents,
    buyerNotes: "Smoke test only. No real payment captured.",
    deliveryEmailSentAt: null,
    capturedAt: now,
    createdAt: now,
    updatedAt: now,
    customer: {
      id: "smoke-customer",
      email: cartPayload.customerEmail,
      name: cartPayload.customerName,
      address: cartPayload.customerAddress,
      phone: null,
      createdAt: now,
      updatedAt: now
    },
    items: [
      {
        id: `smoke-item-${Date.now()}`,
        orderId: "smoke-order",
        productType: "SOUND_KIT" as const,
        beatId: null,
        beatLicenseId: null,
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
        rightsJsonSnapshot: { files: ["ZIP"] },
        deliveryLinksSnapshot: [
          {
            label: "ZIP Download",
            url: kit.downloadUrl
          }
        ],
        soundKitTitleSnapshot: kit.title,
        soundKitDescriptionSnapshot: kit.description,
        soundKitDownloadUrlSnapshot: kit.downloadUrl,
        soundKitTermsUrlSnapshot: kit.termsUrl,
        soundKitTermsTextSnapshot: kit.termsPreviewText,
        soundKitCoverImageUrlSnapshot: kit.coverImageUrl,
        manualFulfillmentRequired: false,
        createdAt: now
      }
    ],
    paymentEvents: []
  };

  const buyerEmailSent = await sendOrderEmail({
    order: testOrder,
    customerEmail: cartPayload.customerEmail,
    customerName: cartPayload.customerName
  });

  const adminEmailSent = await sendAdminNotification({
    subject: "Yunginz commerce smoke test",
    preview: "This verifies successful-purchase admin notifications can send.",
    lines: [
      "Smoke test only. No real payment was captured.",
      `Product: ${kit.title}`,
      `Price: ${formatCurrency(kit.priceCents)}`,
      `Buyer test inbox: ${cartPayload.customerEmail}`
    ]
  });

  console.log(`Buyer email send result: ${buyerEmailSent ? "sent" : "failed"}`);
  console.log(`Admin email send result: ${adminEmailSent ? "sent" : "failed"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

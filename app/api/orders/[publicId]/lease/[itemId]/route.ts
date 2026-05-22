import { NextResponse } from "next/server";

import { generateLeasePdf, normalizeLicenseCode } from "@/lib/lease-document";
import { prisma } from "@/lib/prisma";
import { verifyLeaseDownloadToken } from "@/lib/security";
import type { LicenseRightsSnapshot } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export async function GET(
  request: Request,
  context: { params: Promise<{ publicId: string; itemId: string }> }
) {
  const params = await context.params;
  const url = new URL(request.url);
  const expiresAt = Number(url.searchParams.get("expires") ?? "");
  const token = url.searchParams.get("token") ?? "";

  if (
    !verifyLeaseDownloadToken({
      publicId: params.publicId,
      itemId: params.itemId,
      expiresAt,
      token
    })
  ) {
    return NextResponse.json({ error: "Download link is invalid or expired." }, { status: 403 });
  }

  const order = await prisma.order.findUnique({
    where: { publicId: params.publicId },
    include: {
      customer: true,
      items: true
    }
  });

  if (!order || order.status !== "PAID") {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const item = order.items.find((entry) => entry.id === params.itemId);
  if (!item) {
    return NextResponse.json({ error: "Lease not found." }, { status: 404 });
  }

  if (item.productType === "SOUND_KIT") {
    return NextResponse.json({ error: "Sound kit downloads are not served as lease PDFs." }, { status: 404 });
  }

  const pdf = await generateLeasePdf({
    licenseCode: normalizeLicenseCode(item.licenseNameSnapshot),
    licenseName: item.licenseNameSnapshot,
    beatTitle: item.beatTitleSnapshot,
    producerName: "Yunginz",
    buyerName: order.customer.name,
    buyerEmail: order.customer.email,
    buyerAddress: order.customer.address ?? undefined,
    priceLabel: formatCurrency(item.priceCentsSnapshot),
    purchasedAt: order.capturedAt ?? order.createdAt,
    rights: (item.rightsJsonSnapshot ?? {}) as LicenseRightsSnapshot
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${item.beatTitleSnapshot}-${item.licenseNameSnapshot}.pdf"`
    }
  });
}

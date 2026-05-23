import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyPaypalWebhook } from "@/lib/paypal";
import { sendPaidOrderNotifications } from "@/lib/order-notifications";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const webhookBody = body as { id?: string; event_type?: string; resource?: { id?: string; supplementary_data?: { related_ids?: { order_id?: string } }; amount?: { value?: string } } };
  const isVerified = await verifyPaypalWebhook(request.headers, body);

  if (!isVerified) {
    return NextResponse.json({ error: "Webhook verification failed." }, { status: 400 });
  }

  const paypalOrderId = webhookBody.resource?.id ?? webhookBody.resource?.supplementary_data?.related_ids?.order_id;
  const order = paypalOrderId
      ? await prisma.order.findUnique({
          where: { paypalOrderId },
          include: { customer: true, items: true }
        })
    : null;

  const existingEvent = webhookBody.id
    ? await prisma.paymentEvent.findFirst({
        where: {
          provider: "PAYPAL",
      eventType: webhookBody.event_type ?? "UNKNOWN",
          providerId: webhookBody.id
        }
      })
    : null;

  if (existingEvent) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await prisma.paymentEvent.create({
    data: {
      orderId: order?.id,
      eventType: webhookBody.event_type ?? "UNKNOWN",
      providerId: webhookBody.id,
      rawPayload: body as Prisma.InputJsonValue
    }
  });

  if (order && webhookBody.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const amountPaidCents = Math.round(Number(webhookBody.resource?.amount?.value ?? 0) * 100);
    if (amountPaidCents !== order.subtotalCents) {
      return NextResponse.json(
        { error: "Webhook amount did not match the order subtotal." },
        { status: 400 }
      );
    }

    const fulfillmentStatus = order.items.some((item) => item.manualFulfillmentRequired)
      ? "PARTIAL"
      : "DELIVERED";

    const paidOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        fulfillmentStatus,
        amountPaidCents,
        capturedAt: new Date()
      },
      include: { customer: true, items: true }
    });

    await sendPaidOrderNotifications(paidOrder);
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyPaypalWebhook } from "@/lib/paypal";
import { sendPaidOrderNotifications } from "@/lib/order-notifications";

export async function POST(request: Request) {
  const body = await request.json();
  const isVerified = await verifyPaypalWebhook(request.headers, body);

  if (!isVerified) {
    return NextResponse.json({ error: "Webhook verification failed." }, { status: 400 });
  }

  const paypalOrderId = body.resource?.id ?? body.resource?.supplementary_data?.related_ids?.order_id;
  const order = paypalOrderId
      ? await prisma.order.findUnique({
          where: { paypalOrderId },
          include: { customer: true, items: true }
        })
    : null;

  const existingEvent = body.id
    ? await prisma.paymentEvent.findFirst({
        where: {
          provider: "PAYPAL",
          eventType: body.event_type,
          providerId: body.id
        }
      })
    : null;

  if (existingEvent) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await prisma.paymentEvent.create({
    data: {
      orderId: order?.id,
      eventType: body.event_type,
      providerId: body.id,
      rawPayload: body
    }
  });

  if (order && body.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const amountPaidCents = Math.round(Number(body.resource?.amount?.value ?? 0) * 100);
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

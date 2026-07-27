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
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 200 });
  }

  try {
    const webhookBody = body as { id?: string; event_type?: string; resource?: { id?: string; supplementary_data?: { related_ids?: { order_id?: string } }; amount?: { value?: string } } };
    const isVerified = await verifyPaypalWebhook(request.headers, body);

    if (!isVerified) {
      return NextResponse.json({ ok: false, error: "Webhook verification failed." }, { status: 200 });
    }

    const paypalOrderId = webhookBody.event_type === "PAYMENT.CAPTURE.COMPLETED"
      ? webhookBody.resource?.supplementary_data?.related_ids?.order_id
      : webhookBody.resource?.id;

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
      if (amountPaidCents < order.subtotalCents) {
        return NextResponse.json(
          { ok: false, error: "Webhook amount did not match the order subtotal." },
          { status: 200 }
        );
      }

      const fulfillmentStatus = order.items.some((item) => item.manualFulfillmentRequired)
        ? "PARTIAL"
        : "DELIVERED";

      const paidOrder = await prisma.order.updateMany({
        where: { id: order.id, status: { not: "PAID" } },
        data: {
          status: "PAID",
          fulfillmentStatus,
          amountPaidCents,
          capturedAt: new Date()
        }
      });

      if (paidOrder.count > 0) {
        const updatedOrder = await prisma.order.findUnique({
          where: { id: order.id },
          include: { customer: true, items: true }
        });
        if (updatedOrder) {
          await sendPaidOrderNotifications(updatedOrder);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 200 });
  }
}

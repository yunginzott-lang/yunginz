import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action, id, fulfillmentStatus, refundNote } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { customer: true, items: true }
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (action === "updateFulfillment") {
    const validStatus = ["PENDING", "PARTIAL", "DELIVERED"].includes(fulfillmentStatus)
      ? fulfillmentStatus
      : "DELIVERED";

    await prisma.order.update({
      where: { id },
      data: { fulfillmentStatus: validStatus }
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "resendEmail") {
    const { sendPaidOrderNotifications } = await import("@/lib/order-notifications");
    await sendPaidOrderNotifications(order);

    return NextResponse.json({ ok: true });
  }

  if (action === "refund") {
    if (order.status !== "PAID") {
      return NextResponse.json({ error: "Only paid orders can be refunded" }, { status: 400 });
    }
    if (!order.paypalOrderId) {
      return NextResponse.json({ error: "No PayPal order ID" }, { status: 400 });
    }

    try {
      const { refundPaypalCapture } = await import("@/lib/paypal");
      const refundAmountCents = order.amountPaidCents ?? order.subtotalCents;

      await refundPaypalCapture({
        paypalOrderId: order.paypalOrderId,
        amountCents: refundAmountCents,
        note: refundNote || "Refund processed by store admin."
      });

      await prisma.order.update({
        where: { id },
        data: { status: "REFUNDED" }
      });

      await prisma.paymentEvent.create({
        data: {
          orderId: id,
          provider: "PAYPAL",
          eventType: "REFUND.PROCESSED",
          providerId: order.paypalOrderId,
          rawPayload: {
            refundNote: refundNote || "Refund processed by store admin.",
            amountCents: refundAmountCents,
            processedBy: session.user.email,
            processedAt: new Date().toISOString()
          }
        }
      });

      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown refund error";
      console.error("Refund failed", { orderId: id, paypalOrderId: order.paypalOrderId, error: message });
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (action === "markRefunded") {
    await prisma.order.update({
      where: { id },
      data: { status: "REFUNDED" }
    });

    await prisma.paymentEvent.create({
      data: {
        orderId: id,
        provider: "INTERNAL",
        eventType: "REFUND.MANUAL_MARK",
        providerId: order.paypalOrderId,
        rawPayload: {
          note: "Manually marked as refunded by admin (refund was processed outside PayPal).",
          processedBy: session.user.email,
          processedAt: new Date().toISOString()
        }
      }
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

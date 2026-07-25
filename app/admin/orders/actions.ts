"use server";

import { revalidatePath } from "next/cache";

import { logAdminActivity } from "@/lib/admin-activity";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function updateOrderFulfillment(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const fulfillmentStatus = String(formData.get("fulfillmentStatus") ?? "DELIVERED") as
    | "PENDING"
    | "PARTIAL"
    | "DELIVERED";

  if (!id) return;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return;

  await prisma.order.update({
    where: { id },
    data: { fulfillmentStatus }
  });

  await logAdminActivity({
    adminUserId: session.user!.id,
    action: "UPDATE_ORDER_FULFILLMENT",
    targetType: "ORDER",
    targetId: id,
    targetLabel: order.publicId,
    metadata: { fulfillmentStatus }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
}

export async function refundOrder(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("refundNote") ?? "Refund processed by admin.");

  if (!id) return;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { customer: true, items: true }
  });

  if (!order) return;
  if (order.status === "REFUNDED") return;
  if (order.status !== "PAID") return;

  const refundAmountCents = order.amountPaidCents ?? order.subtotalCents;
  if (!order.paypalOrderId) return;

  const { refundPaypalCapture } = await import("@/lib/paypal");

  try {
    await refundPaypalCapture({
      paypalOrderId: order.paypalOrderId,
      amountCents: refundAmountCents,
      note
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
          refundNote: note,
          amountCents: refundAmountCents,
          processedBy: session.user!.email,
          processedAt: new Date().toISOString()
        }
      }
    });

    await logAdminActivity({
      adminUserId: session.user!.id,
      action: "REFUND_ORDER",
      targetType: "ORDER",
      targetId: id,
      targetLabel: order.publicId,
      metadata: {
        amountCents: refundAmountCents,
        customerEmail: order.customer.email
      }
    });

    revalidatePath("/admin");
    revalidatePath("/admin/orders");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown refund error";
    console.error("Refund failed", { orderId: id, error: message });
  }
}

export async function resendOrderEmail(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  if (!id) return;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { customer: true, items: true }
  });

  if (!order) return;

  const { sendPaidOrderNotifications } = await import("@/lib/order-notifications");

  try {
    await sendPaidOrderNotifications(order);

    await logAdminActivity({
      adminUserId: session.user!.id,
      action: "RESEND_ORDER_EMAIL",
      targetType: "ORDER",
      targetId: id,
      targetLabel: order.publicId,
      metadata: { customerEmail: order.customer.email }
    });

    revalidatePath("/admin");
    revalidatePath("/admin/orders");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    console.error("Resend order email failed", { orderId: id, error: message });
  }
}

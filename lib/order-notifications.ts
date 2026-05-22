import { Prisma } from "@prisma/client";

import { sendAdminNotification, sendOrderEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

type PaidOrder = Prisma.OrderGetPayload<{
  include: {
    customer: true;
    items: true;
  };
}>;

function getOrderItemLabel(item: PaidOrder["items"][number]) {
  return item.productType === "SOUND_KIT"
    ? `${item.beatTitleSnapshot} - Sound kit - ${formatCurrency(item.priceCentsSnapshot)}`
    : `${item.beatTitleSnapshot} - ${item.licenseNameSnapshot} - ${formatCurrency(item.priceCentsSnapshot)}`;
}

export async function sendPaidOrderNotifications(order: PaidOrder) {
  if (!order.deliveryEmailSentAt) {
    try {
      const delivered = await sendOrderEmail({
        order,
        customerEmail: order.customer.email,
        customerName: order.customer.name
      });

      if (delivered) {
        await prisma.order.update({
          where: { id: order.id },
          data: { deliveryEmailSentAt: new Date() }
        });
      }
    } catch (error) {
      console.error("Order email pipeline failed", {
        orderId: order.id,
        error
      });
    }
  }

  const existingAdminNotice = await prisma.paymentEvent.findFirst({
    where: {
      provider: "INTERNAL",
      eventType: "ORDER.ADMIN_NOTIFICATION_SENT",
      providerId: order.id
    }
  });

  if (existingAdminNotice) {
    return;
  }

  const sent = await sendAdminNotification({
    subject: `New paid Yunginz order ${order.publicId}`,
    preview: `${order.customer.name} purchased ${order.items.length} item(s).`,
    lines: [
      `Order: ${order.publicId}`,
      `Customer: ${order.customer.name} <${order.customer.email}>`,
      `Total: ${formatCurrency(order.amountPaidCents ?? order.subtotalCents)}`,
      `Items: ${order.items.map(getOrderItemLabel).join(" | ")}`,
      `Fulfillment: ${order.fulfillmentStatus}`
    ]
  });

  if (sent) {
    await prisma.paymentEvent.create({
      data: {
        orderId: order.id,
        provider: "INTERNAL",
        eventType: "ORDER.ADMIN_NOTIFICATION_SENT",
        providerId: order.id,
        rawPayload: {
          publicId: order.publicId,
          customerEmail: order.customer.email,
          sentAt: new Date().toISOString()
        }
      }
    });
  }
}

import { prisma } from "@/lib/prisma";

export async function getAdminOrders() {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      items: true,
      paymentEvents: { orderBy: { createdAt: "desc" } }
    }
  });
}

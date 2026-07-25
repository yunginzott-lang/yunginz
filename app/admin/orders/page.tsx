import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireAdmin();
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: true, items: true }
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
      <h1 className="text-5xl font-semibold uppercase text-[#f4efe7]">Orders ({orders.length})</h1>
      <pre className="mt-8 text-sm text-foreground/60 overflow-auto">
        {JSON.stringify(orders, null, 2)}
      </pre>
    </main>
  );
}

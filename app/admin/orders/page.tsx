import Link from "next/link";
import {
  refundOrder,
  resendOrderEmail,
  updateOrderFulfillment
} from "@/app/admin/actions";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { requireAdmin } from "@/lib/auth/session";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getOrders() {
  const { prisma } = await import("@/lib/prisma");
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: true,
      items: true,
      paymentEvents: { orderBy: { createdAt: "desc" } }
    }
  });
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    PAID: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    PENDING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    REFUNDED: "bg-red-500/20 text-red-400 border-red-500/30",
    CANCELED: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    FAILED: "bg-red-500/20 text-red-400 border-red-500/30"
  };
  return colors[status] ?? "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
}

function fulfillmentBadge(status: string) {
  const colors: Record<string, string> = {
    DELIVERED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    PARTIAL: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    PENDING: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
  };
  return colors[status] ?? "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
}

export default async function AdminOrdersPage() {
  await requireAdmin();
  const orders = await getOrders();

  const totalRevenue = orders
    .filter((o) => o.status === "PAID")
    .reduce((sum, o) => sum + (o.amountPaidCents ?? o.subtotalCents), 0);

  const refundedCount = orders.filter((o) => o.status === "REFUNDED").length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="section-kicker">Order management</div>
          <h1 className="mt-4 text-5xl font-semibold uppercase text-[#f4efe7] md:text-6xl">
            Orders
          </h1>
          <p className="mt-3 text-lg text-foreground/60">
            Manage orders, fulfillment, and refunds
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/admin">Back to Dashboard</Link>
          </Button>
          <SignOutButton />
        </div>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        <Card className="glass-card border-white/10">
          <CardContent className="p-6">
            <div className="font-mono text-xs uppercase tracking-[0.24em] text-foreground/45">
              Total Orders
            </div>
            <div className="mt-2 text-4xl font-semibold text-[#f4efe7]">{orders.length}</div>
          </CardContent>
        </Card>
        <Card className="glass-card border-white/10">
          <CardContent className="p-6">
            <div className="font-mono text-xs uppercase tracking-[0.24em] text-foreground/45">
              Revenue
            </div>
            <div className="mt-2 text-4xl font-semibold text-emerald-400">
              {formatCurrency(totalRevenue)}
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-white/10">
          <CardContent className="p-6">
            <div className="font-mono text-xs uppercase tracking-[0.24em] text-foreground/45">
              Refunded
            </div>
            <div className="mt-2 text-4xl font-semibold text-red-400">{refundedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8 glass-card border-white/10">
        <CardContent className="p-8">
          <div className="section-kicker">All orders</div>
          <h2 className="mt-4 text-3xl font-semibold uppercase text-[#f4efe7]">
            {orders.length} order{orders.length !== 1 ? "s" : ""} total
          </h2>

          <div className="mt-8 space-y-4">
            {orders.map((order) => (
              <details
                key={order.id}
                className="rounded-3xl border border-white/10 bg-black/20"
                open={false}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-2xl font-semibold uppercase text-[#f4efe7]">
                        {order.publicId}
                      </div>
                      <span
                        className={`inline-block rounded-full border px-3 py-0.5 font-mono text-[11px] uppercase tracking-[0.2em] ${statusBadge(order.status)}`}
                      >
                        {order.status}
                      </span>
                      <span
                        className={`inline-block rounded-full border px-3 py-0.5 font-mono text-[11px] uppercase tracking-[0.2em] ${fulfillmentBadge(order.fulfillmentStatus)}`}
                      >
                        {order.fulfillmentStatus}
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.25em] text-foreground/40">
                      {order.customer.name} &lt;{order.customer.email}&gt; &middot;{" "}
                      {formatCurrency(order.amountPaidCents ?? order.subtotalCents)} &middot;{" "}
                      {new Date(order.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
                      Details
                    </div>
                  </div>
                </summary>

                <div className="border-t border-white/10 px-5 py-6 space-y-6">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="font-mono text-xs uppercase tracking-[0.22em] text-foreground/45">
                        Order Items
                      </div>
                      {order.deliveryEmailSentAt ? (
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                          Delivery email sent {new Date(order.deliveryEmailSentAt).toLocaleString()}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400">
                          No delivery email sent
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-white/10 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-base font-semibold text-[#f4efe7]">
                                {item.beatTitleSnapshot}
                              </div>
                              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/40">
                                {item.productType === "SOUND_KIT"
                                  ? "Sound kit"
                                  : item.licenseNameSnapshot}{" "}
                                &middot; {formatCurrency(item.priceCentsSnapshot)}
                                {item.manualFulfillmentRequired
                                  ? " (manual fulfillment)"
                                  : ""}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="font-mono text-xs uppercase tracking-[0.22em] text-foreground/45 mb-3">
                      Customer
                    </div>
                    <div className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-foreground/72">
                      <div className="font-medium text-[#f4efe7]">{order.customer.name}</div>
                      <div className="font-mono text-xs text-foreground/50">
                        {order.customer.email}
                      </div>
                      {order.customer.address && (
                        <div className="mt-1 text-xs text-foreground/45">
                          {order.customer.address}
                        </div>
                      )}
                    </div>
                  </div>

                  {order.buyerNotes && (
                    <div>
                      <div className="font-mono text-xs uppercase tracking-[0.22em] text-foreground/45 mb-3">
                        Buyer Notes
                      </div>
                      <div className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-foreground/72">
                        {order.buyerNotes}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="font-mono text-xs uppercase tracking-[0.22em] text-foreground/45 mb-3">
                      Payment Events
                    </div>
                    <div className="space-y-2">
                      {order.paymentEvents.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-2xl border border-white/10 px-4 py-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
                              {event.eventType}
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/40">
                              {new Date(event.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                      {!order.paymentEvents.length && (
                        <div className="text-sm text-foreground/40">No payment events recorded.</div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
                    {order.status === "PAID" && (
                      <>
                        <form action={updateOrderFulfillment}>
                          <input type="hidden" name="id" value={order.id} />
                          <div className="flex items-center gap-2">
                            <Select name="fulfillmentStatus" defaultValue={order.fulfillmentStatus}>
                              <option value="PENDING">Pending</option>
                              <option value="PARTIAL">Partial</option>
                              <option value="DELIVERED">Delivered</option>
                            </Select>
                            <Button type="submit" variant="outline" size="sm">
                              Update Fulfillment
                            </Button>
                          </div>
                        </form>

                        <form action={resendOrderEmail}>
                          <input type="hidden" name="id" value={order.id} />
                          <Button type="submit" variant="outline" size="sm">
                            Resend Email
                          </Button>
                        </form>

                        <form action={refundOrder}>
                          <input type="hidden" name="id" value={order.id} />
                          <input
                            type="hidden"
                            name="refundNote"
                            value="Refund processed by store admin."
                          />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            onClick={(e) => {
                              if (
                                !confirm(
                                  `Refund ${formatCurrency(order.amountPaidCents ?? order.subtotalCents)} to ${order.customer.email}?`
                                )
                              ) {
                                e.preventDefault();
                              }
                            }}
                          >
                            Issue Refund
                          </Button>
                        </form>
                      </>
                    )}

                    {order.status === "REFUNDED" && (
                      <div className="font-mono text-xs uppercase tracking-[0.22em] text-red-400">
                        This order has been refunded.
                      </div>
                    )}
                  </div>
                </div>
              </details>
            ))}

            {!orders.length && (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-foreground/45">
                No orders yet. Orders will appear here once customers make purchases.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

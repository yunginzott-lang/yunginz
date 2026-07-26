"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

export function OrderActions({
  orderId,
  status,
  fulfillmentStatus,
  customerEmail,
  amountCents
}: {
  orderId: string;
  status: string;
  fulfillmentStatus: string;
  customerEmail: string;
  amountCents: number;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (status !== "PAID") {
    if (status === "REFUNDED") {
      return (
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-red-400">
          This order has been refunded.
        </div>
      );
    }
    return null;
  }

  async function handleAction(action: string, body: Record<string, string>) {
    const res = await fetch("/api/orders/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body })
    });
    const data = await res.json();
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      alert(data.error || "Action failed. Please try again.");
    }
  }

  return (
    <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          handleAction("updateFulfillment", {
            id: orderId,
            fulfillmentStatus: String(fd.get("fulfillmentStatus"))
          });
        }}
      >
        <div className="flex items-center gap-2">
          <Select name="fulfillmentStatus" defaultValue={fulfillmentStatus}>
            <option value="PENDING">Pending</option>
            <option value="PARTIAL">Partial</option>
            <option value="DELIVERED">Delivered</option>
          </Select>
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            Update Fulfillment
          </Button>
        </div>
      </form>

      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => handleAction("resendEmail", { id: orderId })}
      >
        Resend Email
      </Button>

      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
        onClick={() => {
          if (confirm(`Refund ${formatCurrency(amountCents)} to ${customerEmail}?`)) {
            handleAction("refund", {
              id: orderId,
              refundNote: "Refund processed by store admin."
            });
          }
        }}
      >
        Issue Refund
      </Button>
    </div>
  );
}

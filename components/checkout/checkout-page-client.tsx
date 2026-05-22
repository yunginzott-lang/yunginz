"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { ModalShell } from "@/components/ui/modal-shell";
import { useCartStore } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

type LicensePreview = {
  beatLicenseId: string;
  licenseName: string;
  previewText: string;
};

type KitPreview = {
  soundKitId: string;
  soundKitTitle: string;
  previewText: string;
};

export function CheckoutPageClient() {
  const items = useCartStore((state) => state.items);
  const hydrated = useCartStore((state) => state.hydrated);
  const removeItem = useCartStore((state) => state.removeItem);
  const [pending, startTransition] = useTransition();
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [activePreview, setActivePreview] = useState<LicensePreview | KitPreview | null>(null);
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerAddress: "",
    buyerNotes: ""
  });

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.priceCents, 0),
    [items]
  );

  function beginCheckout() {
    startTransition(async () => {
      const response = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          ...form
        })
      });

      const payload = await response.json();

      if (!response.ok || !payload.approvalUrl) {
        toast.error(payload.error ?? "Unable to start checkout.");
        return;
      }

      window.location.href = payload.approvalUrl;
    });
  }

  async function previewLicense(beatLicenseId: string) {
    setLoadingPreview(true);
    const response = await fetch("/api/licenses/previews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beatLicenseIds: [beatLicenseId] })
    });
    setLoadingPreview(false);

    const payload = await response.json();
    if (!response.ok || !payload.previews?.length) {
      toast.error(payload.error ?? "Unable to load license preview.");
      return;
    }

    setActivePreview(payload.previews[0] as LicensePreview);
  }

  function previewSoundKit(item: (typeof items)[number]) {
    setActivePreview({
      soundKitId: item.soundKitId ?? item.itemKey,
      soundKitTitle: item.soundKitTitle ?? item.beatTitle ?? "Sound kit",
      previewText:
        item.soundKitTermsText ||
        item.soundKitDescription ||
        "No kit terms preview has been added yet."
    });
  }

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
        <div className="section-kicker">Secure checkout</div>
        <h1 className="mt-5 text-4xl font-semibold uppercase text-[#f4efe7] md:text-6xl">
          Loading checkout
        </h1>
        <p className="mt-4 text-base text-foreground/58 md:text-lg">
          Restoring your cart and checkout session...
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
        <div className="section-kicker">Secure checkout</div>
        <h1 className="mt-5 text-4xl font-semibold uppercase text-[#f4efe7] md:text-6xl">
          Complete your order
        </h1>
        <p className="mt-4 max-w-3xl text-base text-foreground/58 md:text-lg">
          Review your selected licenses, enter delivery details, and continue to PayPal.
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="glass-card border-white/10">
            <CardContent className="space-y-5 p-6 md:p-8">
              <div className="text-xl font-semibold uppercase text-[#f4efe7]">
                Delivery details
              </div>
              <div>
                <Label htmlFor="customerName">Full name</Label>
                <Input
                  id="customerName"
                  name="customerName"
                  value={form.customerName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, customerName: event.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="customerEmail">Email address</Label>
                <Input
                  id="customerEmail"
                  name="customerEmail"
                  type="email"
                  value={form.customerEmail}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, customerEmail: event.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="customerAddress">Address</Label>
                <Input
                  id="customerAddress"
                  name="customerAddress"
                  value={form.customerAddress}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, customerAddress: event.target.value }))
                  }
                  placeholder="City, state/province, country"
                />
              </div>
              <div>
                <Label htmlFor="buyerNotes">Order notes</Label>
                <Textarea
                  id="buyerNotes"
                  name="buyerNotes"
                  value={form.buyerNotes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, buyerNotes: event.target.value }))
                  }
                  placeholder="Optional delivery note or project reference"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10">
            <CardContent className="space-y-5 p-6 md:p-8">
              <div className="text-xl font-semibold uppercase text-[#f4efe7]">
                Order summary
              </div>
              <div className="space-y-4">
                {items.length ? (
                  items.map((item) => (
                    <div
                      key={item.itemKey}
                      className="rounded-2xl border border-white/10 p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {item.coverImageUrl ? (
                            <Image
                              src={item.coverImageUrl}
                              alt={item.beatTitle ?? item.soundKitTitle ?? "Product"}
                              width={56}
                              height={56}
                              className="h-14 w-14 rounded-xl object-cover"
                            />
                          ) : null}
                          <div>
                            <div className="text-base font-semibold text-[#f4efe7]">
                              {item.beatTitle ?? item.soundKitTitle ?? "Product"}
                            </div>
                            <div className="text-sm text-foreground/45">
                              {item.productType === "SOUND_KIT"
                                ? "Sound kit"
                                : item.licenseName}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-primary">
                            {formatCurrency(item.priceCents)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={loadingPreview}
                          onClick={() =>
                            item.productType === "SOUND_KIT"
                              ? previewSoundKit(item)
                              : previewLicense(item.beatLicenseId ?? item.itemKey)
                          }
                        >
                          {loadingPreview
                            ? "Loading..."
                            : item.productType === "SOUND_KIT"
                              ? "Preview terms"
                              : "Preview license"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.itemKey)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-foreground/45">
                    Your cart is empty.
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-5">
                <span className="text-foreground/58">Subtotal</span>
                <span className="text-2xl font-semibold text-[#f4efe7]">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <Button
                className="w-full"
                size="lg"
                disabled={
                  !items.length ||
                  !form.customerName ||
                  !form.customerEmail ||
                  !form.customerAddress ||
                  pending
                }
                onClick={beginCheckout}
              >
                {pending ? "Redirecting..." : "Continue to PayPal"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ModalShell
        open={!!activePreview}
        onClose={() => setActivePreview(null)}
        className="max-w-3xl"
      >
        {activePreview ? (
          <div className="space-y-5">
            <div className="section-kicker">
              {"licenseName" in activePreview ? "License preview" : "Sound kit terms"}
            </div>
            <h2 className="text-3xl font-semibold uppercase text-[#f4efe7]">
              {"licenseName" in activePreview
                ? activePreview.licenseName
                : activePreview.soundKitTitle}
            </h2>
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap pr-2 text-[14px] leading-7 text-foreground/78">
              {activePreview.previewText}
            </div>
          </div>
        ) : null}
      </ModalShell>
    </>
  );
}

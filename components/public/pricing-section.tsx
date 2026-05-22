"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModalShell } from "@/components/ui/modal-shell";
import { formatCurrency } from "@/lib/utils";

type PricingLicense = {
  id: string;
  code: string;
  name: string;
  description: string;
  priceCents: number | null;
  minOfferCents: number | null;
  active: boolean;
  isExclusive: boolean;
  sortOrder: number;
  publicSummary: string[];
  contractPreviewPlain: string | null;
};

export function PricingSection({ licenses }: { licenses: PricingLicense[] }) {
  const [activePreview, setActivePreview] = useState<PricingLicense | null>(null);

  return (
    <section id="plans" className="section-shell">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <div className="section-kicker justify-center">Licensing plans</div>
          <h2 className="text-4xl font-semibold uppercase leading-[0.95] text-[#f4efe7] md:text-6xl">
            Pick your level
          </h2>
          <p className="text-lg text-foreground/55 md:text-xl">
            Clean terms, direct delivery, and artist-ready licensing options.
          </p>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {licenses.map((license) => (
            <Card key={license.id} className="glass-card border-white/10">
              <CardContent className="flex h-full flex-col gap-6 p-8">
                <div className="text-3xl font-semibold uppercase text-[#f4efe7]">
                  {license.name}
                </div>
                <div className="text-4xl font-semibold text-primary">
                  {license.isExclusive ? "$1000+" : formatCurrency(license.priceCents)}
                </div>
                <p className="flex-1 text-base text-foreground/58">{license.description}</p>
                <div className="space-y-2 text-sm text-foreground/72">
                  {license.publicSummary.map((item) => (
                    <div key={item} className="flex gap-2">
                      <span className="text-primary">-</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" onClick={() => setActivePreview(license)}>
                  Preview License
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <ModalShell
        open={!!activePreview}
        onClose={() => setActivePreview(null)}
        className="max-w-3xl"
      >
        {activePreview ? (
          <div className="space-y-6">
            <div className="section-kicker">License preview</div>
            <div className="text-3xl font-semibold uppercase text-[#f4efe7]">
              {activePreview.name}
            </div>
            <div className="text-xl font-semibold text-primary">
              {activePreview.isExclusive
                ? "$1000+ minimum offer"
                : formatCurrency(activePreview.priceCents)}
            </div>
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap pr-2 text-[14px] leading-7 text-foreground/78">
              {activePreview.contractPreviewPlain || activePreview.description}
            </div>
          </div>
        ) : null}
      </ModalShell>
    </section>
  );
}

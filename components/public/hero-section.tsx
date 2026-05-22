"use client";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SET_CATALOG_GENRE_EVENT } from "@/lib/catalog-events";
import { formatCompactNumber } from "@/lib/utils";

export function HeroSection({
  section,
  settings
}: {
  section: { content: any } | undefined;
  settings: any;
}) {
  const content = section?.content as any;
  const stats =
    (settings?.heroStats as Array<{ label: string; value: string | number }>) || [];
  const genres = Array.from(
    new Set([
      ...((content?.genres as string[] | undefined) ?? ["Trap", "Afro", "R&B", "Dancehall", "Soul"]),
      "Amapiano",
      "Neo Soul"
    ])
  );
  const kicker = String(content?.kicker ?? "EST. 2019 - INDEPENDENT PRODUCER").replace(
    /EST\.\s*2020/i,
    "EST. 2019"
  );

  return (
    <section id="top" className="section-shell min-h-[90vh] md:min-h-0 lg:min-h-screen">
      <video
        className="hero-video opacity-30"
        src="/media/check-description-hero.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(247,195,0,0.12),transparent_24%),linear-gradient(180deg,rgba(2,2,6,0.32),rgba(2,2,6,0.84))]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 pb-14 pt-24 md:gap-8 md:pb-12 md:pt-20 lg:min-h-screen lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:px-10 lg:pb-16 lg:pt-28">
        <div className="space-y-7">
          <div className="section-kicker text-[10px] sm:text-xs">{kicker}</div>
          <div className="display-shadow leading-none">
            <div className="text-[3.5rem] font-semibold uppercase tracking-tight text-[#f4efe7] sm:text-[4.9rem] md:text-[4.8rem] lg:text-[7rem]">
              {content?.headingPrimary ?? "YUNGINZ"}
            </div>
            <div className="-mt-2 text-[3rem] font-semibold uppercase tracking-tight text-primary sm:text-[4.2rem] md:text-[4.2rem] lg:text-[6.2rem]">
              {content?.headingAccent ?? ".PROD"}
            </div>
          </div>
          <div className="flex max-w-3xl flex-wrap gap-2">
            {genres.map((genre: string) => (
              <button
                key={genre}
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent(SET_CATALOG_GENRE_EVENT, {
                      detail: { genre }
                    })
                  )
                }
                className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/50 transition hover:text-primary sm:text-xs"
              >
                {genre}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <Button asChild size="lg" className="h-12 px-6 text-xs">
              <Link href="#beats" prefetch={false}>
                {content?.primaryCtaLabel ?? "Browse Beats"}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-6 text-xs">
              <Link href="#plans" prefetch={false}>
                {content?.secondaryCtaLabel ?? "View Plans"}
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] md:items-end lg:grid-cols-1 lg:justify-items-end">
          <div className="glass-card overflow-hidden border border-white/10 p-3 md:order-2 lg:order-1">
            <Image
              src="/media/yunginz-yellow-hero.webp"
              alt="Yunginz portrait"
              width={720}
              height={900}
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 420px"
              className="h-[260px] w-full object-cover object-center md:h-[280px] lg:w-[420px] lg:h-[360px]"
            />
          </div>
          <div className="grid w-full max-w-xl grid-cols-3 gap-3 border border-white/8 bg-black/25 p-4 backdrop-blur-sm md:order-1 md:max-w-none lg:order-2 lg:max-w-xl lg:gap-4 lg:p-5">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-semibold text-primary lg:text-4xl">
                  {formatCompactNumber(stat.value)}
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40 sm:text-[11px]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

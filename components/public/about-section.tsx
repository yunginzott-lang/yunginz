"use client";

import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { SET_CATALOG_GENRE_EVENT } from "@/lib/catalog-events";

export function AboutSection({
  section
}: {
  section: { title: string; subtitle?: string | null; content: any } | undefined;
}) {
  const content = (section?.content ?? {}) as any;
  const pills = Array.from(
    new Set([...(content.pills ?? []), "Amapiano", "Neo Soul"] as string[])
  );

  return (
    <section id="about" className="section-shell">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12 lg:px-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          <div className="glass-card overflow-hidden border border-white/8">
            <Image
              src="/media/001.webp"
              alt="Yunginz visual one"
              width={640}
              height={900}
              sizes="(max-width: 640px) 100vw, 50vw"
              className="h-full min-h-[260px] w-full object-cover md:min-h-[300px]"
            />
          </div>
          <div className="glass-card overflow-hidden border border-white/8">
            <Image
              src="/media/yunginz-yellow-car.webp"
              alt="Yunginz visual two"
              width={640}
              height={900}
              sizes="(max-width: 640px) 100vw, 50vw"
              className="h-full min-h-[260px] w-full object-cover md:min-h-[300px]"
            />
          </div>
        </div>
        <div className="space-y-5 md:space-y-6">
          <div className="section-kicker">{section?.subtitle ?? "The artist"}</div>
          <h2 className="max-w-3xl text-4xl font-semibold uppercase leading-[0.95] text-[#f4efe7] md:text-5xl lg:text-6xl">
            {section?.title ?? "Built from the ground up"}
          </h2>
          <div className="space-y-4 text-[0.95rem] leading-relaxed text-foreground/76 md:text-[1rem] lg:text-[1.12rem]">
            <p>{content.body}</p>
            <p>{content.body2}</p>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            {pills.map((pill) => (
              <button
                key={pill}
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent(SET_CATALOG_GENRE_EVENT, {
                      detail: { genre: pill }
                    })
                  )
                }
              >
                <Badge>{pill}</Badge>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

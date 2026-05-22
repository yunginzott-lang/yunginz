"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModalShell } from "@/components/ui/modal-shell";
import { useCartStore } from "@/lib/cart";
import { normalizeDropboxPreviewUrl } from "@/lib/dropbox";
import { usePlayerStore } from "@/lib/player";
import { formatCurrency } from "@/lib/utils";

type SoundKitItem = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  priceCents: number;
  coverImageUrl: string | null;
  previewMp3Url: string | null;
  downloadUrl: string;
  termsUrl: string | null;
  termsPreviewText: string | null;
  category: string | null;
  tags: string | null;
  status: string;
  isFeatured: boolean;
};

export function SoundKitsSection({
  soundKits,
  showAllLink = true
}: {
  soundKits: SoundKitItem[];
  showAllLink?: boolean;
}) {
  const addItem = useCartStore((state) => state.addItem);
  const [activeKit, setActiveKit] = useState<SoundKitItem | null>(null);
  const [previewMode, setPreviewMode] = useState<"description" | "terms">("description");
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const activeTrackId = usePlayerStore((state) => state.activeBeatId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setQueue = usePlayerStore((state) => state.setQueue);
  const setActiveTrack = usePlayerStore((state) => state.setActiveBeat);
  const setPlaying = usePlayerStore((state) => state.setPlaying);
  const hasMoreKits = soundKits.length > 5;

  if (!soundKits.length) {
    return null;
  }

  function addKitToCart(kit: SoundKitItem) {
    addItem({
      itemKey: `sound-kit-${kit.id}`,
      productType: "SOUND_KIT",
      soundKitId: kit.id,
      soundKitTitle: kit.title,
      soundKitDescription: kit.description,
      soundKitDownloadUrl: undefined,
      soundKitTermsUrl: kit.termsUrl,
      soundKitTermsText: kit.termsPreviewText,
      soundKitCoverImageUrl: kit.coverImageUrl,
      priceCents: kit.priceCents,
      coverImageUrl: kit.coverImageUrl
    });

    toast.success("Sound kit added to cart");
  }

  function openKitPreview(kit: SoundKitItem, mode: "description" | "terms") {
    setPreviewMode(mode);
    setActiveKit(kit);
  }

  function scrollKits(direction: "prev" | "next") {
    const viewport = carouselRef.current;
    if (!viewport) return;

    viewport.scrollBy({
      left: direction === "next" ? viewport.clientWidth : -viewport.clientWidth,
      behavior: "smooth"
    });
  }

  function playKitPreview(kit: SoundKitItem) {
    if (!kit.previewMp3Url) {
      toast.error("No preview sample has been added for this kit yet.");
      return;
    }

    const previewableKits = soundKits.filter((item) => item.previewMp3Url);
    const trackId = `sound-kit-${kit.id}`;

    setQueue(
      previewableKits.map((item) => ({
        id: `sound-kit-${item.id}`,
        title: item.title,
        productType: "SOUND_KIT",
        previewMp3Url: normalizeDropboxPreviewUrl(item.previewMp3Url!),
        bpm: null,
        durationSeconds: null,
        coverImageUrl: item.coverImageUrl,
        soundKitId: item.id,
        soundKitTitle: item.title,
        soundKitDescription: item.description,
        soundKitTermsUrl: item.termsUrl,
        soundKitTermsText: item.termsPreviewText,
        priceCents: item.priceCents
      }))
    );

    if (activeTrackId === trackId && isPlaying) {
      setPlaying(false);
      return;
    }

    setActiveTrack(trackId);
    setPlaying(true);
  }

  return (
    <section id="kits" className="section-shell">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="section-kicker">Sound kits</div>
            <h2 className="text-3xl font-semibold uppercase leading-[0.95] text-[#f4efe7] md:text-5xl">
              Loop kits and sample packs
            </h2>
            <p className="max-w-xl text-sm text-foreground/60 md:text-base">
              Browse curated sound kits and preview the descriptions before you add one to cart.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasMoreKits && showAllLink ? (
              <Button asChild variant="outline" size="sm" className="h-9 px-3 text-[10px] tracking-[0.18em]">
                <Link href="/sound-kits" prefetch={false}>
                  See all sound kits
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => scrollKits("prev")}
              aria-label="Previous sound kits"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => scrollKits("next")}
              aria-label="Next sound kits"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          ref={carouselRef}
          className="mt-8 grid auto-cols-[minmax(0,100%)] grid-flow-col gap-3 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:none] md:auto-cols-[calc((100%-48px)/5)] [&::-webkit-scrollbar]:hidden"
        >
          {soundKits.map((kit) => (
            <Card
              key={kit.id}
              className="glass-card snap-start overflow-hidden border-white/10"
            >
              <CardContent className="flex h-full flex-col p-0">
                <div className="group relative aspect-[1.02] w-full overflow-hidden border-b border-white/10 bg-black">
                  <button
                    type="button"
                    onClick={() => openKitPreview(kit, "description")}
                    className="absolute inset-0 text-left"
                    aria-label={`Preview ${kit.title} description`}
                  >
                    {kit.coverImageUrl ? (
                      <>
                        <Image
                          src={kit.coverImageUrl}
                          alt={kit.title}
                          fill
                          sizes="(min-width: 1280px) 20vw, (min-width: 768px) 20vw, 100vw"
                          className="object-cover transition duration-500 group-hover:scale-[1.035]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-10">
                        <div className="flex h-48 w-48 items-center justify-center rounded-3xl border border-primary/25 bg-primary/10 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                          No artwork
                        </div>
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => playKitPreview(kit)}
                    className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 text-primary shadow-[0_16px_45px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:scale-[1.04] hover:bg-primary hover:text-black disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={`${activeTrackId === `sound-kit-${kit.id}` && isPlaying ? "Pause" : "Play"} ${kit.title} preview`}
                    disabled={!kit.previewMp3Url}
                  >
                    {activeTrackId === `sound-kit-${kit.id}` && isPlaying ? (
                      <Pause className="h-5 w-5 fill-current" />
                    ) : (
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    )}
                  </button>
                </div>

                <div className="space-y-3 p-3.5">
                  <div className="space-y-1">
                    <div className="line-clamp-2 min-h-10 text-sm font-semibold uppercase leading-tight text-[#f4efe7] md:text-base">
                      {kit.title}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-foreground/45">
                      {kit.category || "Sound kit"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2">
                    <Button
                      size="sm"
                      className="col-span-2 h-8 w-full gap-1.5 px-2 text-xs"
                      onClick={() => addKitToCart(kit)}
                      aria-label={`Add ${kit.title} to cart for ${formatCurrency(kit.priceCents)}`}
                    >
                      <ShoppingBag className="h-4 w-4" />
                      <span className="font-mono text-[11px]">{formatCurrency(kit.priceCents)}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-full whitespace-nowrap px-2 text-[9px] tracking-[0.08em]"
                      onClick={() => openKitPreview(kit, "description")}
                    >
                      Desc
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-full whitespace-nowrap px-2 text-[9px] tracking-[0.08em]"
                      onClick={() => openKitPreview(kit, "terms")}
                    >
                      Terms
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <ModalShell open={!!activeKit} onClose={() => setActiveKit(null)} className="max-w-3xl">
        {activeKit ? (
          <div className="space-y-6">
            <div className="section-kicker">
              {previewMode === "description" ? "Kit description" : "Kit terms"}
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {activeKit.coverImageUrl ? (
                <Image
                  src={activeKit.coverImageUrl}
                  alt={activeKit.title}
                  width={120}
                  height={120}
                  className="h-28 w-28 rounded-2xl object-cover"
                />
              ) : null}
              <div className="space-y-2">
                <div className="text-3xl font-semibold uppercase text-[#f4efe7]">
                  {activeKit.title}
                </div>
                <div className="font-mono text-xs uppercase tracking-[0.25em] text-foreground/45">
                  {formatCurrency(activeKit.priceCents)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-base leading-7 text-foreground/72 whitespace-pre-wrap">
              {previewMode === "description"
                ? activeKit.description || "No description has been added yet."
                : activeKit.termsPreviewText || "No terms preview has been added yet."}
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => addKitToCart(activeKit)}
            >
              <ShoppingBag className="h-4 w-4" />
              Add To Cart
            </Button>
          </div>
        ) : null}
      </ModalShell>
    </section>
  );
}

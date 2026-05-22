"use client";

import Image from "next/image";
import { Share2, Pause, Play, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { toast } from "sonner";

import { useCartStore } from "@/lib/cart";
import { SET_CATALOG_GENRE_EVENT, OPEN_LICENSE_EVENT } from "@/lib/catalog-events";
import { normalizeDropboxPreviewUrl } from "@/lib/dropbox";
import { usePlayerStore } from "@/lib/player";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalShell } from "@/components/ui/modal-shell";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TurnstileField } from "@/components/ui/turnstile-field";

type BeatItem = any;

export function CatalogExperience({ beats }: { beats: BeatItem[]; licenses: any[] }) {
  const pageSize = 8;
  const bpmMarks = [50, 95, 140, 180, 225] as const;
  const bpmMinBound = bpmMarks[0];
  const bpmMaxBound = bpmMarks[bpmMarks.length - 1];
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState("newest");
  const [bpmMin, setBpmMin] = useState<number>(bpmMinBound);
  const [bpmMax, setBpmMax] = useState<number>(bpmMaxBound);
  const bpmTrackRef = useRef<HTMLDivElement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailBeat, setDetailBeat] = useState<BeatItem | null>(null);
  const [selectedBeat, setSelectedBeat] = useState<BeatItem | null>(null);
  const [selectedLicenseId, setSelectedLicenseId] = useState<string>("");
  const [offerOpen, setOfferOpen] = useState(false);
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [offerForm, setOfferForm] = useState({
    name: "",
    email: "",
    phone: "",
    offerAmount: 1000,
    message: "",
    turnstileToken: ""
  });
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const addItem = useCartStore((state) => state.addItem);
  const activeBeatId = usePlayerStore((state) => state.activeBeatId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const setQueue = usePlayerStore((state) => state.setQueue);
  const setActiveBeat = usePlayerStore((state) => state.setActiveBeat);
  const setPlaying = usePlayerStore((state) => state.setPlaying);

  const genres = Array.from(
    new Set(
      beats.flatMap((beat) =>
        String(beat.genre)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      )
    )
  );

  const filteredBeats = useMemo(() => {
    const catalog = [...beats]
      .filter((beat) =>
        genre === "all"
          ? true
          : String(beat.genre)
              .split(",")
              .map((value) => value.trim().toLowerCase())
              .includes(genre.toLowerCase())
      )
      .filter((beat) => {
        const searchable = [beat.title, beat.genre, beat.mood, ...(beat.tags?.map((tag: any) => tag.value) ?? [])]
          .join(" ")
          .toLowerCase();
        return searchable.includes(query.toLowerCase());
      })
      .filter((beat) => {
        const bpmValue = Number(beat.bpm ?? 0);
        return bpmValue >= bpmMin && bpmValue <= bpmMax;
      });

    if (sort === "title") {
      catalog.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "price-asc") {
      catalog.sort((a, b) => cheapestPrice(a) - cheapestPrice(b));
    } else if (sort === "price-desc") {
      catalog.sort((a, b) => cheapestPrice(b) - cheapestPrice(a));
    } else if (sort === "oldest") {
      catalog.reverse();
    }

    return catalog;
  }, [beats, genre, query, sort, bpmMin, bpmMax]);

  const totalPages = Math.max(1, Math.ceil(filteredBeats.length / pageSize));
  const paginatedBeats = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBeats.slice(start, start + pageSize);
  }, [currentPage, filteredBeats]);
  const visiblePages = useMemo(
    () => buildVisiblePages(currentPage, totalPages),
    [currentPage, totalPages]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [query, genre, sort, bpmMin, bpmMax]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setQueue(
      filteredBeats.map((beat) => ({
        id: beat.id,
        title: beat.title,
        previewMp3Url: normalizeDropboxPreviewUrl(beat.previewMp3Url),
        bpm: beat.bpm,
        durationSeconds: beat.durationSeconds,
        coverImageUrl: beat.coverImageUrl
      }))
    );
  }, [filteredBeats, setQueue]);

  function toggleBeat(beat: BeatItem) {
    if (activeBeatId === beat.id && isPlaying) {
      setPlaying(false);
      return;
    }

    setActiveBeat(beat.id);
    setPlaying(true);
  }

  function openLicenseSelector(beat: BeatItem) {
    setSelectedBeat(beat);
    setSelectedLicenseId(beat.licenses[0]?.id ?? "");
  }

  function openBeatDetails(beat: BeatItem) {
    setDetailBeat(beat);
  }

  function openLicenseFromDetails() {
    if (!detailBeat) return;
    openLicenseSelector(detailBeat);
    setDetailBeat(null);
  }

  useEffect(() => {
    function handleOpenLicense(event: Event) {
      const customEvent = event as CustomEvent<{ beatId?: string | null }>;
      const beatId = customEvent.detail?.beatId;
      if (!beatId) return;
      const beat = beats.find((item) => item.id === beatId);
      if (!beat) return;
      openLicenseSelector(beat);
    }

    window.addEventListener(OPEN_LICENSE_EVENT, handleOpenLicense as EventListener);

    return () => {
      window.removeEventListener(OPEN_LICENSE_EVENT, handleOpenLicense as EventListener);
    };
  }, [beats]);

  useEffect(() => {
    function handleSetGenre(event: Event) {
      const customEvent = event as CustomEvent<{ genre?: string | null }>;
      const nextGenre = customEvent.detail?.genre?.trim();
      if (!nextGenre) return;
      setGenre(nextGenre.toLowerCase() === "all" ? "all" : nextGenre);
      document.getElementById("beats")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    window.addEventListener(SET_CATALOG_GENRE_EVENT, handleSetGenre as EventListener);
    return () => {
      window.removeEventListener(SET_CATALOG_GENRE_EVENT, handleSetGenre as EventListener);
    };
  }, []);

  function selectedLicense() {
    return selectedBeat?.licenses.find((license: any) => license.id === selectedLicenseId) ?? null;
  }

  function updateNearestBpmHandle(nextValue: number) {
    const clampedValue = Math.max(bpmMinBound, Math.min(bpmMaxBound, Math.round(nextValue)));
    const distanceToMin = Math.abs(clampedValue - bpmMin);
    const distanceToMax = Math.abs(clampedValue - bpmMax);

    if (distanceToMin <= distanceToMax) {
      setBpmMin(Math.min(clampedValue, bpmMax));
      return;
    }

    setBpmMax(Math.max(clampedValue, bpmMin));
  }

  function handleBpmTrackClick(event: MouseEvent<HTMLDivElement>) {
    if (!bpmTrackRef.current) return;

    const rect = bpmTrackRef.current.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const ratio = rect.width > 0 ? relativeX / rect.width : 0;
    const mappedValue = bpmMinBound + ratio * (bpmMaxBound - bpmMinBound);
    updateNearestBpmHandle(mappedValue);
  }

  function addSelectedLicenseToCart() {
    const beat = selectedBeat;
    const license = selectedLicense();
    if (!beat || !license) return;

    if (license.licenseTemplate.isExclusive) {
      setOfferOpen(true);
      return;
    }

    addItem({
      itemKey: `beat-license-${license.id}`,
      productType: "BEAT_LICENSE",
      beatLicenseId: license.id,
      beatId: beat.id,
      beatSlug: beat.slug,
      beatTitle: beat.title,
      licenseName: license.customName ?? license.licenseTemplate.name,
      priceCents: license.customPriceCents ?? license.licenseTemplate.priceCents,
      coverImageUrl: beat.coverImageUrl
    });

    setSelectedBeat(null);
    toast.success("Added to cart");
  }

  async function submitExclusiveOffer() {
    if (!selectedBeat) return;

    setSubmittingOffer(true);
    const response = await fetch("/api/exclusive-offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beatId: selectedBeat.id,
        name: offerForm.name,
        email: offerForm.email,
        phone: offerForm.phone,
        offerAmountCents: offerForm.offerAmount * 100,
        message: offerForm.message,
        turnstileToken: offerForm.turnstileToken
      })
    });
    setSubmittingOffer(false);

    if (!response.ok) {
      toast.error("Unable to send offer.");
      return;
    }

    setOfferOpen(false);
    setSelectedBeat(null);
    setOfferForm({
      name: "",
      email: "",
      phone: "",
      offerAmount: 1000,
      message: "",
      turnstileToken: ""
    });
    toast.success("Offer sent successfully.");
  }

  return (
    <section id="beats" className="section-shell">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="space-y-4">
          <div className="section-kicker">The catalog</div>
          <h2 className="text-4xl font-semibold uppercase leading-[0.95] text-[#f4efe7] md:text-6xl">
            Featured beats
          </h2>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, genre, mood, tag"
          />
          <Select value={genre} onChange={(event) => setGenre(event.target.value)}>
            <option value="all">All genres</option>
            {genres.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="price-asc">Price low-high</option>
            <option value="price-desc">Price high-low</option>
            <option value="title">Title</option>
          </Select>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Label className="text-xs uppercase tracking-[0.28em] text-foreground/65">BPM Filter</Label>
            <div className="font-mono text-xs uppercase tracking-[0.24em] text-primary">
              {bpmMin} - {bpmMax}
            </div>
          </div>
          <div ref={bpmTrackRef} className="relative h-8" onClick={handleBpmTrackClick}>
            <div className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-white/10" />
            <div
              className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary"
              style={{
                left: `${((bpmMin - bpmMinBound) / (bpmMaxBound - bpmMinBound)) * 100}%`,
                right: `${100 - ((bpmMax - bpmMinBound) / (bpmMaxBound - bpmMinBound)) * 100}%`
              }}
            />
            <input
              type="range"
              min={bpmMinBound}
              max={bpmMaxBound}
              step={1}
              value={bpmMin}
              onChange={(event) => setBpmMin(Math.min(Number(event.target.value), bpmMax))}
              className="dual-range-input absolute top-1/2 z-20 h-2 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent accent-[#f7c300] pointer-events-none"
              aria-label="Minimum BPM"
            />
            <input
              type="range"
              min={bpmMinBound}
              max={bpmMaxBound}
              step={1}
              value={bpmMax}
              onChange={(event) => setBpmMax(Math.max(Number(event.target.value), bpmMin))}
              className="dual-range-input absolute top-1/2 z-20 h-2 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent accent-[#f7c300] pointer-events-none"
              aria-label="Maximum BPM"
            />
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45">
            {bpmMarks.map((mark) => (
              <span key={mark}>{mark}</span>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-white/10 bg-[#0a0a15]/90 px-4 py-5 shadow-[0_25px_80px_rgba(0,0,0,0.32)] md:px-7 md:py-7">
          <div className="grid grid-cols-[44px_minmax(0,1fr)_70px_24px] items-center border-b border-white/15 px-1 pb-3 font-mono text-[9px] uppercase tracking-[0.16em] text-foreground/55 lg:hidden">
            <span />
            <span className="pl-1">Title</span>
            <span className="text-center" />
            <span />
          </div>
          <div className="hidden grid-cols-[96px_1.8fr_0.9fr_0.8fr_180px] border-b border-white/15 px-3 pb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-foreground/55 lg:grid">
            <span />
            <span>Title</span>
            <span>Time</span>
            <span>BPM</span>
            <span />
          </div>
          <div className="grid gap-5 pt-4">
            {paginatedBeats.map((beat) => (
              <div
                key={beat.id}
                className="glass-card cursor-pointer rounded-[24px] border border-white/10 px-4 py-4 transition hover:border-primary/35 md:px-5"
                onClick={() => openBeatDetails(beat)}
              >
                <div className="lg:hidden">
                  <div className="grid grid-cols-[44px_minmax(0,1fr)_70px_24px] items-center gap-2 overflow-hidden">
                    <button
                      type="button"
                      className="group flex items-center text-left"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleBeat(beat);
                      }}
                    >
                      <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-black/50">
                        {beat.coverImageUrl ? (
                          <Image
                            src={beat.coverImageUrl}
                            alt={beat.title}
                            fill
                            className="object-cover opacity-85 transition duration-300 group-hover:scale-105"
                          />
                        ) : null}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-black/45 text-primary">
                            {activeBeatId === beat.id && isPlaying ? (
                              <Pause className="h-3 w-3" />
                            ) : (
                              <Play className="ml-0.5 h-3 w-3" />
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="min-w-0">
                      <div className="overflow-hidden text-[0.9rem] font-semibold leading-tight text-[#f4efe7]">
                        {beat.title}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openLicenseSelector(beat);
                      }}
                      className="flex min-w-0 items-center justify-center gap-1 rounded-lg bg-primary px-1.5 py-1.5 text-[10px] font-semibold text-black transition hover:brightness-110"
                      aria-label={`Choose license for ${beat.title}`}
                    >
                      <ShoppingBag className="h-3 w-3 shrink-0" />
                      <span className="truncate">{formatCurrency(cheapestPrice(beat))}</span>
                    </button>
                    <button
                      type="button"
                      onClick={async (event) => {
                        event.stopPropagation();
                        const shareUrl = `${window.location.origin}/#beats`;
                        if (navigator.share) {
                          await navigator.share({ title: beat.title, url: shareUrl });
                        } else {
                          await navigator.clipboard.writeText(shareUrl);
                          toast.success("Beat link copied");
                        }
                      }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/12 text-primary transition hover:bg-primary hover:text-black"
                      aria-label={`Share ${beat.title}`}
                    >
                      <Share2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="hidden lg:grid lg:grid-cols-[88px_1.8fr_0.9fr_0.8fr_180px] lg:items-center lg:gap-4">
                  <button
                    type="button"
                    className="group flex items-center gap-4 text-left"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleBeat(beat);
                    }}
                  >
                    <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-black/50">
                      {beat.coverImageUrl ? (
                        <Image
                          src={beat.coverImageUrl}
                          alt={beat.title}
                          fill
                          className="object-cover opacity-85 transition duration-300 group-hover:scale-105"
                        />
                      ) : null}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-black/45 text-primary">
                          {activeBeatId === beat.id && isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="ml-0.5 h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="min-w-0">
                    <div className="truncate text-2xl font-semibold text-[#f4efe7] lg:text-[1.9rem]">
                      {beat.title}
                    </div>
                  </div>

                  <div className="font-mono text-lg text-foreground/72">
                    {formatStoredDuration(beat.durationSeconds)}
                  </div>

                  <div className="font-mono text-lg text-foreground/72">{beat.bpm}</div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openLicenseSelector(beat);
                      }}
                      className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-black transition hover:brightness-110 md:text-base"
                      aria-label={`Choose license for ${beat.title}`}
                    >
                      <ShoppingBag className="h-4 w-4" />
                      {formatCurrency(cheapestPrice(beat))}
                    </button>
                    <button
                      type="button"
                      onClick={async (event) => {
                        event.stopPropagation();
                        const shareUrl = `${window.location.origin}/#beats`;
                        if (navigator.share) {
                          await navigator.share({ title: beat.title, url: shareUrl });
                        } else {
                          await navigator.clipboard.writeText(shareUrl);
                          toast.success("Beat link copied");
                        }
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/12 text-primary transition hover:bg-primary hover:text-black"
                      aria-label={`Share ${beat.title}`}
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredBeats.length > pageSize ? (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-6">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded-full border border-white/10 px-4 py-2 text-xs font-mono uppercase tracking-[0.22em] text-foreground/65 transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35"
              >
                Prev
              </button>
              {visiblePages.map((item, index) =>
                item === "ellipsis" ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="flex h-10 w-8 items-center justify-center text-sm font-semibold text-foreground/45"
                    aria-hidden="true"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition ${
                      item === currentPage
                        ? "border-primary bg-primary text-black"
                        : "border-white/10 bg-white/5 text-foreground/72 hover:border-primary/35 hover:text-primary"
                    }`}
                    aria-label={`Go to beat page ${item}`}
                    aria-current={item === currentPage ? "page" : undefined}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="rounded-full border border-white/10 px-4 py-2 text-xs font-mono uppercase tracking-[0.22em] text-foreground/65 transition hover:border-primary/35 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <ModalShell
        open={!!detailBeat}
        onClose={() => setDetailBeat(null)}
        className="max-w-2xl"
      >
        {detailBeat ? (
          <div className="space-y-6">
            <div className="section-kicker">Beat preview</div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {detailBeat.coverImageUrl ? (
                <Image
                  src={detailBeat.coverImageUrl}
                  alt={detailBeat.title}
                  width={112}
                  height={112}
                  className="h-24 w-24 rounded-2xl object-cover"
                />
              ) : null}
              <div className="space-y-2">
                <div className="text-2xl font-semibold uppercase text-[#f4efe7] md:text-3xl">
                  {detailBeat.title}
                </div>
                <div className="font-mono text-xs uppercase tracking-[0.25em] text-foreground/45">
                  {detailBeat.bpm} BPM
                  {detailBeat.genre ? ` - ${detailBeat.genre}` : ""}
                  {detailBeat.mood ? ` - ${detailBeat.mood}` : ""}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-base leading-relaxed text-foreground/70">
              {detailBeat.description?.trim() ||
                "No beat description has been added for this preview yet."}
            </div>
            <Button className="w-full" size="lg" onClick={openLicenseFromDetails}>
              Choose License
            </Button>
          </div>
        ) : null}
      </ModalShell>

      <ModalShell
        open={!!selectedBeat}
        onClose={() => {
          setSelectedBeat(null);
          setOfferOpen(false);
        }}
        className="max-w-2xl"
      >
        {selectedBeat ? (
          <div className="space-y-6">
            <div className="section-kicker">Choose license</div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {selectedBeat.coverImageUrl ? (
                <Image
                  src={selectedBeat.coverImageUrl}
                  alt={selectedBeat.title}
                  width={88}
                  height={88}
                  className="h-20 w-20 rounded-2xl object-cover"
                />
              ) : null}
              <div>
                <div className="text-2xl font-semibold uppercase text-[#f4efe7] md:text-3xl">
                  {selectedBeat.title}
                </div>
                <div className="font-mono text-xs uppercase tracking-[0.25em] text-foreground/45">
                  {selectedBeat.bpm} BPM
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {selectedBeat.licenses.map((license: any) => {
                const isSelected = selectedLicenseId === license.id;
                const price = license.customPriceCents ?? license.licenseTemplate.priceCents;
                return (
                  <button
                    key={license.id}
                    type="button"
                    onClick={() => setSelectedLicenseId(license.id)}
                    className={`glass-card flex items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                      isSelected ? "border-primary/60" : "border-white/10"
                    }`}
                  >
                    <div>
                      <div className="text-2xl font-semibold uppercase text-[#f4efe7]">
                        {license.customName ?? license.licenseTemplate.name}
                      </div>
                      <div className="text-sm text-foreground/45">
                        {license.customDescription ?? license.licenseTemplate.description}
                      </div>
                    </div>
                    <div className="text-2xl font-semibold text-primary">
                      {license.licenseTemplate.isExclusive ? "$1000+" : formatCurrency(price)}
                    </div>
                  </button>
                );
              })}
            </div>

            <Button className="w-full" size="lg" onClick={addSelectedLicenseToCart}>
              {selectedLicense()?.licenseTemplate.isExclusive ? "Make An Offer" : "Add To Cart"}
            </Button>
          </div>
        ) : null}
      </ModalShell>

      <ModalShell open={offerOpen} onClose={() => setOfferOpen(false)} className="max-w-xl">
        <div className="space-y-5">
          <div className="section-kicker">Exclusive offer</div>
          <div className="text-4xl font-semibold uppercase text-[#f4efe7]">
            {selectedBeat?.title}
          </div>
          <p className="text-lg text-foreground/62">
            Minimum exclusive offer is $1,000. If accepted, the beat is taken off the market.
          </p>
          <div>
            <Label>Name</Label>
            <Input
              value={offerForm.name}
              onChange={(event) =>
                setOfferForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={offerForm.email}
              onChange={(event) =>
                setOfferForm((current) => ({ ...current, email: event.target.value }))
              }
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={offerForm.phone}
              onChange={(event) =>
                setOfferForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </div>
          <div>
            <Label>Offer Amount (USD)</Label>
            <Input
              type="number"
              min={1000}
              step={50}
              value={offerForm.offerAmount}
              onChange={(event) =>
                setOfferForm((current) => ({
                  ...current,
                  offerAmount: Number(event.target.value)
                }))
              }
            />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea
              value={offerForm.message}
              onChange={(event) =>
                setOfferForm((current) => ({ ...current, message: event.target.value }))
              }
            />
          </div>
          <TurnstileField
            siteKey={turnstileSiteKey}
            value={offerForm.turnstileToken}
            onChange={(token) =>
              setOfferForm((current) => ({ ...current, turnstileToken: token }))
            }
          />
          <Button className="w-full" size="lg" disabled={submittingOffer} onClick={submitExclusiveOffer}>
            {submittingOffer ? "Sending..." : "Send Offer"}
          </Button>
        </div>
      </ModalShell>
    </section>
  );
}

function cheapestPrice(beat: BeatItem) {
  return beat.licenses
    .filter((license: any) => !license.licenseTemplate.isExclusive)
    .reduce((min: number, license: any) => {
      const price = license.customPriceCents ?? license.licenseTemplate.priceCents ?? min;
      return Math.min(min, price);
    }, Number.POSITIVE_INFINITY);
}

function buildVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "ellipsis", totalPages] as const;
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [1, "ellipsis", currentPage, "ellipsis", totalPages] as const;
}

function formatStoredDuration(seconds?: number | null) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) {
    return "--:--";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${mins}:${secs}`;
}

"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ListMusic,
  MoreVertical,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  ShoppingCart,
  SkipBack,
  SkipForward,
  Volume2
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { OPEN_LICENSE_EVENT } from "@/lib/catalog-events";
import { useCartStore } from "@/lib/cart";
import { usePlayerStore } from "@/lib/player";

export function StickyBeatPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<any[]>([]);
  const activeIndexRef = useRef(-1);
  const durationFallbackRef = useRef(0);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [playerHidden, setPlayerHidden] = useState(false);
  const pathname = usePathname();
  const queue = usePlayerStore((state) => state.queue);
  const activeBeatId = usePlayerStore((state) => state.activeBeatId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const progress = usePlayerStore((state) => state.progress);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const volume = usePlayerStore((state) => state.volume);
  const setActiveBeat = usePlayerStore((state) => state.setActiveBeat);
  const setPlaying = usePlayerStore((state) => state.setPlaying);
  const setProgress = usePlayerStore((state) => state.setProgress);
  const setCurrentTime = usePlayerStore((state) => state.setCurrentTime);
  const setDuration = usePlayerStore((state) => state.setDuration);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const cartCount = useCartStore((state) => state.items.length);

  const activeBeat = useMemo(
    () => queue.find((beat) => beat.id === activeBeatId) ?? null,
    [queue, activeBeatId]
  );

  const activeIndex = queue.findIndex((beat) => beat.id === activeBeat?.id);

  useEffect(() => {
    queueRef.current = queue;
    activeIndexRef.current = activeIndex;
    durationFallbackRef.current = activeBeat?.durationSeconds ?? 0;
  }, [queue, activeIndex, activeBeat]);

  useEffect(() => {
    return () => {
      if (!audioRef.current) return;
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!activeBeat && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      setDuration(0);
      return;
    }

    if (!activeBeat) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(activeBeat.previewMp3Url);
      audioRef.current.preload = "metadata";
      audioRef.current.volume = volume;
      setDuration(normalizeDuration(activeBeat.durationSeconds, 0));
      audioRef.current.addEventListener("loadedmetadata", () => {
        if (!audioRef.current) return;
        setDuration(normalizeDuration(audioRef.current.duration, durationFallbackRef.current));
      });
      audioRef.current.addEventListener("timeupdate", () => {
        if (!audioRef.current) return;
        const nextDuration = normalizeDuration(audioRef.current.duration, durationFallbackRef.current);
        setDuration(nextDuration);
        setCurrentTime(audioRef.current.currentTime);
        setProgress(
          nextDuration ? (audioRef.current.currentTime / nextDuration) * 100 : 0
        );
      });
      audioRef.current.addEventListener("ended", () => {
        setPlaying(false);
        if (queueRef.current.length > 1) {
          const next =
            queueRef.current[
              (activeIndexRef.current + 1 + queueRef.current.length) % queueRef.current.length
            ];
          setActiveBeat(next.id);
          setPlaying(true);
        }
      });
    } else if (audioRef.current.src !== activeBeat.previewMp3Url) {
      audioRef.current.pause();
      audioRef.current.src = activeBeat.previewMp3Url;
      audioRef.current.load();
      setProgress(0);
      setCurrentTime(0);
      setDuration(normalizeDuration(activeBeat.durationSeconds, 0));
    }
  }, [
    activeBeat,
    activeIndex,
    queue,
    setActiveBeat,
    setCurrentTime,
    setDuration,
    setPlaying,
    setProgress,
    volume
  ]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current || !activeBeat) return;

    if (isPlaying) {
      audioRef.current.play().catch(() => setPlaying(false));
      return;
    }

    audioRef.current.pause();
  }, [activeBeat, isPlaying, setPlaying]);

  useEffect(() => {
    if (!activeBeat) {
      setMobileExpanded(false);
      setPlayerHidden(false);
    }
  }, [activeBeat]);

  function openLicenseSelector() {
    if (!activeBeat) return;
    if (activeBeat.productType === "SOUND_KIT") {
      addSoundKitToCart();
      return;
    }

    window.dispatchEvent(
      new CustomEvent(OPEN_LICENSE_EVENT, {
        detail: { beatId: activeBeat.id }
      })
    );
  }

  function addSoundKitToCart() {
    if (!activeBeat?.soundKitId) return;

    useCartStore.getState().addItem({
      itemKey: `sound-kit-${activeBeat.soundKitId}`,
      productType: "SOUND_KIT",
      soundKitId: activeBeat.soundKitId,
      soundKitTitle: activeBeat.soundKitTitle ?? activeBeat.title,
      soundKitDescription: activeBeat.soundKitDescription ?? null,
      soundKitDownloadUrl: undefined,
      soundKitTermsUrl: activeBeat.soundKitTermsUrl ?? null,
      soundKitTermsText: activeBeat.soundKitTermsText ?? null,
      soundKitCoverImageUrl: activeBeat.coverImageUrl ?? null,
      coverImageUrl: activeBeat.coverImageUrl ?? null,
      priceCents: activeBeat.priceCents ?? 0
    });
  }

  function togglePlayback() {
    if (!activeBeat) return;
    setActiveBeat(activeBeat.id);
    setPlaying(!isPlaying);
  }

  function jump(offset: number) {
    if (!queue.length) return;
    const next = queue[(activeIndex + offset + queue.length) % queue.length];
    setActiveBeat(next.id);
    setPlaying(true);
  }

  function seek(nextProgress: number) {
    if (!audioRef.current) return;
    const nextDuration = normalizeDuration(audioRef.current.duration, duration || 1);
    audioRef.current.currentTime = (nextProgress / 100) * nextDuration;
    setCurrentTime(audioRef.current.currentTime);
    setProgress(nextProgress);
  }

  function seekBy(seconds: number) {
    if (!audioRef.current) return;
    const nextDuration = normalizeDuration(audioRef.current.duration, duration || 0);
    const nextTime = Math.max(
      0,
      Math.min(nextDuration || 0, audioRef.current.currentTime + seconds)
    );
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
    setProgress(nextDuration ? (nextTime / nextDuration) * 100 : 0);
  }

  if (!activeBeat) {
    return null;
  }

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <>
      {playerHidden ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[70] px-4">
          <div className="mx-auto flex w-full max-w-sm justify-end pointer-events-auto md:max-w-none">
            <button
              type="button"
              onClick={() => setPlayerHidden(false)}
              className="flex h-6 w-6 items-center justify-center bg-transparent text-primary shadow-none"
              aria-label="Reveal player"
            >
              <ChevronDown className="h-4 w-4 rotate-180" />
            </button>
          </div>
        </div>
      ) : null}

      {!playerHidden ? (
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] hidden px-4 md:block">
        <div className="pointer-events-auto mx-auto max-w-6xl overflow-hidden rounded-full border border-white/10 bg-black/92 shadow-[0_18px_70px_rgba(0,0,0,0.62)] backdrop-blur-2xl">
          <div className="absolute right-5 top-1/2 z-10 -translate-y-1/2">
            <button
              type="button"
              onClick={() => setPlayerHidden(true)}
              className="flex h-6 w-6 items-center justify-center bg-transparent text-primary"
              aria-label="Hide player"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <div className="h-1.5 w-full bg-white/5">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-6 px-5 py-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-[18px] bg-white/5">
                {activeBeat.coverImageUrl ? (
                  <Image
                    src={activeBeat.coverImageUrl}
                    alt={activeBeat.title}
                    fill
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[2rem] font-light tracking-[0.12em] text-[#f4efe7]">
                  {activeBeat.title}
                </div>
                {activeBeat.bpm ? (
                  <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-foreground/45">
                    {activeBeat.bpm} BPM
                  </div>
                ) : (
                  <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-foreground/45">
                    Sound kit preview
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-white">
              <PlayerIconButton label="Queue">
                <ListMusic className="h-5 w-5" />
              </PlayerIconButton>
              <PlayerIconButton label="Replay 15 seconds" onClick={() => seekBy(-15)}>
                <RotateCcw className="h-5 w-5" />
                <span className="absolute text-[10px] font-semibold">15</span>
              </PlayerIconButton>
              <PlayerIconButton label="Previous track" onClick={() => jump(-1)}>
                <SkipBack className="h-5 w-5 fill-current" />
              </PlayerIconButton>
              <button
                type="button"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black transition hover:scale-[1.02]"
                onClick={togglePlayback}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-7 w-7 fill-current" />
                ) : (
                  <Play className="ml-1 h-7 w-7 fill-current" />
                )}
              </button>
              <PlayerIconButton label="Next track" onClick={() => jump(1)}>
                <SkipForward className="h-5 w-5 fill-current" />
              </PlayerIconButton>
              <PlayerIconButton label="Skip 30 seconds" onClick={() => seekBy(30)}>
                <RotateCw className="h-5 w-5" />
                <span className="absolute text-[10px] font-semibold">30</span>
              </PlayerIconButton>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-white/80">
                <span className="text-xs">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(event) => seek(Number(event.target.value))}
                  className="w-28 accent-white"
                />
                <span className="text-xs">{formatTime(duration)}</span>
              </div>
              <div className="flex items-center gap-2 text-white/85">
                <Volume2 className="h-4 w-4" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="w-20 accent-white"
                />
              </div>
              <Button
                className="rounded-full px-5 text-xs uppercase tracking-[0.24em]"
                onClick={openLicenseSelector}
              >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {activeBeat.productType === "SOUND_KIT"
                    ? activeBeat.priceCents
                      ? `Add ${formatPrice(activeBeat.priceCents)}`
                      : "Add kit"
                    : cartCount
                      ? `${cartCount} in cart`
                      : "Add to cart"}
                </Button>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {!playerHidden ? (
      <div className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] md:hidden">
        {mobileExpanded ? (
          <div className="relative max-h-[84vh] overflow-y-auto rounded-[28px] border border-white/10 bg-black/95 p-4 shadow-[0_18px_70px_rgba(0,0,0,0.68)] backdrop-blur-2xl">
            <div className="flex items-center justify-between text-white">
              <PlayerIconButton label="Collapse player" onClick={() => setMobileExpanded(false)}>
                <ChevronDown className="h-5 w-5" />
              </PlayerIconButton>
              <div className="truncate px-3 text-xs tracking-[0.1em] text-white/80">
                {activeBeat.title}
              </div>
              <PlayerIconButton label="More">
                <MoreVertical className="h-5 w-5" />
              </PlayerIconButton>
            </div>

            <div className="mx-auto mt-3 w-full max-w-[220px]">
              <div className="relative aspect-square overflow-hidden rounded-[20px] bg-white/5">
                {activeBeat.coverImageUrl ? (
                  <Image
                    src={activeBeat.coverImageUrl}
                    alt={activeBeat.title}
                    fill
                    className="object-cover"
                  />
                ) : null}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xl font-medium text-[#f4efe7]">{activeBeat.title}</div>
              <div className="mt-1 text-sm text-white/60">Yunginz</div>
            </div>

            <div className="mt-4">
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={(event) => seek(Number(event.target.value))}
                className="w-full accent-white"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-white/55">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-white">
              <PlayerIconButton label="Replay 15 seconds" onClick={() => seekBy(-15)}>
                <RotateCcw className="h-4.5 w-4.5" />
                <span className="absolute text-[10px] font-semibold">15</span>
              </PlayerIconButton>
              <PlayerIconButton label="Previous track" onClick={() => jump(-1)}>
                <SkipBack className="h-4.5 w-4.5 fill-current" />
              </PlayerIconButton>
              <button
                type="button"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black"
                onClick={togglePlayback}
              >
                {isPlaying ? (
                  <Pause className="h-7 w-7 fill-current" />
                ) : (
                  <Play className="ml-1 h-7 w-7 fill-current" />
                )}
              </button>
              <PlayerIconButton label="Next track" onClick={() => jump(1)}>
                <SkipForward className="h-4.5 w-4.5 fill-current" />
              </PlayerIconButton>
              <PlayerIconButton label="Skip 30 seconds" onClick={() => seekBy(30)}>
                <RotateCw className="h-4.5 w-4.5" />
                <span className="absolute text-[10px] font-semibold">30</span>
              </PlayerIconButton>
            </div>

            <div className="mt-5 flex items-center justify-between gap-2.5">
              <PlayerIconButton label="Queue">
                <ListMusic className="h-4.5 w-4.5" />
              </PlayerIconButton>
              <div className="flex flex-1 items-center justify-center gap-3 text-white/75">
                <Volume2 className="h-4 w-4" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="w-full max-w-[100px] accent-white"
                />
              </div>
              <Button className="rounded-2xl px-2.5 py-1.5 text-[11px]" onClick={openLicenseSelector}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {activeBeat.productType === "SOUND_KIT" ? "Add kit" : cartCount ? `${cartCount} cart` : "Add"}
                </Button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="pointer-events-none absolute -top-5 right-2 z-10">
              <button
                type="button"
                onClick={() => {
                  setPlayerHidden(true);
                }}
                className="pointer-events-auto flex h-6 w-6 items-center justify-center bg-transparent text-primary"
                aria-label="Hide player"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setMobileExpanded(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setMobileExpanded(true);
                }
              }}
              className="w-full rounded-[20px] border border-white/10 bg-black/92 px-2.5 py-2 text-left shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
            >
            <div className="mb-2 h-1 w-full rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-primary transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative h-9 w-9 overflow-hidden rounded-lg bg-white/5">
                {activeBeat.coverImageUrl ? (
                  <Image
                    src={activeBeat.coverImageUrl}
                    alt={activeBeat.title}
                    fill
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.88rem] tracking-[0.04em] text-[#f4efe7]">
                  {activeBeat.title}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    togglePlayback();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="ml-0.5 h-4 w-4 fill-current" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openLicenseSelector();
                  }}
                  className="rounded-lg bg-white px-2 py-1.5 text-[11px] font-semibold text-black"
                  aria-label="Open license selector"
                >
                  <ShoppingCart className="inline h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          </div>
        )}
      </div>
      ) : null}
      {!playerHidden ? <div aria-hidden className="h-24 md:h-28" /> : null}
    </>
  );
}

function normalizeDuration(rawValue: number | null | undefined, fallback = 0) {
  if (Number.isFinite(rawValue) && Number(rawValue) > 0) {
    return Number(rawValue);
  }

  if (Number.isFinite(fallback) && Number(fallback) > 0) {
    return Number(fallback);
  }

  return 0;
}

function PlayerIconButton({
  children,
  label,
  onClick
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/8"
    >
      {children}
    </button>
  );
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");

  return `${mins}:${secs}`;
}

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(priceCents / 100);
}

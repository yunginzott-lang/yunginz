import { create } from "zustand";

export type PlayerTrack = {
  id: string;
  title: string;
  previewMp3Url: string;
  productType?: "BEAT" | "SOUND_KIT";
  bpm?: number | null;
  durationSeconds?: number | null;
  coverImageUrl?: string | null;
  soundKitId?: string;
  soundKitTitle?: string;
  soundKitDescription?: string | null;
  soundKitTermsUrl?: string | null;
  soundKitTermsText?: string | null;
  priceCents?: number;
};

type PlayerState = {
  queue: PlayerTrack[];
  activeBeatId: string | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  volume: number;
  setQueue: (beats: PlayerTrack[]) => void;
  setActiveBeat: (beatId: string | null) => void;
  setPlaying: (value: boolean) => void;
  setProgress: (value: number) => void;
  setCurrentTime: (value: number) => void;
  setDuration: (value: number) => void;
  setVolume: (value: number) => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  queue: [],
  activeBeatId: null,
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  duration: 0,
  volume: 0.85,
  setQueue: (beats) => set({ queue: beats }),
  setActiveBeat: (beatId) => set({ activeBeatId: beatId, progress: 0, currentTime: 0 }),
  setPlaying: (value) => set({ isPlaying: value }),
  setProgress: (value) => set({ progress: value }),
  setCurrentTime: (value) => set({ currentTime: value }),
  setDuration: (value) => set({ duration: value }),
  setVolume: (value) => set({ volume: value })
}));

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CartItemInput } from "@/lib/types";

function normalizeCartItem(item: Partial<CartItemInput>): CartItemInput {
  const itemKey =
    item.itemKey ||
    item.beatLicenseId ||
    item.soundKitId ||
    `${item.productType ?? "BEAT_LICENSE"}-${item.beatSlug ?? item.soundKitTitle ?? item.beatTitle ?? crypto.randomUUID()}`;

  return {
    itemKey,
    productType: item.productType ?? "BEAT_LICENSE",
    beatLicenseId: item.beatLicenseId,
    beatId: item.beatId,
    beatSlug: item.beatSlug,
    beatTitle: item.beatTitle,
    licenseName: item.licenseName,
    priceCents: item.priceCents ?? 0,
    coverImageUrl: item.coverImageUrl ?? null,
    soundKitId: item.soundKitId,
    soundKitTitle: item.soundKitTitle,
    soundKitDescription: item.soundKitDescription ?? null,
    soundKitDownloadUrl: item.soundKitDownloadUrl,
    soundKitTermsUrl: item.soundKitTermsUrl ?? null,
    soundKitTermsText: item.soundKitTermsText ?? null,
    soundKitCoverImageUrl: item.soundKitCoverImageUrl ?? null
  };
}

type CartState = {
  items: CartItemInput[];
  hydrated: boolean;
  addItem: (item: CartItemInput) => void;
  removeItem: (itemKey: string) => void;
  clear: () => void;
  setHydrated: (value: boolean) => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,
      addItem: (item) => {
        const normalized = normalizeCartItem(item);
        const filtered = get().items.filter((existing) => {
          if (existing.itemKey === normalized.itemKey) {
            return false;
          }

          if (normalized.productType === "BEAT_LICENSE" && existing.productType === "BEAT_LICENSE") {
            return existing.beatId !== normalized.beatId;
          }

          return true;
        });
        set({ items: [...filtered, normalized] });
      },
      removeItem: (itemKey) =>
        set({
          items: get().items.filter(
            (item) => item.itemKey !== itemKey && item.beatLicenseId !== itemKey && item.soundKitId !== itemKey
          )
        }),
      clear: () => set({ items: [] }),
      setHydrated: (value) => set({ hydrated: value })
    }),
    {
      name: "yunginz-cart",
      storage:
        typeof window === "undefined"
          ? undefined
          : createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.items?.length) {
          state.items = state.items.map((item) => normalizeCartItem(item));
        }
        state?.setHydrated(true);
      }
    }
  )
);

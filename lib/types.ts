export type SectionContent =
  | Record<string, unknown>
  | Array<Record<string, unknown>>
  | string
  | null;

export type CatalogFilters = {
  query?: string;
  genre?: string;
  mood?: string;
  key?: string;
  featured?: boolean;
  sort?: "newest" | "oldest" | "price-asc" | "price-desc" | "title";
};

export type CartItemInput = {
  itemKey: string;
  productType: "BEAT_LICENSE" | "SOUND_KIT";
  beatLicenseId?: string;
  beatId?: string;
  beatSlug?: string;
  beatTitle?: string;
  licenseName?: string;
  priceCents: number;
  coverImageUrl?: string | null;
  soundKitId?: string;
  soundKitTitle?: string;
  soundKitDescription?: string | null;
  soundKitDownloadUrl?: string;
  soundKitTermsUrl?: string | null;
  soundKitTermsText?: string | null;
  soundKitCoverImageUrl?: string | null;
};

export type LicenseRightsSnapshot = {
  performancesForProfit?: string | boolean;
  numberOfRadioStations?: number | string;
  distributeCopies?: number | string;
  audioStreams?: number | string;
  monetizedVideoStreamsAllowed?: number | string;
  monetizedMusicVideos?: number | string;
  numberOfVideoStreams?: number | string;
  freeDownloads?: number | string;
  sellerRegion?: string;
};

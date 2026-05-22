import { isDropboxFolderUrl, normalizeDropboxPreviewUrl } from "@/lib/dropbox";

export const GENRE_OPTIONS = [
  "Trap",
  "Afrobeats",
  "R&B",
  "Dancehall",
  "Amapiano",
  "Neo Soul",
  "Hip-Hop",
  "Pop",
  "Soul"
] as const;

const GENRE_ALIASES: Record<string, string> = {
  trap: "Trap",
  afro: "Afrobeats",
  afrobeats: "Afrobeats",
  "r&b": "R&B",
  rnb: "R&B",
  dancehall: "Dancehall",
  amapiano: "Amapiano",
  "neo soul": "Neo Soul",
  "neo-soul": "Neo Soul",
  neosoul: "Neo Soul",
  "hip-hop": "Hip-Hop",
  hiphop: "Hip-Hop",
  pop: "Pop",
  soul: "Soul"
};

function titleCase(value: string) {
  return value
    .split(/[\s/-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function parseBeatMetadataFromPreviewUrl(value: string) {
  const normalizedUrl = normalizeDropboxPreviewUrl(value);

  let lastSegment = "";
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    lastSegment = decodeURIComponent(parts[parts.length - 1] ?? "");
  } catch {
    lastSegment = "";
  }

  if (!lastSegment) {
    return {
      normalizedUrl,
      title: "",
      bpm: "",
      genres: [] as string[],
      mood: "",
      looksLikeFolderLink: isDropboxFolderUrl(value)
    };
  }

  let filename = lastSegment.replace(/\.(mp3|wav|aiff|flac)$/i, "");
  filename = filename.replace(/\s*-\s*@[^-]+(?:\s+@.+)?$/i, "").trim();
  filename = filename.replace(/[-_]?yunginz(?:\.prod)?$/i, "").trim();
  filename = filename.replace(/[-_]?prodbyampz$/i, "").trim();

  const bpmMatch = filename.match(/(\d{2,3})\s*bpm/i);
  const bpm = bpmMatch?.[1] ?? "";
  if (bpmMatch) {
    filename = filename.replace(bpmMatch[0], "").trim();
  }

  const bracketMatch = filename.match(/^\(([^)]+)\)\s*/);
  let descriptors = bracketMatch
    ? bracketMatch[1]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  if (bracketMatch) {
    filename = filename.slice(bracketMatch[0].length).trim();
  }

  if (!descriptors.length) {
    const parts = filename
      .split("-")
      .map((item) => item.trim())
      .filter(Boolean);

    if (parts.length > 1) {
      const maybeTitle = parts[parts.length - 1];
      const leadDescriptors = parts.slice(0, -1);
      const recognizedGenresOrMoods = leadDescriptors.filter(
        (item) => GENRE_ALIASES[item.toLowerCase()] || item.length > 0
      );

      if (recognizedGenresOrMoods.length) {
        descriptors = recognizedGenresOrMoods;
        filename = maybeTitle;
      }
    }
  }

  const genres = descriptors
    .map((item) => GENRE_ALIASES[item.toLowerCase()])
    .filter(Boolean);

  const moods = descriptors
    .filter((item) => !GENRE_ALIASES[item.toLowerCase()])
    .map((item) => titleCase(item));

  return {
    normalizedUrl,
    title: filename.trim(),
    bpm,
    genres: Array.from(new Set(genres)),
    mood: moods.join(", "),
    looksLikeFolderLink: isDropboxFolderUrl(value)
  };
}

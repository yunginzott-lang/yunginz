/**
 * Clean Re-Import Script
 * 
 * This script:
 * 1. Wipes all existing beats from the database (they were corrupted by the Choise DB mix)
 * 2. Re-imports all beats from the Dropbox recovery data with clean titles
 * 3. Sets up delivery links (MP3 + Producers Tag) for each license tier
 * 
 * Usage:
 *   npx tsx scripts/clean-reimport-beats.ts          # dry-run (preview)
 *   npx tsx scripts/clean-reimport-beats.ts --apply  # actually write to DB
 */

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

// ─── Types ───────────────────────────────────────────────────────────────────

type FileRow = { text: string; href: string };
type ContainerRecord = { sourceUrl?: string; title?: string; fileRows: FileRow[]; body?: string };
type LinkRecord = {
  folderUrl: string;
  mp3FolderUrl: string | null;
  wavFolderUrl: string | null;
  stemsFolderUrl: string | null;
  files: Record<string, string>;
  pageTitle?: string;
};

type BeatCandidate = {
  title: string;
  slug: string;
  previewUrl: string;
  downloadMp3Url: string;
  bpm: number;
  musicalKey: string;
  genre: string;
  mood: string;
  description: string;
  tags: string[];
  sourceContainer: string;
  sourceFileName: string;
  wavLink: string | null;
  stemsLink: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const ROOT = path.join(process.cwd(), "recovery");
const FILE_LINKS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "dropbox-file-links.json"), "utf8")
) as Record<string, ContainerRecord>;
const NESTED_FILE_LINKS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "dropbox-nested-file-links.json"), "utf8")
) as Record<string, ContainerRecord>;
const CONTAINER_LINKS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "dropbox-links.json"), "utf8")
) as Record<string, LinkRecord>;

const PRODUCER_TAG_URL =
  "https://www.dropbox.com/scl/fo/5zhuwdzkqf8w5b9r71swh/AN79axEiD1RQVColHJ_0htc/tag?rlkey=fveetntu8ts50k9qvnucnlo1k&e=1&st=foa8gtbn&subfolder_nav_tracking=1&dl=0";

const DB_URL = process.env.DATABASE_URL || "";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[']/g, "") // Remove apostrophes before slugifying (I'm → im)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function titleCase(input: string) {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^[a-z]$/i.test(word)) return word.toUpperCase();
      if (/^[A-Z0-9$'.#&-]+$/.test(word) && word.length <= 4) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function decodeFileName(href: string) {
  return decodeURIComponent(href.split("?")[0].split("/").pop() || "");
}

function toRawUrl(href: string) {
  const url = new URL(href);
  url.searchParams.delete("dl");
  url.searchParams.set("raw", "1");
  return url.toString();
}

function toDownloadUrl(href: string) {
  const url = new URL(href);
  url.searchParams.delete("raw");
  url.searchParams.set("dl", "1");
  return url.toString();
}

function normalizeKey(value: string) {
  const cleaned = value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "N/A";
  const sharpFlat = cleaned
    .replace(/#(?=[A-Ga-g])/g, "#")
    .replace(/([A-G])b/i, (_, note) => `${note}b`);
  if (/^[A-G][#b]?\s?(m|min|minor)$/i.test(sharpFlat)) {
    return sharpFlat.replace(/min|minor/i, "Min").replace(/\bm\b/i, "Min").replace(/\s+/g, " ");
  }
  if (/^[A-G][#b]?\s?(maj|major)$/i.test(sharpFlat)) {
    return sharpFlat.replace(/maj|major/i, "Maj").replace(/\s+/g, " ");
  }
  return titleCase(sharpFlat);
}

function parseTagsFromName(name: string) {
  const collected: string[] = [];
  const parenMatch = name.match(/^\(([^)]+)\)/);
  if (parenMatch) collected.push(...parenMatch[1].split(","));
  const bracketMatch = name.match(/beats\[([^\]]+)\]/i);
  if (bracketMatch) collected.push(...bracketMatch[1].split(","));
  return collected.map((part) => part.trim().toLowerCase()).filter(Boolean);
}

function parseBpm(name: string) {
  const match = name.match(/(\d{2,3})\s?-?\s?bpm/i);
  if (match) return Number(match[1]);
  // Try bracket format: [ 110 bpm ]
  const bracketMatch = name.match(/\[\s*(\d{2,3})\s*(?:bpm)?\s*\]/i);
  if (bracketMatch) return Number(bracketMatch[1]);
  return 0;
}

function parseKey(name: string) {
  const bracketMatch = name.match(/\[.*?([A-G][#b♭]?\s?(?:minor|major|m(?:in|aj)?)).*?\]/i);
  if (bracketMatch) return normalizeKey(bracketMatch[1].replace("♭", "b"));
  const parenMatch = name.match(/\(([A-G][#b♭]?\s?(?:minor|major|m(?:in|aj)?))\)/i);
  if (parenMatch) return normalizeKey(parenMatch[1].replace("♭", "b"));
  const inlineMatch = name.match(/\b([A-G][#b]?\s?(?:min|maj|minor|major))\b/i);
  if (inlineMatch) return normalizeKey(inlineMatch[1]);
  return "N/A";
}

function chooseGenre(tags: string[], containers: string[]) {
  const haystack = [...tags, ...containers.map((v) => v.toLowerCase())];
  if (haystack.some((v) => /trapsoul/.test(v))) return "Trapsoul";
  if (haystack.some((v) => /\brnb\b|soul/.test(v))) return "R&B";
  if (haystack.some((v) => /dancehall/.test(v))) return "Dancehall";
  if (haystack.some((v) => /detroit/.test(v))) return "Detroit";
  if (haystack.some((v) => /soca|bouyon|carnival/.test(v))) return "Soca";
  if (haystack.some((v) => /afro|afrob|afrobeats|afropiano|amapiano/.test(v))) return "Afrobeats";
  if (haystack.some((v) => /melodic/.test(v))) return "Melodic Trap";
  if (haystack.some((v) => /trap|club|hard|dark/.test(v))) return "Trap";
  return "Hip-Hop";
}

function chooseMood(tags: string[]) {
  if (tags.some((v) => /dark/.test(v))) return "Dark";
  if (tags.some((v) => /hard|club|turnt|power/.test(v))) return "Aggressive";
  if (tags.some((v) => /ambient|wavy|melodic/.test(v))) return "Atmospheric";
  if (tags.some((v) => /upbeat|soca|bouyon/.test(v))) return "Upbeat";
  if (tags.some((v) => /soul|rnb|throwback/.test(v))) return "Soulful";
  return "Energetic";
}

function cleanTitle(name: string) {
  const withoutExt = name.replace(/\.(mp3|m4a|wav)$/i, "");
  // Remove leading genre tags in parens: (dark, dancehall)
  const withoutTags = withoutExt
    .replace(/^\([^)]*\)\s*/, "")
    .replace(/^\.?mp3\s+beats\[[^\]]+\]\s*/i, "");
  // Remove dates
  const withoutDate = withoutTags.replace(/\s*\[\d{4}-\d{2}-\d{2}\]\s*/g, " ");
  // Remove "- Copy" and "(1)" suffixes
  const withoutCopy = withoutDate.replace(/\s*-\s*Copy$/i, "").replace(/\s*\(\d+\)$/i, "");
  // Remove @handles
  const withoutHandles = withoutCopy.replace(/@[\w.$-]+/gi, " ");
  // Remove BPM patterns: "108bpm", "108 bpm", "[ 110 bpm ]", etc
  const withoutBpm = withoutHandles
    .replace(/\b\d{2,3}\s?-?\s?bpm\b/gi, " ")
    .replace(/\[\s*\d{2,3}\s*bpm\s*\]/gi, " ");
  // Remove bracket content that's just BPM/key info: [ 110 bpm ], [ 93 bpm - Gm ], (C# Minor)
  const withoutBracketMeta = withoutBpm
    .replace(/\[\s*\d{2,3}\s*(?:bpm)?\s*(?:-?\s*[A-G][#b♭]?\s?(?:m(?:in|aj)?|minor|major)?)?\s*\]/gi, " ")
    .replace(/\[\s*[A-G][#b♭]?\s?(?:m(?:in|aj)?|minor|major)\s*\]/gi, " ")
    .replace(/\(\s*[A-G][#b♭]?\s?(?:minor|major|m(?:in|aj)?)\s*\)/gi, " ");
  // Remove standalone key signatures
  const withoutKey = withoutBracketMeta
    .replace(/\b[A-G][#b]\s?(?:min|maj|minor|major)\b/gi, " ")
    .replace(/\b[A-G][#b]m\b/gi, " ");
  // Remove version markers
  const withoutVersion = withoutKey
    .replace(/\b(clean|mix|ruff|rough|v\d+|v1|v2|tagged)\b/gi, " ")
    .replace(/^#\d+\s*/i, "");
  // Remove producer names (comprehensive list)
  const simplified = withoutVersion
    .replace(/\b(yunginz|yunginzz?|yung1nz|choi\$?e|choi_e|prodbyampz|prodbychoise|ampz|4ormant|kaddyx4|kaddy4x|caddy4x|loyalcold|sirkelmp3|vgs\.midnight|mikeyindacut|sabromadeit|gelospinz|1litjo|prodxinsomniac|asherlewis|andreiyz1|dollaz|prodmarv|g1mmetheloot|mallymall|yxngspacey|oktaylor_|sosxbeatz|swerverose|905bloke|jelaniwatson|jc\._15|prodbyreon|mandem|eyesenterspace|chuckyy)\b/gi, " ")
    .replace(/\bprod\.?\b/gi, " ")
    .replace(/\bx\b/gi, " ")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If there's a " - " separator, take the meaningful part (usually the title)
  const parts = simplified.split(/\s+-\s+/).filter(Boolean);
  let result = parts.length > 1 ? parts[parts.length - 1].trim() : simplified;
  
  // Remove leading track numbers like "227", "99", "2134", "193", "15", "17"
  result = result.replace(/^\d{1,4}\s+/, "").trim();
  // Remove trailing standalone numbers (stray BPMs)
  result = result.replace(/\s+\d{2,3}$/, "").trim();
  // Remove empty brackets/parens
  result = result.replace(/\[\s*\]/g, "").replace(/\(\s*\)/g, "").trim();
  // Remove leading/trailing dashes, dots, commas
  result = result.replace(/^[-.,\s]+/, "").replace(/[-.,\s]+$/, "").trim();
  // Remove trailing "Bm", "Dm", "Gm" etc that are key remnants
  result = result.replace(/\s+[A-G][#b]?m$/i, "").trim();
  // Remove "( )" empty parens with spaces
  result = result.replace(/\(\s*\+?\s*\)/g, "").trim();
  // Remove stray commas from cleaned producer lists
  result = result.replace(/^[,\s]+/, "").replace(/[,\s]+$/, "").trim();
  result = result.replace(/\s*,\s*,\s*/g, " ").replace(/\s*,\s*$/g, "").replace(/^\s*,\s*/g, "").trim();

  // Remove stray BPM numbers like "154" or "123bpm" that survived
  result = result.replace(/\s+\d{2,3}bpm\b/gi, "").trim();
  result = result.replace(/\s+\d{3}$/g, "").trim();
  // Remove key remnants like "Emin", "Cmin To Amin", "D#m"
  result = result.replace(/\s+[A-G][#b♭]?\s?(?:min|maj|minor|major)\s*(?:to\s+[A-G][#b♭]?\s?(?:min|maj|minor|major))?$/gi, "").trim();
  result = result.replace(/\s+[A-G][#b♭]?m(?:in|aj)?$/gi, "").trim();
  // Remove "( . )" or "( + )" artifacts
  result = result.replace(/\(\s*[.+]\s*\)/g, "").trim();
  // Remove bracket content that's just key info: [ Gm ], [ Ab maj ]
  result = result.replace(/\[\s*[A-G][#b♭]?\s?(?:m(?:in|aj)?|minor|major)?\s*\]/gi, "").trim();

  if (!result || result.length < 2) {
    // Fallback: use the filename without extension
    return titleCase(withoutExt.replace(/[_-]/g, " ").replace(/\s+/g, " ").trim());
  }

  return titleCase(result);
}

// ─── Manual Title Overrides ──────────────────────────────────────────────────
// Some filenames are too mangled for regex cleanup. Override them here.
const TITLE_OVERRIDES: Record<string, string> = {
  "10toesdown 121  [tagged] @yunginz.prod @prodmarv.mp3": "10 Toes Down",
  "10 toes 129 @yunginz.prod x @1litjo.m4a": "10 Toes",
  "3 Peat 144bpm - Mandem.mp3": "3 Peat",
  "99 IM STILL RIGHT HERE 182 @prodxinsomniac @yunginz x @prodbyreon.mp3": "I'm Still Right Here",
  "2134 @prodxinsomniac @yunginzprod - IN THIS CUP 147.mp3": "In This Cup",
  "204 Am 110bpm G#m - @yunginz.prod.mp3": "204 AM",
  "Cautions 154 Gm @Yunginz.prod @Andreiyz1.mp3": "Cautions",
  "RISKY 154 Emin @prodxinsomniac @yunginzprod.mp3": "Risky",
  "Left Behind_123BPM_(@oktaylor_ + @yunginz.prod).mp3": "Left Behind",
  "1 Lord Knows - SabroMadeIt x Yunginz x MikeyInDaCut x GeloSpinz - Cmin to Amin 80bpm.m4a": "Lord Knows",
  "Yunginz x Ampz x Kaddy - Slidin' 18-bpm V1 ruff.mp3": "Slidin'",
  "Yunginz x Ampz x Kaddy - Trouble.mp3": "Trouble",
  "(wavy, trap) NIGHTS IN THE CITY 161bpm @yung1nz @prodbyampz - Copy.mp3": "Nights In The City",
  "DECISIONS, DECISIONS 143BPM (D# Minor) (@PRODBYAMPZ x YUNGINZ.PROD).mp3": "Decisions Decisions",
  "HALF WAY HOME 110BPM (C# Minor) (@PRODBYAMPZ x @YUNGINZ.PROD).mp3": "Half Way Home",
  "IRIDESCENT 166BPM (C# Minor) (@PRODBYAMPZ x @YUNGINZ.PROD) v2.mp3": "Iridescent",
  ".mp3 beats[wavy, melodic] floating emin 150 @g1mmetheloot @yunginz.prod @mallymall.mp3": "Floating",
  "whistle @gelospinz @yunginz.prod @mikeyindacut @sabromadeit 150bpm Emin [2025-03-19].mp3": "Whistle",
  "227 @prodxinsomniac @yunginzprod - CULTURES 147bpm.mp3": "Cultures",
  "193 @prodxinsomniac @yunginzprod - SOULS 140 bpm.mp3": "Souls",
  "17 @prodxinsomniac @yunginzprod - AINT NO MORE 118 bpm.mp3": "Ain't No More",
  "15 @prodxinsomniac @yunginzprod - DECEPTION 155 bpm.mp3": "Deception",
  "15 @prodxinsomniac @yunginzprod - DECEPTION 155 bpm (1).mp3": "Deception",
  "DROP TOP [ 93 bpm - Gm ] @prodbychoise x @yunginz.prod x @jc._15.mp3": "Drop Top",
  "Copy Me - 147bpm D#m - @Yunginz.prod.mp3": "Copy Me",
  "fault 122.mp3": "Fault",
  "aqua yunginzz.mp3": "Aqua",
  "progress.mp3": "Progress",
  "Butterflies.mp3": "Butterflies",
  "(dancehall, dark) Bell - @yunginz.prod @4ormant.mp3": "Bell",
  ".mp3 beats[hard, dark] cyclops c#min 161 @g1mmetheloot @yunginz.prod.mp3": "Cyclops",
  "(HARD, SAMP) ice 119 bpm - @yung1nz.mp3": "Ice",
  "Yunginz x Choi$e - Due Time 94bpm.mp3": "Due Time",
  "Yunginz x Choi$e - Tropix Riddim.mp3": "Tropix Riddim",
  "Yunginz x Choi$e - Thru Tha Flames 138bpm.mp3": "Thru Tha Flames",
  "Yunginz x choi$e - Bambino 88bpm MIX.mp3": "Bambino",
  "Yunginz x Choi$e - Save Tha Day 88bpm.mp3": "Save Tha Day",
  "YUNGINZ x Choi$e - BLESSINGS [ 114 BPM ].mp3": "Blessings",
  "Yunginz x Choi$e - Heat wave 119bpm.mp3": "Heat Wave",
  "Difference 197bpm ( Yunginz x Choi$e x Jelani).mp3": "Difference",
  "Yunginz -  d spot 199bpm.mp3": "D Spot",
  "yunginz - boolin 182bpm.mp3": "Boolin",
  "Yunginz - FLINTKNOCK 193bpm.mp3": "Flintknock",
  "yunginz - rocket 197bpm.mp3": "Rocket",
  "yunginz - to tha d 189bpm.mp3": "To Tha D",
  "Yunginz  - No Mistake 155bpm.mp3": "No Mistake",
  "Yunginz - Bouyon 157bpm .mp3": "Bouyon",
  "yunginz - feeling 157bpm.mp3": "Feeling",
  "Yunginz - Something Serious 164bpm.mp3": "Something Serious",
  "Yunginz - Wicked 157bpm.mp3": "Wicked",
  "Yunginz - Sauced 133bpm Dm (1).mp3": "Sauced",
  "Yunginz - Sauced 133bpm Dm.mp3": "Sauced",
  "#1 Yunginz - Traumatized 160bpm.mp3": "Traumatized",
  "#11 - Run It 134bpm Prod. Yunginz.mp3": "Run It",
  "Mob 99bpm - @yunginz.prod 4ormant.mp3": "Mob",
  "T.O 2 L.A 189bpm @Yunginz.prod x @prodbyAMPZ.mp3": "T.O 2 L.A",
  "BONES [ 172 BPM ] CHOI$E X YUNGINZ -.mp3": "Bones",
  "CHOI_E X YUNGINZ - BONES [ 172 BPM ].mp3": "Bones",
  "Choi_e x Yunginz - Grateful [ 97 bpm ].mp3": "Grateful",
  "Choi_e x Yunginz - Green Light [ 99 bpm ].mp3": "Green Light",
  "CHOI_E X YUNGINZ - TRACKHAWK - [ 192 BPM ].mp3": "Trackhawk",
  "CHOI_E X YUNGINZ - VULTURE [ 92 BPM ].mp3": "Vulture",
  "CHOI$E X YUNGINZ - HOW YUH MEAN [ 95 BPM ] Ab maj.mp3": "How Yuh Mean",
  "Bad Shxt 189bpm - @yunginz.prod x @prodbychoise.mp3": "Bad Shxt",
  "No Games 189bpm - @Yunginz.prod.mp3": "No Games",
  "(dancehall, club) WARNING - @yung1nz @choi$e.mp3": "Warning",
  "(afrob, wavy) Habitz 98bpm - @Yunginz.prod x Choi$e.mp3": "Habitz",
  "God Father 135bpm - @yunginz.prod.mp3": "God Father",
  "Kylo 106bpm - @yunginz.prod @Gelospinz.mp3": "Kylo",
  "Menace 155bpm- @yunginz.prod @4ormant.mp3": "Menace",
  "(dark, hard) masked 195bpm - @yung1nz.mp3": "Masked",
  "shake em 157bpm - @yung1nz.mp3": "Shake Em",
  "(dark, ot7) Been Dat 156bpm - @yung1nz.mp3": "Been Dat",
  "(hard, chuckyy) Digital 159bpm - @yung1nz.mp3": "Digital",
};

// ─── Collect Candidates ──────────────────────────────────────────────────────

function collectCandidates(): BeatCandidate[] {
  const candidates: BeatCandidate[] = [];
  const all = { ...FILE_LINKS, ...NESTED_FILE_LINKS };

  for (const [containerName, container] of Object.entries(all)) {
    const rootContainer = containerName.split("/")[0];
    const linkRecord = CONTAINER_LINKS[rootContainer];

    for (const row of container.fileRows || []) {
      const fileName = decodeFileName(row.href || "");
      if (!/\.(mp3|m4a|wav)$/i.test(fileName)) continue;

      const tags = Array.from(
        new Set([
          ...parseTagsFromName(fileName),
          ...containerName
            .split("/")
            .flatMap((piece) => piece.toLowerCase().split(/[^a-z0-9$+#]+/))
            .filter(Boolean)
            .filter((v) => !["files", "mp3", "wav", "stems", "collabs"].includes(v))
        ])
      );

      const bpm = parseBpm(fileName);
      const musicalKey = parseKey(fileName);
      const title = TITLE_OVERRIDES[fileName] || cleanTitle(fileName);
      const genre = chooseGenre(tags, [containerName]);
      const mood = chooseMood(tags);
      const slug = slugify(title);

      // Skip if title is empty or too short
      if (!title || title.length < 2 || slug.length < 2) continue;

      candidates.push({
        title,
        slug,
        previewUrl: toRawUrl(row.href),
        downloadMp3Url: toDownloadUrl(row.href),
        bpm,
        musicalKey,
        genre,
        mood,
        description: `${title} is a ${mood.toLowerCase()} ${genre.toLowerCase()} beat${bpm ? ` at ${bpm} BPM` : ""}.`,
        tags,
        sourceContainer: containerName,
        sourceFileName: fileName,
        wavLink: linkRecord?.wavFolderUrl || null,
        stemsLink: linkRecord?.stemsFolderUrl || null,
      });
    }
  }

  // Deduplicate by slug - prefer entries with more metadata
  const deduped = new Map<string, BeatCandidate>();
  for (const candidate of candidates) {
    const key = candidate.slug;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, candidate);
      continue;
    }
    // Prefer the one with BPM
    if (!existing.bpm && candidate.bpm) {
      deduped.set(key, candidate);
      continue;
    }
    // Prefer the one with WAV/stems links
    if ((candidate.stemsLink && !existing.stemsLink) || (candidate.wavLink && !existing.wavLink)) {
      deduped.set(key, {
        ...existing,
        wavLink: candidate.wavLink || existing.wavLink,
        stemsLink: candidate.stemsLink || existing.stemsLink,
      });
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.title.localeCompare(b.title));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const apply = process.argv.includes("--apply");
  const candidates = collectCandidates();

  // Also include beats from the recovered snapshot that aren't in the Dropbox recovery
  const snapshotPath = path.join(process.cwd(), "recovered-beats-from-snapshot.json");
  let snapshotBeats: BeatCandidate[] = [];
  if (fs.existsSync(snapshotPath)) {
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as Array<{
      title: string;
      slug: string;
      previewMp3Url: string;
      bpm: number;
      durationSeconds: number | null;
      genre: string;
      mood: string;
      description?: string;
      tags?: Array<{ value: string }>;
    }>;
    
    const existingSlugs = new Set(candidates.map((c) => c.slug));
    
    for (const beat of snapshot) {
      if (!existingSlugs.has(beat.slug)) {
        // Convert the raw Dropbox URL to a download URL
        const downloadUrl = beat.previewMp3Url.replace(/[?&]raw=1/, "").replace(/([?&])dl=0/, "$1dl=1");
        
        snapshotBeats.push({
          title: beat.title,
          slug: beat.slug,
          previewUrl: beat.previewMp3Url,
          downloadMp3Url: downloadUrl.includes("dl=1") ? downloadUrl : downloadUrl + (downloadUrl.includes("?") ? "&dl=1" : "?dl=1"),
          bpm: beat.bpm || 0,
          musicalKey: "N/A",
          genre: beat.genre || "Hip-Hop",
          mood: beat.mood || "Energetic",
          description: beat.description || `${beat.title} is a ${(beat.mood || "energetic").toLowerCase()} ${(beat.genre || "hip-hop").toLowerCase()} beat${beat.bpm ? ` at ${beat.bpm} BPM` : ""}.`,
          tags: (beat.tags || []).map((t) => t.value),
          sourceContainer: "snapshot-recovery",
          sourceFileName: "",
          wavLink: null,
          stemsLink: null,
        });
      }
    }
  }

  const allCandidates = [...candidates, ...snapshotBeats].sort((a, b) => a.title.localeCompare(b.title));

  console.log(`\n📦 Found ${candidates.length} beats from Dropbox recovery + ${snapshotBeats.length} from snapshot = ${allCandidates.length} total.\n`);

  // Show preview
  const preview = allCandidates.map((c) => ({
    title: c.title,
    slug: c.slug,
    bpm: c.bpm,
    key: c.musicalKey,
    genre: c.genre,
    mood: c.mood,
    hasWav: Boolean(c.wavLink),
    hasStems: Boolean(c.stemsLink),
  }));
  console.table(preview);

  if (!apply) {
    console.log("\n⚠️  DRY RUN - no changes made. Use --apply to write to database.\n");
    return;
  }

  if (!DB_URL) {
    console.error("❌ DATABASE_URL not set. Export it or add to .env.local");
    process.exit(1);
  }

  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // Step 1: Wipe all existing beats (cascade will handle licenses, tags, delivery links)
    console.log("\n🗑️  Wiping all existing beats...");
    const deleteResult = await client.query('DELETE FROM "Beat"');
    console.log(`   Deleted ${deleteResult.rowCount} beats.`);

    // Step 2: Get license templates
    const templatesResult = await client.query<{ id: string; code: string }>(
      'SELECT id, code FROM "LicenseTemplate" WHERE active = true ORDER BY "sortOrder" ASC'
    );
    const templates = templatesResult.rows;
    console.log(`   Found ${templates.length} active license templates: ${templates.map((t) => t.code).join(", ")}`);

    // Step 3: Import each beat
    console.log(`\n📥 Importing ${allCandidates.length} beats...\n`);
    let imported = 0;

    for (const candidate of allCandidates) {
      await client.query("BEGIN");
      try {
        // Insert beat
        const beatResult = await client.query(
          `INSERT INTO "Beat" (
            id, title, slug, "producerName", "previewMp3Url", bpm,
            "musicalKey", genre, mood, description, status, "isFeatured", "updatedAt"
          ) VALUES (
            gen_random_uuid()::text, $1, $2, 'Yunginz', $3, $4, $5, $6, $7, $8, 'PUBLISHED', false, now()
          ) RETURNING id`,
          [
            candidate.title,
            candidate.slug,
            candidate.previewUrl,
            candidate.bpm || 0,
            candidate.musicalKey,
            candidate.genre,
            candidate.mood,
            candidate.description,
          ]
        );
        const beatId = beatResult.rows[0].id as string;

        // Insert tags
        for (const tag of candidate.tags) {
          await client.query(
            'INSERT INTO "BeatTag" (id, "beatId", value) VALUES (gen_random_uuid()::text, $1, $2)',
            [beatId, tag]
          );
        }

        // Insert licenses with delivery links
        for (const template of templates) {
          const manualFulfillment = template.code === "unlimited" || template.code === "exclusive";

          const licenseResult = await client.query(
            `INSERT INTO "BeatLicense" (
              id, "beatId", "licenseTemplateId", active, "manualFulfillmentRequired", "updatedAt"
            ) VALUES (
              gen_random_uuid()::text, $1, $2, true, $3, now()
            ) RETURNING id`,
            [beatId, template.id, manualFulfillment]
          );
          const beatLicenseId = licenseResult.rows[0].id as string;

          // Build delivery links based on license tier
          const links: { label: string; url: string }[] = [
            { label: "MP3", url: candidate.downloadMp3Url },
          ];

          // Standard and above get WAV if available
          if (template.code !== "basic" && candidate.wavLink) {
            links.push({ label: "WAV", url: candidate.wavLink });
          }

          // Unlimited and exclusive get stems if available
          if ((template.code === "unlimited" || template.code === "exclusive") && candidate.stemsLink) {
            links.push({ label: "Stems", url: candidate.stemsLink });
          }

          // All licenses get the producers tag
          links.push({ label: "Producers Tag", url: PRODUCER_TAG_URL });

          // Insert delivery links
          for (const [index, link] of links.entries()) {
            await client.query(
              `INSERT INTO "BeatLicenseDeliveryLink" (
                id, "beatLicenseId", label, url, "sortOrder"
              ) VALUES (
                gen_random_uuid()::text, $1, $2, $3, $4
              )`,
              [beatLicenseId, link.label, link.url, index]
            );
          }
        }

        await client.query("COMMIT");
        imported++;
        console.log(`   ✅ ${candidate.title} (${candidate.bpm}bpm, ${candidate.genre})`);
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(`   ❌ Failed: ${candidate.title} - ${(error as Error).message}`);
      }
    }

    console.log(`\n✨ Done! Imported ${imported}/${allCandidates.length} beats.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { parseBuffer, parseWebStream } from "music-metadata";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

type FileRow = {
  text: string;
  href: string;
};

type ContainerRecord = {
  sourceUrl: string;
  title?: string;
  fileRows: FileRow[];
  body?: string;
};

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
  durationSeconds: number | null;
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

type LicenseTemplateRow = {
  id: string;
  code: string;
};

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

function slugify(input: string) {
  return input
    .toLowerCase()
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
  const cleaned = value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "N/A";

  const sharpFlat = cleaned
    .replace(/#(?=[A-Ga-g])/g, "#")
    .replace(/([A-G])b/i, (_, note) => `${note}b`);

  if (/^[A-G][#b]?\s?(m|min|minor)$/i.test(sharpFlat)) {
    return sharpFlat
      .replace(/min|minor/i, "Min")
      .replace(/\bm\b/i, "Min")
      .replace(/\s+/g, " ");
  }

  if (/^[A-G][#b]?\s?(maj|major)$/i.test(sharpFlat)) {
    return sharpFlat
      .replace(/maj|major/i, "Maj")
      .replace(/\s+/g, " ");
  }

  return titleCase(sharpFlat);
}

function parseTagsFromName(name: string) {
  const collected: string[] = [];
  const parenMatch = name.match(/^\(([^)]+)\)/);
  if (parenMatch) {
    collected.push(...parenMatch[1].split(","));
  }

  const bracketMatch = name.match(/beats\[([^\]]+)\]/i);
  if (bracketMatch) {
    collected.push(...bracketMatch[1].split(","));
  }

  return collected
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function parseBpm(name: string) {
  const match = name.match(/(\d{2,3})\s?-?\s?bpm/i);
  if (match) return Number(match[1]);

  const trailingMatch = name.match(/(?:^|[\s_-])(\d{2,3})(?:\s|$)/);
  return trailingMatch ? Number(trailingMatch[1]) : 0;
}

function parseKey(name: string) {
  const bracketMatch = name.match(/\(([A-G][#b♭]?\s?(?:minor|major|m|min|maj))\)/i);
  if (bracketMatch) return normalizeKey(bracketMatch[1].replace("♭", "b"));

  const inlineMatch = name.match(/\b([A-G][#b]?(?:m|min|maj))\b/i);
  if (inlineMatch) return normalizeKey(inlineMatch[1]);

  return "N/A";
}

function chooseGenre(tags: string[], containers: string[]) {
  const haystack = [...tags, ...containers.map((value) => value.toLowerCase())];
  if (haystack.some((value) => /trapsoul/.test(value))) return "Trapsoul";
  if (haystack.some((value) => /\brnb\b|soul/.test(value))) return "R&B";
  if (haystack.some((value) => /dancehall/.test(value))) return "Dancehall";
  if (haystack.some((value) => /detroit/.test(value))) return "Detroit";
  if (haystack.some((value) => /soca|bouyon|carnival/.test(value))) return "Soca";
  if (haystack.some((value) => /afro|afrob|afrobeats|afropiano/.test(value))) return "Afrobeats";
  if (haystack.some((value) => /trap|club|hard/.test(value))) return "Trap";
  if (haystack.some((value) => /melodic/.test(value))) return "Melodic Trap";
  return "Hip-Hop";
}

function chooseMood(tags: string[]) {
  if (tags.some((value) => /dark/.test(value))) return "Dark";
  if (tags.some((value) => /hard|club|turnt|power/.test(value))) return "Aggressive";
  if (tags.some((value) => /ambient|wavy|melodic/.test(value))) return "Atmospheric";
  if (tags.some((value) => /upbeat|soca/.test(value))) return "Upbeat";
  if (tags.some((value) => /soul|rnb/.test(value))) return "Soulful";
  return "Energetic";
}

function buildDescription(title: string, genre: string, mood: string, bpm: number, tags: string[]) {
  const tagText = tags.slice(0, 3).join(", ");
  const bpmText = bpm ? `${bpm} BPM` : "a polished tempo";
  return `${title} is a ${mood.toLowerCase()} ${genre.toLowerCase()} beat built around ${bpmText}${tagText ? ` with ${tagText} textures` : ""}.`;
}

function cleanTitle(name: string) {
  const withoutExt = name.replace(/\.(mp3|m4a|wav)$/i, "");
  const withoutTags = withoutExt
    .replace(/^\([^)]*\)\s*/, "")
    .replace(/^\.?mp3\s+beats\[[^\]]+\]\s*/i, "");
  const withoutDate = withoutTags.replace(/\s*\[\d{4}-\d{2}-\d{2}\]\s*/g, " ");
  const withoutCopy = withoutDate.replace(/\s*-\s*Copy$/i, "").replace(/\s*\(\d+\)$/i, "");
  const withoutHandles = withoutCopy.replace(/@[\w.$-]+/gi, " ");
  const withoutBpm = withoutHandles.replace(/\b\d{2,3}\s?-?\s?bpm\b/gi, " ");
  const withoutKey = withoutBpm
    .replace(/\(([A-G][#b♭]?\s?(?:minor|major|m|min|maj))\)/gi, " ")
    .replace(/\b[A-G][#b]?(?:m|min|maj)\b/gi, " ");
  const withoutVersion = withoutKey
    .replace(/\b(clean|mix|ruff|rough|v\d+|tagged)\b/gi, " ")
    .replace(/^#\d+\s*/i, "");
  const simplified = withoutVersion
    .replace(/\b(yunginz|choi\$e|prodbyampz|prodbychoise|prodbyampz|ampz|4ormant|kaddyx4|kaddy4x|loyalcold|sirkelmp3|vgs.midnight|mikeyindacut|sabromadeit|gelospinz|1litjo|prodxinsomniac|asherlewis|andreiyz1|dollaz)\b/gi, " ")
    .replace(/\bx\b/gi, " ")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const lastDash = simplified.split(/\s+-\s+/).pop() || simplified;
  const withoutLeadNumbers = lastDash.replace(/^\d+\s+/, "").trim();
  let normalized = withoutLeadNumbers
    .replace(/^-\s*/, "")
    .replace(/\[\s*\]/g, "")
    .replace(/\b(prod\.?|yunginzz?)$/i, "")
    .trim();

  if (/\d+$/.test(normalized) && /[a-z]/i.test(normalized)) {
    normalized = normalized.replace(/\s+\d{2,3}$/g, "").trim();
  }

  return titleCase(normalized || withoutExt);
}

function collectCandidates() {
  const candidates: BeatCandidate[] = [];
  const all = {
    ...FILE_LINKS,
    ...NESTED_FILE_LINKS
  };

  for (const [containerName, container] of Object.entries(all)) {
    const rootContainer = containerName.split("/")[0];
    const linkRecord = CONTAINER_LINKS[rootContainer];

    for (const row of container.fileRows || []) {
      const fileName = decodeFileName(row.href || "");
      if (!/\.(mp3|m4a|wav)$/i.test(fileName)) continue;

      const tags = Array.from(
        new Set(
          [
            ...parseTagsFromName(fileName),
            ...containerName
              .split("/")
              .flatMap((piece) => piece.toLowerCase().split(/[^a-z0-9$+#]+/))
              .filter(Boolean)
              .filter((value) => !["files", "mp3", "wav", "stems"].includes(value))
          ].filter(Boolean)
        )
      );

      const bpm = parseBpm(fileName);
      const musicalKey = parseKey(fileName);
      const title = cleanTitle(fileName);
      const genre = chooseGenre(tags, [containerName]);
      const mood = chooseMood(tags);
      const slug = slugify(title);

      candidates.push({
        title,
        slug,
        previewUrl: toRawUrl(row.href),
        downloadMp3Url: toDownloadUrl(row.href),
        durationSeconds: null,
        bpm,
        musicalKey,
        genre,
        mood,
        description: buildDescription(title, genre, mood, bpm, tags),
        tags,
        sourceContainer: containerName,
        sourceFileName: fileName,
        wavLink: rootContainer === containerName ? linkRecord?.wavFolderUrl || null : null,
        stemsLink: rootContainer === containerName ? linkRecord?.stemsFolderUrl || null : null
      });
    }
  }

  const deduped = new Map<string, BeatCandidate>();
  for (const candidate of candidates) {
    const key = candidate.slug;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, candidate);
      continue;
    }

    const existingLooksLikeCopy = /copy|\(\d+\)/i.test(existing.sourceFileName);
    const candidateLooksLikeCopy = /copy|\(\d+\)/i.test(candidate.sourceFileName);
    if (existingLooksLikeCopy && !candidateLooksLikeCopy) {
      deduped.set(key, candidate);
      continue;
    }

    if ((candidate.stemsLink && !existing.stemsLink) || (candidate.wavLink && !existing.wavLink)) {
      deduped.set(key, {
        ...existing,
        wavLink: candidate.wavLink || existing.wavLink,
        stemsLink: candidate.stemsLink || existing.stemsLink
      });
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.title.localeCompare(b.title));
}

async function computeDuration(candidate: BeatCandidate) {
  const url = candidate.previewUrl;
  const head = await fetch(url, { headers: { Range: "bytes=0-131071" } });
  const totalSize = Number(
    (head.headers.get("content-range") || "").split("/").pop() ||
      head.headers.get("content-length") ||
      0
  );

  const buffer = Buffer.from(await head.arrayBuffer());
  const format = await parseBuffer(
    buffer,
    { mimeType: head.headers.get("content-type") || undefined },
    { duration: false }
  );

  if (format.format.bitrate && totalSize) {
    return Math.round((totalSize * 8) / format.format.bitrate);
  }

  const full = await fetch(url);
  const metadata = await parseWebStream(
    full.body as ReadableStream<Uint8Array>,
    {
      mimeType: full.headers.get("content-type") || undefined,
      size: Number(full.headers.get("content-length") || totalSize || 0)
    },
    { duration: true }
  );

  return metadata.format.duration ? Math.round(metadata.format.duration) : null;
}

async function upsertBeatWithPg(
  client: Client,
  templates: LicenseTemplateRow[],
  candidate: BeatCandidate
) {
  await client.query("begin");

  try {
    const beatResult = await client.query(
      `
        insert into "Beat" (
          id, title, slug, "producerName", "previewMp3Url", bpm,
          "durationSeconds", "musicalKey", genre, mood, description, status, "updatedAt"
        )
        values (
          gen_random_uuid()::text, $1, $2, 'Yunginz', $3, $4, $5, $6, $7, $8, $9, 'PUBLISHED', now()
        )
        on conflict (slug) do update
        set
          title = excluded.title,
          "producerName" = excluded."producerName",
          "previewMp3Url" = excluded."previewMp3Url",
          bpm = excluded.bpm,
          "durationSeconds" = excluded."durationSeconds",
          "musicalKey" = excluded."musicalKey",
          genre = excluded.genre,
          mood = excluded.mood,
          description = excluded.description,
          status = excluded.status,
          "updatedAt" = now()
        returning id
      `,
      [
        candidate.title,
        candidate.slug,
        candidate.previewUrl,
        candidate.bpm || 0,
        candidate.durationSeconds,
        candidate.musicalKey || "N/A",
        candidate.genre,
        candidate.mood,
        candidate.description
      ]
    );

    const beatId = beatResult.rows[0].id as string;

    await client.query(`delete from "BeatTag" where "beatId" = $1`, [beatId]);
    for (const tag of candidate.tags) {
      await client.query(
        `insert into "BeatTag" (id, "beatId", value) values (gen_random_uuid()::text, $1, $2)`,
        [beatId, tag]
      );
    }

    for (const template of templates) {
      const manualFulfillmentRequired =
        template.code === "unlimited" || template.code === "exclusive";

      const licenseResult = await client.query(
        `
          insert into "BeatLicense" (
            id, "beatId", "licenseTemplateId", active, "manualFulfillmentRequired", "updatedAt"
          )
          values (
            gen_random_uuid()::text, $1, $2, true, $3, now()
          )
          on conflict ("beatId", "licenseTemplateId") do update
          set
            active = true,
            "manualFulfillmentRequired" = excluded."manualFulfillmentRequired",
            "updatedAt" = now()
          returning id
        `,
        [beatId, template.id, manualFulfillmentRequired]
      );

      const beatLicenseId = licenseResult.rows[0].id as string;
      const links = [
        { label: "MP3", url: candidate.downloadMp3Url },
        ...(template.code !== "basic" && candidate.wavLink
          ? [{ label: "WAV", url: candidate.wavLink }]
          : []),
        ...((template.code === "unlimited" || template.code === "exclusive") && candidate.stemsLink
          ? [{ label: "Stems", url: candidate.stemsLink }]
          : []),
        { label: "Producers Tag", url: PRODUCER_TAG_URL }
      ];

      await client.query(`delete from "BeatLicenseDeliveryLink" where "beatLicenseId" = $1`, [
        beatLicenseId
      ]);

      for (const [index, link] of links.entries()) {
        await client.query(
          `
            insert into "BeatLicenseDeliveryLink" (
              id, "beatLicenseId", label, url, "sortOrder"
            )
            values (
              gen_random_uuid()::text, $1, $2, $3, $4
            )
          `,
          [beatLicenseId, link.label, link.url, index]
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const skipExisting = process.argv.includes("--skip-existing");
  const candidates = collectCandidates();

  console.log(`Prepared ${candidates.length} unique beats from Dropbox recovery.`);

  const preview = candidates.slice(0, 12).map((candidate) => ({
    title: candidate.title,
    slug: candidate.slug,
    bpm: candidate.bpm,
    genre: candidate.genre,
    mood: candidate.mood,
    sourceContainer: candidate.sourceContainer,
    wav: Boolean(candidate.wavLink),
    stems: Boolean(candidate.stemsLink)
  }));

  console.table(preview);

  if (!apply) {
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const templatesResult = await client.query<LicenseTemplateRow>(
      `select id, code from "LicenseTemplate" where active = true order by "sortOrder" asc`
    );
    const templates = templatesResult.rows;
    const slugsToCheck = candidates.map((candidate) => candidate.slug);
    const existingResult = await client.query<{ slug: string }>(
      `select slug from "Beat" where slug = any($1::text[])`,
      [slugsToCheck]
    );
    const existingSlugs = new Set(existingResult.rows.map((row) => row.slug));

    for (const candidate of candidates) {
      if (skipExisting && existingSlugs.has(candidate.slug)) {
        continue;
      }
      candidate.durationSeconds = await computeDuration(candidate);
      await upsertBeatWithPg(client, templates, candidate);
      console.log(
        `Imported ${candidate.title} (${candidate.durationSeconds ?? "?"}s) from ${candidate.sourceContainer}`
      );
    }
  } finally {
    await client.end();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

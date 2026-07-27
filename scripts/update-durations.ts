/**
 * Fetch and update beat durations from Dropbox MP3 streams.
 * 
 * Usage:
 *   npx tsx scripts/update-durations.ts          # dry-run
 *   npx tsx scripts/update-durations.ts --apply  # write to DB
 */

import { parseWebStream } from "music-metadata";
import { Client } from "pg";

const DB_URL = process.env.DATABASE_URL || "";

async function fetchDuration(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok || !res.headers.get("content-type")?.includes("audio")) {
      return null;
    }

    const metadata = await parseWebStream(
      res.body as ReadableStream<Uint8Array>,
      {
        mimeType: res.headers.get("content-type") || undefined,
        size: Number(res.headers.get("content-length") || 0),
      },
      { duration: true }
    );

    return metadata.format.duration ? Math.round(metadata.format.duration) : null;
  } catch (error) {
    console.error(`  ⚠️  Failed to fetch duration: ${(error as Error).message}`);
    return null;
  }
}

async function main() {
  const apply = process.argv.includes("--apply");

  if (!DB_URL) {
    console.error("❌ DATABASE_URL not set.");
    process.exit(1);
  }

  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const beats = await client.query<{ id: string; title: string; previewMp3Url: string }>(
      `SELECT id, title, "previewMp3Url" FROM "Beat" WHERE "durationSeconds" IS NULL OR "durationSeconds" = 0 ORDER BY title`
    );

    console.log(`\n🎵 ${beats.rows.length} beats need duration updates.\n`);

    let updated = 0;
    let failed = 0;

    for (const beat of beats.rows) {
      const duration = await fetchDuration(beat.previewMp3Url);

      if (duration && duration > 0) {
        if (apply) {
          await client.query(
            `UPDATE "Beat" SET "durationSeconds" = $1, "updatedAt" = now() WHERE id = $2`,
            [duration, beat.id]
          );
        }
        updated++;
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        console.log(`  ✅ ${beat.title} → ${mins}:${secs.toString().padStart(2, "0")}`);
      } else {
        failed++;
        console.log(`  ❌ ${beat.title} → could not determine duration`);
      }
    }

    console.log(`\n✨ ${apply ? "Updated" : "Would update"} ${updated} beats. ${failed} failed.\n`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

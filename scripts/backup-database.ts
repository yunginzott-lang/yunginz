/**
 * Full database backup script.
 * Exports every table to JSON files in /backups/<timestamp>/
 * 
 * Usage: npx tsx scripts/backup-database.ts
 */

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const DB_URL = process.env.DATABASE_URL || "";

const TABLES = [
  "AdminUser",
  "Beat",
  "BeatTag",
  "BeatLicense",
  "BeatLicenseDeliveryLink",
  "LicenseTemplate",
  "SoundKit",
  "Customer",
  "Order",
  "OrderItem",
  "PaymentEvent",
  "ContactSubmission",
  "ExclusiveOffer",
  "SiteSettings",
  "HomepageSection",
  "RateLimitBucket",
  "AdminActivityLog",
];

async function main() {
  if (!DB_URL) {
    console.error("❌ DATABASE_URL not set.");
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0] + "_" +
    new Date().toISOString().replace(/[:.]/g, "-").split("T")[1].split("Z")[0];
  const backupDir = path.join(process.cwd(), "backups", timestamp);
  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`\n📦 Creating backup in: ${backupDir}\n`);

  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const summary: Record<string, number> = {};

  try {
    for (const table of TABLES) {
      try {
        const res = await client.query(`SELECT * FROM "${table}" ORDER BY "createdAt" ASC NULLS LAST`);
        const filePath = path.join(backupDir, `${table}.json`);
        fs.writeFileSync(filePath, JSON.stringify(res.rows, null, 2));
        summary[table] = res.rows.length;
        console.log(`  ✅ ${table}: ${res.rows.length} rows`);
      } catch (error) {
        // Some tables may not have createdAt - retry without ORDER BY
        try {
          const res = await client.query(`SELECT * FROM "${table}"`);
          const filePath = path.join(backupDir, `${table}.json`);
          fs.writeFileSync(filePath, JSON.stringify(res.rows, null, 2));
          summary[table] = res.rows.length;
          console.log(`  ✅ ${table}: ${res.rows.length} rows`);
        } catch (innerError) {
          console.log(`  ⚠️  ${table}: skipped (${(innerError as Error).message})`);
        }
      }
    }

    // Write a combined manifest
    const manifest = {
      backupDate: new Date().toISOString(),
      databaseHost: DB_URL.replace(/:[^@]+@/, ":***@").replace(/\?.*$/, ""),
      tables: summary,
      totalRows: Object.values(summary).reduce((a, b) => a + b, 0),
    };
    fs.writeFileSync(path.join(backupDir, "_manifest.json"), JSON.stringify(manifest, null, 2));

    console.log(`\n✨ Backup complete!`);
    console.log(`   Location: ${backupDir}`);
    console.log(`   Total rows: ${manifest.totalRows}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

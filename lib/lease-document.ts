import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { LicenseRightsSnapshot } from "@/lib/types";

type LeaseFillInput = {
  licenseCode: string;
  licenseName: string;
  beatTitle: string;
  producerName: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerAddress?: string;
  priceLabel: string;
  purchasedAt?: Date;
  rights?: LicenseRightsSnapshot;
  sellerRegion?: string;
};

const fileNames: Record<string, string> = {
  basic: "basic-license.rtf",
  standard: "standard-license.rtf",
  unlimited: "unlimited-license.rtf",
  exclusive: "exclusive-license.rtf"
};

export function normalizeLicenseCode(name: string) {
  const value = name.toLowerCase();
  if (value.includes("exclusive")) return "exclusive";
  if (value.includes("unlimited")) return "unlimited";
  if (value.includes("standard")) return "standard";
  return "basic";
}

const getLeaseTemplateText = cache(async (code: string) => {
  const normalized = normalizeLicenseCode(code);
  const fileName = fileNames[normalized] ?? fileNames.basic;
  const filePath = path.join(process.cwd(), "public", "contracts", fileName);
  const rtf = await readFile(filePath, "utf8");
  return rtfToPlainText(rtf);
});

export async function getLeasePreview(code: string) {
  return sanitizeLeasePreviewText(await getLeaseTemplateText(code));
}

export async function buildFilledLeaseText(input: LeaseFillInput) {
  const purchasedAt = input.purchasedAt ?? new Date();
  const contractDate = purchasedAt.toLocaleString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
  const buyerName = input.buyerName || "{CUSTOMER_FULLNAME}";
  const buyerEmail = input.buyerEmail || "{CUSTOMER_EMAIL}";
  const buyerAddress = input.buyerAddress || "{CUSTOMER_ADDRESS}";
  const template = await getLeaseTemplateText(input.licenseCode);
  const rights = input.rights ?? {};

  const replacements: Record<string, string> = {
    "{LICENSE_NAME}": input.licenseName,
    "{CONTRACT_DATE}": contractDate,
    "{CUSTOMER_FULLNAME}": buyerName,
    "{CUSTOMER_EMAIL}": buyerEmail,
    "{CUSTOMER_ADDRESS}": buyerAddress,
    "{LICENSE_PRICE}": input.priceLabel || "",
    "{PRODUCER_ALIAS}": input.producerName,
    "{PRODUCT_TITLE}": input.beatTitle,
    "{PERFORMANCES_FOR_PROFIT}": formatPerformanceValue(rights.performancesForProfit),
    "{NUMBER_OF_RADIO_STATIONS}": formatValue(rights.numberOfRadioStations, "0"),
    "{DISTRIBUTE_COPIES}": formatValue(rights.distributeCopies, "0"),
    "{AUDIO_STREAMS}": formatValue(rights.audioStreams, "0"),
    "{MONETIZED_VIDEO_STREAMS_ALLOWED}": formatValue(
      rights.monetizedVideoStreamsAllowed,
      "0"
    ),
    "{MONETIZED_MUSIC_VIDEOS}": formatValue(rights.monetizedMusicVideos, "1"),
    "{NUMBER_OF_VIDEO_STREAMS}": formatValue(
      rights.numberOfVideoStreams ?? rights.monetizedMusicVideos,
      "1"
    ),
    "{FREE_DOWNLOADS}": formatValue(rights.freeDownloads, "0"),
    "{STATE_PROVINCE_COUNTRY}":
      input.sellerRegion ||
      rights.sellerRegion ||
      process.env.SELLER_REGION ||
      "California, United States"
  };

  let completed = template;
  for (const [token, value] of Object.entries(replacements)) {
    completed = completed.split(token).join(value);
  }

  if (!completed.includes(buyerEmail)) {
    completed = `${completed}\n\nCustomer Email: ${buyerEmail}`;
  }

  return completed;
}

export async function generateLeasePdf(input: LeaseFillInput) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const text = await buildFilledLeaseText(input);
  const lines = wrapText(text, 88);
  let page = doc.addPage([612, 792]);
  let y = 748;

  page.drawText("YUNGINZ LEASE AGREEMENT", {
    x: 48,
    y,
    size: 18,
    font: bold,
    color: rgb(0.96, 0.88, 0.25)
  });

  y -= 30;
  for (const line of lines) {
    if (y < 50) {
      y = 742;
      page = doc.addPage([612, 792]);
    }

    page.drawText(line, {
      x: 48,
      y,
      size: 10.5,
      font: regular,
      color: rgb(0.92, 0.92, 0.92)
    });
    y -= 15;
  }

  return doc.save();
}

function formatValue(value: string | number | boolean | undefined, fallback: string) {
  if (typeof value === "boolean") {
    return value ? "may" : "may not";
  }

  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value);
}

function formatPerformanceValue(value: string | number | boolean | undefined) {
  if (typeof value === "boolean") {
    return value ? "may" : "may not";
  }

  if (value === undefined || value === null || value === "") {
    return "may";
  }

  return String(value);
}

function wrapText(text: string, lineLength: number) {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > lineLength) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}

function rtfToPlainText(rtf: string) {
  const plain = rtf
    .replace(/\r/g, "")
    .replace(/\{\\fonttbl[\s\S]*?\}\s*/g, "")
    .replace(/\{\\\*\\generator[\s\S]*?\}\s*/g, "")
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\tab/g, "\t")
    .replace(/\\emdash/g, " - ")
    .replace(/\\endash/g, "-")
    .replace(/\\ldblquote/g, '"')
    .replace(/\\rdblquote/g, '"')
    .replace(/\\lquote/g, "'")
    .replace(/\\rquote/g, "'")
    .replace(/\\u(-?\d+)\??/g, (_, num) => {
      const code = parseInt(num, 10);
      return String.fromCharCode(code < 0 ? code + 65536 : code);
    })
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return String.fromCharCode(code >= 0x80 && code <= 0x9f ? cp1252ToUnicode(code) : code);
    })
    .replace(/\\\{/g, "\u0001")
    .replace(/\\\}/g, "\u0002")
    .replace(/\\[a-z]+\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\u0001/g, "{")
    .replace(/\u0002/g, "}")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\u0000/g, "")
    .trim();

  return sanitizeLeasePreviewText(plain);
}

const CP1252_MAP: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178
};

function cp1252ToUnicode(code: number) {
  return CP1252_MAP[code] ?? code;
}

export function sanitizeLeasePreviewText(text: string) {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => !/calibri|riched20|generator/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\u0000/g, "")
    .trim();
}

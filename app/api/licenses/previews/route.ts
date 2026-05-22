import { NextResponse } from "next/server";

import {
  getLeasePreview,
  normalizeLicenseCode,
  sanitizeLeasePreviewText
} from "@/lib/lease-document";
import { prisma } from "@/lib/prisma";

type PreviewRequest = {
  beatLicenseIds?: string[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PreviewRequest;
    const beatLicenseIds = Array.isArray(body.beatLicenseIds) ? body.beatLicenseIds : [];

    if (!beatLicenseIds.length) {
      return NextResponse.json({ error: "No licenses selected." }, { status: 400 });
    }

    const licenses = await prisma.beatLicense.findMany({
      where: {
        id: { in: beatLicenseIds }
      },
      include: {
        licenseTemplate: true
      }
    });

    const previews = await Promise.all(
      licenses.map(async (license) => {
        const name = license.customName ?? license.licenseTemplate.name;
        const code = normalizeLicenseCode(license.licenseTemplate.code || name);
        return {
          beatLicenseId: license.id,
          licenseName: name,
          previewText: sanitizeLeasePreviewText(
            license.licenseTemplate.contractPreviewPlain || (await getLeasePreview(code))
          )
        };
      })
    );

    return NextResponse.json({ previews });
  } catch (error) {
    console.error("License preview failed", error);
    return NextResponse.json(
      { error: "Unable to load license preview right now." },
      { status: 500 }
    );
  }
}

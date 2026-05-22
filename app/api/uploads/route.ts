import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { verifyUploadAuth } from "@/lib/upload-auth";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Upload endpoint is active."
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const isTokenRequest = body.type === "blob.generate-client-token";

    if (isTokenRequest) {
      const pathname = body.payload.pathname;
      if (!verifyUploadAuth(request.headers, pathname)) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const isPreview = pathname.startsWith("previews/");
        const isCover = pathname.startsWith("covers/");

        return {
          allowedContentTypes: isPreview
            ? ["audio/mpeg", "audio/mp3", "audio/mpeg3", "audio/x-mpeg-3", "audio/*"]
            : isCover
              ? ["image/jpeg", "image/png", "image/webp", "image/avif"]
              : undefined,
          maximumSizeInBytes: isPreview ? 100 * 1024 * 1024 : 20 * 1024 * 1024,
          allowOverwrite: true,
          callbackUrl: request.url
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.info("Blob upload completed", {
          pathname: blob.pathname,
          url: blob.url
        });
      }
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Asset upload failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 }
    );
  }
}

import { createHmac, timingSafeEqual } from "node:crypto";

const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

type UploadAuthPayload = {
  userId: string;
  scope: string;
  expiresAt: number;
  signature: string;
};

function getSigningSecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for upload signing.");
  }

  return secret;
}

function signValue(userId: string, scope: string, expiresAt: number) {
  return createHmac("sha256", getSigningSecret())
    .update(`${userId}:${scope}:${expiresAt}`)
    .digest("hex");
}

export function createUploadAuth(userId: string, scope = "*"): UploadAuthPayload {
  const expiresAt = Date.now() + UPLOAD_WINDOW_MS;

  return {
    userId,
    scope,
    expiresAt,
    signature: signValue(userId, scope, expiresAt)
  };
}

export function verifyUploadAuth(headers: Headers, pathname?: string) {
  const userId = headers.get("x-upload-user")?.trim() ?? "";
  const scope = headers.get("x-upload-scope")?.trim() ?? "";
  const expiresAtRaw = headers.get("x-upload-expires")?.trim() ?? "";
  const signature = headers.get("x-upload-signature")?.trim() ?? "";

  if (!userId || !scope || !expiresAtRaw || !signature) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);

  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  if (pathname && scope !== "*" && !pathname.startsWith(`${scope}/`)) {
    return false;
  }

  const expected = signValue(userId, scope, expiresAt);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function getSecuritySecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for security signing.");
  }

  return secret;
}

export function signLeaseDownloadToken(args: {
  publicId: string;
  itemId: string;
  expiresAt: number;
}) {
  const payload = `${args.publicId}:${args.itemId}:${args.expiresAt}`;
  return createHmac("sha256", getSecuritySecret()).update(payload).digest("hex");
}

export function verifyLeaseDownloadToken(args: {
  publicId: string;
  itemId: string;
  expiresAt: number;
  token: string;
}) {
  if (!args.token || !Number.isFinite(args.expiresAt) || Date.now() > args.expiresAt) {
    return false;
  }

  const expected = signLeaseDownloadToken(args);
  const providedBuffer = Buffer.from(args.token);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function createLeaseDownloadLink(args: {
  baseUrl: string;
  publicId: string;
  itemId: string;
  expiresInMs?: number;
}) {
  const expiresAt = Date.now() + (args.expiresInMs ?? 1000 * 60 * 60 * 24);
  const token = signLeaseDownloadToken({
    publicId: args.publicId,
    itemId: args.itemId,
    expiresAt
  });

  const url = new URL(`/api/orders/${args.publicId}/lease/${args.itemId}`, args.baseUrl);
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("token", token);

  return url.toString();
}

export function createOpaqueId(length = 12) {
  return randomBytes(length).toString("base64url");
}

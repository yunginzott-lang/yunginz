import { prisma } from "@/lib/prisma";

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || "unknown";
}

export async function enforceRateLimit(args: {
  action: string;
  identifier: string;
  limit: number;
  windowMs: number;
}) {
  const now = new Date();
  const bucketStart = Math.floor(now.getTime() / args.windowMs) * args.windowMs;
  const key = `${args.action}:${args.identifier}:${bucketStart}`;
  const expiresAt = new Date(bucketStart + args.windowMs);

  const bucket = await prisma.rateLimitBucket.upsert({
    where: { key },
    update: {
      count: {
        increment: 1
      }
    },
    create: {
      key,
      count: 1,
      expiresAt
    }
  });

  if (Math.random() < 0.05) {
    await prisma.rateLimitBucket.deleteMany({
      where: {
        expiresAt: {
          lt: now
        }
      }
    });
  }

  return {
    allowed: bucket.count <= args.limit,
    remaining: Math.max(args.limit - bucket.count, 0),
    retryAfterSeconds: Math.max(Math.ceil((expiresAt.getTime() - now.getTime()) / 1000), 1)
  };
}

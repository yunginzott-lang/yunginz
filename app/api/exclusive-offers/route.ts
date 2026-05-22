import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendAdminNotification } from "@/lib/email";
import { enforceRateLimit, getRequestIp } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { exclusiveOfferSchema } from "@/lib/validations/forms";

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const rateLimit = await enforceRateLimit({
    action: "exclusive-offer",
    identifier: ip,
    limit: 4,
    windowMs: 1000 * 60 * 30
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many offers submitted. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds)
        }
      }
    );
  }

  const payload = await request.json();
  const turnstile = await verifyTurnstileToken({
    token: payload?.turnstileToken,
    ip
  });

  if (!turnstile.ok) {
    return NextResponse.json({ error: "Captcha verification failed." }, { status: 400 });
  }

  const parsed = exclusiveOfferSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid offer." }, { status: 400 });
  }

  const offer = await prisma.exclusiveOffer.create({
    data: {
      beatId: parsed.data.beatId,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      offerAmountCents: parsed.data.offerAmountCents,
      message: parsed.data.message || null
    },
    include: {
      beat: true
    }
  });

  try {
    await sendAdminNotification({
      subject: "New exclusive offer",
      preview: `${offer.name} made an exclusive offer`,
      lines: [
        `Beat: ${offer.beat.title}`,
        `Buyer: ${offer.name}`,
        `Email: ${offer.email}`,
        `Offer: $${(offer.offerAmountCents / 100).toFixed(2)}`,
        offer.message ?? "No message provided."
      ]
    });
  } catch (error) {
    console.error("Exclusive offer notification failed", {
      offerId: offer.id,
      error
    });
  }

  return NextResponse.json({ ok: true });
}

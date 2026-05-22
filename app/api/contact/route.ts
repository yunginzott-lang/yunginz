import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendAdminNotification } from "@/lib/email";
import { enforceRateLimit, getRequestIp } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { contactSubmissionSchema } from "@/lib/validations/forms";

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  const rateLimit = await enforceRateLimit({
    action: "contact",
    identifier: ip,
    limit: 5,
    windowMs: 1000 * 60 * 15
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many inquiries submitted. Please try again shortly." },
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

  const parsed = contactSubmissionSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const submission = await prisma.contactSubmission.create({
    data: parsed.data
  });

  try {
    await sendAdminNotification({
      subject: "New Yunginz contact inquiry",
      preview: `${submission.name} sent a new inquiry`,
      lines: [
        `Name: ${submission.name}`,
        `Email: ${submission.email}`,
        `Type: ${submission.inquiryType}`,
        `Subject: ${submission.subject}`,
        submission.message
      ]
    });
  } catch (error) {
    console.error("Contact notification failed", {
      submissionId: submission.id,
      error
    });
  }

  return NextResponse.json({ ok: true });
}

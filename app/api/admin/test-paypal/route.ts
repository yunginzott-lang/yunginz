import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getPaypalAccessToken } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const configured = (process.env.PAYPAL_ENVIRONMENT || "").trim().toLowerCase();
  const environment = configured === "live" ? "live" : "sandbox";

  try {
    const token = await getPaypalAccessToken(environment);
    return NextResponse.json({
      ok: true,
      environment,
      tokenPreview: token.substring(0, 20) + "...",
      message: `PayPal ${environment} auth successful.`
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      environment,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

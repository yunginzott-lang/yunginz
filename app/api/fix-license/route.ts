import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await prisma.licenseTemplate.update({
      where: { code: "basic" },
      data: { name: "Premium", priceCents: 3000 }
    });
    return NextResponse.json({
      success: true,
      message: `Updated ${result.code}: name='${result.name}', price=$${result.priceCents ? result.priceCents / 100 : "N/A"}`
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: e instanceof Error ? e.message : String(e)
    }, { status: 500 });
  }
}

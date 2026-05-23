import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { sendPaidOrderNotifications } from "@/lib/order-notifications";
import { capturePaypalOrder } from "@/lib/paypal";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createLeaseDownloadLink } from "@/lib/security";
import { formatCurrency, getBaseUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    notFound();
  }

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || headersList.get("x-real-ip")?.trim() || "unknown";
  const rateLimit = await enforceRateLimit({
    action: `checkout-success:${token}`,
    identifier: ip,
    limit: 5,
    windowMs: 1000 * 60 * 15
  });

  if (!rateLimit.allowed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-24">
        <h1 className="text-6xl font-semibold uppercase text-[#f4efe7]">
          Too many requests
        </h1>
        <p className="mt-4 text-2xl text-foreground/60">
          Please wait a moment and try refreshing the page.
        </p>
      </main>
    );
  }

  let order = await prisma.order.findUnique({
    where: { paypalOrderId: token },
    include: { customer: true, items: true }
  });

  if (!order) {
    notFound();
  }

  if (order.status !== "PAID") {
    const capture = await capturePaypalOrder(token);
    const amountPaidCents = Math.round(
      Number(capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ?? 0) * 100
    );

    if (amountPaidCents !== order.subtotalCents) {
      return (
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-24">
          <div className="section-kicker">Payment issue</div>
          <h1 className="mt-6 text-6xl font-semibold uppercase text-[#f4efe7]">
            Amount mismatch
          </h1>
          <p className="mt-4 text-2xl text-foreground/60">
            Your payment was processed but the captured amount doesn&apos;t match the order
            total. Please contact support with your order reference.
          </p>
        </main>
      );
    }

    order = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        amountPaidCents,
        capturedAt: new Date(),
        fulfillmentStatus: order.items.some((item) => item.manualFulfillmentRequired)
          ? "PARTIAL"
          : "DELIVERED"
      },
      include: {
        customer: true,
        items: true
      }
    });

    const existingApprovalEvent = await prisma.paymentEvent.findFirst({
      where: {
        provider: "PAYPAL",
        eventType: "CHECKOUT.ORDER.APPROVED",
        providerId: token
      }
    });

    if (!existingApprovalEvent) {
      await prisma.paymentEvent.create({
        data: {
          orderId: order.id,
          eventType: "CHECKOUT.ORDER.APPROVED",
          providerId: token,
          rawPayload: capture
        }
      });
    }

    await sendPaidOrderNotifications(order);
  } else if (order.status === "PAID") {
    await sendPaidOrderNotifications(order);
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-24">
      <div className="section-kicker">Order confirmed</div>
      <h1 className="mt-6 text-6xl font-semibold uppercase text-[#f4efe7]">
        Your files are ready
      </h1>
      <p className="mt-4 max-w-3xl text-2xl text-foreground/60">
        Thanks {order.customer.name}. Your payment cleared and your delivery instructions are
        below.
      </p>

      <div className="mt-10 space-y-6">
        {order.items.map((item) => {
          const links =
            item.productType === "SOUND_KIT"
              ? [
                  {
                    label: "ZIP Download",
                    url: item.soundKitDownloadUrlSnapshot ?? ""
                  }
                ].filter((link) => Boolean(link.url))
              : (item.deliveryLinksSnapshot as Array<{ label: string; url: string }>);

          return (
            <div key={item.id} className="border border-white/10 p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-4xl font-semibold uppercase text-[#f4efe7]">
                    {item.beatTitleSnapshot}
                  </div>
                  <div className="font-mono text-xs uppercase tracking-[0.3em] text-foreground/45">
                    {item.productType === "SOUND_KIT"
                      ? "Sound kit"
                      : item.licenseNameSnapshot}
                  </div>
                </div>
                <div className="text-3xl font-semibold text-primary">
                  {formatCurrency(item.priceCentsSnapshot)}
                </div>
              </div>

              {item.productType === "BEAT_LICENSE" ? (
                <div className="mt-4 space-y-2 text-lg text-foreground/70">
                  {item.publicSummarySnapshot.map((entry) => (
                    <div key={entry}>- {entry}</div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 space-y-2 text-lg text-foreground/70">
                  {item.soundKitDescriptionSnapshot ? <div>{item.soundKitDescriptionSnapshot}</div> : null}
                  {item.soundKitTermsTextSnapshot ? <div>{item.soundKitTermsTextSnapshot}</div> : null}
                </div>
              )}

              {item.productType === "BEAT_LICENSE" && item.manualFulfillmentRequired ? (
                <div className="mt-6 border border-primary/30 bg-primary/5 p-4 text-lg text-foreground/75">
                  This license includes manual fulfillment for stems. MP3/WAV delivery links are
                  below when available, and stems will be delivered manually later.
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                {item.productType === "BEAT_LICENSE" ? (
                  <Button asChild variant="outline">
                    <a
                      href={createLeaseDownloadLink({
                        baseUrl: getBaseUrl(),
                        publicId: order.publicId,
                        itemId: item.id
                      })}
                    >
                      Download Lease PDF
                    </a>
                  </Button>
                ) : null}
                {item.productType === "SOUND_KIT" && item.soundKitTermsUrlSnapshot ? (
                  <Button asChild variant="outline">
                    <a href={item.soundKitTermsUrlSnapshot} target="_blank" rel="noreferrer">
                      Open Terms
                    </a>
                  </Button>
                ) : null}
                {links?.map((link) => (
                  <Button key={link.url} asChild>
                    <a href={link.url} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex flex-wrap gap-4">
        <Button asChild>
          <Link href="/">Back to site</Link>
        </Button>
        <Button asChild variant="outline">
          <a href={`mailto:${order.customer.email}`}>Email copy</a>
        </Button>
      </div>
    </main>
  );
}

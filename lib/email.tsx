import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text
} from "@react-email/components";
import { render } from "@react-email/render";
import { Order } from "@prisma/client";
import { Resend } from "resend";

import { generateLeasePdf, normalizeLicenseCode } from "@/lib/lease-document";
import type { LicenseRightsSnapshot } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function cleanEmailEnv(value: string) {
  return value.replace(/\\r|\\n/g, "").trim();
}

function getEmailConfig() {
  const rawFrom = cleanEmailEnv(process.env.ORDER_FROM_EMAIL || "");
  const shouldFallback =
    /@(gmail|yahoo|outlook|hotmail|aol)\./i.test(rawFrom) || !rawFrom;

  return {
    enabled: Boolean(resend),
    from: shouldFallback ? "Yunginz <onboarding@resend.dev>" : rawFrom,
    notifyTo: cleanEmailEnv(process.env.NOTIFY_TO_EMAIL || ""),
    adminEmail: cleanEmailEnv(process.env.ADMIN_EMAIL || ""),
    usingFallbackSender: shouldFallback
  };
}

function BaseEmail({
  preview,
  title,
  children
}: React.PropsWithChildren<{ preview: string; title: string }>) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#0b0b0b",
          color: "#f4efe7",
          fontFamily: "Arial, sans-serif"
        }}
      >
        <Container style={{ margin: "0 auto", maxWidth: "640px", padding: "32px 24px" }}>
          <Heading style={{ color: "#f7c300", fontSize: "28px", letterSpacing: "0.08em" }}>
            {title}
          </Heading>
          {children}
        </Container>
      </Body>
    </Html>
  );
}

export async function sendOrderEmail(args: {
  order: Order & {
    customer: {
      email: string;
      name: string;
      address: string | null;
    };
    items: Array<{
      id: string;
      productType: "BEAT_LICENSE" | "SOUND_KIT";
      beatTitleSnapshot: string;
      licenseNameSnapshot: string;
      priceCentsSnapshot: number;
      manualFulfillmentRequired: boolean;
      deliveryLinksSnapshot: unknown;
      rightsJsonSnapshot: unknown;
      soundKitDownloadUrlSnapshot: string | null;
      soundKitTermsTextSnapshot: string | null;
    }>;
  };
  customerEmail: string;
  customerName: string;
}) {
  const cfg = getEmailConfig();
  if (!cfg.enabled) {
    console.warn("Order email skipped: email provider config is incomplete.", {
      hasResend: Boolean(resend),
      hasFrom: Boolean(cfg.from)
    });
    return false;
  }

  if (cfg.usingFallbackSender) {
    console.warn("Using Resend fallback sender for order email until custom domain is verified.");
  }

  const html = await render(
    <BaseEmail
      preview={`Your Yunginz order ${args.order.publicId} is ready`}
      title="Order Confirmed"
    >
      <Text>Thanks {args.customerName}, your order has been locked in.</Text>
      <Section>
        {args.order.items.map((item) => (
          <Text key={`${item.beatTitleSnapshot}-${item.licenseNameSnapshot}`}>
            {item.productType === "SOUND_KIT"
              ? `${item.beatTitleSnapshot} - Sound kit - ${formatCurrency(item.priceCentsSnapshot)}`
              : `${item.beatTitleSnapshot} - ${item.licenseNameSnapshot} - ${formatCurrency(item.priceCentsSnapshot)}${item.manualFulfillmentRequired ? " - stems delivered manually" : ""}`}
          </Text>
        ))}
      </Section>
      {args.order.items.some((item) => item.productType === "SOUND_KIT") ? (
        <Section>
          {args.order.items
            .filter((item) => item.productType === "SOUND_KIT")
            .map((item) => (
              <Text key={item.id}>
                Download link: {item.soundKitDownloadUrlSnapshot ?? "Available in checkout"}
              </Text>
            ))}
        </Section>
      ) : null}
      <Text>Order reference: {args.order.publicId}</Text>
      <Text>Beat lease PDFs are attached to this email and can also be downloaded from the order success page.</Text>
      <Text>Sound kit downloads are delivered directly in the secure delivery section after checkout.</Text>
    </BaseEmail>
  );

  const attachments = await Promise.all(
    args.order.items
      .filter((item) => item.productType === "BEAT_LICENSE")
      .map(async (item) => {
      const bytes = await generateLeasePdf({
        licenseCode: normalizeLicenseCode(item.licenseNameSnapshot),
        licenseName: item.licenseNameSnapshot,
        beatTitle: item.beatTitleSnapshot,
        producerName: "Yunginz",
        buyerName: args.customerName,
        buyerEmail: args.customerEmail,
        buyerAddress: args.order.customer.address ?? undefined,
        priceLabel: formatCurrency(item.priceCentsSnapshot),
        purchasedAt: args.order.capturedAt ?? args.order.createdAt,
        rights: (item.rightsJsonSnapshot ?? {}) as LicenseRightsSnapshot
      });

      return {
        filename: `${item.beatTitleSnapshot}-${item.licenseNameSnapshot}.pdf`,
        content: Buffer.from(bytes).toString("base64")
      };
    })
  );

  const response = await resend!.emails.send({
    from: cfg.from,
    to: args.customerEmail,
    subject: `Your Yunginz order ${args.order.publicId}`,
    html,
    attachments
  });

  if (response.error) {
    console.error("Order email delivery failed", {
      orderId: args.order.publicId,
      customerEmail: args.customerEmail,
      from: cfg.from,
      error: response.error
    });
    return false;
  }

  return true;
}

export async function sendAdminNotification(args: {
  subject: string;
  preview: string;
  lines: string[];
}) {
  const cfg = getEmailConfig();
  const recipients = [cfg.notifyTo, cfg.adminEmail].filter(Boolean) as string[];

  if (!cfg.enabled || !recipients.length) {
    console.warn("Admin notification skipped: email config/recipients missing.", {
      hasResend: Boolean(resend),
      hasFrom: Boolean(cfg.from),
      recipients
    });
    return false;
  }

  if (cfg.usingFallbackSender) {
    console.warn(
      "Using Resend fallback sender for admin notification until custom domain is verified."
    );
  }

  const html = await render(
    <BaseEmail preview={args.preview} title={args.subject}>
      {args.lines.map((line) => (
        <Text key={line}>{line}</Text>
      ))}
    </BaseEmail>
  );

  const response = await resend!.emails.send({
    from: cfg.from,
    to: recipients,
    subject: args.subject,
    html
  });

  if (response.error) {
    console.error("Admin notification email failed", {
      subject: args.subject,
      recipients,
      from: cfg.from,
      error: response.error
    });
    return false;
  }

  return true;
}

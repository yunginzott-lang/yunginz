import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
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
      <Text>Thanks {args.customerName}, your purchase is complete.</Text>
      <Text>Order reference: {args.order.publicId}</Text>
      <Hr />
      <Section>
        {args.order.items.map((item) => {
          const deliveryLinks = item.productType === "BEAT_LICENSE"
            ? (item.deliveryLinksSnapshot as Array<{ label: string; url: string }> | null)
            : null;
          return (
            <div key={item.id} style={{ marginBottom: "20px" }}>
              <Heading
                as="h3"
                style={{ color: "#f7c300", fontSize: "16px", marginBottom: "4px" }}
              >
                {item.beatTitleSnapshot}
              </Heading>
              <Text style={{ margin: "0 0 4px", fontSize: "14px", color: "#ccc" }}>
                {item.productType === "SOUND_KIT"
                  ? `Sound kit - ${formatCurrency(item.priceCentsSnapshot)}`
                  : `${item.licenseNameSnapshot} - ${formatCurrency(item.priceCentsSnapshot)}${item.manualFulfillmentRequired ? " (stems delivered manually)" : ""}`}
              </Text>
              {deliveryLinks && deliveryLinks.length > 0 ? (
                <div style={{ marginTop: "8px" }}>
                  {deliveryLinks.map((link) => (
                    <Link
                      key={link.label}
                      href={link.url}
                      style={{
                        display: "inline-block",
                        padding: "8px 16px",
                        margin: "4px 8px 4px 0",
                        backgroundColor: "#f7c300",
                        color: "#000",
                        textDecoration: "none",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 600
                      }}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
              {item.productType === "SOUND_KIT" && item.soundKitDownloadUrlSnapshot ? (
                <div style={{ marginTop: "8px" }}>
                  <Link
                    href={item.soundKitDownloadUrlSnapshot}
                    style={{
                      display: "inline-block",
                      padding: "8px 16px",
                      backgroundColor: "#f7c300",
                      color: "#000",
                      textDecoration: "none",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 600
                    }}
                  >
                    ZIP Download
                  </Link>
                </div>
              ) : null}
            </div>
          );
        })}
      </Section>
      <Hr />
      <Text>
        Beat lease PDFs are attached to this email and can also be downloaded from the order
        success page.
      </Text>
      <Text>
        Need help? Reply to this email or contact{" "}
        <Link href="mailto:yunginzbeats@gmail.com" style={{ color: "#f7c300" }}>
          yunginzbeats@gmail.com
        </Link>
      </Text>
    </BaseEmail>
  );

  const settledAttachments = await Promise.allSettled(
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

  const attachments = settledAttachments.flatMap((result, index) => {
    if (result.status === "rejected") {
      console.error("Lease PDF generation failed for an order item", {
        orderId: args.order.publicId,
        item: args.order.items
          .filter((item) => item.productType === "BEAT_LICENSE")
          [index]?.beatTitleSnapshot,
        error: result.reason
      });
      return [];
    }
    return [result.value];
  });

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

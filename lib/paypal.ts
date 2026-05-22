import { cache } from "react";

import { getBaseUrl } from "@/lib/utils";

type PaypalEnvironment = "live" | "sandbox";

const PAYPAL_BASE_URLS: Record<PaypalEnvironment, string> = {
  live: "https://api-m.paypal.com",
  sandbox: "https://api-m.sandbox.paypal.com"
};

function getEnvironmentOrder(): PaypalEnvironment[] {
  const configured = (process.env.PAYPAL_ENVIRONMENT || "").trim().toLowerCase();
  return configured === "live"
    ? ["live", "sandbox"]
    : ["sandbox", "live"];
}

export const getPaypalAccessToken = cache(async (environment: PaypalEnvironment) => {
  const clientId = (process.env.PAYPAL_CLIENT_ID || "").trim();
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || "").trim();

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are missing.");
  }

  const response = await fetch(`${PAYPAL_BASE_URLS[environment]}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials",
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Unable to authenticate with PayPal (${environment}). ${detail}`);
  }

  const payload = await response.json();
  return payload.access_token as string;
});

async function withPaypalEnvironment<T>(
  action: (config: {
    environment: PaypalEnvironment;
    baseUrl: string;
    token: string;
  }) => Promise<T>
) {
  let lastError: Error | null = null;

  for (const environment of getEnvironmentOrder()) {
    try {
      const token = await getPaypalAccessToken(environment);
      return await action({
        environment,
        baseUrl: PAYPAL_BASE_URLS[environment],
        token
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown PayPal error.");
    }
  }

  throw lastError ?? new Error("Unable to reach PayPal.");
}

export async function createPaypalOrder(args: {
  orderId: string;
  amountCents: number;
  description: string;
}) {
  return withPaypalEnvironment(async ({ baseUrl, token }) => {
    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: args.orderId,
            description: args.description,
            amount: {
              currency_code: "USD",
              value: (args.amountCents / 100).toFixed(2)
            }
          }
        ],
        application_context: {
          brand_name: "Yunginz.Prod",
          landing_page: "BILLING",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: `${getBaseUrl()}/checkout/success`,
          cancel_url: `${getBaseUrl()}/checkout/cancel`
        }
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Unable to create PayPal order. ${detail}`);
    }

    return response.json();
  });
}

export async function capturePaypalOrder(paypalOrderId: string) {
  return withPaypalEnvironment(async ({ baseUrl, token }) => {
    const response = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Unable to capture PayPal order.");
    }

    return response.json();
  });
}

export async function verifyPaypalWebhook(headers: Headers, body: unknown) {
  const webhookId = (process.env.PAYPAL_WEBHOOK_ID || "").trim();
  if (!webhookId) {
    return false;
  }

  try {
    const payload = await withPaypalEnvironment(async ({ baseUrl, token }) => {
      const response = await fetch(
        `${baseUrl}/v1/notifications/verify-webhook-signature`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            auth_algo: headers.get("paypal-auth-algo"),
            cert_url: headers.get("paypal-cert-url"),
            transmission_id: headers.get("paypal-transmission-id"),
            transmission_sig: headers.get("paypal-transmission-sig"),
            transmission_time: headers.get("paypal-transmission-time"),
            webhook_id: webhookId,
            webhook_event: body
          }),
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error("Webhook signature verification failed.");
      }

      return response.json();
    });

    return payload.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}

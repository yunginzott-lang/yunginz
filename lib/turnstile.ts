const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() &&
      process.env.TURNSTILE_SECRET_KEY?.trim()
  );
}

export async function verifyTurnstileToken(args: { token?: string | null; ip?: string | null }) {
  if (!isTurnstileEnabled()) {
    return { ok: true, reason: "disabled" as const };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY!.trim();
  const token = args.token?.trim();

  if (!token) {
    return { ok: false, reason: "missing-token" as const };
  }

  const formData = new URLSearchParams();
  formData.set("secret", secret);
  formData.set("response", token);
  if (args.ip) {
    formData.set("remoteip", args.ip);
  }

  const response = await fetch(VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData.toString(),
    cache: "no-store"
  });

  if (!response.ok) {
    return { ok: false, reason: "verify-request-failed" as const };
  }

  const payload = (await response.json()) as {
    success?: boolean;
    ["error-codes"]?: string[];
  };

  return {
    ok: Boolean(payload.success),
    reason: payload.success ? ("ok" as const) : ("rejected" as const),
    errors: payload["error-codes"] ?? []
  };
}

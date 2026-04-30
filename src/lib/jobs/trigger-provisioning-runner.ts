import "server-only";

/**
 * Best-effort: process queued Paystack provisioning jobs without waiting for an external cron.
 * Requires INTERNAL_CRON_SECRET and a public base URL (NEXT_PUBLIC_APP_URL or VERCEL_URL).
 */
export async function triggerProvisioningRunnerBestEffort(): Promise<void> {
  const secret = process.env.INTERNAL_CRON_SECRET?.trim();
  if (!secret) return;

  const baseRaw =
    process.env.INTERNAL_CRON_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`
      : "");
  if (!baseRaw) return;

  const base = baseRaw.replace(/\/$/, "");
  const url = `${base}/api/provisioning/run?limit=5`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "x-internal-key": secret },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    /* ignore — cron may still pick up jobs */
  }
}

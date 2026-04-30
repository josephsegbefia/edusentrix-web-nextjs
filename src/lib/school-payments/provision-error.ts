/**
 * Split user-visible Paystack / provisioning errors from longer technical detail
 * stored for platform operators (full stack, long JSON bodies).
 */
export function splitPublicAndDetailError(err: unknown): {
  publicMessage: string;
  detail: string;
} {
  if (err instanceof Error) {
    const msg = (err.message || "Unknown error").trim() || "Unknown error";
    const stack = err.stack ? `\n${err.stack}` : "";
    const detail = `${msg}${stack}`.slice(0, 12_000);
    const publicMessage = msg.length > 400 ? `${msg.slice(0, 397)}…` : msg;
    return { publicMessage, detail };
  }
  const s = String(err).trim() || "Unknown error";
  return {
    publicMessage: s.length > 400 ? `${s.slice(0, 397)}…` : s,
    detail: s.slice(0, 12_000),
  };
}

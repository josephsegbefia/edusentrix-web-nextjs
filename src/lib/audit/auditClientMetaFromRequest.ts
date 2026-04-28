import type { NextRequest } from "next/server";

/** Best-effort client metadata for §18-style audit (never treat as authoritative for security). */
export function auditClientMetaFromRequest(req: NextRequest): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwarded = req.headers.get("x-forwarded-for");
  const fromForwarded = forwarded?.split(",")[0]?.trim() ?? null;
  const realIp = req.headers.get("x-real-ip")?.trim() ?? null;
  const ipAddress = fromForwarded || realIp || null;
  const rawUa = req.headers.get("user-agent");
  const userAgent = rawUa ? rawUa.slice(0, 500) : null;
  return { ipAddress, userAgent };
}

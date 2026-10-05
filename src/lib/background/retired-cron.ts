import { NextResponse } from "next/server";

export function retiredCronResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 410 });
}

export function authorizeRetiredCron(
  req: Request | undefined,
  secretName?: string
): NextResponse | null {
  if (!req) return null;
  const secret =
    (secretName ? process.env[secretName] : undefined) || process.env.CRON_SECRET;
  if (!secret) return null;
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function retiredCronHandlers(message: string, secretName?: string) {
  const respond = (req?: Request) => {
    const denied = authorizeRetiredCron(req, secretName);
    if (denied) return denied;
    return retiredCronResponse(message);
  };
  return {
    GET: async (req?: Request) => respond(req),
    POST: async (req?: Request) => respond(req),
  };
}

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { runImapMailboxSync } from "@/lib/jobs/imapMailboxSync";
import type { PlatformMailboxId } from "@/lib/email/platform-mailboxes";

export const dynamic = "force-dynamic";

const MAILBOX_IDS = new Set(["hello", "support", "billing"]);

export async function POST(req: NextRequest) {
  try {
    const guard = await requirePlatformAdmin();
    if (!guard.ok) return guard.res;

    await connectToDatabase();

    const body = await req.json().catch(() => ({}));
    const mailbox = typeof body.mailbox === "string" ? body.mailbox : null;

    const mailboxId =
      mailbox && MAILBOX_IDS.has(mailbox)
        ? (mailbox as PlatformMailboxId)
        : undefined;
    const resetUid = body.reset === true || body.resetUid === true;

    const result = await runImapMailboxSync(mailboxId, { resetUid });

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Mailbox sync failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

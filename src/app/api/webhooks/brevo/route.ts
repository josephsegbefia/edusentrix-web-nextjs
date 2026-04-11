import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectToDatabase } from "@/db/connectToDatabase";
import { EmailEvent } from "@/models/EmailEvent";
import { EmailMessage } from "@/models/EmailMessage";
import { applySuppression } from "@/lib/email/suppressions";
import { recordBounceOrComplaint } from "@/lib/email/rate-limiter";

const { BREVO_WEBHOOK_SECRET } = process.env;

const EVENT_TO_STATUS: Record<string, string> = {
  sent: "sent",
  delivered: "delivered",
  open: "opened",
  click: "clicked",
  deferred: "deferred",
  soft_bounce: "deferred",
  hard_bounce: "bounced",
  complaint: "complained",
  unsubscribe: "unsubscribed",
  blocked: "blocked",
  error: "failed",
  invalid: "failed",
};

const SUPPRESSION_EVENTS = new Set([
  "hard_bounce",
  "complaint",
  "blocked",
]);

function verifySignature(
  body: string,
  signature: string | null,
): boolean {
  if (!BREVO_WEBHOOK_SECRET || !signature) return !BREVO_WEBHOOK_SECRET;
  const expected = crypto
    .createHmac("sha256", BREVO_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  );
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-brevo-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const event = (payload.event as string) || "";
  const messageId = (payload["message-id"] as string) || "";
  const email = (payload.email as string) || "";
  const timestamp =
    (payload.ts_event as number) || (payload.ts as number) || Date.now() / 1000;

  if (!event || !messageId) {
    return NextResponse.json({ status: "ignored" });
  }

  await connectToDatabase();

  const emailMessage = await EmailMessage.findOne({
    providerMessageId: messageId,
  }).lean();

  const emailEvent = await EmailEvent.create({
    emailMessageId: emailMessage?._id || null,
    schoolId: emailMessage?.schoolId || null,
    provider: "brevo",
    eventType: event,
    providerMessageId: messageId,
    payload,
    occurredAt: new Date(timestamp * 1000),
  });

  if (emailMessage) {
    const newStatus = EVENT_TO_STATUS[event];
    if (newStatus) {
      const updateFields: Record<string, unknown> = { status: newStatus };
      if (newStatus === "delivered") updateFields.deliveredAt = new Date();
      if (newStatus === "opened") updateFields.openedAt = new Date();

      await EmailMessage.findByIdAndUpdate(emailMessage._id, {
        $set: updateFields,
      });
    }
  }

  if (SUPPRESSION_EVENTS.has(event) && email) {
    const reason = event === "complaint" ? "complaint" : "bounce";
    await applySuppression({
      email,
      reason,
      scope: "global",
      sourceProvider: "brevo",
    });

    await recordBounceOrComplaint({
      schoolId: emailMessage?.schoolId ? String(emailMessage.schoolId) : null,
      trafficClass: (emailMessage?.trafficClass as "transactional" | "manual" | "bulk" | "digest") || "transactional",
      kind: reason,
    });
  }

  return NextResponse.json({
    status: "ok",
    eventId: String(emailEvent._id),
  });
}

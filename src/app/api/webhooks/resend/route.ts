import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  receiveResendInbound,
  type ResendInboundWebhookData,
} from "@/lib/email/services/receive-resend-inbound";

export const runtime = "nodejs";

type ResendWebhookEvent = {
  type: string;
  created_at?: string;
  data: ResendInboundWebhookData;
};

function verifyResendWebhook(
  req: NextRequest,
  payload: string,
): ResendWebhookEvent | null {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    console.error("[Resend Webhook] RESEND_WEBHOOK_SECRET is not configured");
    return null;
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("[Resend Webhook] Missing Svix signature headers");
    return null;
  }

  try {
    const webhook = new Webhook(webhookSecret);

    return webhook.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendWebhookEvent;
  } catch (error) {
    console.error("[Resend Webhook] Signature verification failed", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const event = verifyResendWebhook(req, payload);

  if (!event) {
    return NextResponse.json(
      { error: "Invalid webhook" },
      { status: 400 },
    );
  }

  if (event.type !== "email.received") {
    return NextResponse.json({
      received: true,
      ignored: true,
    });
  }

  try {
    await connectToDatabase();

    const result = await receiveResendInbound(
      event.data,
      event as unknown as Record<string, unknown>,
    );

    return NextResponse.json({
      received: true,
      messageId: result.messageId,
      threadId: result.threadId,
      routed: result.routed,
      duplicate: result.duplicate ?? false,
    });
  } catch (error) {
    console.error("[Resend Webhook] Inbound processing failed", error);

    return NextResponse.json(
      { error: "Inbound email processing failed" },
      { status: 500 },
    );
  }
}

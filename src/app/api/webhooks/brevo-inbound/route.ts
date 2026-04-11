import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { receiveBrevoInbound } from "@/lib/email/services/receive-brevo-inbound";

const { BREVO_INBOUND_PARSE_WEBHOOK_SECRET } = process.env;

export async function POST(req: NextRequest) {
  if (BREVO_INBOUND_PARSE_WEBHOOK_SECRET) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (token !== BREVO_INBOUND_PARSE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
  }

  let payload: Record<string, unknown>;
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      payload = Object.fromEntries(formData.entries());
    } else {
      payload = await req.json();
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400 },
    );
  }

  const senderRaw = payload.Sender || payload.sender || payload.From || payload.from;
  const sender = parseSenderField(senderRaw);

  const recipientsRaw =
    payload.Recipients || payload.recipients || payload.To || payload.to;
  const recipients = parseRecipientsField(recipientsRaw);

  if (!sender || recipients.length === 0) {
    return NextResponse.json(
      { error: "Missing sender or recipients" },
      { status: 400 },
    );
  }

  await connectToDatabase();

  try {
    const result = await receiveBrevoInbound({
      sender,
      recipients,
      subject:
        (payload.Subject as string) ||
        (payload.subject as string) ||
        "(No subject)",
      htmlBody:
        (payload.HtmlBody as string) ||
        (payload["html-body"] as string) ||
        null,
      textBody:
        (payload.TextBody as string) ||
        (payload["text-body"] as string) ||
        (payload.RawTextBody as string) ||
        null,
      messageId:
        (payload.MessageId as string) ||
        (payload["message-id"] as string) ||
        undefined,
      inReplyTo:
        (payload.InReplyTo as string) ||
        (payload["in-reply-to"] as string) ||
        undefined,
      references:
        (payload.References as string) ||
        (payload.references as string) ||
        undefined,
      rawPayload: payload,
    });

    return NextResponse.json({
      status: "ok",
      messageId: result.messageId,
      routed: result.routed,
    });
  } catch (error) {
    console.error("[Brevo Inbound] Processing error:", error);
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 },
    );
  }
}

function parseSenderField(
  raw: unknown,
): { email: string; name?: string } | null {
  if (!raw) return null;
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const email =
      (obj.email as string) || (obj.Email as string) || (obj.address as string);
    if (email) return { email, name: (obj.name as string) || undefined };
  }
  if (typeof raw === "string") {
    const match = raw.match(/<([^>]+)>/);
    if (match) {
      const name = raw.slice(0, raw.indexOf("<")).trim().replace(/"/g, "");
      return { email: match[1], name: name || undefined };
    }
    if (raw.includes("@")) return { email: raw };
  }
  return null;
}

function parseRecipientsField(
  raw: unknown,
): Array<{ email: string }> {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((r) => {
        if (typeof r === "string") return { email: r };
        if (typeof r === "object" && r !== null) {
          const email =
            (r as Record<string, unknown>).email ||
            (r as Record<string, unknown>).Email ||
            (r as Record<string, unknown>).address;
          if (email) return { email: String(email) };
        }
        return null;
      })
      .filter(Boolean) as Array<{ email: string }>;
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => {
        const match = s.trim().match(/<([^>]+)>/);
        if (match) return { email: match[1] };
        if (s.includes("@")) return { email: s.trim() };
        return null;
      })
      .filter(Boolean) as Array<{ email: string }>;
  }
  return [];
}

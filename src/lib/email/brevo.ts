// src/lib/email/brevo.ts
import "server-only";
import * as Brevo from "@getbrevo/brevo"; //

import { renderTemplate, TemplateKey, TemplatePayload } from "./templates";

const { BREVO_API_KEY, FROM_EMAIL, BREVO_FROM_NAME, BREVO_FROM_EMAIL } =
  process.env;

type Recipient = { email: string; name?: string };

let apiInstance: Brevo.TransactionalEmailsApi | null = null;

function getClient() {
  if (apiInstance) return apiInstance;

  apiInstance = new Brevo.TransactionalEmailsApi();
  apiInstance.setApiKey(
    Brevo.TransactionalEmailsApiApiKeys.apiKey,
    (BREVO_API_KEY as string) || ""
  );
  return apiInstance;
}

export async function sendEmail<K extends TemplateKey>(
  to: string | Recipient[],
  template: K,
  data: TemplatePayload[K]
): Promise<void> {
  const api = getClient();
  const payload = renderTemplate(template, data);

  const send = new Brevo.SendSmtpEmail();
  send.subject = payload.subject;
  send.htmlContent = payload.htmlContent;
  send.textContent = payload.textContent;

  send.sender = {
    email: (FROM_EMAIL as string) || "",
    name: BREVO_FROM_NAME as string,
  };
  send.replyTo = {
    email: (BREVO_FROM_EMAIL as string) || "",
    name: "Edusentrix Support",
  };

  if (typeof to === "string") {
    send.to = [{ email: to }];
  } else {
    send.to = to;
  }

  // Optional headers (example): set list-unsubscribe if you have one
  // send.headers = { "List-Unsubscribe": "<mailto:unsubscribe@edusentrix.com>" };

  try {
    await api.sendTransacEmail(send);
  } catch (err: unknown) {
    // Bubble up a clean error; log raw for diagnostics
    let detail = "Unknown error";
    if (err && typeof err === "object") {
      const anyErr = err as { response?: { body?: unknown }; message?: string };
      detail =
        (anyErr.response?.body as string) ?? anyErr.message ?? String(err);
    }
    console.error("[Brevo] sendTransacEmail error:", detail);
    throw new Error("Failed to send email");
  }
}

// Usage example
/**
 * // app/api/test-email/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/brevo";

export async function POST() {
  await sendEmail("recipient@example.com", "SCHOOL_INVITE", {
    schoolName: "Sample Basic School",
    setupLink: "https://app.edusentrix.com/onboard?token=abc123",
  });

  return NextResponse.json({ ok: true });
}

 */

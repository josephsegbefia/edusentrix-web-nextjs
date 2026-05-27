import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { User } from "@/models/User";

export const runtime = "nodejs";

const SUPPORT_EMAIL = "support@tryedusentrix.app";

const ContactSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name."),
  email: z.string().trim().email("Please enter a valid email address."),
  phone: z.string().trim().min(8, "Please enter a valid phone number."),
  schoolName: z.string().trim().max(160).optional(),
  inquiryType: z.enum([
    "enrollment",
    "existing-school",
    "learn",
    "partnership",
    "general",
  ]),
  message: z.string().trim().min(12, "Please add more detail to your message."),
  website: z.string().optional(),
});

const INQUIRY_LABEL: Record<z.infer<typeof ContactSchema>["inquiryType"], string> = {
  enrollment: "School enrollment",
  "existing-school": "Existing school support",
  learn: "EduSentrix Learn",
  partnership: "Partnership",
  general: "General inquiry",
};

type Recipient = {
  email: string;
  name?: string;
};

export async function POST(req: NextRequest) {
  try {
    const parsed = ContactSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid request." },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Honeypot field for simple bot filtering.
    if (data.website?.trim()) {
      return NextResponse.json({ success: true });
    }

    await connectToDatabase();

    const admins = await User.find({ role: "platform_admin", email: { $type: "string", $ne: "" } })
      .select("email name firstName lastName")
      .lean<Array<{ email?: string; name?: string; firstName?: string; lastName?: string }>>();

    const recipientMap = new Map<string, Recipient>();
    for (const admin of admins) {
      const email = admin.email?.trim().toLowerCase();
      if (!email) continue;
      const name =
        admin.name?.trim() ||
        [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim() ||
        undefined;
      recipientMap.set(email, { email, name });
    }

    if (!recipientMap.has(SUPPORT_EMAIL)) {
      recipientMap.set(SUPPORT_EMAIL, { email: SUPPORT_EMAIL, name: "EduSentrix Support" });
    }

    const recipients = Array.from(recipientMap.values());
    const inquiryLabel = INQUIRY_LABEL[data.inquiryType];
    const subject = `[Contact] ${inquiryLabel} — ${data.fullName}`;
    const htmlContent = buildHtml(data, inquiryLabel);
    const textContent = buildText(data, inquiryLabel);

    const outcomes = await Promise.allSettled(
      recipients.map((recipient) =>
        sendTrackedBrevoEmail({
          to: recipient.email,
          toName: recipient.name,
          subject,
          htmlContent,
          textContent,
          templateKey: "CONTACT_FORM_SUBMISSION",
          threadType: "support",
          relatedEntityType: "public_contact",
          actorName: data.fullName,
          actorRole: "external_contact",
        }),
      ),
    );

    if (outcomes.every((outcome) => outcome.status === "rejected")) {
      return NextResponse.json(
        { success: false, error: "Could not send your message right now. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { deliveredTo: recipients.length },
    });
  } catch (error) {
    console.error("[public/contact:POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit contact request." },
      { status: 500 },
    );
  }
}

function buildHtml(data: z.infer<typeof ContactSchema>, inquiryLabel: string) {
  return `
    <p>A new public contact form request was submitted.</p>
    <p><strong>Inquiry:</strong> ${escapeHtml(inquiryLabel)}</p>
    <p><strong>Name:</strong> ${escapeHtml(data.fullName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>
    <p><strong>School:</strong> ${escapeHtml(data.schoolName || "Not provided")}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(data.message).replace(/\n/g, "<br/>")}</p>
  `.trim();
}

function buildText(data: z.infer<typeof ContactSchema>, inquiryLabel: string) {
  return [
    "New public contact form request",
    `Inquiry: ${inquiryLabel}`,
    `Name: ${data.fullName}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone}`,
    `School: ${data.schoolName || "Not provided"}`,
    "",
    "Message:",
    data.message,
  ].join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

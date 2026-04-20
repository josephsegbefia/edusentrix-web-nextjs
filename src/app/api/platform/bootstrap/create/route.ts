import { NextRequest, NextResponse } from "next/server";
import type { Invitation } from "@clerk/backend";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { sendRawEmail } from "@/lib/email/brevo";
import {
  BOOTSTRAP_SESSION_COOKIE,
  isBootstrapAllowWhenAdminsExist,
} from "@/lib/platform-bootstrap/config";
import {
  assertBootstrapConfigured,
  bootstrapKeyFingerprint,
  isValidBootstrapPathSecret,
} from "@/lib/platform-bootstrap/key";
import { getInvitationRedirectUrl } from "@/lib/utils/getAppUrl";
import { hashOtpCode } from "@/lib/platform-billing/payout-security";
import { PlatformBootstrapSession } from "@/models/PlatformBootstrapSession";
import { User } from "@/models/User";

export const runtime = "nodejs";

const bodySchema = z.object({
  secret: z.string().min(8),
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});

export async function POST(req: NextRequest) {
  try {
    assertBootstrapConfigured();
    const rawToken = req.cookies.get(BOOTSTRAP_SESSION_COOKIE)?.value;
    if (!rawToken) {
      return NextResponse.json(
        { success: false, error: "Session expired. Verify the email code again." },
        { status: 401 }
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { secret, email, firstName, lastName } = parsed.data;
    if (!isValidBootstrapPathSecret(secret)) {
      return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
    }

    await connectToDatabase();

    const fp = bootstrapKeyFingerprint(secret);
    const sessionTokenHash = hashOtpCode(rawToken);

    const session = await PlatformBootstrapSession.findOne({
      sessionTokenHash,
      bootstrapKeyFingerprint: fp,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session expired or invalid. Verify the email code again." },
        { status: 401 }
      );
    }

    const existingAdmins = await User.countDocuments({ role: "platform_admin" });
    if (existingAdmins > 0 && !isBootstrapAllowWhenAdminsExist()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A platform admin already exists. Use the platform UI to invite others, or set PLATFORM_BOOTSTRAP_ALLOW_WHEN_ADMINS_EXIST=true for emergency recovery (use with care).",
        },
        { status: 403 }
      );
    }

    const existingPlatform = await User.findOne({
      email,
      role: "platform_admin",
    })
      .select("_id")
      .lean();
    if (existingPlatform) {
      return NextResponse.json(
        { success: false, error: "This email already has a platform admin account." },
        { status: 409 }
      );
    }

    const redirectUrl = getInvitationRedirectUrl();

    const clerk = await clerkClient();
    const invitation = (await clerk.invitations.createInvitation({
      emailAddress: email,
      redirectUrl,
      notify: false,
      publicMetadata: {
        role: "platform_admin",
      },
      ignoreExisting: true,
    })) as Invitation;

    /** Required: generic /sign-in does not include the invitation ticket — Clerk returns 404-style "account not found" until this link is used. */
    const acceptUrl = invitation.url?.trim();
    if (!acceptUrl) {
      console.error(
        "[bootstrap/create] Clerk invitation missing url — check SDK / API version."
      );
      return NextResponse.json(
        {
          success: false,
          error:
            "Invitation was created but no acceptance link was returned. Check server logs and Clerk dashboard.",
        },
        { status: 502 }
      );
    }

    const fullName = `${firstName} ${lastName}`.trim();
    const safeName = fullName
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const safeEmail = email
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    await sendRawEmail({
      to: email,
      subject: "Edusentrix — platform administrator invitation",
      htmlContent: `
        <p>Hello ${safeName},</p>
        <p>You have been invited as a <strong>platform administrator</strong> for Edusentrix.</p>
        <p><strong>Use the link below</strong> to accept the invitation and set your password. Do not use the normal sign-in page first — your account is created when you complete this step.</p>
        <p><a href="${acceptUrl}">Accept invitation and continue</a></p>
        <p style="font-size:12px;color:#555;word-break:break-all;">If the button does not work, copy this URL: ${acceptUrl}</p>
        <p>This email was sent to: <strong>${safeEmail}</strong></p>
      `,
    });

    await PlatformBootstrapSession.updateOne(
      { _id: session._id },
      { $set: { consumedAt: new Date() } }
    );

    const res = NextResponse.json({
      success: true,
      data: { message: "Invitation sent. Check the new admin inbox." },
    });

    res.cookies.set(BOOTSTRAP_SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (error) {
    console.error("[bootstrap/create]", error);
    const message =
      error instanceof Error ? error.message : "Failed to create platform administrator.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

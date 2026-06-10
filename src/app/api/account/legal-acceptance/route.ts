import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { isDemoMode } from "@/lib/demo/runtime";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal/versions";
import { ensureCanonicalUserForClerkSession } from "@/lib/auth/canonical-user";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    // Demo host/session does not use Clerk auth. Treat acceptance as no-op success.
    if (isDemoMode()) {
      return NextResponse.json({ success: true, data: { mode: "demo" } });
    }
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const clerk = await clerkClient();
  const cUser = await clerk.users.getUser(userId);
  const email =
    cUser.primaryEmailAddress?.emailAddress?.toLowerCase() ||
    cUser.emailAddresses?.[0]?.emailAddress?.toLowerCase() ||
    "";

  const userDoc = await ensureCanonicalUserForClerkSession({
    clerkUserId: userId,
    email,
    firstName: cUser.firstName,
    lastName: cUser.lastName,
    avatarUrl: cUser.imageUrl,
  });

  const user = await User.findById(userDoc._id).select("_id");
  if (!user) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const acceptedIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const acceptedUserAgent = req.headers.get("user-agent") || null;

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        policyAcceptedAt: new Date(),
        policyAcceptedIp: acceptedIp,
        policyAcceptedUserAgent: acceptedUserAgent,
      },
    },
  );

  return NextResponse.json({ success: true });
}

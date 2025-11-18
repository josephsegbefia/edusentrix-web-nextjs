/* eslint-disable @typescript-eslint/no-explicit-any */
// scripts/createPlatformAdmin.ts
/**
 * Usage:
 *   EMAIL=admin@example.com pnpm admin:create
 *
 * Env needed:
 *   - CLERK_SECRET_KEY
 *   - APP_URL (e.g., https://app.edusentrix.com)
 *   - MONGODB_URI
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { createClerkClient } from "@clerk/backend";
import { connectToDatabase } from "../src/db/connectToDatabase";
import { User } from "../src/models/User";

async function main() {
  const email = (process.env.EMAIL || "").toLowerCase().trim();
  const { CLERK_SECRET_KEY, APP_URL } = process.env;

  if (!email) throw new Error("Provide EMAIL env var");
  if (!CLERK_SECRET_KEY) throw new Error("Missing CLERK_SECRET_KEY");
  if (!APP_URL) throw new Error("Missing APP_URL");

  // Init Clerk (backend SDK)
  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

  // Look up existing Clerk user by email
  const existingList = await clerk.users.getUserList({
    query: email,
    limit: 5,
  });
  const existing = existingList.data?.find((u) =>
    (u.emailAddresses || []).some(
      (ea) => ea.emailAddress.toLowerCase() === email
    )
  );

  await connectToDatabase();

  let clerkUserId: string | null = existing?.id ?? null;
  let deliveredByInvitation = false;
  let signInTokenUrl: string | undefined;

  if (!clerkUserId) {
    // Try the invitation flow first (requires Email address identifier enabled)
    try {
      await clerk.invitations.createInvitation({
        emailAddress: email,
        // After the invite acceptance/sign-in, Clerk will redirect here:
        redirectUrl: `${APP_URL}/auth/callback`,
      });
      deliveredByInvitation = true; // Clerk emails the link directly
      console.log("✅ Invitation created. Clerk will email the user.");
    } catch (err: any) {
      // If invitations aren’t supported (email identifiers not enabled), fall back
      const isInviteUnsupported =
        Array.isArray(err?.errors) &&
        err.errors.some((e: any) => e.code === "invitations_not_supported");

      if (!isInviteUnsupported) {
        console.error("❌ Clerk invitation failed with unexpected error:", err);
        throw err;
      }

      console.warn(
        "⚠️  Invitations not supported on this Clerk instance. " +
          "Falling back to user creation + sign-in token."
      );

      // Create user WITHOUT requiring a password
      const created = await clerk.users.createUser({
        emailAddress: [email],
        skipPasswordRequirement: true,
        publicMetadata: { role: "platform_admin" },
      });
      clerkUserId = created.id;

      // Generate a sign-in token (passwordless one-time link)
      const token = await clerk.signInTokens.createSignInToken({
        userId: created.id,
        // 1 hour token; adjust to taste
        expiresInSeconds: 60 * 60,
      });
      signInTokenUrl = token.url; // Send this URL to the user via your mailer
    }
  } else {
    // Ensure role is reflected in Clerk metadata if user exists
    await clerk.users.updateUser(clerkUserId, {
      publicMetadata: { role: "platform_admin" },
    });
  }

  // Upsert your local Mongo user
  await User.updateOne(
    { email },
    {
      $set: {
        email,
        role: "platform_admin",
        pendingOnboarding: false,
        clerkUserId: clerkUserId || undefined,
      },
    },
    { upsert: true }
  );

  console.log(`\n✅ Platform admin ensured in Mongo for ${email}\n`);

  if (deliveredByInvitation) {
    console.log(
      "📧 Clerk has sent an invitation email (requires Email address identifier to be enabled in the Clerk dashboard)."
    );
  } else if (signInTokenUrl) {
    console.log("🔗 Send this one-time sign-in URL to the user:");
    console.log(signInTokenUrl, "\n");
    console.log(
      "Tip: After they land in your app (session established), redirect them to your Set Password screen."
    );
  } else {
    console.log("User already existed; they can sign in normally.");
  }

  console.log(
    "If you want Invitations to work, enable Email address as an identifier in Clerk → User & Authentication settings."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

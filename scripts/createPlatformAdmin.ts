/**
 * Usage (recommended):
 *   pnpm dlx tsx scripts/createplatform_admin.ts --email admin@example.com
 *
 * Or add a package.json script:
 *   "scripts": { "admin:create": "tsx scripts/createplatform_admin.ts" }
 * Then run:
 *   EMAIL=admin@example.com pnpm run admin:create
 *
 * Env required:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   MONGODB_URI=...
 */

import "dotenv/config";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
// NOTE: use RELATIVE imports (no "@/...")
import { connectToDatabase } from "../src/db/connectToDatabase";
import { User } from "../src/models/User";

// Read args/env
const argvEmail =
  process.env.EMAIL ||
  (() => {
    const idx = process.argv.indexOf("--email");
    return idx > -1 ? process.argv[idx + 1] : undefined;
  })();

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
console.log(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!argvEmail) throw new Error("Provide email via --email or EMAIL env var");

  await connectToDatabase();

  const supabaseAdmin = createClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  // 1) Create (or get) Supabase user WITHOUT a password
  //    If the user already exists, createUser will error; we then fetch the user.
  let supabaseUserId: string | undefined;

  const createRes = await supabaseAdmin.auth.admin.createUser({
    email: argvEmail,
    email_confirm: true, // immediately confirmed, since we’ll use magic links only
    user_metadata: { role: "platform_admin" },
  });

  if (createRes.error) {
    // If user exists already, fetch it
    if (createRes.error.message?.toLowerCase().includes("already registered")) {
      const list = await supabaseAdmin.auth.admin.listUsers();
      const found = list.data.users.find((u) => u.email === argvEmail);
      if (!found) throw createRes.error;
      supabaseUserId = found.id;
    } else {
      throw createRes.error;
    }
  } else {
    supabaseUserId = createRes.data.user?.id;
  }

  if (!supabaseUserId) throw new Error("No supabase user id available");

  // 2) Generate a MAGIC LINK for this email
  //    (No password auth; platform admin signs in via email link)
  const { data: linkData, error: linkErr } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: argvEmail,
    });

  if (linkErr) throw linkErr;

  const actionLink = linkData?.properties?.action_link || null;

  // 3) Upsert our App user with platform_admin role
  const existing = await User.findOne({ supabaseUserId });
  if (existing) {
    existing.role = "platform_admin";
    existing.email = argvEmail;
    existing.pendingOnboarding = false;
    await existing.save();
  } else {
    await User.create({
      supabaseUserId,
      email: argvEmail,
      name: "Platform Admin",
      role: "platform_admin",
      pendingOnboarding: false,
    });
  }

  console.log("✅ Platform admin ensured:", argvEmail);
  if (actionLink) {
    console.log("\nMagic sign-in link (copy & open in browser):");
    console.log(actionLink, "\n");
  } else {
    console.log(
      "ℹ️ Magic link not returned. Ensure email templates are enabled or generate client-side with signInWithOtp."
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

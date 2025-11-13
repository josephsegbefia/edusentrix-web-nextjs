/* eslint-disable @typescript-eslint/no-explicit-any */
// scripts/create_platform_admin.ts
/**
 * Usage:
 *   EMAIL=admin@example.com pnpm admin:create
 *
 * The script automatically loads variables from .env.local or .env files.
 *
 * Required environment variables (in .env.local/.env or passed inline):
 *   - SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - APP_URL
 *   - MONGODB_URI
 *   - EMAIL (can be passed inline)
 */
import { config } from "dotenv";
import { resolve } from "path";
// Load .env.local first (Next.js convention), then fallback to .env
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });
import { createClient } from "@supabase/supabase-js";
import { connectToDatabase } from "../src/db/connectToDatabase";
import { User } from "../src/models/User";

// Use NEXT_PUBLIC_SUPABASE_URL if SUPABASE_URL is not set (for .env.local compatibility)
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const { SUPABASE_SERVICE_ROLE_KEY, APP_URL } = process.env;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !APP_URL) {
    throw new Error(
      "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or APP_URL"
    );
  }

  const email = process.env.EMAIL;
  if (!email) throw new Error("Provide EMAIL env var");

  await connectToDatabase();

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Ensure Supabase user
  let supabaseUserId: string | null = null;
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (!list.error) {
    supabaseUserId = list.data.users.find((u) => u.email === email)?.id ?? null;
  }
  if (!supabaseUserId) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { role: "platform_admin", seeded: true },
    });
    if (created.error) throw created.error;
    supabaseUserId = created.data.user?.id ?? null;
    if (!supabaseUserId) throw new Error("No Supabase user id returned");
  }

  // 2) Upsert Mongo user with platform_admin role
  await User.updateOne(
    { supabaseUserId },
    {
      $set: {
        supabaseUserId,
        email: email.toLowerCase(),
        role: "platform_admin",
        pendingOnboarding: false,
      },
    },
    { upsert: true }
  );

  // 3) Generate a password setup link (recovery)
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${APP_URL}/authentication/reset` as any },
  } as any);
  if (error) throw error;

  console.log("✅ Platform admin ensured:", email);
  if (data?.properties?.action_link) {
    console.log("\nSet password with this link (copy & open in browser):");
    console.log(data.properties.action_link, "\n");
  } else {
    console.log("No action link returned (check Supabase Auth URL config)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

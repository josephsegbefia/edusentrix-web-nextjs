// src/lib/supabase/client.ts
"use client";
import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      // We will exchange the code on the server route (/auth/callback),
      // so no need to parse tokens from URL here:
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  }
);

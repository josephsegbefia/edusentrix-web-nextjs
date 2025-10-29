// lib/supabase/server.ts
import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function supabaseServer() {
  const cookieStore = await cookies(); // <- get the cookie store

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, // keep this public URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // <-- fix the typo
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as CookieOptions);
            });
          } catch {
            // Called from a Server Component (no mutation). Safe to ignore if
            // you refresh sessions via middleware/route handlers.
          }
        },
      },
    }
  );
}

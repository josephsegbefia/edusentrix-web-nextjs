import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * A server-side Supabase client used only to SEND magic links.
 * We wrap cookies.set/remove with try/catch so calling this in API route doesn't throw an error
 * if the context can't set cookies (like in an Edge function). We do not need cookies to send
 */

export async function supabaseServerForEmail() {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return store.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // harmless; we don't need cookies to send
            store.set({ name, value, ...options });
          } catch {
            /** ignore - not required for sending magic links */
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            store.set({ name, value: "", ...options });
          } catch {
            /** ignore - not required for sending magic links */
          }
        },
      },
    }
  );
}

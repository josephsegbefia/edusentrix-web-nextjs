import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: { code?: string; next?: string };
}) {
  const next = searchParams.next || "/dashboard";
  const supabase = await supabaseServer();

  if (searchParams.code) {
    await supabase.auth.exchangeCodeForSession(searchParams.code);
  }
  redirect(next);
}

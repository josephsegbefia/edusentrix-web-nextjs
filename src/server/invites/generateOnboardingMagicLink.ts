import { supabaseAdmin } from "@/lib/supabase/admin";

export async function generateOnboardingMagicLink(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${process.env.APP_URL}/auth/callback?next=/onboard`,
    },
  });

  if (error) throw error;

  return data?.properties?.action_link;
}

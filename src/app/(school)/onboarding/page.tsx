import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/get-current-user";
import { beginOnboarding } from "./action";

export default async function OnboardingKickoffPage() {
  const me = await requireUser();
  if (me.role !== "school_admin") redirect("/403");
  if (!me.pendingOnboarding) {
    // They’re already good to go—send to their home
    redirect("/admin");
  }

  // Premium, minimal UI that matches your design language
  return (
    <div className="relative min-h-dvh bg-bg text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(50% 50% at 15% 15%, var(--color-brand) 0%, transparent 60%), radial-gradient(60% 40% at 85% 10%, var(--color-primary) 0%, transparent 65%)",
          filter: "blur(90px)",
        }}
      />
      <div className="mx-auto max-w-2xl">
        <div className="relative mx-4 my-16 overflow-hidden rounded-3xl border border-white/10 bg-card/90 shadow-2xl backdrop-blur">
          <div className="border-b border-white/10 bg-white/5 px-10 py-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1 text-xs text-muted">
              <span className="size-2 rounded-full bg-emerald-400" />
              School setup
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              Welcome! Let’s set up your school
            </h1>
            <p className="mt-3 max-w-xl text-sm text-muted">
              We’ll guide you through a quick onboarding—school profile, grades,
              class groups, and initial admin access. You can finish in a few
              minutes.
            </p>
          </div>

          <div className="px-10 py-10">
            <form action={beginOnboarding} className="space-y-5">
              <Button
                type="submit"
                className="w-full rounded-xl bg-brand px-6 py-4 text-sm font-semibold text-black shadow-lg shadow-brand/20 transition hover:opacity-90"
              >
                Start school onboarding
              </Button>
              <p className="text-center text-[11px] uppercase tracking-[0.24em] text-muted">
                You can finish later—your progress will be saved.
              </p>
            </form>

            {/* Optional: secondary actions/help */}
            {/* <div className="mt-8 text-center text-sm text-muted">
              Need help? Contact support@appsentrix.com
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}

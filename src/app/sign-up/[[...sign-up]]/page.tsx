"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SignUp, useClerk, useUser } from "@clerk/nextjs";
import Image from "next/image";
import { EDUSENTRIX_LOGO_ALT, EDUSENTRIX_LOGO_PATH } from "@/lib/branding";
import { AuthSessionConflictCard } from "@/components/auth/AuthSessionConflictCard";

function SignUpPageContent() {
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const fallbackRedirectUrl = React.useMemo(() => {
    const next = searchParams.get("next");
    if (next && next.startsWith("/")) {
      return `/auth/callback?next=${encodeURIComponent(next)}`;
    }
    return "/auth/callback";
  }, [searchParams]);
  const hasInvitationTicket = React.useMemo(
    () => Boolean(searchParams.get("__clerk_ticket")),
    [searchParams]
  );

  const handleSignOutAndContinue = React.useCallback(async () => {
    setIsSigningOut(true);
    try {
      const currentUrl =
        typeof window !== "undefined"
          ? window.location.href
          : `${fallbackRedirectUrl}`;
      await signOut({ redirectUrl: currentUrl });
    } finally {
      setIsSigningOut(false);
    }
  }, [fallbackRedirectUrl, signOut]);

  if (isLoaded && isSignedIn) {
    const activeName =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.primaryEmailAddress?.emailAddress ||
      "Current user";

    return (
      <AuthSessionConflictCard
        title={hasInvitationTicket ? "Invitation needs a fresh session" : "You are already signed in"}
        description={
          hasInvitationTicket
            ? "This invitation must be completed outside the currently active account in this browser."
            : "Creating another EduSentrix account in this browser requires signing out of the current account first."
        }
        primaryLabel="Continue to current workspace"
        secondaryLabel={
          hasInvitationTicket ? "Sign out and accept invitation" : "Sign out and create another account"
        }
        onSecondary={handleSignOutAndContinue}
        secondaryBusy={isSigningOut}
        activeName={activeName}
        activeEmail={user?.primaryEmailAddress?.emailAddress ?? null}
        note={
          hasInvitationTicket
            ? "The invite link already contains a secure Clerk ticket. After sign-out, this page will reload and continue the invited account setup."
            : undefined
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-bg py-10 px-4 flex items-center justify-center relative overflow-hidden">
      {/* Premium background glow effects */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 40% at 70% 10%, #0ea5e9 0%, transparent 60%), radial-gradient(50% 50% at 20% 20%, #6d28d9 0%, transparent 60%)",
          filter: "blur(60px)",
        }}
      />

      <div className="mx-auto max-w-xl w-full relative z-10">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl">
          {/* Subtle gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#0ea5e9]/5 to-[#6d28d9]/5 pointer-events-none" />

          {/* Header section */}
          <div className="relative border-b border-white/10 bg-gradient-to-r from-white/10 via-white/5 to-transparent px-8 py-8">
            <div className="flex items-center gap-3 mb-2">
              <Image src={EDUSENTRIX_LOGO_PATH} alt={EDUSENTRIX_LOGO_ALT} width={32} height={32} className="rounded-md" />
              <h1 className="text-3xl font-bold text-white">Create account</h1>
            </div>
            <p className="text-muted text-sm">
              Get started with EduSentrix today.
            </p>
          </div>

          {/* Clerk SignUp component with custom styling */}
          <div className="relative p-8">
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              fallbackRedirectUrl={fallbackRedirectUrl}
              appearance={{
                variables: {
                  colorPrimary: "#0ea5e9", // Brand color (sky blue)
                  colorText: "#ffffff",
                  colorTextSecondary: "#9aa3b2", // Muted color
                  colorBackground: "#0f1524", // Card color
                  colorInputBackground: "#0b0f1a", // Background color
                  colorInputText: "#ffffff",
                  colorDanger: "#ef4444",
                  borderRadius: "0.75rem",
                  fontFamily: "Inter, ui-sans-serif, system-ui",
                  fontSize: "0.875rem",
                },
                elements: {
                  rootBox: "w-full",
                  card: "bg-transparent shadow-none border-0 p-0",
                  headerTitle: "hidden", // Hide default title since we have custom header
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton:
                    "bg-card border border-white/10 text-white hover:bg-card/80 hover:border-white/20 transition-all rounded-lg",
                  socialButtonsBlockButtonText: "text-sm font-medium",
                  formButtonPrimary:
                    "bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-black font-medium rounded-lg transition-all shadow-lg shadow-[#0ea5e9]/20",
                  formFieldInput:
                    "bg-[#0b0f1a] border-white/10 text-white placeholder:text-muted focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 rounded-lg",
                  formFieldLabel: "text-white text-sm font-medium",
                  footerActionLink: "text-[#0ea5e9] hover:text-[#0ea5e9]/80",
                  identityPreviewEditButton: "text-[#0ea5e9] hover:text-[#0ea5e9]/80",
                  formResendCodeLink: "text-[#0ea5e9] hover:text-[#0ea5e9]/80",
                  otpCodeFieldInput:
                    "bg-[#0b0f1a] border-white/10 text-white focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 rounded-lg",
                  dividerLine: "bg-white/10",
                  dividerText: "text-muted text-xs",
                  alertText: "text-sm",
                  formFieldErrorText: "text-danger text-xs",
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg text-white/60">
          Loading…
        </div>
      }
    >
      <SignUpPageContent />
    </Suspense>
  );
}

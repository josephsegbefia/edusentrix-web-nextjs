"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
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
              <div className="size-8 rounded-md bg-brand/15 grid place-items-center">
                <span className="text-brand font-bold text-sm">E</span>
              </div>
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
              afterSignInUrl="/auth/callback"
              afterSignUpUrl="/auth/callback"
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

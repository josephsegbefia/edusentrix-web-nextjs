"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-svh bg-bg px-4 flex items-center justify-center relative overflow-hidden">
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

      <div className="w-full max-w-xl flex items-center justify-center">
        <SignIn
          routing="path"
          path="/sign-in"
          afterSignInUrl="/auth/callback"
          afterSignUpUrl="/auth/callback"
          /** Hide/disable "Sign up" */
          signUpUrl={undefined}
          appearance={{
            variables: {
              colorPrimary: "#0ea5e9",
              colorText: "#ffffff",
              colorTextSecondary: "#9aa3b2",
              colorBackground: "#0f1524",
              colorInputBackground: "#0b0f1a",
              colorInputText: "#ffffff",
              colorDanger: "#ef4444",
              borderRadius: "0.75rem",
              fontFamily: "Inter, ui-sans-serif, system-ui",
              fontSize: "1rem",
              spacingUnit: "1.25rem",
            },
            elements: {
              rootBox: "w-full",
              /** keep the card narrow and centered */
              card: "w-full bg-card/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 md:p-10",
              headerTitle: "text-4xl font-bold text-white mb-3",
              headerSubtitle: "text-muted text-base mb-8",
              socialButtonsBlockButton:
                "bg-card border border-white/10 text-white hover:bg-card/80 hover:border-white/20 transition-all rounded-lg h-12 text-base font-medium",
              socialButtonsBlockButtonText: "text-base font-medium",
              formButtonPrimary:
                "bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-black font-medium rounded-lg transition-all shadow-lg shadow-[#0ea5e9]/20 h-12 text-base",
              formFieldInput:
                "bg-[#0b0f1a] border-white/10 text-white placeholder:text-muted focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 rounded-lg h-12 text-base",
              formFieldLabel: "text-white text-base font-medium mb-2",
              /** Hide the default footer which contains the Sign up link */
              footer: "hidden",
              footerActionLink: "hidden",
              /** Cosmetics */
              formFieldInputShowPasswordButton: "text-muted hover:text-white",
              formFieldInputShowPasswordIcon: "text-muted",
              otpCodeFieldInput:
                "bg-[#0b0f1a] border-white/10 text-white focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 rounded-lg h-14",
              dividerLine: "bg-white/10",
              dividerText: "text-muted text-sm",
              alertText: "text-base",
              formFieldErrorText: "text-danger text-sm mt-1",
            },
          }}
        />
      </div>
    </div>
  );
}

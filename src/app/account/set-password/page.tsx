"use client";
import { UserProfile } from "@clerk/nextjs";

export default function SetPasswordPage() {
  return (
    <div className="min-h-screen bg-bg py-10 px-4 flex items-center justify-center relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 40% at 70% 10%, #0ea5e9 0%, transparent 60%), radial-gradient(50% 50% at 20% 20%, #6d28d9 0%, transparent 60%)",
          filter: "blur(60px)",
        }}
      />
      <div className="mx-auto w-full max-w-2xl relative z-10">
        <div className="rounded-3xl border border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl p-6 md:p-10">
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-2">
            Secure Your Account
          </h1>
          <p className="text-muted mb-6">
            Please set a password to continue. You&apos;ll only need to do this
            once.
          </p>
          <UserProfile
            routing="path"
            path="/account"
            appearance={{
              variables: {
                colorPrimary: "#0ea5e9",
                colorText: "#ffffff",
                colorTextSecondary: "#9aa3b2",
                colorBackground: "transparent",
                colorInputBackground: "#0b0f1a",
                colorInputText: "#ffffff",
                borderRadius: "0.75rem",
                fontFamily: "Inter, ui-sans-serif, system-ui",
              },
              elements: {
                rootBox: "w-full",
                card: "bg-transparent border-0 p-0",
                navbar: "hidden",
                profileSection__accountSecurity: "block",
                profileSection__activeDevices: "hidden",
                profileSection__connectedAccounts: "hidden",
                profileSection__emailAddresses: "hidden",
                profileSection__phoneNumbers: "hidden",
                profileSection__mfa: "hidden",
                formButtonPrimary:
                  "bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-black font-medium rounded-lg transition-all shadow-lg shadow-[#0ea5e9]/20 h-12 text-base",
                formFieldInput:
                  "bg-[#0b0f1a] border-white/10 text-white placeholder:text-muted focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 rounded-lg h-12 text-base",
                formFieldLabel: "text-white text-sm font-medium mb-2",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

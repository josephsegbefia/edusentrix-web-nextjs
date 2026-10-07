"use client";
import { UserProfile } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { BrandMark } from "@/components/brand/BrandMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { authPageGlowStyle } from "@/components/auth/auth-surfaces";

export default function SetPasswordPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="m-page relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={authPageGlowStyle}
      />
      <div className="relative z-10 mx-auto w-full max-w-2xl">
        <div className="m-card-strong rounded-3xl p-6 backdrop-blur-xl md:p-10">
          <div className="mb-6 flex items-start justify-between gap-4">
            <BrandMark size="sm" />
            <ThemeToggle />
          </div>
          <h1 className="mb-2 text-2xl font-semibold text-(--m-fg) md:text-3xl">
            Secure Your Account
          </h1>
          <p className="mb-6 m-muted">
            Please set a password to continue. You&apos;ll only need to do this
            once.
          </p>
          <UserProfile
            routing="path"
            path="/account"
            appearance={{
              variables: {
                colorPrimary: "#0ea5e9",
                colorText: isDark ? "#ffffff" : "#0f172a",
                colorTextSecondary: isDark ? "#9aa3b2" : "#64748b",
                colorBackground: "transparent",
                colorInputBackground: isDark ? "#0b0f1a" : "#f8fafc",
                colorInputText: isDark ? "#ffffff" : "#0f172a",
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
                formFieldInput: isDark
                  ? "bg-[#0b0f1a] border-white/10 text-white placeholder:text-muted focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 rounded-lg h-12 text-base"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/20 rounded-lg h-12 text-base",
                formFieldLabel: isDark
                  ? "text-white text-sm font-medium mb-2"
                  : "text-slate-900 text-sm font-medium mb-2",
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

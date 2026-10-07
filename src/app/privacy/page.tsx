import type { Metadata } from "next";
import { authPageGlowStyle } from "@/components/auth/auth-surfaces";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { LegalDocumentBody } from "@/components/legal/LegalDocumentBody";
import { PublicMarketingFooter } from "@/components/marketing/PublicMarketingFooter";
import { PublicMarketingNav } from "@/components/marketing/PublicMarketingNav";
import {
  PRIVACY_POLICY_CONTACT_EMAIL,
  PRIVACY_POLICY_CONTACT_PHONE,
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
} from "@/lib/legal/privacy-policy";

export const metadata: Metadata = {
  title: "Privacy Policy — EduSentrix",
  description:
    "Plain-language privacy policy for EduSentrix School OS and EduSentrix Learn across web and mobile experiences.",
};

export default function PrivacyPage() {
  return (
    <main className="m-page relative min-h-dvh antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={authPageGlowStyle}
      />

      <div className="relative">
        <PublicMarketingNav />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200/80">
              Legal / Privacy Policy
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              <EduSentrixWordmark tone="adaptive" className="text-4xl sm:text-5xl" /> Privacy
            </h1>
          </div>

          <div className="mt-10">
            <LegalDocumentBody
              surface="theme"
              intro={PRIVACY_POLICY_INTRO}
              lastUpdated={PRIVACY_POLICY_LAST_UPDATED}
              sections={PRIVACY_POLICY_SECTIONS}
              contactNote={
                <>
                  Need privacy support? Email{" "}
                  <a
                    className="font-semibold underline decoration-cyan-700/40 dark:decoration-cyan-300/50"
                    href={`mailto:${PRIVACY_POLICY_CONTACT_EMAIL}`}
                  >
                    {PRIVACY_POLICY_CONTACT_EMAIL}
                  </a>{" "}
                  or call{" "}
                  <a
                    className="font-semibold underline decoration-cyan-700/40 dark:decoration-cyan-300/50"
                    href={`tel:${PRIVACY_POLICY_CONTACT_PHONE}`}
                  >
                    {PRIVACY_POLICY_CONTACT_PHONE}
                  </a>
                  .
                </>
              }
            />
          </div>
        </div>
        <PublicMarketingFooter />
      </div>
    </main>
  );
}

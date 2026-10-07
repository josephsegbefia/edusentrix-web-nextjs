import type { Metadata } from "next";
import { authPageGlowStyle } from "@/components/auth/auth-surfaces";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { LegalDocumentBody } from "@/components/legal/LegalDocumentBody";
import { PublicMarketingFooter } from "@/components/marketing/PublicMarketingFooter";
import { PublicMarketingNav } from "@/components/marketing/PublicMarketingNav";
import {
  TERMS_OF_USE_INTRO,
  TERMS_OF_USE_LAST_UPDATED,
  TERMS_OF_USE_SECTIONS,
  TERMS_OF_USE_SUPPORT_EMAIL,
  TERMS_OF_USE_SUPPORT_PHONE,
} from "@/lib/legal/terms-of-use";

export const metadata: Metadata = {
  title: "Terms of Use — EduSentrix",
  description:
    "Plain-language terms for EduSentrix School OS and EduSentrix Learn across web and mobile products.",
};

export default function TermsPage() {
  return (
    <main className="m-page relative min-h-dvh antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={authPageGlowStyle}
      />

      <div className="relative">
        <PublicMarketingNav active="terms" />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200/80">
              Legal / Terms of Use
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              <EduSentrixWordmark tone="adaptive" className="text-4xl sm:text-5xl" /> Terms
            </h1>
          </div>

          <div className="mt-10">
            <LegalDocumentBody
              surface="theme"
              intro={TERMS_OF_USE_INTRO}
              lastUpdated={TERMS_OF_USE_LAST_UPDATED}
              sections={TERMS_OF_USE_SECTIONS}
              contactNote={
                <>
                  Need clarification or legal contact? Email{" "}
                  <a
                    className="font-semibold underline decoration-cyan-700/40 dark:decoration-cyan-300/50"
                    href={`mailto:${TERMS_OF_USE_SUPPORT_EMAIL}`}
                  >
                    {TERMS_OF_USE_SUPPORT_EMAIL}
                  </a>{" "}
                  or call{" "}
                  <a
                    className="font-semibold underline decoration-cyan-700/40 dark:decoration-cyan-300/50"
                    href={`tel:${TERMS_OF_USE_SUPPORT_PHONE}`}
                  >
                    {TERMS_OF_USE_SUPPORT_PHONE}
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

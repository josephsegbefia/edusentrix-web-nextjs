import type { Metadata } from "next";
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
    <main className="min-h-dvh bg-neutral-950 text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-linear-to-br from-slate-950 via-neutral-950 to-black"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(139,92,246,0.18) 0%, transparent 55%), radial-gradient(ellipse 50% 35% at 90% 70%, rgba(6,182,212,0.08) 0%, transparent 50%)",
        }}
      />

      <div className="relative">
        <PublicMarketingNav active="terms" />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
              Legal / Terms of Use
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              <EduSentrixWordmark className="text-4xl sm:text-5xl" /> Terms
            </h1>
          </div>

          <div className="mt-10">
            <LegalDocumentBody
              intro={TERMS_OF_USE_INTRO}
              lastUpdated={TERMS_OF_USE_LAST_UPDATED}
              sections={TERMS_OF_USE_SECTIONS}
              contactNote={
                <>
                  Need clarification or legal contact? Email{" "}
                  <a
                    className="font-semibold underline decoration-cyan-300/50"
                    href={`mailto:${TERMS_OF_USE_SUPPORT_EMAIL}`}
                  >
                    {TERMS_OF_USE_SUPPORT_EMAIL}
                  </a>{" "}
                  or call{" "}
                  <a
                    className="font-semibold underline decoration-cyan-300/50"
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

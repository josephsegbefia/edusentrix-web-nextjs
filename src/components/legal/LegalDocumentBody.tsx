import type { ReactNode } from "react";
import type { LegalSection } from "@/lib/legal/terms-of-use";

type LegalDocumentBodyProps = {
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
  contactNote?: ReactNode;
  compact?: boolean;
};

export function LegalDocumentBody({
  intro,
  lastUpdated,
  sections,
  contactNote,
  compact = false,
}: LegalDocumentBodyProps) {
  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div>
        <p className="text-xs text-white/45">Last updated: {lastUpdated}</p>
        <p
          className={
            compact
              ? "mt-2 text-sm leading-relaxed text-white/65"
              : "mt-4 text-base leading-relaxed text-white/65"
          }
        >
          {intro}
        </p>
      </div>

      <div className={compact ? "space-y-3" : "space-y-4"}>
        {sections.map((section) => (
          <section
            key={section.title}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black p-4 shadow-lg shadow-black/20 backdrop-blur-xl sm:p-5"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
            />
            <h2 className="relative text-base font-semibold tracking-tight text-white sm:text-lg">
              {section.title}
            </h2>
            <ul className="relative mt-3 space-y-2">
              {section.body.map((line) => (
                <li key={line} className="text-sm leading-relaxed text-white/65">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {contactNote ? (
        <section className="rounded-2xl border border-cyan-500/25 bg-cyan-500/8 p-4 text-sm leading-relaxed text-cyan-100/90">
          {contactNote}
        </section>
      ) : null}
    </div>
  );
}

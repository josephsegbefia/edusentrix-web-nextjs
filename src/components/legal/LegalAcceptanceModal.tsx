"use client";

import type { ReactNode } from "react";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { LegalDocumentBody } from "@/components/legal/LegalDocumentBody";
import type { LegalSection } from "@/lib/legal/terms-of-use";

type LegalAcceptanceModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
  contactNote?: ReactNode;
  onAccept: () => void;
  acceptLabel?: string;
};

export function LegalAcceptanceModal({
  open,
  onClose,
  title,
  intro,
  lastUpdated,
  sections,
  contactNote,
  onAccept,
  acceptLabel = "Accept",
}: LegalAcceptanceModalProps) {
  function handleAccept() {
    onAccept();
    onClose();
  }

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title={title}
      widthClass="max-w-5xl lg:max-w-6xl"
    >
      <div className="flex min-h-0 flex-col gap-5">
        <LegalDocumentBody
          intro={intro}
          lastUpdated={lastUpdated}
          sections={sections}
          contactNote={contactNote}
          compact
        />

        <div className="sticky bottom-0 -mx-1 flex shrink-0 flex-col-reverse gap-2 border-t border-white/10 bg-card/95 pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-11 rounded-xl text-white/70 hover:bg-white/5 hover:text-white"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleAccept}
            className="h-11 rounded-xl bg-brand px-6 text-sm font-semibold text-black hover:bg-sky-300"
          >
            {acceptLabel}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}

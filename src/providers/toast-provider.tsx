"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  // Renders once at app root; no children needed
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      expand
      theme="dark" // default to your premium dark; switches with next-themes automatically
      toastOptions={{
        classNames: {
          toast:
            "min-h-[76px] w-[min(92vw,540px)] rounded-2xl border border-border/70 bg-card px-5 py-4 text-card-foreground shadow-elev-100",
          title: "text-base font-bold leading-snug",
          description: "mt-1 text-sm font-semibold leading-relaxed text-muted-foreground",
          closeButton:
            "border-border/70 bg-background text-foreground hover:bg-muted",
          actionButton:
            "rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground shadow-gold-glow",
          cancelButton:
            "rounded-lg border border-input bg-background px-4 py-2 font-bold hover:opacity-90",
        },
      }}
    />
  );
}

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
            "rounded-xl border border-border/60 bg-card text-card-foreground shadow-elev-100",
          title: "font-medium",
          description: "text-muted-foreground",
          actionButton:
            "rounded-lg bg-primary text-primary-foreground shadow-gold-glow",
          cancelButton:
            "rounded-lg bg-background border border-input hover:opacity-90",
        },
      }}
    />
  );
}

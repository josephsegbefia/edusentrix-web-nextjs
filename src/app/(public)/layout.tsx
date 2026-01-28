// src/app/(public)/layout.tsx
/**
 * Layout for public pages that don't require authentication.
 * Used for public donation pages, campaign sharing, etc.
 */
import { Toaster } from "sonner";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen antialiased">
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "rgba(15, 23, 42, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#fff",
          },
        }}
      />
    </div>
  );
}

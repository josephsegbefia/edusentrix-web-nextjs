// src/app/403/page.tsx
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-background">
      <div className="mx-auto max-w-md text-center p-8 rounded-3xl border border-neutral-900 bg-card shadow-[0_10px_40px_-10px_rgba(0,0,0,0.7)]">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 text-red-300 flex items-center justify-center mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold text-neutral-100 mb-2">
          Access denied
        </h1>
        <p className="text-sm text-neutral-400 mb-6">
          You don’t have permission to view this page.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button
            asChild
            variant="secondary"
            className="bg-neutral-900 hover:bg-neutral-800"
          >
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function safeParentNext(value: string | null) {
  if (!value) return "/parent/fees";
  if (!value.startsWith("/parent/")) return "/parent/fees";
  if (value.startsWith("//")) return "/parent/fees";
  return value;
}

function PaystackReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const reference = searchParams.get("reference") || searchParams.get("trxref") || "";
    const next = safeParentNext(searchParams.get("next"));
    const target = new URL(next, window.location.origin);

    if (reference) {
      try {
        window.sessionStorage.setItem("edusentrix:lastPaystackReference", reference);
      } catch {
        // Non-critical; the query param below is the primary handoff.
      }
      target.searchParams.set("checkout", "paystack");
      target.searchParams.set("reference", reference);
    }

    router.replace(`${target.pathname}${target.search}`);
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center shadow-2xl shadow-black/40 backdrop-blur-xl">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-200" />
        <h1 className="mt-4 text-base font-semibold">Returning to EduSentrix</h1>
        <p className="mt-1 text-sm text-white/55">Confirming your payment session.</p>
      </div>
    </main>
  );
}

export default function PaystackReturnPage() {
  return (
    <React.Suspense fallback={null}>
      <PaystackReturnContent />
    </React.Suspense>
  );
}

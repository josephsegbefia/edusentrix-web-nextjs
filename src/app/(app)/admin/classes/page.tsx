"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Redirect /admin/classes to /admin/grades.
 * Grades is the primary view; classes are accessed via grade detail pages.
 */
export default function ClassesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/grades");
  }, [router]);

  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-white/60">
      <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      <p className="text-sm">Redirecting to Grades…</p>
    </div>
  );
}

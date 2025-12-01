"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminDocsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/docs");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-white/60">Redirecting to documentation...</div>
    </div>
  );
}

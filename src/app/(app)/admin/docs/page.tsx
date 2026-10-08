"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export default function AdminDocsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/docs");
  }, [router]);

  return (
    <WorkspaceScope>
      <div className="flex h-screen items-center justify-center">
        <div className="text-(--ws-fg-60)">Redirecting to documentation...</div>
      </div>
    </WorkspaceScope>
  );
}

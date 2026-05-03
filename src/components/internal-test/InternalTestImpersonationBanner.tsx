"use client";

import * as React from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function InternalTestImpersonationBanner(props: {
  displayName: string;
  schoolId: string;
}) {
  const [loading, setLoading] = React.useState(false);

  async function endSession() {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/platform/schools/${props.schoolId}/internal-test/impersonate/end`,
        { method: "POST" }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Could not end session");
      }
      toast.success("Returned to platform operator session.");
      window.location.href = `/platform/schools/${props.schoolId}/internal-test`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to exit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-500/35 bg-violet-950/90 px-4 py-2 text-sm text-violet-50">
      <p>
        Viewing as <strong>{props.displayName}</strong>
        <span className="ml-2 text-violet-200/80">(internal test)</span>
      </p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={loading}
        onClick={() => void endSession()}
        className="gap-2 bg-white/15 text-white hover:bg-white/25"
      >
        <LogOut className="h-4 w-4" />
        Exit view
      </Button>
    </div>
  );
}

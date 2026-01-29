"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TeacherError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Teacher Portal</h1>
        <p className="text-sm text-white/60">
          Something went wrong while loading this section.
        </p>
      </div>

      <Card className="border border-rose-500/40 bg-linear-to-br from-rose-500/15 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-rose-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/20 text-rose-200">
              <AlertTriangle className="h-4 w-4" />
            </span>
            Unable to load the Teacher Portal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-rose-100/80">
          <p>{error?.message || "Please refresh and try again."}</p>
          <Button
            onClick={reset}
            className="bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
          >
            <RefreshCcw className="h-4 w-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

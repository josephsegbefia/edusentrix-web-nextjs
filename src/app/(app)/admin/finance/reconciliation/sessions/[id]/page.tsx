"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  RefreshCw,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReconciliationSession } from "@/hooks/admin/useReconciliationSessions";
import { ReconciliationWizard } from "@/components/admin/fees/reconciliation/ReconciliationWizard";

export default function ReconciliationSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || "");

  const sessionQuery = useReconciliationSession(id, Boolean(id));

  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen p-6 md:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (sessionQuery.error || !sessionQuery.data) {
    return (
      <div className="min-h-screen p-6 md:p-8">
        <div className="mx-auto max-w-4xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/finance/reconciliation/sessions")}
            className="mb-4 text-white/50 hover:text-white/80"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Sessions
          </Button>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
            <Shield className="mx-auto h-10 w-10 text-rose-400/50" />
            <p className="mt-3 text-sm text-rose-300">
              {sessionQuery.error instanceof Error ? sessionQuery.error.message : "Session not found."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void sessionQuery.refetch()}
              className="mt-4 border-white/10 text-white/60 hover:bg-white/10"
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const session = sessionQuery.data;

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/finance/reconciliation/sessions")}
            className="mb-4 text-white/50 hover:text-white/80"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Sessions
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500/20 to-violet-600/20">
              <Shield className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{session.label}</h1>
              <p className="mt-1 text-sm text-white/50">
                {session.status.replace("_", " ")} · {session.sourceTypes.join(", ")}
              </p>
            </div>
          </div>
        </div>

        {/* Wizard */}
        <ReconciliationWizard
          session={session}
          onComplete={() => {
            void sessionQuery.refetch();
            router.push("/admin/finance/reconciliation/sessions");
          }}
          onCancel={() => router.push("/admin/finance/reconciliation/sessions")}
        />
      </div>
    </div>
  );
}

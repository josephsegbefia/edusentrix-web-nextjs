"use client";

import * as React from "react";
import {
  Mail,
  ShieldAlert,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import {
  type AdmissionDelegateDTO,
  useAdmissionDelegate,
  useRevokeAdmissionDelegate,
} from "@/hooks/admissions/useAdmissionDelegate";
import { AssignDelegateModal } from "./AssignDelegateModal";

type DelegationTabProps = {
  isAdmin: boolean;
  /**
   * When provided, the tab delegates opening the assign-delegate modal to the
   * parent so a single shared modal instance lives at the workspace level. If
   * omitted, the tab manages its own modal instance.
   */
  onOpenAssignDelegate?: () => void;
};

function initials(first?: string, last?: string) {
  const f = (first ?? "").trim()[0] ?? "";
  const l = (last ?? "").trim()[0] ?? "";
  return `${f}${l}`.toUpperCase() || "?";
}

export function DelegationTab({
  isAdmin,
  onOpenAssignDelegate,
}: DelegationTabProps) {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { data: delegateData, isLoading } = useAdmissionDelegate();
  const revoke = useRevokeAdmissionDelegate();

  const delegate: AdmissionDelegateDTO = delegateData?.data ?? null;
  const [localAssignOpen, setLocalAssignOpen] = React.useState(false);
  const openAssign = React.useCallback(() => {
    if (onOpenAssignDelegate) onOpenAssignDelegate();
    else setLocalAssignOpen(true);
  }, [onOpenAssignDelegate]);

  const handleRevoke = React.useCallback(async () => {
    if (!delegate) return;
    const ok = await confirm({
      title: "Revoke admissions delegate?",
      description: `${delegate.firstName} ${delegate.lastName} will lose access to the Admissions workspace immediately.`,
      confirmLabel: "Revoke access",
      intent: "destructive",
    });
    if (ok !== "confirm") return;
    try {
      await busy.promise(revoke.mutateAsync(), {
        loading: "Revoking delegate…",
        success: "Delegate revoked.",
        error: (e: Error) => e.message,
      });
    } catch {
      /* handled */
    }
  }, [busy, confirm, delegate, revoke]);

  return (
    <>
      <section className="space-y-6">
        <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/80 p-6">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
                Admissions delegation
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                Who manages admissions
              </h3>
              <p className="mt-2 max-w-xl text-sm text-white/55">
                Delegate day-to-day admissions to a teacher you trust. The
                school admin still sees everything, can override decisions, and
                can revoke access at any time.
              </p>
            </div>
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan-200 sm:flex">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6">
            {isLoading ? (
              <div className="rounded-2xl border border-white/10 bg-black/10 p-6 text-sm text-white/55">
                Loading delegate…
              </div>
            ) : delegate ? (
              <div className="flex flex-col gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    {delegate.photoUrl ? (
                      <AvatarImage
                        src={delegate.photoUrl}
                        alt={delegate.firstName}
                      />
                    ) : null}
                    <AvatarFallback>
                      {initials(delegate.firstName, delegate.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold text-white">
                        {delegate.firstName} {delegate.lastName}
                      </p>
                      <Badge
                        variant="outline"
                        className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                      >
                        Current delegate
                      </Badge>
                    </div>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-white/55">
                      <Mail className="h-3.5 w-3.5" />
                      {delegate.email}
                    </p>
                  </div>
                </div>
                {isAdmin ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={openAssign}
                    >
                      <Users className="h-4 w-4" />
                      Replace
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 border-rose-500/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                      onClick={handleRevoke}
                      disabled={revoke.isPending}
                    >
                      <UserMinus className="h-4 w-4" />
                      Revoke
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/10 p-8 text-center">
                <ShieldAlert className="mx-auto h-9 w-9 text-white/35" />
                <p className="mt-3 text-base font-semibold text-white">
                  No delegate assigned
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm text-white/55">
                  Without a delegate, only school admins can manage admissions.
                  Assign a teacher to share the workload.
                </p>
                {isAdmin ? (
                  <Button
                    type="button"
                    className="mt-5 gap-2"
                    onClick={openAssign}
                  >
                    <UserPlus className="h-4 w-4" />
                    Assign a teacher
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>

      {isAdmin && !onOpenAssignDelegate ? (
        <AssignDelegateModal
          open={localAssignOpen}
          onOpenChange={setLocalAssignOpen}
          currentDelegate={delegate}
        />
      ) : null}
      {confirmationDialog}
    </>
  );
}

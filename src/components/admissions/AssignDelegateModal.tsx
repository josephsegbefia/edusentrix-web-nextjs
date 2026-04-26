"use client";

import * as React from "react";
import {
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Modal } from "@/components/ui/responsive-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import {
  type AdmissionDelegateDTO,
  useAssignAdmissionDelegate,
  useTeacherPicker,
} from "@/hooks/admissions/useAdmissionDelegate";

type AssignDelegateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDelegate: AdmissionDelegateDTO;
};

function initials(first?: string, last?: string) {
  const f = (first ?? "").trim()[0] ?? "";
  const l = (last ?? "").trim()[0] ?? "";
  return `${f}${l}`.toUpperCase() || "?";
}

export function AssignDelegateModal({
  open,
  onOpenChange,
  currentDelegate,
}: AssignDelegateModalProps) {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const assign = useAssignAdmissionDelegate();

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setSearch("");
    setDebounced("");
  }, [open]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  const teacherQuery = useTeacherPicker(debounced);
  const teachers = teacherQuery.data?.data ?? [];

  const handleAssign = React.useCallback(
    async (teacherId: string, name: string) => {
      const ok = await confirm({
        title: currentDelegate
          ? "Replace current delegate?"
          : "Assign as delegate?",
        description: currentDelegate
          ? `${currentDelegate.firstName} ${currentDelegate.lastName} will lose admissions access. ${name} will be able to manage admissions for the school.`
          : `${name} will see an Admissions tab on their sidebar and can manage applications, decisions, and the form on your behalf.`,
        confirmLabel: currentDelegate ? "Replace delegate" : "Assign delegate",
      });
      if (ok !== "confirm") return;
      try {
        await busy.promise(assign.mutateAsync({ teacherId }), {
          loading: "Assigning delegate…",
          success: "Delegate assigned.",
          error: (e: Error) => e.message,
        });
        onOpenChange(false);
      } catch {
        /* handled */
      }
    },
    [assign, busy, confirm, currentDelegate, onOpenChange]
  );

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={
          currentDelegate ? "Replace admissions delegate" : "Assign a teacher"
        }
        description={
          currentDelegate
            ? "Pick another teacher to take over admissions. The current delegate will lose access immediately."
            : "Choose an active teacher who will manage admissions for the school. You can replace or revoke them at any time."
        }
        className="sm:max-w-2xl"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              type="search"
              placeholder="Search active teachers by name or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          <div className="max-h-[55vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/20">
            {teacherQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-white/55">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading teachers…
              </div>
            ) : teachers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-10 text-center">
                <ShieldAlert className="h-7 w-7 text-white/35" />
                <p className="text-sm font-medium text-white">
                  No teachers match this search
                </p>
                <p className="max-w-sm text-xs text-white/55">
                  Try a different name or email. Only active teachers can be
                  delegated.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {teachers.map((t) => {
                  const isCurrent =
                    currentDelegate && currentDelegate.teacherId === t._id;
                  const fullName = `${t.firstName} ${t.lastName}`.trim();
                  return (
                    <li
                      key={t._id}
                      className="flex items-center justify-between gap-3 p-3 sm:p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-10 w-10">
                          {t.photoUrl ? (
                            <AvatarImage src={t.photoUrl} alt={t.firstName} />
                          ) : null}
                          <AvatarFallback>
                            {initials(t.firstName, t.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {fullName || "Teacher"}
                          </p>
                          <p className="truncate text-xs text-white/50">
                            {t.email}
                          </p>
                        </div>
                      </div>
                      {isCurrent ? (
                        <Badge
                          variant="outline"
                          className="gap-1.5 border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          Current
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="gap-2"
                          disabled={assign.isPending}
                          onClick={() => handleAssign(t._id, fullName)}
                        >
                          <UserPlus className="h-4 w-4" />
                          {currentDelegate ? "Replace" : "Assign"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
      {confirmationDialog}
    </>
  );
}

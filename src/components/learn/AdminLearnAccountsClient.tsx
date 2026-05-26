"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound, Loader2, Lock, RefreshCcw, Send, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type AccountRow = {
  id: string;
  studentId: string;
  studentName: string;
  admissionNo: string | null;
  gradeName: string | null;
  classGroupName: string | null;
  username: string;
  status: string;
  mustChangePassword: boolean;
  credentialsDeliveredAt: string | null;
  access: { source: string; status: string; expiresAt: string } | null;
};

type CredentialResult = {
  studentName: string;
  username: string;
  temporaryPassword?: string;
  guardiansNotified: number;
};

type ApiResponse =
  | { success: true; data: { accounts: AccountRow[] } }
  | { success: false; error: string };

function shortDate(value: string | null) {
  if (!value) return "Not delivered";
  return new Intl.DateTimeFormat("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function AdminLearnAccountsClient() {
  const [accounts, setAccounts] = React.useState<AccountRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [workingId, setWorkingId] = React.useState<string | null>(null);
  const [credentialResult, setCredentialResult] = React.useState<CredentialResult | null>(null);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/learn/accounts", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "Failed to load accounts." : payload.error);
      }
      setAccounts(payload.data.accounts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function postAction(accountId: string, action: "reset-password" | "resend-credentials") {
    setWorkingId(accountId);
    try {
      const response = await fetch(`/api/admin/learn/accounts/${accountId}/${action}`, {
        method: "POST",
      });
      const payload = (await response.json()) as
        | { success: true; data: CredentialResult }
        | { success: false; error: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "Action failed." : payload.error);
      }
      setCredentialResult(payload.data);
      toast.success(action === "reset-password" ? "Password reset" : "Credentials resent");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setWorkingId(null);
    }
  }

  async function updateStatus(account: AccountRow, action: "disable" | "enable") {
    const result = await confirm({
      title: action === "disable" ? "Disable Learn account?" : "Enable Learn account?",
      description:
        action === "disable"
          ? "This will disable the student Learn account and revoke any active Learn access for this account."
          : "This will reactivate the account in first-login pending state. It will not grant Learn access.",
      confirmLabel: action === "disable" ? "Disable account" : "Enable account",
      intent: action === "disable" ? "destructive" : "default",
    });
    if (result !== "confirm") return;

    setWorkingId(account.id);
    try {
      const response = await fetch(`/api/admin/learn/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "disable"
            ? { action, reason: "Disabled by school admin" }
            : { action }
        ),
      });
      const payload = (await response.json()) as
        | { success: true }
        | { success: false; error: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "Update failed." : payload.error);
      }
      toast.success(action === "disable" ? "Learn account disabled" : "Learn account enabled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="Learn accounts"
          subtitle="Manage student Learn accounts, access status, and credential delivery."
          icon={KeyRound}
          backHref="/admin/learn"
          backLabel="Back to Learn"
          actions={
            <Button asChild className="rounded-xl bg-teal-400 text-slate-950 hover:bg-teal-300">
              <Link href="/admin/learn/eligible-students">Create accounts</Link>
            </Button>
          }
        />

        {credentialResult ? (
          <GlassPanel className="p-5" glow="teal">
            <p className="font-semibold text-white">One-time credential result</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Info label="Student" value={credentialResult.studentName} />
              <Info label="Username" value={credentialResult.username} />
              <Info
                label="Temporary password"
                value={credentialResult.temporaryPassword || "Not resent"}
              />
            </div>
            <p className="mt-3 text-sm text-white/55">
              Guardians notified: {credentialResult.guardiansNotified}. Temporary passwords are
              shown only once and are never stored in plain text.
            </p>
          </GlassPanel>
        ) : null}

        <GlassPanel className="p-6" glow="both">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-white/55">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Learn accounts...
            </p>
          ) : accounts.length ? (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div key={account.id} className={cn(glassInsetClass, "p-4")}>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <p className="font-semibold text-white">{account.studentName}</p>
                      <p className="mt-1 text-sm text-white/50">
                        {[account.gradeName, account.classGroupName, account.admissionNo]
                          .filter(Boolean)
                          .join(" - ")}
                      </p>
                    </div>
                    <div className="grid gap-3 text-sm md:grid-cols-4 xl:min-w-[720px]">
                      <Info label="Username" value={account.username} />
                      <Info label="Status" value={account.status.replace(/_/g, " ")} />
                      <Info
                        label="Access"
                        value={account.access ? `Active until ${shortDate(account.access.expiresAt)}` : "No active access"}
                      />
                      <Info label="Credentials" value={shortDate(account.credentialsDeliveredAt)} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={workingId === account.id}
                        onClick={() => postAction(account.id, "reset-password")}
                        className="rounded-xl bg-teal-400 text-slate-950 hover:bg-teal-300 disabled:opacity-50"
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={workingId === account.id}
                        onClick={() => postAction(account.id, "resend-credentials")}
                        className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-50"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Resend
                      </Button>
                      {account.status === "disabled" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={workingId === account.id}
                          onClick={() => updateStatus(account, "enable")}
                          className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-50"
                        >
                          <Unlock className="mr-2 h-4 w-4" />
                          Enable
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={workingId === account.id}
                          onClick={() => updateStatus(account, "disable")}
                          className="rounded-xl border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15 disabled:opacity-50"
                        >
                          <Lock className="mr-2 h-4 w-4" />
                          Disable
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
              No Learn accounts have been created yet.
            </p>
          )}
        </GlassPanel>
        {confirmationDialog}
      </WorkspacePageShell>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p className="mt-1 capitalize text-white/80">{value}</p>
    </div>
  );
}

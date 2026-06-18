"use client";

import * as React from "react";
import { Loader2, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Input } from "@/components/ui/input";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type EligibleStudent = {
  id: string;
  fullName: string;
  admissionNo: string | null;
  photoUrl: string | null;
  gradeName: string | null;
  classGroupName: string | null;
  guardianCount: number;
  account: {
    id: string;
    username: string;
    status: string;
    mustChangePassword: boolean;
    credentialsDeliveredAt: string | null;
  } | null;
};

type EligibleStudentsPayload = {
  eligibility: {
    eligible: boolean;
    reason?: string;
    planCode?: string | null;
    planName?: string | null;
    hasLessonFeatures: boolean;
  };
  gradeRange: string;
  students: EligibleStudent[];
  summary: {
    eligibleStudents: number;
    withAccounts: number;
    withoutAccounts: number;
    withGuardians: number;
    eligibleGradeCount: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type CreatedCredential = {
  accountId: string;
  studentId: string;
  studentName: string;
  username: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
  guardiansNotified: number;
};

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function credentialKey(row: CreatedCredential) {
  return `${row.studentId}:${row.username}`;
}

export function AdminEligibleStudentsClient() {
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [data, setData] = React.useState<EligibleStudentsPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState<string | null>(null);
  const [bulkCreating, setBulkCreating] = React.useState(false);
  const [bulkCreatingAll, setBulkCreatingAll] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [credentials, setCredentials] = React.useState<CreatedCredential[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/admin/learn/eligible-students?${params}`);
      const payload = (await response.json()) as ApiResponse<EligibleStudentsPayload>;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success ? "Failed to load eligible students." : payload.error
        );
      }
      setData(payload.data);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load eligible students."
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function createSingle(studentId: string) {
    setCreating(studentId);
    try {
      const response = await fetch("/api/admin/learn/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const payload = (await response.json()) as ApiResponse<CreatedCredential>;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success ? "Failed to create Learn account." : payload.error
        );
      }
      setCredentials((current) => {
        const existing = new Set(current.map(credentialKey));
        return existing.has(credentialKey(payload.data))
          ? current
          : [payload.data, ...current];
      });
      toast.success("Learn account created.");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create Learn account."
      );
    } finally {
      setCreating(null);
    }
  }

  async function createBulk() {
    const studentIds = Array.from(selectedIds);
    if (!studentIds.length) return;

    setBulkCreating(true);
    try {
      const response = await fetch("/api/admin/learn/accounts/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds }),
      });
      const payload = (await response.json()) as ApiResponse<{
        results: Array<
          | { studentId: string; success: true; data: CreatedCredential }
          | { studentId: string; success: false; error: string }
        >;
        created: number;
        failed: number;
      }>;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success ? "Failed to bulk create accounts." : payload.error
        );
      }
      const created = payload.data.results
        .filter(
          (row): row is { studentId: string; success: true; data: CreatedCredential } =>
            row.success
        )
        .map((row) => row.data);
      setCredentials((current) => {
        const existing = new Set(current.map(credentialKey));
        const next = created.filter((row) => !existing.has(credentialKey(row)));
        return [...next, ...current];
      });
      toast.success(
        `Created ${payload.data.created} Learn account${
          payload.data.created === 1 ? "" : "s"
        }.`
      );
      if (payload.data.failed) {
        toast.error(
          `${payload.data.failed} account${
            payload.data.failed === 1 ? "" : "s"
          } could not be created.`
        );
      }
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to bulk create accounts."
      );
    } finally {
      setBulkCreating(false);
    }
  }

  async function createBulkAll() {
    const withoutAccounts = data?.summary.withoutAccounts ?? 0;
    if (!withoutAccounts) return;

    const result = await confirm({
      title: "Enable Learn for all eligible students?",
      description: `This will create Learn accounts for ${withoutAccounts} student${
        withoutAccounts === 1 ? "" : "s"
      } in ${data?.gradeRange || "the eligible grade range"} who do not already have accounts. One-time passwords will appear on this page after creation.`,
      confirmLabel: "Enable all",
      intent: "default",
    });
    if (result !== "confirm") return;

    setBulkCreatingAll(true);
    try {
      const response = await fetch("/api/admin/learn/accounts/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allEligible: true }),
      });
      const payload = (await response.json()) as ApiResponse<{
        results: Array<
          | { studentId: string; success: true; data: CreatedCredential }
          | { studentId: string; success: false; error: string }
        >;
        created: number;
        failed: number;
        requested: number;
      }>;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success ? "Failed to enable all eligible accounts." : payload.error
        );
      }
      const created = payload.data.results
        .filter(
          (row): row is { studentId: string; success: true; data: CreatedCredential } =>
            row.success
        )
        .map((row) => row.data);
      setCredentials((current) => {
        const existing = new Set(current.map(credentialKey));
        const next = created.filter((row) => !existing.has(credentialKey(row)));
        return [...next, ...current];
      });
      toast.success(
        `Enabled ${payload.data.created} Learn account${
          payload.data.created === 1 ? "" : "s"
        } for eligible students.`
      );
      if (payload.data.failed) {
        toast.error(
          `${payload.data.failed} account${
            payload.data.failed === 1 ? "" : "s"
          } could not be created.`
        );
      }
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to enable all eligible accounts."
      );
    } finally {
      setBulkCreatingAll(false);
    }
  }

  const students = data?.students || [];
  const selectedCount = selectedIds.size;
  const selectableStudents = students.filter((student) => !student.account);
  const allPageSelected =
    selectableStudents.length > 0 &&
    selectableStudents.every((student) => selectedIds.has(student.id));

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="Eligible Learn Students"
          subtitle={
            data?.gradeRange
              ? `Create EduSentrix Learn accounts for active students in ${data.gradeRange}. Parent payments and school fees remain separate.`
              : "Create EduSentrix Learn accounts for active students in this school. Parent payments and school fees remain separate."
          }
          backHref="/admin/learn"
          backLabel="Learn overview"
          icon={Users}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={
                  !data?.summary.withoutAccounts || bulkCreatingAll || bulkCreating
                }
                onClick={() => void createBulkAll()}
                className="rounded-xl bg-teal-400 text-slate-950 hover:bg-teal-300"
              >
                {bulkCreatingAll ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Users className="mr-2 h-4 w-4" />
                )}
                Enable all eligible
              </Button>
              <Button
                type="button"
                disabled={!selectedCount || bulkCreating || bulkCreatingAll}
                onClick={() => void createBulk()}
                variant="outline"
                className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                {bulkCreating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Create selected ({selectedCount})
              </Button>
            </div>
          }
        />

        {data ? (
          <div className="grid gap-4 md:grid-cols-4">
            <Metric label="Eligible" value={data.summary.eligibleStudents} />
            <Metric label="With accounts" value={data.summary.withAccounts} />
            <Metric label="Without accounts" value={data.summary.withoutAccounts} />
            <Metric label="With guardians" value={data.summary.withGuardians} />
          </div>
        ) : null}

        {data && !data.eligibility.eligible ? (
          <GlassPanel className="p-6" glow="cyan">
            <h2 className="text-lg font-semibold text-white">Learn unavailable</h2>
            <p className="mt-2 text-sm text-white/60">
              {data.eligibility.reason || "This school is not eligible for Learn."}
            </p>
          </GlassPanel>
        ) : null}

        {data && data.eligibility.eligible && data.summary.eligibleGradeCount === 0 ? (
          <GlassPanel className="p-6" glow="amber">
            <h2 className="text-lg font-semibold text-white">No matching grades found</h2>
            <p className="mt-2 text-sm text-white/60">
              Learn eligibility requires active grades named or coded as Primary 4 / Grade 4
              through JHS 3. Add or rename grades in your school setup, then return here.
            </p>
          </GlassPanel>
        ) : null}

        {confirmationDialog}

        {credentials.length > 0 ? (
          <GlassPanel className="space-y-4 p-6" glow="both">
            <div>
              <h2 className="text-lg font-semibold text-white">
                One-time temporary passwords
              </h2>
              <p className="mt-1 text-sm text-amber-100/80">
                These passwords are only returned at creation time. They are not
                stored in notifications or audit logs.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {credentials.map((row) => (
                <div key={credentialKey(row)} className={cn(glassInsetClass, "p-4")}>
                  <p className="font-medium text-white">{row.studentName}</p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-white/45">Username</dt>
                      <dd className="font-mono text-teal-100">{row.username}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-white/45">Temporary password</dt>
                      <dd className="font-mono text-amber-100">
                        {row.temporaryPassword}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-white/45">Guardians notified</dt>
                      <dd className="text-white/75">{row.guardiansNotified}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </GlassPanel>
        ) : null}

        <GlassPanel className="space-y-4 p-6" glow="teal">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void load();
                }}
                placeholder="Search by name or admission number"
                className="rounded-xl border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/35"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Search
            </Button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-white/50">
              Loading eligible students...
            </div>
          ) : students.length ? (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-white/40">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <Checkbox
                        checked={allPageSelected}
                        disabled={!selectableStudents.length}
                        onCheckedChange={(next) => {
                          setSelectedIds((current) => {
                            const copy = new Set(current);
                            if (next) {
                              selectableStudents.forEach((student) => copy.add(student.id));
                            } else {
                              selectableStudents.forEach((student) => copy.delete(student.id));
                            }
                            return copy;
                          });
                        }}
                      />
                    </th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Guardians</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {students.map((student) => {
                    const checked = selectedIds.has(student.id);
                    const creatingThis = creating === student.id;
                    return (
                      <tr key={student.id} className="bg-black/10">
                        <td className="px-4 py-4">
                          <Checkbox
                            checked={checked}
                            disabled={Boolean(student.account)}
                            onCheckedChange={(next) => {
                              setSelectedIds((current) => {
                                const copy = new Set(current);
                                if (next) copy.add(student.id);
                                else copy.delete(student.id);
                                return copy;
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-white">{student.fullName}</p>
                          <p className="text-xs text-white/45">
                            {student.admissionNo || "No admission number"}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-white/70">
                          {[student.gradeName, student.classGroupName]
                            .filter(Boolean)
                            .join(" ") || "Unassigned"}
                        </td>
                        <td className="px-4 py-4 text-white/70">
                          {student.guardianCount}
                        </td>
                        <td className="px-4 py-4">
                          {student.account ? (
                            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-100">
                              {student.account.status.replace(/_/g, " ")}
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-100">
                              No account
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button
                            type="button"
                            size="sm"
                            disabled={Boolean(student.account) || creatingThis}
                            onClick={() => void createSingle(student.id)}
                            className="rounded-xl bg-teal-400 text-slate-950 hover:bg-teal-300"
                          >
                            {creatingThis ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <UserPlus className="mr-2 h-4 w-4" />
                            )}
                            Create
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 py-12 text-center">
              <p className="font-medium text-white">No eligible students found.</p>
              <p className="mt-1 text-sm text-white/50">
                Students must be active, assigned to a class group, and in{" "}
                {data?.gradeRange || "Primary 4 / Grade 4 through JHS 3"}.
              </p>
            </div>
          )}
        </GlassPanel>
      </WorkspacePageShell>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <GlassPanel className="p-4" glow="cyan">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </GlassPanel>
  );
}

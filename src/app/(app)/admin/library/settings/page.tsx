"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, BookOpenCheck, Loader2, RotateCcw, Settings2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useLibrarySettingsQuery,
  useLibraryBookMutations,
  useLibraryCapabilitiesQuery,
} from "@/hooks/admin/useLibraryAdmin";
import type { z } from "zod";
import type { updateLibrarySettingsSchema } from "@/lib/library/library.validators";
import {
  LibraryBackLink,
  libraryGlassPanel,
  LibraryPageHeader,
  LibraryPageShell,
} from "@/components/admin/library/LibraryAdminChrome";

const SettingsFormReadOnlyContext = React.createContext(false);

type LibrarySettingsForm = z.infer<typeof updateLibrarySettingsSchema>;

export default function AdminLibrarySettingsPage() {
  const { data, isLoading } = useLibrarySettingsQuery();
  const settings = data?.data;
  const { patchSettings } = useLibraryBookMutations();
  const { data: capsRes } = useLibraryCapabilitiesQuery();
  const readOnlySettings = !(capsRes?.data?.settingsManage ?? false);

  const [form, setForm] = React.useState<LibrarySettingsForm | null>(null);

  React.useEffect(() => {
    if (!settings) return;
    setForm({
      defaultLoanDaysStudent: Number(settings.defaultLoanDaysStudent),
      defaultLoanDaysTeacher: Number(settings.defaultLoanDaysTeacher),
      defaultLoanDaysStaff: Number(settings.defaultLoanDaysStaff),
      maxBooksPerStudent: Number(settings.maxBooksPerStudent),
      maxBooksPerTeacher: Number(settings.maxBooksPerTeacher),
      maxBooksPerStaff: Number(settings.maxBooksPerStaff),
      allowRenewals: Boolean(settings.allowRenewals),
      maxRenewals: Number(settings.maxRenewals),
      renewalDays: Number(settings.renewalDays),
      enableFines: Boolean(settings.enableFines),
      finePerDay: Number(settings.finePerDay),
      graceDaysAfterDueDate: Number(settings.graceDaysAfterDueDate),
      enableReplacementFees: Boolean(settings.enableReplacementFees),
      notifyBeforeDueDate: Boolean(settings.notifyBeforeDueDate),
      dueReminderDaysBefore: Number(settings.dueReminderDaysBefore),
      notifyOnDueDate: Boolean(settings.notifyOnDueDate),
      notifyAfterOverdue: Boolean(settings.notifyAfterOverdue),
      overdueReminderFrequencyDays: Number(settings.overdueReminderFrequencyDays),
      notifyParentsForStudentOverdue: Boolean(settings.notifyParentsForStudentOverdue),
      notifyTeachersForTeacherOverdue: Boolean(settings.notifyTeachersForTeacherOverdue),
    });
  }, [settings]);

  function set<K extends keyof LibrarySettingsForm>(key: K, value: LibrarySettingsForm[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function save() {
    if (!form) return;
    try {
      await patchSettings.mutateAsync(form);
      toast.success("Library settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <LibraryPageShell>
      <LibraryBackLink href="/admin/library" label="Library home" />
      <LibraryPageHeader
        icon={Settings2}
        title="Library settings"
        description="Configure loan defaults, borrowing limits, renewal rules, fines, and reminder preferences before circulation goes live."
      />

      {readOnlySettings ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
          View-only: your delegation does not include library settings changes.
        </p>
      ) : null}

      {isLoading || !form ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-white/40" />
        </div>
      ) : (
        <SettingsFormReadOnlyContext.Provider value={readOnlySettings}>
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
          <section className={`${libraryGlassPanel} space-y-4 p-5`}>
            <SectionTitle icon={BookOpenCheck} title="Loan duration" description="Default number of days a borrower keeps a book." />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Students"
                value={form.defaultLoanDaysStudent}
                onChange={(n) => set("defaultLoanDaysStudent", n)}
              />
              <Field
                label="Teachers"
                value={form.defaultLoanDaysTeacher}
                onChange={(n) => set("defaultLoanDaysTeacher", n)}
              />
              <Field
                label="Staff"
                value={form.defaultLoanDaysStaff}
                onChange={(n) => set("defaultLoanDaysStaff", n)}
              />
            </div>
          </section>

          <section className={`${libraryGlassPanel} space-y-4 p-5`}>
            <SectionTitle icon={ShieldCheck} title="Borrowing limits" description="Maximum active books allowed by borrower type." />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Max books / student"
                value={form.maxBooksPerStudent}
                onChange={(n) => set("maxBooksPerStudent", n)}
              />
              <Field
                label="Max books / teacher"
                value={form.maxBooksPerTeacher}
                onChange={(n) => set("maxBooksPerTeacher", n)}
              />
              <Field
                label="Max books / staff"
                value={form.maxBooksPerStaff}
                onChange={(n) => set("maxBooksPerStaff", n)}
              />
            </div>
          </section>

          <section className={`${libraryGlassPanel} space-y-4 p-5`}>
            <SectionTitle icon={RotateCcw} title="Renewals" description="Control whether borrowers can extend a loan." />
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/10 px-4 py-3">
              <span className="text-sm text-white/80">Allow renewals</span>
              <Switch
                checked={form.allowRenewals}
                onCheckedChange={(v) => set("allowRenewals", v)}
                disabled={readOnlySettings}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Max renewals" value={form.maxRenewals} onChange={(n) => set("maxRenewals", n)} />
              <Field label="Renewal days" value={form.renewalDays} onChange={(n) => set("renewalDays", n)} />
            </div>
          </section>
          </div>

          <aside className="space-y-6">
          <section className={`${libraryGlassPanel} space-y-4 p-5`}>
            <SectionTitle icon={ShieldCheck} title="Fines" description="Daily fine and replacement fee defaults." />
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/10 px-4 py-3">
              <span className="text-sm text-white/80">Enable daily fines</span>
              <Switch
                checked={form.enableFines}
                onCheckedChange={(v) => set("enableFines", v)}
                disabled={readOnlySettings}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Fine per day"
                value={form.finePerDay}
                onChange={(n) => set("finePerDay", n)}
              />
              <Field
                label="Grace days after due"
                value={form.graceDaysAfterDueDate}
                onChange={(n) => set("graceDaysAfterDueDate", n)}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/10 px-4 py-3">
              <span className="text-sm text-white/80">Replacement fees</span>
              <Switch
                checked={form.enableReplacementFees}
                onCheckedChange={(v) => set("enableReplacementFees", v)}
                disabled={readOnlySettings}
              />
            </div>
          </section>

          <section className={`${libraryGlassPanel} space-y-4 p-5`}>
            <SectionTitle icon={Bell} title="Notifications" description="Future reminder sends for due dates and overdue items." />
            <div className="space-y-3">
              <ToggleRow
                label="Remind before due date"
                checked={form.notifyBeforeDueDate}
                onCheckedChange={(v) => set("notifyBeforeDueDate", v)}
              />
              <Field
                label="Days before due"
                value={form.dueReminderDaysBefore}
                onChange={(n) => set("dueReminderDaysBefore", n)}
              />
              <ToggleRow
                label="Notify on due date"
                checked={form.notifyOnDueDate}
                onCheckedChange={(v) => set("notifyOnDueDate", v)}
              />
              <ToggleRow
                label="Notify when overdue"
                checked={form.notifyAfterOverdue}
                onCheckedChange={(v) => set("notifyAfterOverdue", v)}
              />
              <Field
                label="Overdue reminder frequency (days)"
                value={form.overdueReminderFrequencyDays}
                onChange={(n) => set("overdueReminderFrequencyDays", n)}
              />
              <ToggleRow
                label="Email parents (student overdue)"
                checked={form.notifyParentsForStudentOverdue}
                onCheckedChange={(v) => set("notifyParentsForStudentOverdue", v)}
              />
              <ToggleRow
                label="Notify teachers (teacher overdue)"
                checked={form.notifyTeachersForTeacherOverdue}
                onCheckedChange={(v) => set("notifyTeachersForTeacherOverdue", v)}
              />
            </div>
          </section>

          <div className="rounded-2xl border border-white/10 bg-linear-to-r from-white/5 to-transparent p-4 shadow-lg shadow-black/20 backdrop-blur-xl">
            <Button
              onClick={() => void save()}
              disabled={readOnlySettings || patchSettings.isPending}
              className="w-full bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700"
            >
              {patchSettings.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save settings"
              )}
            </Button>
          </div>
          </aside>
        </div>
        </SettingsFormReadOnlyContext.Provider>
      )}
    </LibraryPageShell>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-400/10">
        <Icon className="h-4 w-4 text-cyan-200" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-white/50">{description}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const readOnly = React.useContext(SettingsFormReadOnlyContext);
  return (
    <div className="space-y-2">
      <Label className="text-white/80">{label}</Label>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="border-white/15 bg-white/[0.05] text-white"
        disabled={readOnly}
      />
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  const readOnly = React.useContext(SettingsFormReadOnlyContext);
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/10 px-4 py-3">
      <span className="text-sm text-white/80">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={readOnly} />
    </div>
  );
}

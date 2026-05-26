import { BookOpenCheck, CheckCircle2, CircleAlert, CreditCard, ShieldCheck } from "lucide-react";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { getSchoolLearnEligibility } from "@/lib/learn/eligibility";
import { getOrCreateLearnPlatformSettings } from "@/lib/learn/platform-settings";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

export default async function AdminLearnSettingsPage() {
  const ctx = await requireSchoolAdmin();
  const [eligibility, settings] = await Promise.all([
    getSchoolLearnEligibility(ctx.schoolId),
    getOrCreateLearnPlatformSettings(),
  ]);

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="Learn settings"
          subtitle="School-facing EduSentrix Learn rules, pricing visibility, and eligibility status."
          iconName="book-open-check"
          backHref="/admin/learn"
          backLabel="Back to Learn"
        />

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <GlassPanel className="p-6" glow="teal">
            <div className="flex items-center gap-3">
              {eligibility.eligible ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-200" />
              ) : (
                <CircleAlert className="h-5 w-5 text-amber-200" />
              )}
              <h2 className="text-lg font-semibold text-white">School eligibility</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/60">
              {eligibility.eligible
                ? "This school can provision EduSentrix Learn accounts for active students with grade and class group placement."
                : eligibility.reason || "This school is not currently eligible for EduSentrix Learn."}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <SettingPill label="Plan" value={eligibility.planName || eligibility.planCode || "Unknown"} />
              <SettingPill
                label="Lesson features"
                value={eligibility.hasLessonFeatures ? "Available" : "Not available"}
              />
            </div>
          </GlassPanel>

          <GlassPanel className="p-6" glow="both">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-teal-200" />
              <h2 className="text-lg font-semibold text-white">Parent payment policy</h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <SettingPill
                label="Price per student per term"
                value={money(settings.pricePerStudentPerTermMinor, settings.currency)}
              />
              <SettingPill label="Currency" value={settings.currency} />
              <SettingPill
                label="Platform gifts"
                value={settings.allowPlatformGifts ? "Allowed" : "Disabled"}
              />
              <SettingPill
                label="Starter plan"
                value={settings.starterPlanBlocked ? "Blocked" : "Allowed"}
              />
            </div>
            <p className="mt-5 text-sm leading-6 text-white/55">
              Pricing and global Learn policy are managed by platform operators. Parent Learn
              payments stay separate from school fees and are not included in school invoices.
            </p>
          </GlassPanel>
        </div>

        <GlassPanel className="p-6" glow="cyan">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-cyan-200" />
            <h2 className="text-lg font-semibold text-white">Credential safety</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <SafetyItem text="Temporary passwords are stored only as hashes." />
            <SafetyItem text="Parents see Learn credential status only for linked wards." />
            <SafetyItem text="Payment and access records are scoped to this school and student." />
          </div>
        </GlassPanel>
      </WorkspacePageShell>
    </div>
  );
}

function SettingPill({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(glassInsetClass, "p-4")}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function SafetyItem({ text }: { text: string }) {
  return (
    <div className={cn(glassInsetClass, "p-4 text-sm leading-6 text-white/65")}>{text}</div>
  );
}

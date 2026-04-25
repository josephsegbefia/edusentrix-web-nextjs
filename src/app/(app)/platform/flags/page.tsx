import Link from "next/link";
import { ArrowRight, Flag, LayoutTemplate, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { connectToDatabase } from "@/db/connectToDatabase";
import { formatMoney } from "@/lib/fees/money";
import {
  isTeacherStudioEnvEnabled,
} from "@/lib/features/teacherStudio";
import { isLeoCopilotServerRuntimeEnabled } from "@/lib/leo/runtime";
import { LeoIcon } from "@/components/icons/LeoIcon";
import {
  isTimetableAdminPlannerEnabled,
  isTimetableApiWriteEnabled,
  isTimetableDualWriteEnabled,
  isTimetablePublishWorkflowEnabled,
  isTimetableRebootEnabled,
  isTimetableRoleReadViewsEnabled,
} from "@/lib/timetable/feature-flags";
import { SchoolSettings } from "@/models/SchoolSettings";
import { SubscriptionTier } from "@/models/SubscriptionTier";
import {
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformPageHeader,
  PlatformPill,
  PlatformSection,
} from "@/components/platform/platform-page-primitives";

export const dynamic = "force-dynamic";

export default async function PlatformFlagsPage() {
  await connectToDatabase();

  const runtimeFlags = [
    {
      key: "feature_timetable_reboot_enabled",
      enabled: isTimetableRebootEnabled(),
      scope: "Global runtime",
      note: "Enables the timetable reboot feature set.",
    },
    {
      key: "feature_timetable_dual_write_enabled",
      enabled: isTimetableDualWriteEnabled(),
      scope: "Global runtime",
      note: "Writes timetable changes into both legacy and reboot paths.",
    },
    {
      key: "feature_timetable_admin_planner_enabled",
      enabled: isTimetableAdminPlannerEnabled(),
      scope: "Global runtime",
      note: "Turns on the admin planner surface for timetable creation.",
    },
    {
      key: "feature_timetable_publish_workflow_enabled",
      enabled: isTimetablePublishWorkflowEnabled(),
      scope: "Global runtime",
      note: "Controls timetable publish workflow steps.",
    },
    {
      key: "feature_timetable_role_read_views_enabled",
      enabled: isTimetableRoleReadViewsEnabled(),
      scope: "Global runtime",
      note: "Enables role-targeted read views for timetable consumers.",
    },
    {
      key: "feature_timetable_api_write_enabled",
      enabled: isTimetableApiWriteEnabled(),
      scope: "Derived runtime",
      note: "Derived gate for API write capability in the timetable reboot.",
    },
    {
      key: "feature_teacher_studio_enabled",
      enabled: isTeacherStudioEnvEnabled(),
      scope: "Global runtime",
      note: "Enables teacher studio at the environment level.",
    },
    {
      key: "feature_leo_copilot_runtime_enabled",
      enabled: isLeoCopilotServerRuntimeEnabled(),
      scope: "Global runtime",
      note: "Server-side Leo Copilot APIs; pair with NEXT_PUBLIC_FEATURE_LEO_COPILOT_RUNTIME_ENABLED for the launcher.",
    },
  ];

  const [tiers, teacherStudioEnabledSchools, teacherStudioDisabledSchools, settingsDocs] =
    await Promise.all([
      SubscriptionTier.find({})
        .sort({ sortOrder: 1, priceMinor: 1 })
        .select("code name priceMinor studentLimit features active provisional")
        .lean<
          Array<{
            _id: unknown;
            code: string;
            name: string;
            priceMinor: number;
            studentLimit?: number | null;
            features?: string[];
            active: boolean;
            provisional: boolean;
          }>
        >(),
      SchoolSettings.countDocuments({ "teacherStudio.enabled": true }),
      SchoolSettings.countDocuments({ "teacherStudio.enabled": false }),
      SchoolSettings.countDocuments({}),
    ]);

  const discoveredFeatureKeys = Array.from(
    new Set(tiers.flatMap((tier) => tier.features || []).map((feature) => feature.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Release Controls"
        title="Runtime flags and entitlement diagnostics"
        description="Inspect global env-backed switches, review subscription tier feature packs, and see where school-level overrides already exist."
        actions={
          <>
            <Link
              href="/platform/billing/tiers"
              className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span>Subscription Tiers</span>
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
            <Link
              href="/platform/leo"
              className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span className="flex items-center gap-2">
                <LeoIcon className="h-4 w-4 text-amber-300" />
                Leo Copilot
              </span>
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
            <Link
              href="/platform/settings"
              className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span>Platform Settings</span>
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
          </>
        }
      />

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={Flag}
          label="Runtime Flags"
          value={`${runtimeFlags.filter((flag) => flag.enabled).length}/${runtimeFlags.length}`}
          note="Enabled env-backed or derived runtime controls."
          tone="cyan"
        />
        <PlatformMetricCard
          icon={LayoutTemplate}
          label="Tier Features"
          value={discoveredFeatureKeys.length.toLocaleString()}
          note="Unique feature keys discovered from active tier configuration."
          tone="violet"
        />
        <PlatformMetricCard
          icon={ShieldCheck}
          label="School Overrides"
          value={settingsDocs.toLocaleString()}
          note="School settings documents with per-school flag surfaces."
          tone="emerald"
        />
        <PlatformMetricCard
          icon={SlidersHorizontal}
          label="Teacher Studio Off"
          value={teacherStudioDisabledSchools.toLocaleString()}
          note={`${teacherStudioEnabledSchools} schools explicitly enabled in settings.`}
          tone="amber"
        />
      </PlatformMetricGrid>

      <PlatformSection
        title="Runtime Flags"
        description="These values are driven by environment configuration or derived runtime logic. They are read-only from the UI."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/45">
                <th className="pb-3 font-medium">Key</th>
                <th className="pb-3 font-medium">State</th>
                <th className="pb-3 font-medium">Scope</th>
                <th className="pb-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {runtimeFlags.map((flag) => (
                <tr key={flag.key} className="border-b border-white/5 align-top">
                  <td className="py-3 pr-4 font-mono text-xs text-white">{flag.key}</td>
                  <td className="py-3 pr-4">
                    <PlatformPill tone={flag.enabled ? "emerald" : "rose"}>
                      {flag.enabled ? "enabled" : "disabled"}
                    </PlatformPill>
                  </td>
                  <td className="py-3 pr-4 text-white/60">{flag.scope}</td>
                  <td className="py-3 text-white/55">{flag.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PlatformSection>

      <PlatformSection
        title="Subscription Tier Feature Packs"
        description="Tier-level entitlements discovered from current subscription plan definitions."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.code}
              className="rounded-2xl border border-white/8 bg-black/20 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-white">{tier.name}</p>
                  <p className="mt-1 text-xs text-white/45">{tier.code}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PlatformPill tone={tier.active ? "emerald" : "rose"}>
                    {tier.active ? "active" : "inactive"}
                  </PlatformPill>
                  {tier.provisional ? <PlatformPill tone="amber">provisional</PlatformPill> : null}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/35">Price</p>
                  <p className="mt-1 text-sm text-white">{formatMoney(tier.priceMinor)}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/35">Student limit</p>
                  <p className="mt-1 text-sm text-white">
                    {typeof tier.studentLimit === "number" ? tier.studentLimit.toLocaleString() : "Unlimited"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(tier.features || []).length > 0 ? (
                  (tier.features || []).map((feature) => (
                    <PlatformPill key={feature} tone="slate">
                      {feature}
                    </PlatformPill>
                  ))
                ) : (
                  <p className="text-sm text-white/45">No feature keys assigned.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </PlatformSection>

      <PlatformSection
        title="School-Level Override Signals"
        description="Current repo-backed overrides are sparse. Teacher Studio is the main school-specific flag already represented in the data model."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="font-medium text-white">Teacher Studio Enabled</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {teacherStudioEnabledSchools.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-white/50">
              Schools with `teacherStudio.enabled = true`.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="font-medium text-white">Teacher Studio Disabled</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {teacherStudioDisabledSchools.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-white/50">
              Explicit school-level opt-outs captured in settings.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="font-medium text-white">Operator Note</p>
            <p className="mt-2 text-sm text-white/55">
              This screen is currently diagnostic only. Env-backed flags and tier features should not be mutated from the UI until a persistent flag store exists.
            </p>
          </div>
        </div>
      </PlatformSection>
    </div>
  );
}

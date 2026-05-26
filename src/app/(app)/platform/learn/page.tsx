import Link from "next/link";
import { redirect } from "next/navigation";
import type { ComponentType } from "react";
import { BookOpenCheck, Gift, Landmark, Settings, Sparkles, Users } from "lucide-react";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { getSchoolLearnEligibility } from "@/lib/learn/eligibility";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import { LearnAccess } from "@/models/LearnAccess";
import { LearnActivityEvent } from "@/models/LearnActivityEvent";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { School } from "@/models/School";

export const dynamic = "force-dynamic";

type SchoolRow = {
  _id: Types.ObjectId;
  name: string;
  status: string;
};

type GroupRow = {
  _id: Types.ObjectId;
  count: number;
};

type ActivityRow = {
  _id: Types.ObjectId;
  count: number;
  latest: Date;
};

function money(minor: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

export default async function PlatformLearnPage() {
  const gate = await requirePlatformPermission("platform.learn.read");
  if (!gate.ok) redirect("/platform");

  await connectToDatabase();

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  const schools = await School.find({ status: { $in: ["active", "pending"] } })
    .select("_id name status")
    .sort({ name: 1 })
    .lean<SchoolRow[]>();

  const eligibilityRows = await Promise.all(
    schools.map(async (school) => ({
      school,
      eligibility: await getSchoolLearnEligibility(school._id),
    }))
  );
  const eligibleSchoolIds = eligibilityRows
    .filter((row) => row.eligibility.eligible)
    .map((row) => row.school._id);

  const [
    activeStudents,
    giftedStudents,
    parentPaidAccess,
    revenueRow,
    recentActivity,
    accountRows,
    activeAccessRows,
  ] = await Promise.all([
    LearnStudentAccount.countDocuments({
      status: { $in: ["pending_first_login", "active", "locked"] },
    }),
    LearnAccess.countDocuments({
      source: "platform_gift",
      status: "active",
      expiresAt: { $gt: now },
    }),
    LearnAccess.countDocuments({
      source: "parent_paid",
      status: "active",
      expiresAt: { $gt: now },
    }),
    LearnPaymentIntent.aggregate<{ _id: null; total: number }>([
      { $match: { status: "succeeded" } },
      { $group: { _id: null, total: { $sum: "$amountMinor" } } },
    ]),
    LearnActivityEvent.aggregate<ActivityRow>([
      { $match: { occurredAt: { $gte: weekStart } } },
      { $group: { _id: "$schoolId", count: { $sum: 1 }, latest: { $max: "$occurredAt" } } },
      { $sort: { latest: -1 } },
      { $limit: 6 },
    ]),
    LearnStudentAccount.aggregate<GroupRow>([
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
    LearnAccess.aggregate<GroupRow>([
      { $match: { status: "active", expiresAt: { $gt: now } } },
      { $group: { _id: "$schoolId", count: { $sum: 1 } } },
    ]),
  ]);

  const schoolNameMap = new Map(schools.map((school) => [String(school._id), school.name]));
  const accountMap = new Map(accountRows.map((row) => [String(row._id), row.count]));
  const activeAccessMap = new Map(activeAccessRows.map((row) => [String(row._id), row.count]));
  const adoptionRows = eligibilityRows
    .filter((row) => row.eligibility.eligible)
    .map((row) => {
      const schoolId = String(row.school._id);
      const accounts = accountMap.get(schoolId) || 0;
      const access = activeAccessMap.get(schoolId) || 0;
      const rate = accounts > 0 ? Math.round((access / accounts) * 100) : 0;
      return {
        schoolId,
        schoolName: row.school.name,
        accounts,
        access,
        rate,
      };
    })
    .sort((a, b) => b.rate - a.rate || b.access - a.access);

  const highAdoption = adoptionRows.slice(0, 4);
  const lowAdoption = [...adoptionRows]
    .sort((a, b) => a.rate - b.rate || a.access - b.access)
    .slice(0, 4);

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="EduSentrix Learn"
          subtitle="Platform oversight for Learn eligibility, access, revenue, and adoption."
          iconName="book-open-check"
          actions={
            <Button
              asChild
              className="rounded-xl bg-teal-400 text-slate-950 hover:bg-teal-300"
            >
              <Link href="/platform/learn/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <Metric
            label="Eligible schools"
            value={eligibleSchoolIds.length}
            icon={Landmark}
          />
          <Metric label="Active Learn students" value={activeStudents} icon={Users} />
          <Metric label="Gifted students" value={giftedStudents} icon={Gift} />
          <Metric label="Parent-paid access" value={parentPaidAccess} icon={Sparkles} />
          <Metric
            label="Learn revenue"
            value={money(revenueRow[0]?.total || 0)}
            icon={BookOpenCheck}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <GlassPanel className="p-6" glow="both">
            <h2 className="text-lg font-semibold text-white">Recent Learn activity</h2>
            <div className="mt-4 space-y-3">
              {recentActivity.length ? (
                recentActivity.map((row) => (
                  <div
                    key={String(row._id)}
                    className={cn(glassInsetClass, "flex items-center justify-between gap-3 p-4")}
                  >
                    <div>
                      <p className="font-medium text-white">
                        {schoolNameMap.get(String(row._id)) || "School"}
                      </p>
                      <p className="mt-1 text-sm text-white/50">
                        Latest event {row.latest.toLocaleDateString("en-GH")}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-teal-100">
                      {row.count.toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                  No Learn activity has been recorded this week.
                </p>
              )}
            </div>
          </GlassPanel>

          <GlassPanel className="p-6" glow="teal">
            <h2 className="text-lg font-semibold text-white">Quick links</h2>
            <div className="mt-4 grid gap-2">
              {[
                ["Schools", "/platform/learn/schools"],
                ["Students", "/platform/learn/students"],
                ["Gifts", "/platform/learn/gifts"],
                ["Payments", "/platform/learn/payments"],
                ["Settings", "/platform/learn/settings"],
              ].map(([label, href]) => (
                <Button
                  key={href}
                  asChild
                  variant="outline"
                  className="justify-start rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <Link href={href}>{label}</Link>
                </Button>
              ))}
            </div>
          </GlassPanel>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <AdoptionPanel title="High adoption schools" rows={highAdoption} />
          <AdoptionPanel title="Low adoption schools" rows={lowAdoption} />
        </div>
      </WorkspacePageShell>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <GlassPanel className="p-4" glow="cyan">
      <Icon className="h-4 w-4 text-teal-200" />
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </GlassPanel>
  );
}

function AdoptionPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    schoolId: string;
    schoolName: string;
    accounts: number;
    access: number;
    rate: number;
  }>;
}) {
  return (
    <GlassPanel className="p-6" glow="cyan">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.schoolId} className={cn(glassInsetClass, "p-4")}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-white">{row.schoolName}</span>
                <span className="text-teal-100">{row.rate}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-teal-300" style={{ width: `${row.rate}%` }} />
              </div>
              <p className="mt-2 text-xs text-white/45">
                {row.access.toLocaleString()} active access / {row.accounts.toLocaleString()} accounts
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
            No eligible schools have Learn account data yet.
          </p>
        )}
      </div>
    </GlassPanel>
  );
}

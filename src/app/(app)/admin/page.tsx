// src/app/(app)/admin/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  GraduationCap,
  BookOpen,
  DollarSign,
  TrendingUp,
  Calendar,
  UserPlus,
  School,
  FileText,
  ArrowRight,
  Clock,
  CheckCircle2,
} from "lucide-react";

function MetricCard({
  label,
  value,
  accent,
  subtitle,
  showTrending,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  accent: string;
  subtitle?: string;
  showTrending?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 shadow-lg shadow-black/20 backdrop-blur lg:p-6">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent}`}
        aria-hidden="true"
      />
      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            {label}
          </div>
          {Icon && (
            <Icon className="h-4 w-4 text-white/40" aria-hidden="true" />
          )}
        </div>
        <div className="text-3xl font-semibold text-white drop-shadow-sm">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {subtitle && (
          <div className="text-xs text-white/50 flex items-center gap-1">
            {showTrending && <TrendingUp className="h-3 w-3" />}
            <span>{subtitle}</span>
          </div>
        )}
        <div className="h-[3px] w-12 rounded-full bg-white/30" />
      </div>
    </Card>
  );
}

export default function SchoolAdminOverviewPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted">
          Welcome back! Here's an overview of your school.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Students"
          value={0}
          accent="from-blue-500/25 via-blue-500/10 to-transparent"
          subtitle="No change from last period"
          showTrending={true}
          icon={GraduationCap}
        />

        <MetricCard
          label="Teachers"
          value={0}
          accent="from-purple-500/25 via-purple-500/10 to-transparent"
          subtitle="Active staff members"
          icon={Users}
        />

        <MetricCard
          label="Subjects"
          value={0}
          accent="from-emerald-500/25 via-emerald-500/10 to-transparent"
          subtitle="Active subjects"
          icon={BookOpen}
        />

        <MetricCard
          label="Revenue"
          value="₵0"
          accent="from-amber-500/25 via-amber-500/10 to-transparent"
          subtitle="This academic period"
          icon={DollarSign}
        />
      </div>

      {/* Quick Actions & Academic Period */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions Card */}
        <Card className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-indigo-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                <FileText className="h-4 w-4 text-indigo-400" />
              </div>
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3">
            <button className="group w-full text-left px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30 group-hover:bg-blue-500/30 transition-colors">
                  <UserPlus className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white mb-1">
                    Add New Student
                  </div>
                  <div className="text-xs text-white/60">
                    Enroll a new student to your school
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-white/40 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
              </div>
            </button>

            <button className="group w-full text-left px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30 group-hover:bg-purple-500/30 transition-colors">
                  <School className="h-4 w-4 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white mb-1">
                    Create Class
                  </div>
                  <div className="text-xs text-white/60">
                    Set up a new class or grade level
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-white/40 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
              </div>
            </button>

            <button className="group w-full text-left px-4 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 group-hover:bg-emerald-500/30 transition-colors">
                  <FileText className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white mb-1">
                    Generate Report
                  </div>
                  <div className="text-xs text-white/60">
                    View analytics and generate reports
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-white/40 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
              </div>
            </button>
          </CardContent>
        </Card>

        {/* Academic Period Card */}
        <Card className="relative overflow-hidden border border-white/10 bg-gradient-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/20 via-amber-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
                <Calendar className="h-4 w-4 text-amber-400" />
              </div>
              Academic Period
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-white/5">
              <div className="p-3 rounded-lg bg-amber-500/20 border border-amber-500/30">
                <Calendar className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-white">Current Term</span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400">
                    Not Set
                  </span>
                </div>
                <div className="text-sm text-white/60 mb-3">
                  No active academic period configured
                </div>
                <div className="flex items-center gap-4 text-xs text-white/50">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Start: —</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>End: —</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Academic Year</span>
                <span className="text-white/70 font-medium">—</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

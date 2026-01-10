// src/app/demo/(app)/admin/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  GraduationCap,
  BookOpen,
  DollarSign,
  TrendingUp,
  Calendar,
  School,
  ArrowRight,
  Clock,
  CheckCircle2,
  Bell,
  FileText,
  PlusCircle,
  Eye,
  LayoutDashboard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DemoMetrics {
  students: { total: number };
  teachers: { total: number };
  classGroups: { total: number };
  subjects: { total: number };
  invoices: { total: number; collected: number; outstanding: number };
  period: { yearLabel: string; term: string; startDate: string; endDate: string } | null;
}

function MetricCard({
  label,
  value,
  accent,
  subtitle,
  icon: Icon,
  href,
}: {
  label: string;
  value: string | number;
  accent: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  const content = (
    <div
      className={`
        relative w-full overflow-hidden rounded-2xl border border-white/10
        bg-linear-to-br from-white/5 to-transparent p-5 lg:p-6
        shadow-lg shadow-black/20 backdrop-blur
        ${href ? "transition-transform hover:scale-[1.01] cursor-pointer" : ""}
      `}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-linear-to-br ${accent}`}
        aria-hidden="true"
      />
      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            {label}
          </div>
          {Icon && <Icon className="h-4 w-4 text-white/40" aria-hidden="true" />}
        </div>
        <div className="text-3xl font-semibold text-white drop-shadow-sm">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {subtitle && (
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span>{subtitle}</span>
          </div>
        )}
        <div className="h-[3px] w-12 rounded-full bg-white/30" />
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function QuickNavCard({
  title,
  description,
  icon: Icon,
  accent,
  href,
  badge,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link href={href}>
      <div className="group w-full text-left px-4 py-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg ${accent}`}>
            <Icon className="h-5 w-5 text-white/80" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-white">{title}</span>
              {badge && (
                <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">
                  {badge}
                </Badge>
              )}
            </div>
            <div className="text-xs text-white/60">{description}</div>
          </div>
          <ArrowRight className="h-4 w-4 text-white/40 group-hover:text-white/60 group-hover:translate-x-1 transition-all mt-1" />
        </div>
      </div>
    </Link>
  );
}

export default function DemoAdminDashboard() {
  const [metrics, setMetrics] = useState<DemoMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch("/api/demo/metrics");
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error("Failed to fetch demo metrics:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  const termProgress = () => {
    if (!metrics?.period) return { pct: 0, label: "Not Set" };
    const start = new Date(metrics.period.startDate).getTime();
    const end = new Date(metrics.period.endDate).getTime();
    const now = Date.now();
    if (now <= start) return { pct: 0, label: "Starts soon" };
    if (now >= end) return { pct: 100, label: "Completed" };
    const pct = Math.round(((now - start) / (end - start)) * 100);
    return { pct, label: `${pct}% complete` };
  };

  const progress = termProgress();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Welcome to EduSentrix</h1>
            <Badge variant="outline" className="border-amber-500/50 text-amber-400">
              DEMO
            </Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            This is a fully functional demo of the school management dashboard.
            Explore the features, view sample data, and see how EduSentrix can transform your school administration.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/demo/schedule-call">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Demo
            </Link>
          </Button>
        </div>
      </div>

      {/* Demo Notice */}
      <Card className="relative overflow-hidden border-amber-500/30 bg-amber-500/5">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/10 via-amber-500/5 to-transparent" />
        <CardContent className="relative z-10 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
              <Eye className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-200 mb-1">Demo Mode Active</h3>
              <p className="text-sm text-amber-200/70">
                You&apos;re viewing a sandboxed demo environment with sample data.
                Some write operations are restricted. Ready to get started for real?
                <Link href="/demo/schedule-call" className="ml-1 underline hover:no-underline">
                  Schedule a call with our team
                </Link>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Students"
          value={loading ? "—" : metrics?.students.total ?? 0}
          accent="from-blue-500/25 via-blue-500/10 to-transparent"
          subtitle="Enrolled students"
          icon={GraduationCap}
          href="/demo/admin/students"
        />
        <MetricCard
          label="Teachers"
          value={loading ? "—" : metrics?.teachers.total ?? 0}
          accent="from-purple-500/25 via-purple-500/10 to-transparent"
          subtitle="Active staff"
          icon={Users}
          href="/demo/admin/teachers"
        />
        <MetricCard
          label="Class Groups"
          value={loading ? "—" : metrics?.classGroups.total ?? 0}
          accent="from-emerald-500/25 via-emerald-500/10 to-transparent"
          subtitle="Active classes"
          icon={School}
          href="/demo/admin/class-groups"
        />
        <MetricCard
          label="Revenue"
          value={loading ? "—" : `₵${(metrics?.invoices.collected ?? 0).toLocaleString()}`}
          accent="from-amber-500/25 via-amber-500/10 to-transparent"
          subtitle="This term"
          icon={DollarSign}
          href="/demo/admin/fees"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Explore Features */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-indigo-500/20 via-indigo-500/5 to-transparent" />
          <CardHeader className="relative z-10">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                <LayoutDashboard className="h-4 w-4 text-indigo-400" />
              </div>
              Explore Features
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3">
            <QuickNavCard
              title="Student Management"
              description="View, search, and manage student records with advanced filtering"
              icon={GraduationCap}
              accent="bg-blue-500/20 border-blue-500/30"
              href="/demo/admin/students"
              badge="Popular"
            />
            <QuickNavCard
              title="Teacher Directory"
              description="Manage teachers, assignments, and class assignments"
              icon={Users}
              accent="bg-purple-500/20 border-purple-500/30"
              href="/demo/admin/teachers"
            />
            <QuickNavCard
              title="Class Groups"
              description="Organize classes, assign teachers, and manage rosters"
              icon={School}
              accent="bg-emerald-500/20 border-emerald-500/30"
              href="/demo/admin/class-groups"
            />
            <QuickNavCard
              title="Fee Management"
              description="Create invoices, track payments, and manage collections"
              icon={DollarSign}
              accent="bg-amber-500/20 border-amber-500/30"
              href="/demo/admin/fees"
              badge="Key Feature"
            />
            <QuickNavCard
              title="Subjects"
              description="Manage curriculum subjects and teacher assignments"
              icon={BookOpen}
              accent="bg-cyan-500/20 border-cyan-500/30"
              href="/demo/admin/subjects"
            />
          </CardContent>
        </Card>

        {/* Academic Period */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/20 via-amber-500/5 to-transparent" />
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
                  <span className="font-semibold text-white">
                    {metrics?.period ? `${metrics.period.yearLabel} - ${metrics.period.term}` : "Current Term"}
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400">
                    {progress.label}
                  </span>
                </div>
                {progress.pct > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-white/50 mb-2">
                      <span>Term Progress</span>
                      <span className="font-medium text-white/70">{progress.pct}%</span>
                    </div>
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/5 border border-white/10">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-amber-500 via-amber-400 to-amber-300 transition-all duration-700"
                        style={{ width: `${progress.pct}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-white/50">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Demo data included</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <div className="text-2xl font-bold text-white">
                  {loading ? "—" : metrics?.subjects.total ?? 0}
                </div>
                <div className="text-xs text-white/60">Subjects</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <div className="text-2xl font-bold text-emerald-400">
                  ₵{loading ? "—" : (metrics?.invoices.collected ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-white/60">Collected</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <div className="text-2xl font-bold text-amber-400">
                  ₵{loading ? "—" : (metrics?.invoices.outstanding ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-white/60">Outstanding</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* What's Included */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/15 via-emerald-500/5 to-transparent" />
          <CardHeader className="relative z-10">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              </div>
              What&apos;s Included
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-2">
            {[
              "Student & Teacher Management",
              "Class Group Organization",
              "Fee & Invoice Tracking",
              "Payment Recording",
              "Academic Period Management",
              "Subject & Curriculum Setup",
              "Reports & Analytics",
              "Parent Portal Access",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-white/80">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                {feature}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity (Demo) */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/15 via-violet-500/5 to-transparent" />
          <CardHeader className="relative z-10">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-violet-500/20 border border-violet-500/30">
                <Bell className="h-4 w-4 text-violet-300" />
              </div>
              Sample Activities
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3">
            {[
              { action: "New student enrolled", time: "2 hours ago", icon: GraduationCap },
              { action: "Invoice payment received", time: "5 hours ago", icon: DollarSign },
              { action: "Teacher assignment updated", time: "1 day ago", icon: Users },
              { action: "Class group created", time: "2 days ago", icon: School },
            ].map((activity, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg border border-white/5 bg-white/5">
                <activity.icon className="h-4 w-4 text-white/60 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/80">{activity.action}</div>
                  <div className="text-xs text-white/50">{activity.time}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/15 via-blue-500/5 to-transparent" />
          <CardHeader className="relative z-10">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                <TrendingUp className="h-4 w-4 text-blue-300" />
              </div>
              Ready to Get Started?
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-4">
            <p className="text-sm text-white/70">
              See how EduSentrix can streamline your school&apos;s administration.
              Our team will help you get set up quickly.
            </p>
            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link href="/demo/schedule-call">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule a Demo Call
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/docs">
                  <FileText className="h-4 w-4 mr-2" />
                  View Documentation
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

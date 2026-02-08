"use client";

import Link from "next/link";
import {
  ClipboardList,
  CalendarDays,
  BarChart3,
  Bell,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const quickActions = [
  {
    title: "Assignments",
    description: "View and submit your homework and coursework.",
    href: "/student/assignments",
    icon: ClipboardList,
  },
  {
    title: "Results",
    description: "Track grades, term performance, and trends.",
    href: "/student/results",
    icon: BarChart3,
  },
  {
    title: "Calendar",
    description: "Keep up with deadlines and school events.",
    href: "/student/calendar",
    icon: CalendarDays,
  },
  {
    title: "Notices",
    description: "Read important school announcements.",
    href: "/student/notices",
    icon: Bell,
  },
];

export default function StudentPage() {
  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white md:text-3xl">
          Student Dashboard
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Access your academics, tasks, and updates in one place.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((item) => (
          <Card
            key={item.href}
            className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60"
          >
            <CardHeader className="pb-3">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/15 text-brand">
                <item.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-base text-white">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-white/60">{item.description}</p>
              <Link href={item.href}>
                <Button className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
                  Open
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

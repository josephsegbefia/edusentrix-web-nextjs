"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock,
  ExternalLink,
  HelpCircle,
  Info,
  Lightbulb,
  Settings,
  Sparkles,
} from "lucide-react";

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="rounded-xl border border-white/10 bg-white/2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/3"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
          <Icon className="h-4 w-4 text-cyan-400" />
        </div>
        <span className="flex-1 text-sm font-medium text-white">{title}</span>
        <ChevronDown
          className={`h-4 w-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-white/5 px-4 py-4 text-[13px] leading-relaxed text-white/60">
          {children}
        </div>
      )}
    </div>
  );
}

function StepItem({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-300">
        {step}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white/80">{title}</p>
        <div className="mt-1 text-[13px] text-white/50">{children}</div>
      </div>
    </div>
  );
}

function ExampleBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-cyan-500/15 bg-cyan-500/5 px-3 py-2.5 text-[12px] text-cyan-200/80">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-300/60">
        <Lightbulb className="h-3 w-3" />
        Example
      </div>
      {children}
    </div>
  );
}

export function TimetableHelpDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-white/10 bg-black/90 backdrop-blur sm:max-w-xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2.5 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500/20 to-emerald-600/20">
              <BookOpen className="h-5 w-5 text-cyan-400" />
            </div>
            Master Timetable Help
          </SheetTitle>
          <p className="text-sm text-white/40">
            How to build and publish your school timetable.
          </p>
        </SheetHeader>

        <div className="mt-4 space-y-3 pb-8">
          <Section title="Before you start: School hours" icon={Settings} defaultOpen>
            <p>
              <strong className="text-white/80">Set up your school hours first.</strong> The timetable
              uses your school&apos;s period structure from the Settings page.
            </p>
            <p className="mt-2">
              Go to <strong className="text-white/70">Settings</strong> and configure:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>School start and end times</li>
              <li>Period duration (e.g. 40 minutes)</li>
              <li>Number of periods per day</li>
              <li>Breaks (short break, lunch)</li>
              <li>Working days (e.g. Monday–Friday)</li>
            </ul>
            <p className="mt-3">
              <Link
                href="/admin/settings"
                className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300"
              >
                Open Settings
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </p>
            <ExampleBox>
              If you have 8 periods of 40 minutes, school starts at 07:30, and you have a short break
              (10:00–10:20) and lunch (12:00–13:00), your period slots will be generated accordingly.
            </ExampleBox>
          </Section>

          <Section title="How the timetable works" icon={CalendarDays} defaultOpen>
            <p>
              The timetable is built <strong className="text-white/80">per class</strong>. Each class
              has its own schedule. The master timetable here is a <strong className="text-white/80">read-only
              view</strong> of all classes combined.
            </p>
            <div className="mt-4 space-y-4">
              <StepItem step={1} title="Set up school hours">
                Configure periods and breaks in Settings (see above).
              </StepItem>
              <StepItem step={2} title="Build each class timetable">
                Go to <strong className="text-white/70">Classes</strong> → select a class → <strong className="text-white/70">Schedule</strong> tab.
                Pick a day, add a period with subject and teacher. Repeat until the week is complete.
              </StepItem>
              <StepItem step={3} title="Publish">
                When all classes are scheduled, return here and click <strong className="text-white/70">Publish</strong>.
                The timetable becomes visible to teachers, students, and parents.
              </StepItem>
            </div>
          </Section>

          <Section title="Double and half periods" icon={Clock}>
            <p>
              Some lessons need more than one period. When adding a slot in a class&apos;s Schedule tab,
              you can choose:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li><strong className="text-white/70">1 period</strong> — Standard single period</li>
              <li><strong className="text-white/70">1.5 periods</strong> — One and a half periods (e.g. for practicals)</li>
              <li><strong className="text-white/70">2 periods (double)</strong> — Two consecutive periods</li>
              <li><strong className="text-white/70">Custom time</strong> — Any start/end time within school hours</li>
            </ul>
            <p className="mt-3">
              <strong className="text-white/80">Stay within the daily limit.</strong> The total teaching time
              for each class per day should not exceed your configured number of periods. For example,
              if you have 8 periods per day, a class cannot have more than 8 period-equivalents of lessons
              (e.g. 6 single + 1 double = 8).
            </p>
            <ExampleBox>
              Science practical: pick Period 3, duration &quot;2 periods (double)&quot; — the slot spans
              Period 3 and 4. Art: pick Period 5, duration &quot;1.5 periods&quot; — ends halfway through Period 6.
            </ExampleBox>
          </Section>

          <Section title="Version dropdown and Publish" icon={Sparkles}>
            <p>
              <strong className="text-white/70">Draft</strong> — The timetable you&apos;re editing. Slots added
              in class Schedule tabs go into the draft. Teachers and students do not see the draft.
            </p>
            <p className="mt-2">
              <strong className="text-white/70">Published</strong> — The live timetable. After you click
              Publish, this version is shown to teachers, students, and parents.
            </p>
            <p className="mt-2">
              Use the version dropdown to switch between draft and published. When you&apos;re ready,
              click <strong className="text-white/70">Publish</strong> to make the draft live.
            </p>
          </Section>

          <Section title="Quick Facts" icon={Info}>
            <p>
              The <strong className="text-white/80">Quick Facts</strong> panel shows a snapshot of the
              current view:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                <strong className="text-white/70">Selected date</strong> — The date you&apos;re viewing
                (e.g. 2026-02-27 Friday). Used for day view and calendar.
              </li>
              <li>
                <strong className="text-white/70">Week range</strong> — The Monday–Sunday span for the
                week view (e.g. 2026-02-23 to 2026-03-01).
              </li>
              <li>
                <strong className="text-white/70">Visible slots</strong> — Number of timetable slots
                shown after applying your filters (grade, class, teacher, subject).
              </li>
              <li>
                <strong className="text-white/70">Open conflicts</strong> — Number of timetable
                conflicts (e.g. teacher double-booked, class overlap) that still need to be resolved.
              </li>
            </ul>
          </Section>

          <Section title="Tips" icon={HelpCircle}>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <p>
                  <strong className="text-white/70">No draft yet?</strong> Go to any class&apos;s Schedule
                  tab and add your first slot. The draft is created automatically.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <p>
                  <strong className="text-white/70">Conflicts.</strong> If a teacher or class is double-booked,
                  the Conflict panel will show it. Fix overlaps in the class Schedule tab.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <p>
                  <strong className="text-white/70">Teacher view.</strong> Teachers see their timetable on
                  their profile under the Assignments tab.
                </p>
              </div>
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

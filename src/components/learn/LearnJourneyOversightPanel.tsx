"use client";

import { Map, Sparkles } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type {
  LearnClassJourneyOversight,
  LearnSchoolJourneyOversight,
  LearnStudentJourneyOversight,
} from "@/lib/learn/journey-oversight";

type StudentOversightProps = {
  mode: "student";
  oversight: LearnStudentJourneyOversight;
};

type AggregateOversightProps = {
  mode: "aggregate";
  oversight: LearnClassJourneyOversight | LearnSchoolJourneyOversight;
  title?: string;
};

type LearnJourneyOversightPanelProps = StudentOversightProps | AggregateOversightProps;

function ProgressTrack({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-teal-300 to-cyan-300 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={cn(glassInsetClass, "p-3")}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/40">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

export function LearnJourneyOversightPanel(props: LearnJourneyOversightPanelProps) {
  if (props.mode === "aggregate") {
    const { oversight, title = "Today's Journey snapshot" } = props;
    return (
      <GlassPanel className="p-5" glow="cyan">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2">
            <Map className="h-5 w-5 text-teal-200" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-white/55">{oversight.message}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Learners active" value={oversight.studentsWithJourney} />
              <Stat label="Completed today" value={oversight.studentsCompleted} />
              <Stat label="Average progress" value={`${oversight.averageCompletionPercent}%`} />
              <Stat label="Catch-up waiting" value={oversight.totalCatchUpItems} />
            </div>
            {oversight.studentsWithJourney > 0 ? (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs text-white/45">
                  <span>Class average</span>
                  <span>{oversight.averageCompletionPercent}%</span>
                </div>
                <ProgressTrack value={oversight.averageCompletionPercent} />
              </div>
            ) : null}
          </div>
        </div>
      </GlassPanel>
    );
  }

  const { oversight } = props;
  const today = oversight.todaysJourney;

  return (
    <GlassPanel className="p-5" glow="teal">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-2">
          <Sparkles className="h-5 w-5 text-amber-200" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white">Today&apos;s Journey</h2>
          <p className="mt-1 text-sm text-white/55">
            {today?.message || "Today's Journey will appear after class lessons are covered."}
          </p>
        </div>
      </div>

      {today ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-white/65">
            <span>
              {today.subjectsCompleted} of {today.subjectsTotal} subjects complete
            </span>
            <span className="font-semibold text-teal-100">{today.completionPercent}%</span>
          </div>
          <ProgressTrack value={today.completionPercent} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Required steps"
              value={`${today.requiredStepsCompleted}/${today.requiredStepsTotal}`}
            />
            <Stat label="Streak safe" value={today.streakProtected ? "Yes" : "Not yet"} />
            <Stat label="Date" value={today.date} />
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <section className={cn(glassInsetClass, "p-4")}>
          <h3 className="text-sm font-semibold text-white">Catch-up vault</h3>
          <p className="mt-1 text-xs text-white/50">{oversight.catchUp.message}</p>
          {oversight.catchUp.items.length ? (
            <ul className="mt-3 space-y-2">
              {oversight.catchUp.items.map((item) => (
                <li key={`${item.subjectName}-${item.topicTitle}`} className="text-sm text-white/70">
                  <span className="text-white">{item.subjectName}</span>
                  <span className="text-white/45"> · {item.topicTitle}</span>
                  <span className="mt-0.5 block text-xs text-white/40">
                    {item.coveredLabel} · {item.completionPercent}% done
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className={cn(glassInsetClass, "p-4")}>
          <h3 className="text-sm font-semibold text-white">Weak concepts</h3>
          {oversight.weakConcepts.length ? (
            <ul className="mt-3 space-y-2">
              {oversight.weakConcepts.map((concept) => (
                <li key={concept.id} className="text-sm">
                  <p className="text-white">{concept.title}</p>
                  <p className="text-xs text-white/45">
                    {concept.subjectName} · {concept.reason}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-white/50">No weak concepts flagged right now.</p>
          )}
        </section>

        <section className={cn(glassInsetClass, "p-4")}>
          <h3 className="text-sm font-semibold text-white">Flashcard mastery</h3>
          <p className="mt-1 text-xs text-white/50">{oversight.flashcardMastery.message}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Decks" value={oversight.flashcardMastery.decksTracked} />
            <Stat label="Known" value={oversight.flashcardMastery.cardsMastered} />
            <Stat label="Reviewed" value={oversight.flashcardMastery.cardsReviewed} />
            <Stat label="Mastery" value={`${oversight.flashcardMastery.masteryPercent}%`} />
          </div>
        </section>
      </div>
    </GlassPanel>
  );
}

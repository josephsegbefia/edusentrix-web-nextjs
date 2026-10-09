"use client";

import * as React from "react";
import type { TeacherCommentDTO } from "@/types/admin/student-academics";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  buildAcademicCommentsSectionModel,
  profileCommentsHasContent,
} from "@/lib/academics/profile/academic-comments-section-utils";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import type { StudentAcademicProfileDTO } from "@/types/academics/student-academic-profile";
import { cn } from "@/lib/utils";
import { MessageSquareText } from "lucide-react";

type Props = {
  profile?: StudentAcademicProfileDTO | null;
  /** Legacy `TeacherComment` rows when profile comments are unavailable. */
  legacyComments?: TeacherCommentDTO[];
};

const legacyTypeLabel: Record<string, string> = {
  subject: "Subject",
  general: "General",
  promotion: "Promotion",
  behavior: "Behaviour",
};

function CommentTextBlock({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "internal";
}) {
  return (
    <div
      className={cn(
        glassInsetClass,
        "space-y-1 px-3 py-2.5",
        tone === "internal" && "border-violet-400/20 bg-violet-500/5"
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-(--ws-fg-40)">
        {label}
      </p>
      <p className="text-sm leading-relaxed text-(--ws-fg-80)">{value}</p>
    </div>
  );
}

function ProfileCommentsContent({ profile }: { profile: StudentAcademicProfileDTO }) {
  const model = React.useMemo(
    () =>
      buildAcademicCommentsSectionModel({
        comments: profile.comments,
        isReleased: profile.reportStatus.isReleased,
        dataSource: profile.dataSource,
        canViewInternalNotes: profile.permissions.canViewInternalNotes,
      }),
    [profile]
  );

  if (!model.hasContent) {
    return (
      <div className={cn(glassInsetClass, "px-4 py-8 text-center")}>
        <p className="text-sm text-(--ws-fg-60)">{model.emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            model.isOfficialSnapshot
              ? "border-emerald-400/25 bg-emerald-500/10 text-(--ws-emerald)"
              : "border-cyan-400/25 bg-cyan-500/10 text-(--ws-cyan)"
          )}
        >
          {model.sourceLabel}
        </span>
        {model.showLiveNotice ? (
          <span className="text-[11px] text-(--ws-amber)">
            Provisional — not yet released to parents
          </span>
        ) : null}
      </div>

      {model.conductFields.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {model.conductFields.map((field) => (
            <div key={field.key} className={cn(glassInsetClass, "px-3 py-2.5")}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-(--ws-fg-40)">
                {field.label}
              </p>
              <p className="mt-1 text-sm text-(--ws-fg-80)">{field.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {model.textBlocks.map((block) => (
        <CommentTextBlock
          key={block.kind}
          label={block.label}
          value={block.value}
          tone={block.kind === "internal" ? "internal" : "default"}
        />
      ))}

      {model.subjectComments.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-(--ws-fg-50)">
            Subject teacher remarks
          </h4>
          {model.subjectComments.map((entry) => (
            <div
              key={`${entry.subjectId}-${entry.teacherId ?? "teacher"}`}
              className={cn(glassInsetClass, "space-y-1 px-3 py-2.5")}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-(--ws-fg-90)">
                  {entry.subjectName}
                </span>
                {entry.teacherName ? (
                  <span className="text-[10px] text-(--ws-fg-40)">{entry.teacherName}</span>
                ) : null}
              </div>
              <p className="text-sm leading-relaxed text-(--ws-fg-80)">{entry.comment}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LegacyCommentsContent({ comments }: { comments: TeacherCommentDTO[] }) {
  return (
    <div className="space-y-2">
      <span className="inline-flex rounded-full border border-(--ws-line-strong) bg-(--ws-fill) px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--ws-fg-60)">
        Legacy teacher comments
      </span>
      {comments.map((comment) => (
        <div
          key={comment.id}
          className={cn(glassInsetClass, "space-y-1 px-3 py-2.5 text-xs text-(--ws-fg-70)")}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  comment.commentType === "subject"
                    ? "border-sky-400/40 bg-sky-500/20 text-sky-50"
                    : comment.commentType === "behavior"
                      ? "border-amber-400/40 bg-amber-500/20 text-amber-50"
                      : "border-slate-500/60 bg-slate-700/70 text-(--ws-fg-70)"
                )}
              >
                {legacyTypeLabel[comment.commentType] ?? comment.commentType}
              </span>
              {comment.subjectName ? (
                <span className="text-[11px] text-(--ws-fg-70)">{comment.subjectName}</span>
              ) : null}
            </div>
            <span className="text-[10px] text-slate-400">
              {comment.teacherName ?? "Teacher"} •{" "}
              {new Date(comment.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-[11px] leading-snug text-(--ws-fg-70)">{comment.comment}</p>
        </div>
      ))}
    </div>
  );
}

export function TeacherCommentsSection({ profile, legacyComments = [] }: Props) {
  const useProfile =
    profile != null && profileCommentsHasContent(profile.comments);
  const useLegacy = !useProfile && legacyComments.length > 0;

  if (!useProfile && !useLegacy) {
    if (!profile) {
      return null;
    }

    const emptyModel = buildAcademicCommentsSectionModel({
      comments: profile.comments,
      isReleased: profile.reportStatus.isReleased,
      dataSource: profile.dataSource,
      canViewInternalNotes: profile.permissions.canViewInternalNotes,
    });

    return (
      <GlassPanel className="p-4 sm:p-5" glow="none">
        <CommentsSectionHeader entryCount={0} />
        <div className={cn(glassInsetClass, "mt-3 px-4 py-8 text-center")}>
          <p className="text-sm text-(--ws-fg-60)">{emptyModel.emptyMessage}</p>
        </div>
      </GlassPanel>
    );
  }

  const entryCount = useProfile
    ? buildAcademicCommentsSectionModel({
        comments: profile!.comments,
        isReleased: profile!.reportStatus.isReleased,
        dataSource: profile!.dataSource,
        canViewInternalNotes: profile!.permissions.canViewInternalNotes,
      }).totalEntries
    : legacyComments.length;

  return (
    <GlassPanel className="p-4 sm:p-5" glow="none">
      <CommentsSectionHeader entryCount={entryCount} />
      <div className="mt-3">
        {useProfile && profile ? (
          <ProfileCommentsContent profile={profile} />
        ) : (
          <LegacyCommentsContent comments={legacyComments} />
        )}
      </div>
    </GlassPanel>
  );
}

function CommentsSectionHeader({ entryCount }: { entryCount: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-(--ws-line) bg-linear-to-br from-violet-500/20 to-slate-500/20">
          <MessageSquareText className="h-5 w-5 text-(--ws-violet)" />
        </div>
        <h3 className="text-sm font-semibold text-(--ws-fg)">Teacher &amp; report comments</h3>
      </div>
      {entryCount > 0 ? (
        <span className="text-[11px] text-(--ws-fg-40)">
          {entryCount} entr{entryCount === 1 ? "y" : "ies"}
        </span>
      ) : null}
    </div>
  );
}

export function TeacherCommentsSectionSkeleton() {
  return (
    <GlassPanel className="p-5" glow="none">
      <div className="h-24 animate-pulse rounded-xl bg-(--ws-fill)" />
    </GlassPanel>
  );
}

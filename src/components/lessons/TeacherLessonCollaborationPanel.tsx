"use client";

import * as React from "react";
import { MessageSquareText, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  useTeacherLessonCollaborationComments,
  useTeacherLessonCollaborationCommentCreate,
  useTeacherLessonCollaborationCommentStatusUpdate,
} from "@/hooks/teacher/useTeacherLessonCollaborationComments";

export function TeacherLessonCollaborationPanel({
  lessonId,
  canWrite,
  role,
  collaborators,
}: {
  lessonId: string;
  canWrite: boolean;
  role: "owner" | "collaborator";
  collaborators: Array<{ teacherId: string; userId: string; name: string }>;
}) {
  const busyToast = useBusyToast();
  const [draft, setDraft] = React.useState("");
  const { data, isLoading } = useTeacherLessonCollaborationComments(lessonId, true);
  const createMutation = useTeacherLessonCollaborationCommentCreate(lessonId);
  const statusMutation = useTeacherLessonCollaborationCommentStatusUpdate(lessonId);

  const addComment = async () => {
    const value = draft.trim();
    if (!value) return;
    await busyToast.promise(createMutation.mutateAsync(value), {
      loading: "Posting note…",
      success: "Note added",
      error: (e) => (e instanceof Error ? e.message : "Failed"),
    });
    setDraft("");
  };

  const setStatus = async (commentId: string, status: "open" | "resolved") => {
    await busyToast.promise(statusMutation.mutateAsync({ commentId, status }), {
      loading: status === "resolved" ? "Resolving…" : "Reopening…",
      success: status === "resolved" ? "Resolved" : "Reopened",
      error: (e) => (e instanceof Error ? e.message : "Failed"),
    });
  };

  return (
    <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-lg text-white">
          <MessageSquareText className="h-5 w-5 text-violet-200" />
          Collaboration
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/55">
          <Users className="h-3.5 w-3.5" />
          {collaborators.length > 0 ? (
            collaborators.map((person) => (
              <Badge key={person.teacherId} variant="outline" className="border-white/20 text-white/70">
                {person.name}
              </Badge>
            ))
          ) : (
            <span>No collaborators detected yet.</span>
          )}
          <span className="ml-1 text-white/40">You are {role}.</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add collaboration note, question, or action item…"
            className="min-h-24 border-white/10 bg-white/5 text-white placeholder:text-white/35"
            disabled={!canWrite || createMutation.isPending}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              className="bg-violet-500/25 text-violet-100 hover:bg-violet-500/35"
              disabled={!canWrite || createMutation.isPending || draft.trim().length === 0}
              onClick={() => void addComment()}
            >
              Add note
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {isLoading && <p className="text-sm text-white/55">Loading collaboration notes…</p>}
          {!isLoading && (data?.data.comments.length ?? 0) === 0 && (
            <p className="text-sm text-white/50">No notes yet. Start a thread to collaborate.</p>
          )}
          {data?.data.comments.map((item) => (
            <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-white/55">
                  <span className="text-white/80">{item.authorName}</span> ·{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      item.status === "resolved"
                        ? "border-emerald-500/30 text-emerald-200"
                        : "border-amber-500/30 text-amber-200"
                    }
                  >
                    {item.status}
                  </Badge>
                  {canWrite && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
                      disabled={statusMutation.isPending}
                      onClick={() => void setStatus(item.id, item.status === "open" ? "resolved" : "open")}
                    >
                      {item.status === "open" ? "Resolve" : "Reopen"}
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">{item.comment}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

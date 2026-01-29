"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Plus, Send } from "lucide-react";
import { useTeacherMessageThreads } from "@/hooks/teacher/useTeacherMessageThreads";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useClassRoster } from "@/hooks/teacher/useClassRoster";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function TeacherMessagesPage() {
  const router = useRouter();
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.messagesView);
  const canSend = can(permissions, PERMISSIONS.messagesSend);

  const { data, isLoading, refetch } = useTeacherMessageThreads();
  const threads = data?.data.threads || [];

  const { data: classesData } = useTeacherClasses();
  const classOptions = (classesData?.data.classes || []).map((cls) => ({
    id: cls._id,
    name: cls.name,
  }));

  const [composeOpen, setComposeOpen] = React.useState(false);
  const [selectedClassId, setSelectedClassId] = React.useState(classOptions[0]?.id || "");
  const [selectedStudentId, setSelectedStudentId] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");

  const { data: rosterData } = useClassRoster(composeOpen ? selectedClassId : undefined);
  const roster = rosterData?.data.students || [];

  React.useEffect(() => {
    if (!selectedClassId && classOptions.length > 0) {
      setSelectedClassId(classOptions[0].id);
    }
  }, [classOptions, selectedClassId]);

  React.useEffect(() => {
    if (roster.length === 0) {
      setSelectedStudentId("");
      return;
    }
    if (!roster.some((student) => student._id === selectedStudentId)) {
      setSelectedStudentId(roster[0]._id);
    }
  }, [roster, selectedStudentId]);

  const handleCreateThread = async () => {
    if (!selectedStudentId) {
      busyToast.error("Select a student to message");
      return;
    }
    if (!message.trim()) {
      busyToast.error("Message body is required");
      return;
    }

    const result = await busyToast.promise(
      fetch("/api/teacher/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
          subject: subject.trim() || undefined,
          message: message.trim(),
        }),
      }).then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to start conversation");
        }
        return payload;
      }),
      {
        loading: "Starting conversation...",
        success: "Conversation created",
        error: "Failed to start conversation",
      }
    );

    setComposeOpen(false);
    setMessage("");
    setSubject("");
    await refetch();

    if (result?.data?.threadId) {
      router.push(`/teacher/communication/messages/${result.data.threadId}`);
    }
  };

  if (!canView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Messages</h1>
          <p className="text-sm text-white/60">Messaging access is disabled for your role.</p>
        </div>
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60">
                <MessageSquare className="h-4 w-4" />
              </span>
              Messaging locked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              Ask an admin to enable messaging permissions.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Messages</h1>
          <p className="text-sm text-white/60">Keep families and students updated in real time.</p>
        </div>
        {canSend && (
          <Button
            onClick={() => setComposeOpen(true)}
            className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
          >
            <Plus className="h-4 w-4" />
            New conversation
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
          No conversations yet. Start a thread with a student to reach their guardians.
        </div>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => (
            <Link key={thread.id} href={`/teacher/communication/messages/${thread.id}`} className="group">
              <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent transition group-hover:-translate-y-0.5 group-hover:border-white/20">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg text-white">
                      {thread.student?.name || thread.participants[0]?.name || "Conversation"}
                    </CardTitle>
                    <div className="text-xs text-white/50">
                      {thread.subject ? `${thread.subject} · ` : ""}
                      {thread.participants.map((p) => p.name).join(", ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {thread.unreadCount > 0 && (
                      <Badge className="bg-rose-500/20 text-rose-200">{thread.unreadCount} new</Badge>
                    )}
                    <span className="text-xs text-white/40">{formatTime(thread.lastMessageAt)}</span>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-white/60">{thread.lastMessagePreview}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="border-white/10 bg-[#0f0f14] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg">Start conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Class group</label>
                <PremiumSelect value={selectedClassId} onValueChange={setSelectedClassId}>
                  <PremiumSelectTrigger>
                    <PremiumSelectValue placeholder="Select class" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {classOptions.map((cls) => (
                      <PremiumSelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Student</label>
                <PremiumSelect value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <PremiumSelectTrigger>
                    <PremiumSelectValue placeholder="Select student" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {roster.map((student) => (
                      <PremiumSelectItem key={student._id} value={student._id}>
                        {student.firstName} {student.lastName}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Subject (optional)</label>
              <Input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="e.g. Mathematics"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Message</label>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type your first message..."
                className="min-h-[120px] border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)} className="border-white/10 text-white/60">
              Cancel
            </Button>
            <Button
              onClick={handleCreateThread}
              disabled={!canSend}
              className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
            >
              <Send className="h-4 w-4" />
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  Inbox,
  MessageSquare,
  Plus,
  Search,
  Send,
  User,
} from "lucide-react";
import { useTeacherMessageThreads } from "@/hooks/teacher/useTeacherMessageThreads";
import { useTeacherMessageThread } from "@/hooks/teacher/useTeacherMessageThread";
import { useTeacherThreadMessages } from "@/hooks/teacher/useTeacherThreadMessages";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useClassRoster } from "@/hooks/teacher/useClassRoster";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0]!.charAt(0)?.toUpperCase() ?? "";
  return (
    (parts[0]?.charAt(0)?.toUpperCase() ?? "") +
    (parts[parts.length - 1]?.charAt(0)?.toUpperCase() ?? "")
  );
}

function formatThreadTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatMessageTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ThreadListItem({
  thread,
  isActive,
  onClick,
}: {
  thread: {
    id: string;
    subject?: string;
    student: { id: string; name: string } | null;
    participants: Array<{ id: string; name: string; role: string }>;
    lastMessageAt: string | null;
    lastMessagePreview: string;
    unreadCount: number;
  };
  isActive: boolean;
  onClick: () => void;
}) {
  const participantName =
    thread.student?.name || thread.participants[0]?.name || "Conversation";
  const subtitle =
    thread.subject || thread.participants.map((participant) => participant.name).join(", ");

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 rounded-xl p-3 text-left transition-all",
        isActive
          ? "bg-brand/20 border border-brand/30"
          : "hover:bg-white/5 border border-transparent"
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="bg-gradient-to-br from-indigo-600/40 to-purple-600/40 text-sm font-semibold">
          {initialsFromName(participantName || "C")}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "font-medium truncate",
              thread.unreadCount > 0 ? "text-white" : "text-white/80"
            )}
          >
            {participantName}
          </p>
          {thread.lastMessageAt ? (
            <span className="text-[10px] text-white/40 shrink-0">
              {formatThreadTime(thread.lastMessageAt)}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-white/50 truncate mt-0.5">{subtitle}</p>
        {thread.lastMessagePreview ? (
          <p
            className={cn(
              "text-xs truncate mt-1",
              thread.unreadCount > 0 ? "text-white/70" : "text-white/40"
            )}
          >
            {thread.lastMessagePreview}
          </p>
        ) : null}
      </div>

      {thread.unreadCount > 0 ? (
        <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
          {thread.unreadCount}
        </div>
      ) : null}
    </button>
  );
}

function MessageBubble({
  message,
}: {
  message: {
    id: string;
    body: string;
    senderName: string;
    createdAt: string | null;
    isMine: boolean;
  };
}) {
  return (
    <div className={cn("flex gap-3", message.isMine ? "flex-row-reverse" : "flex-row")}>
      {!message.isMine ? (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-gradient-to-br from-indigo-600/40 to-purple-600/40 text-xs">
            {initialsFromName(message.senderName || "U")}
          </AvatarFallback>
        </Avatar>
      ) : null}

      <div className={cn("max-w-[78%] space-y-1", message.isMine ? "items-end" : "items-start")}>
        {!message.isMine ? (
          <p className="text-[10px] text-white/50 px-3">{message.senderName}</p>
        ) : null}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5",
            message.isMine
              ? "bg-brand text-white rounded-br-md"
              : "bg-white/10 text-white rounded-bl-md"
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.body}</p>
        </div>
        <p
          className={cn(
            "text-[10px] text-white/40 px-3",
            message.isMine ? "text-right" : "text-left"
          )}
        >
          {formatMessageTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

function TeacherThreadView({
  threadId,
  canSend,
  onBack,
  onMessageSent,
}: {
  threadId: string;
  canSend: boolean;
  onBack: () => void;
  onMessageSent: () => Promise<void>;
}) {
  const busyToast = useBusyToast();
  const { data: threadData, isLoading: threadLoading, error: threadError } = useTeacherMessageThread(threadId);
  const {
    data: messagesData,
    isLoading: messagesLoading,
    error: messagesError,
    refetch: refetchMessages,
  } = useTeacherThreadMessages(threadId);

  const [newMessage, setNewMessage] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const thread = threadData?.data.thread;
  const messages = React.useMemo(() => messagesData?.data.messages ?? [], [messagesData]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const counterpartNames = React.useMemo(() => {
    if (!thread) return "Conversation";
    const nonTeacher = thread.participants
      .filter((participant) => participant.role !== "teacher")
      .map((participant) => participant.name);
    return thread.student?.name || nonTeacher.join(", ") || "Conversation";
  }, [thread]);

  const handleSend = async () => {
    if (!canSend) return;
    if (!newMessage.trim()) {
      busyToast.error("Message cannot be empty");
      return;
    }

    await busyToast.promise(
      fetch(`/api/teacher/messages/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newMessage.trim() }),
      }).then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to send message");
        }
        return payload;
      }),
      {
        loading: "Sending message...",
        success: "Message sent",
        error: "Failed to send message",
      }
    );

    setNewMessage("");
    await refetchMessages();
    await onMessageSent();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  if (threadLoading || messagesLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="border-b border-white/10 p-4">
          <Skeleton className="h-6 w-52" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-14 w-3/4 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (threadError || messagesError || !thread) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-300/60 mb-2" />
          <p className="text-sm text-white/60">Failed to load conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-white/10 p-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="lg:hidden h-8 w-8 rounded-lg"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-gradient-to-br from-indigo-600/40 to-purple-600/40">
            {initialsFromName(counterpartNames || "C")}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">{counterpartNames}</p>
          <p className="text-xs text-white/50 truncate">
            {thread.subject || "Conversation"}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-10 w-10 text-white/30 mb-3" />
            <p className="text-sm text-white/50">No messages yet</p>
            <p className="text-xs text-white/30 mt-1">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-end gap-3">
          <Textarea
            value={newMessage}
            onChange={(event) => setNewMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={canSend ? "Type a message..." : "Messaging is disabled"}
            className="min-h-10 max-h-32 flex-1 resize-none rounded-xl border-white/15 bg-white/5"
            rows={1}
            disabled={!canSend}
          />
          <Button
            onClick={() => void handleSend()}
            disabled={!newMessage.trim() || !canSend}
            size="icon"
            className="h-10 w-10 rounded-xl bg-brand hover:bg-brand/80"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function TeacherMessagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const busyToast = useBusyToast();

  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canView = can(permissions, PERMISSIONS.messagesView);
  const canSend = can(permissions, PERMISSIONS.messagesSend);

  const initialThreadId = searchParams?.get("thread") || null;
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(initialThreadId);
  const [searchQuery, setSearchQuery] = React.useState("");

  const {
    data: threadsData,
    isLoading: threadsLoading,
    error: threadsError,
    refetch: refetchThreads,
  } = useTeacherMessageThreads();
  const threads = React.useMemo(() => threadsData?.data.threads ?? [], [threadsData]);

  const totalUnread = React.useMemo(
    () => threads.reduce((sum, thread) => sum + thread.unreadCount, 0),
    [threads]
  );

  React.useEffect(() => {
    setSelectedThreadId(initialThreadId);
  }, [initialThreadId]);

  const filteredThreads = React.useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const query = searchQuery.trim().toLowerCase();

    return threads.filter((thread) => {
      const name = (thread.student?.name || thread.participants[0]?.name || "").toLowerCase();
      const subject = (thread.subject || "").toLowerCase();
      const preview = (thread.lastMessagePreview || "").toLowerCase();
      const participants = thread.participants
        .map((participant) => participant.name.toLowerCase())
        .join(" ");

      return (
        name.includes(query) ||
        subject.includes(query) ||
        preview.includes(query) ||
        participants.includes(query)
      );
    });
  }, [searchQuery, threads]);

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    router.push(`/teacher/communication/messages?thread=${threadId}`, { scroll: false });
  };

  const handleBackToThreads = () => {
    setSelectedThreadId(null);
    router.push("/teacher/communication/messages", { scroll: false });
  };

  const { data: classesData } = useTeacherClasses();
  const classOptions = React.useMemo(
    () =>
      (classesData?.data.classes || []).map((cls) => ({
        id: cls._id,
        name: cls.name,
      })),
    [classesData]
  );

  const [composeOpen, setComposeOpen] = React.useState(false);
  const [selectedClassId, setSelectedClassId] = React.useState("");
  const [selectedStudentId, setSelectedStudentId] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");

  const { data: rosterData } = useClassRoster(composeOpen ? selectedClassId : undefined);
  const roster = React.useMemo(() => rosterData?.data.students ?? [], [rosterData]);

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
    await refetchThreads();

    const threadId = result?.data?.threadId as string | undefined;
    if (threadId) {
      setSelectedThreadId(threadId);
      router.push(`/teacher/communication/messages?thread=${threadId}`, { scroll: false });
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

  if (threadsLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex">
        <div className="w-80 border-r border-white/10 p-4 space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="hidden lg:block flex-1 p-8">
          <Skeleton className="h-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (threadsError) {
    return (
      <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent p-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-300/60 mb-4" />
        <p className="text-red-200/80">Failed to load messages. Please try again.</p>
      </Card>
    );
  }

  return (
    <>
      <div className="h-[calc(100vh-8rem)] flex rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black overflow-hidden">
        <div
          className={cn(
            "w-full lg:w-80 border-r border-white/10 flex flex-col",
            selectedThreadId && "hidden lg:flex"
          )}
        >
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-semibold text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-indigo-300" />
                Messages
                {totalUnread > 0 ? (
                  <Badge className="bg-brand text-white text-[10px]">{totalUnread}</Badge>
                ) : null}
              </h1>
              {canSend ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setComposeOpen(true)}
                  className="h-8 rounded-lg border border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                >
                  <Plus className="h-4 w-4" />
                  New
                </Button>
              ) : null}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search conversations..."
                className="pl-9 h-9 rounded-lg border-white/15 bg-white/5 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredThreads.length > 0 ? (
              filteredThreads.map((thread) => (
                <ThreadListItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === selectedThreadId}
                  onClick={() => handleSelectThread(thread.id)}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <Inbox className="h-10 w-10 text-white/30 mb-3" />
                <p className="text-sm text-white/50">
                  {searchQuery ? "No conversations found" : "No conversations yet"}
                </p>
                <p className="text-xs text-white/30 mt-1">
                  Start a thread with a student to begin messaging
                </p>
              </div>
            )}
          </div>
        </div>

        {selectedThreadId ? (
          <TeacherThreadView
            threadId={selectedThreadId}
            canSend={canSend}
            onBack={handleBackToThreads}
            onMessageSent={async () => {
              await refetchThreads();
            }}
          />
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl border border-white/10 bg-indigo-500/10 mb-4">
                <MessageSquare className="h-8 w-8 text-indigo-300" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Select a Conversation</h2>
              <p className="text-sm text-white/50 max-w-sm">
                Choose a conversation from the list to view messages and reply.
              </p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="border-white/10 bg-[#0f0f14] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg">Start conversation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                  Class group
                </label>
                <PremiumSelect value={selectedClassId} onValueChange={setSelectedClassId}>
                  <PremiumSelectTrigger>
                    <PremiumSelectValue placeholder="Select class" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {classOptions.map((classGroup) => (
                      <PremiumSelectItem key={classGroup.id} value={classGroup.id}>
                        {classGroup.name}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                  Student
                </label>
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
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Subject (optional)
              </label>
              <Input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="e.g. Mathematics"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Message
              </label>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type your first message..."
                className="min-h-[120px] border-white/10 bg-white/5 text-white"
              />
            </div>

            {classOptions.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60 inline-flex items-center gap-2">
                <User className="h-3.5 w-3.5" />
                No assigned class groups available yet.
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setComposeOpen(false)}
              className="border-white/10 text-white/60"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateThread()}
              disabled={!canSend}
              className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
            >
              <Send className="h-4 w-4" />
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function TeacherMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[calc(100vh-8rem)] flex">
          <div className="w-80 border-r border-white/10 p-4 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <TeacherMessagesPageContent />
    </Suspense>
  );
}

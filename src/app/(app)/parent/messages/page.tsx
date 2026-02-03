// src/app/(app)/parent/messages/page.tsx
"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  AlertTriangle,
  Send,
  ChevronLeft,
  User,
  Search,
  Plus,
  Clock,
  Inbox,
} from "lucide-react";
import { useParentMessages, useParentThread, useSendMessage } from "@/hooks/parent/useParentMessages";
import type { MessageThread, ThreadMessage } from "@/hooks/parent/useParentMessages";
import { format, parseISO, isToday, isYesterday, formatDistanceToNow } from "date-fns";

/* --------------------------------------------------------------------------------
   Helpers
-------------------------------------------------------------------------------- */
function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0]!.charAt(0)?.toUpperCase() ?? "";
  return (
    (parts[0]?.charAt(0)?.toUpperCase() ?? "") +
    (parts[parts.length - 1]?.charAt(0)?.toUpperCase() ?? "")
  );
}

function formatMessageTime(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) {
    return format(date, "h:mm a");
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  return format(date, "MMM d");
}

function formatFullTime(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) {
    return format(date, "h:mm a");
  }
  return format(date, "MMM d, h:mm a");
}

/* --------------------------------------------------------------------------------
   Thread List Item
-------------------------------------------------------------------------------- */
function ThreadListItem({
  thread,
  isActive,
  onClick,
}: {
  thread: MessageThread;
  isActive: boolean;
  onClick: () => void;
}) {
  const mainParticipant = thread.participants[0];
  const displayName = mainParticipant?.name || "Unknown";

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
        {mainParticipant?.photoUrl ? (
          <AvatarImage src={mainParticipant.photoUrl} alt={displayName} />
        ) : null}
        <AvatarFallback className="bg-gradient-to-br from-indigo-600/40 to-purple-600/40 text-sm font-semibold">
          {initialsFromName(displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("font-medium truncate", thread.unreadCount > 0 ? "text-white" : "text-white/80")}>
            {displayName}
          </p>
          {thread.lastMessageAt && (
            <span className="text-[10px] text-white/40 shrink-0">
              {formatMessageTime(thread.lastMessageAt)}
            </span>
          )}
        </div>
        <p className="text-xs text-white/50 truncate mt-0.5">{thread.subject}</p>
        {thread.lastMessagePreview && (
          <p className={cn("text-xs truncate mt-1", thread.unreadCount > 0 ? "text-white/70" : "text-white/40")}>
            {thread.lastMessagePreview}
          </p>
        )}
        {thread.studentName && (
          <Badge variant="outline" className="mt-1.5 text-[10px] bg-white/5 text-white/50 border-white/20">
            Re: {thread.studentName}
          </Badge>
        )}
      </div>

      {thread.unreadCount > 0 && (
        <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
          {thread.unreadCount}
        </div>
      )}
    </button>
  );
}

/* --------------------------------------------------------------------------------
   Message Bubble
-------------------------------------------------------------------------------- */
function MessageBubble({ message }: { message: ThreadMessage }) {
  return (
    <div className={cn("flex gap-3", message.isOwn ? "flex-row-reverse" : "flex-row")}>
      {!message.isOwn && (
        <Avatar className="h-8 w-8 shrink-0">
          {message.senderPhotoUrl ? (
            <AvatarImage src={message.senderPhotoUrl} alt={message.senderName} />
          ) : null}
          <AvatarFallback className="bg-gradient-to-br from-indigo-600/40 to-purple-600/40 text-xs">
            {initialsFromName(message.senderName)}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn("max-w-[70%] space-y-1", message.isOwn ? "items-end" : "items-start")}>
        {!message.isOwn && (
          <p className="text-[10px] text-white/50 px-3">{message.senderName}</p>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5",
            message.isOwn
              ? "bg-brand text-white rounded-br-md"
              : "bg-white/10 text-white rounded-bl-md"
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.body}</p>
        </div>
        <p className={cn("text-[10px] text-white/40 px-3", message.isOwn ? "text-right" : "text-left")}>
          {formatFullTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Thread View
-------------------------------------------------------------------------------- */
function ThreadView({
  threadId,
  onBack,
}: {
  threadId: string;
  onBack: () => void;
}) {
  const { data, isLoading, error } = useParentThread(threadId);
  const sendMessage = useSendMessage();
  const [newMessage, setNewMessage] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sendMessage.isPending) return;
    try {
      await sendMessage.mutateAsync({ threadId, message: newMessage.trim() });
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="border-b border-white/10 p-4">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-3/4" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-300/60 mb-2" />
          <p className="text-sm text-white/60">Failed to load conversation</p>
        </div>
      </div>
    );
  }

  const { thread, messages } = data;
  const mainParticipant = thread.participants[0];

  return (
    <div className="flex-1 flex flex-col">
      {/* Thread Header */}
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
          {mainParticipant?.photoUrl ? (
            <AvatarImage src={mainParticipant.photoUrl} alt={mainParticipant.name} />
          ) : null}
          <AvatarFallback className="bg-gradient-to-br from-indigo-600/40 to-purple-600/40">
            {initialsFromName(mainParticipant?.name || "?")}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">{mainParticipant?.name || "Unknown"}</p>
          <p className="text-xs text-white/50 truncate">{thread.subject}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-10 w-10 text-white/30 mb-3" />
            <p className="text-sm text-white/50">No messages yet</p>
            <p className="text-xs text-white/30 mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-end gap-3">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="min-h-10 max-h-32 flex-1 resize-none rounded-xl border-white/15 bg-white/5"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessage.isPending}
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

/* --------------------------------------------------------------------------------
   Main Content
-------------------------------------------------------------------------------- */
function MessagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(
    searchParams?.get("thread") || null
  );
  const [searchQuery, setSearchQuery] = React.useState("");

  const { data, isLoading, error } = useParentMessages();

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    router.push(`?thread=${threadId}`, { scroll: false });
  };

  const handleBack = () => {
    setSelectedThreadId(null);
    router.push("/parent/messages", { scroll: false });
  };

  const filteredThreads = React.useMemo(() => {
    if (!data?.threads) return [];
    if (!searchQuery) return data.threads;
    const query = searchQuery.toLowerCase();
    return data.threads.filter(
      (t) =>
        t.subject.toLowerCase().includes(query) ||
        t.participants.some((p) => p.name?.toLowerCase().includes(query)) ||
        t.studentName?.toLowerCase().includes(query)
    );
  }, [data?.threads, searchQuery]);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex">
        <div className="w-80 border-r border-white/10 p-4 space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-linear-to-br from-red-950/40 to-transparent p-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-300/60 mb-4" />
        <p className="text-red-200/80">Failed to load messages. Please try again.</p>
      </Card>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black overflow-hidden">
      {/* Thread List */}
      <div
        className={cn(
          "w-full lg:w-80 border-r border-white/10 flex flex-col",
          selectedThreadId && "hidden lg:flex"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-300" />
              Messages
              {data?.totalUnread ? (
                <Badge className="bg-brand text-white text-[10px]">{data.totalUnread}</Badge>
              ) : null}
            </h1>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-9 h-9 rounded-lg border-white/15 bg-white/5 text-sm"
            />
          </div>
        </div>

        {/* Thread List */}
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
                Messages from teachers will appear here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Thread View or Empty State */}
      {selectedThreadId ? (
        <ThreadView threadId={selectedThreadId} onBack={handleBack} />
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl border border-white/10 bg-indigo-500/10 mb-4">
              <MessageSquare className="h-8 w-8 text-indigo-300" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Select a Conversation</h2>
            <p className="text-sm text-white/50 max-w-sm">
              Choose a conversation from the list to view messages
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------------
   Page Export
-------------------------------------------------------------------------------- */
export default function ParentMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[calc(100vh-8rem)] flex">
          <div className="w-80 border-r border-white/10 p-4 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <MessagesPageContent />
    </Suspense>
  );
}

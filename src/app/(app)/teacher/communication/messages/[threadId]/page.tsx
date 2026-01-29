"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { useTeacherMessageThread } from "@/hooks/teacher/useTeacherMessageThread";
import { useTeacherThreadMessages } from "@/hooks/teacher/useTeacherThreadMessages";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";

function formatTimestamp(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function TeacherMessageThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params?.threadId;
  const busyToast = useBusyToast();

  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canSend = can(permissions, PERMISSIONS.messagesSend);

  const { data: threadData, isLoading: threadLoading } = useTeacherMessageThread(threadId);
  const { data: messagesData, isLoading: messagesLoading, refetch } = useTeacherThreadMessages(threadId);

  const [message, setMessage] = React.useState("");

  const thread = threadData?.data.thread;
  const messages = messagesData?.data.messages || [];

  const handleSend = async () => {
    if (!threadId) return;
    if (!message.trim()) {
      busyToast.error("Message cannot be empty");
      return;
    }

    await busyToast.promise(
      fetch(`/api/teacher/messages/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: message.trim() }),
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

    setMessage("");
    await refetch();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/teacher/communication/messages" className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to messages
        </Link>
        <h1 className="text-2xl font-semibold text-white">Conversation</h1>
        <p className="text-sm text-white/60">
          {thread?.student?.name || thread?.participants.map((p) => p.name).join(", ") || "Conversation"}
        </p>
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {threadLoading || messagesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-16 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
              No messages yet. Send the first note to start the conversation.
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.isMine ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl border border-white/10 px-4 py-3 text-sm",
                      msg.isMine
                        ? "bg-indigo-500/20 text-white"
                        : "bg-white/5 text-white/80"
                    )}
                  >
                    <div className="text-xs font-semibold text-white/70">
                      {msg.isMine ? "You" : msg.senderName}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-white/80">{msg.body}</div>
                    <div className="mt-2 text-[11px] text-white/40">{formatTimestamp(msg.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Send a reply</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={canSend ? "Write your message..." : "Messaging is disabled"}
            disabled={!canSend}
            className="min-h-[120px] border-white/10 bg-white/5 text-white"
          />
          <Button
            onClick={handleSend}
            disabled={!canSend}
            className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
          >
            <Send className="h-4 w-4" />
            Send message
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

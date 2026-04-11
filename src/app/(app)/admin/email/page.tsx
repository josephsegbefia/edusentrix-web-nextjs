"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Mail,
  Inbox,
  Send,
  AlertCircle,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  MailPlus,
  Archive,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import {
  useEmailInbox,
  useEmailMessages,
  useUpdateThread,
  useComposeEmail,
  useEmailBatches,
  type EmailThreadSummary,
} from "@/hooks/admin/useEmailInbox";

type TabId = "inbox" | "sent" | "compose" | "bulk";

const STATUS_ICON: Record<string, React.ReactNode> = {
  sent: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  delivered: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  queued: <Clock className="h-3.5 w-3.5 text-amber-400" />,
  failed: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  received: <Mail className="h-3.5 w-3.5 text-blue-400" />,
};

function ThreadList({
  threads,
  selectedId,
  onSelect,
}: {
  threads: EmailThreadSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/40">
        <Inbox className="mb-3 h-10 w-10" />
        <p className="text-sm">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5">
      {threads.map((thread) => (
        <button
          key={thread._id}
          onClick={() => onSelect(thread._id)}
          className={cn(
            "w-full px-4 py-3 text-left transition-colors hover:bg-white/5",
            selectedId === thread._id && "bg-white/10",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {thread.unreadCount > 0 && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" />
                )}
                <p
                  className={cn(
                    "truncate text-sm",
                    thread.unreadCount > 0
                      ? "font-semibold text-white"
                      : "text-white/80",
                  )}
                >
                  {thread.subject}
                </p>
              </div>
              <p className="mt-0.5 truncate text-xs text-white/40">
                {thread.participants
                  .map((p) => p.name || p.email)
                  .slice(0, 2)
                  .join(", ")}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[10px] text-white/30">
                {thread.lastMessageAt
                  ? new Date(thread.lastMessageAt).toLocaleDateString()
                  : ""}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] border-white/10 text-white/40"
              >
                {thread.threadType}
              </Badge>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function MessageView({
  threadId,
  onBack,
}: {
  threadId: string;
  onBack: () => void;
}) {
  const { data, isLoading } = useEmailMessages(threadId);
  const updateThread = useUpdateThread();
  const messages = data?.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-white/60 hover:text-white md:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            updateThread.mutate({ threadId, status: "archived" })
          }
          className="text-white/40 hover:text-white"
        >
          <Archive className="mr-1 h-4 w-4" /> Archive
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg bg-white/5"
              />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-white/40 py-8">
            No messages in this thread
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg._id}
              className={cn(
                "rounded-xl border p-4",
                msg.direction === "outbound"
                  ? "border-violet-500/20 bg-violet-500/5 ml-8"
                  : "border-white/10 bg-white/5 mr-8",
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  {STATUS_ICON[msg.status] || null}
                  <span className="font-medium text-white/70">
                    {msg.fromName || msg.from}
                  </span>
                  <span>&rarr;</span>
                  <span>{msg.to}</span>
                </div>
                <span className="text-[10px] text-white/30">
                  {msg.sentAt
                    ? new Date(msg.sentAt).toLocaleString()
                    : msg.createdAt
                      ? new Date(msg.createdAt).toLocaleString()
                      : ""}
                </span>
              </div>
              <p className="mb-2 text-xs font-medium text-white/60">
                {msg.subject}
              </p>
              {msg.textBody ? (
                <p className="text-sm text-white/80 whitespace-pre-wrap">
                  {msg.textBody}
                </p>
              ) : msg.htmlBody ? (
                <div
                  className="prose prose-invert prose-sm max-w-none text-white/80"
                  dangerouslySetInnerHTML={{ __html: msg.htmlBody }}
                />
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ComposeView({ onSent }: { onSent: () => void }) {
  const compose = useComposeEmail();
  const [to, setTo] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");

  const handleSend = async () => {
    if (!to || !subject || !body) return;
    try {
      await compose.mutateAsync({
        to,
        subject,
        htmlContent: `<p>${body.replace(/\n/g, "<br/>")}</p>`,
        textContent: body,
      });
      setTo("");
      setSubject("");
      setBody("");
      onSent();
    } catch {
      // handled by mutation state
    }
  };

  return (
    <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
      <CardContent className="space-y-4 p-6">
        <div className="space-y-2">
          <Label className="text-white/70">To</Label>
          <Input
            placeholder="recipient@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white/70">Subject</Label>
          <Input
            placeholder="Email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-white/70">Message</Label>
          <Textarea
            placeholder="Write your message..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="border-white/10 bg-white/5 text-white placeholder:text-white/30 resize-none"
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleSend}
            disabled={compose.isPending || !to || !subject || !body}
            className="gap-2 bg-linear-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 hover:from-violet-600 hover:to-purple-700"
          >
            {compose.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
        </div>
        {compose.isError && (
          <p className="text-sm text-red-400">
            {compose.error?.message || "Failed to send"}
          </p>
        )}
        {compose.isSuccess && (
          <p className="text-sm text-emerald-400">Email sent successfully</p>
        )}
      </CardContent>
    </Card>
  );
}

function BulkSendsView() {
  const { data, isLoading } = useEmailBatches();
  const batches = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg bg-white/5"
          />
        ))}
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/40">
        <Send className="mb-3 h-10 w-10" />
        <p className="text-sm">No bulk sends yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => (
        <Card
          key={batch._id}
          className="border border-white/10 bg-white/5"
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-white">{batch.subject}</p>
              <p className="mt-0.5 text-xs text-white/40">
                {batch.sentCount}/{batch.recipientCount} sent
                {batch.failedCount > 0 &&
                  ` · ${batch.failedCount} failed`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  batch.status === "completed"
                    ? "border-emerald-500/30 text-emerald-400"
                    : batch.status === "running" || batch.status === "queued"
                      ? "border-amber-500/30 text-amber-400"
                      : batch.status === "failed"
                        ? "border-red-500/30 text-red-400"
                        : "border-white/10 text-white/40",
                )}
              >
                {batch.status}
              </Badge>
              <span className="text-[10px] text-white/30">
                {new Date(batch.createdAt).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function SchoolEmailPage() {
  const [activeTab, setActiveTab] = React.useState<TabId>("inbox");
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(
    null,
  );
  const [mailboxFilter, setMailboxFilter] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState("open");

  const inboxQuery = useEmailInbox({
    status: statusFilter,
    mailbox: mailboxFilter || undefined,
  });

  const threads = inboxQuery.data?.data ?? [];

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "inbox", label: "Inbox", icon: <Inbox className="h-4 w-4" /> },
    { id: "sent", label: "Sent", icon: <Send className="h-4 w-4" /> },
    { id: "compose", label: "Compose", icon: <MailPlus className="h-4 w-4" /> },
    { id: "bulk", label: "Bulk Sends", icon: <Mail className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/20">
              <Mail className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="bg-linear-to-r from-blue-200 via-cyan-200 to-teal-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                  Email
                </h1>
                <Badge
                  variant="outline"
                  className="border-blue-500/30 bg-blue-500/10 text-blue-300"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  Communications
                </Badge>
              </div>
              <p className="mt-1 text-sm text-white/60">
                Manage school emails, conversations, and bulk communications
              </p>
            </div>
          </div>

          <Button
            onClick={() => inboxQuery.refetch()}
            disabled={inboxQuery.isFetching}
            variant="ghost"
            className="gap-2 text-white/60 hover:text-white"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                inboxQuery.isFetching && "animate-spin",
              )}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedThreadId(null);
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white/80",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "inbox" && (
        <div className="flex flex-col md:flex-row gap-4">
          {/* Thread list */}
          <Card
            className={cn(
              "border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl md:w-96 shrink-0",
              selectedThreadId && "hidden md:block",
            )}
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <div className="flex gap-1">
                {["open", "closed", "all"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      statusFilter === s
                        ? "bg-white/10 text-white"
                        : "text-white/40 hover:text-white/60",
                    )}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <div className="relative">
                <button
                  onClick={() =>
                    setMailboxFilter(
                      mailboxFilter === "billing" ? null : "billing",
                    )
                  }
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                    mailboxFilter === "billing"
                      ? "bg-amber-500/20 text-amber-300"
                      : "text-white/40 hover:text-white/60",
                  )}
                >
                  Billing
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
            </div>

            {inboxQuery.isLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-lg bg-white/5"
                  />
                ))}
              </div>
            ) : inboxQuery.isError ? (
              <div className="flex items-center gap-3 p-6 text-red-400">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">Failed to load inbox</p>
              </div>
            ) : (
              <ThreadList
                threads={threads}
                selectedId={selectedThreadId}
                onSelect={setSelectedThreadId}
              />
            )}
          </Card>

          {/* Message view */}
          <Card
            className={cn(
              "flex-1 border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl min-h-[500px]",
              !selectedThreadId && "hidden md:flex",
            )}
          >
            {selectedThreadId ? (
              <MessageView
                threadId={selectedThreadId}
                onBack={() => setSelectedThreadId(null)}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-white/30">
                <Mail className="mb-3 h-12 w-12" />
                <p className="text-sm">Select a conversation to view</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "sent" && (
        <div className="flex flex-col md:flex-row gap-4">
          <SentView />
        </div>
      )}

      {activeTab === "compose" && (
        <ComposeView onSent={() => setActiveTab("inbox")} />
      )}

      {activeTab === "bulk" && <BulkSendsView />}
    </div>
  );
}

function SentView() {
  const { data, isLoading } = useEmailInbox({ status: "all" });
  const threads = data?.data ?? [];
  const sentThreads = threads.filter(
    (t) => t.lastOutboundAt !== null,
  );

  if (isLoading) {
    return (
      <Card className="flex-1 border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl p-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-white/5"
            />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex-1 border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
      {sentThreads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-white/40">
          <Send className="mb-3 h-10 w-10" />
          <p className="text-sm">No sent conversations yet</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {sentThreads.map((thread) => (
            <div key={thread._id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white/80">
                    {thread.subject}
                  </p>
                  <p className="mt-0.5 text-xs text-white/40">
                    {thread.participants
                      .map((p) => p.name || p.email)
                      .slice(0, 2)
                      .join(", ")}
                  </p>
                </div>
                <span className="text-[10px] text-white/30">
                  {thread.lastOutboundAt
                    ? new Date(thread.lastOutboundAt).toLocaleDateString()
                    : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

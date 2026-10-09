"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor, extractPlainText } from "@/components/ui/rich-text-editor";
import {
  ComposeAttachmentPicker,
  type ComposeAttachment,
} from "@/components/email/ComposeAttachmentPicker";
import { useSchool } from "@/hooks/admin/useSchool";
import { cn } from "@/lib/utils";
import { WorkspaceScope } from "@/components/theme/workspace-scope";
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
  FileText,
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

const SCHOOL_EMAIL_TEMPLATES = [
  {
    id: "announcement",
    label: "Announcement",
    subject: "Important update from {schoolName}",
    body: `
      <p>Dear recipient,</p>
      <p>We are writing from <strong>{schoolName}</strong> to share the following update.</p>
      <p><br></p>
      <p>Kindly review this information and contact the school office if you need clarification.</p>
      <p>Regards,<br>{schoolName}</p>
    `,
  },
  {
    id: "reminder",
    label: "Reminder",
    subject: "Reminder from {schoolName}",
    body: `
      <p>Dear recipient,</p>
      <p>This is a reminder from <strong>{schoolName}</strong>.</p>
      <p><br></p>
      <p>Please take the required action at your earliest convenience.</p>
      <p>Regards,<br>{schoolName}</p>
    `,
  },
  {
    id: "follow_up",
    label: "Follow-up",
    subject: "Follow-up from {schoolName}",
    body: `
      <p>Dear recipient,</p>
      <p>We are following up on behalf of <strong>{schoolName}</strong>.</p>
      <p><br></p>
      <p>Please reply to this email if you have any questions or need further assistance.</p>
      <p>Regards,<br>{schoolName}</p>
    `,
  },
] as const;

function applySchoolTemplateVariables(value: string, schoolName: string) {
  return value.replaceAll("{schoolName}", schoolName);
}

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
      <div className="flex flex-col items-center justify-center py-16 text-(--ws-fg-40)">
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
            "w-full px-4 py-3 text-left transition-colors hover:bg-(--ws-fill-strong)",
            selectedId === thread._id && "bg-(--ws-fill-strong)",
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
                      ? "font-semibold text-(--ws-fg)"
                      : "text-(--ws-fg-80)",
                  )}
                >
                  {thread.subject}
                </p>
              </div>
              <p className="mt-0.5 truncate text-xs text-(--ws-fg-40)">
                {thread.participants
                  .map((p) => p.name || p.email)
                  .slice(0, 2)
                  .join(", ")}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[10px] text-(--ws-fg-40)">
                {thread.lastMessageAt
                  ? new Date(thread.lastMessageAt).toLocaleDateString()
                  : ""}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] border-(--ws-line) text-(--ws-fg-40)"
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
  const { data, isLoading, refetch } = useEmailMessages(threadId);
  const updateThread = useUpdateThread();
  const compose = useComposeEmail();
  const [replyBody, setReplyBody] = React.useState("");
  const messages = data?.data ?? [];
  const lastInbound = [...messages].reverse().find((msg) => msg.direction === "inbound");
  const firstMessage = messages[0] ?? null;
  const replyRecipient = lastInbound
    ? {
        email: lastInbound.from,
        name: lastInbound.fromName || undefined,
      }
    : null;

  const handleReply = async () => {
    if (!replyRecipient || !replyBody.trim()) return;
    const plainText = extractPlainText(replyBody);
    if (!plainText.trim()) return;
    await compose.mutateAsync({
      to: replyRecipient.email,
      toName: replyRecipient.name,
      subject: firstMessage?.subject?.toLowerCase().startsWith("re:")
        ? firstMessage.subject
        : `Re: ${firstMessage?.subject || "Email conversation"}`,
      htmlContent: replyBody,
      textContent: plainText,
      threadId,
      threadType: "manual",
    });
    setReplyBody("");
    await refetch();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-(--ws-line) px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-(--ws-fg-60) hover:text-(--ws-fg) md:hidden"
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
          className="text-(--ws-fg-40) hover:text-(--ws-fg)"
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
                className="h-20 animate-pulse rounded-lg bg-(--ws-fill)"
              />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-(--ws-fg-40) py-8">
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
                  : "border-(--ws-line) bg-(--ws-fill) mr-8",
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs text-(--ws-fg-50)">
                  {STATUS_ICON[msg.status] || null}
                  <span className="font-medium text-(--ws-fg-70)">
                    {msg.fromName || msg.from}
                  </span>
                  <span>&rarr;</span>
                  <span>{msg.to}</span>
                </div>
                <span className="text-[10px] text-(--ws-fg-40)">
                  {msg.sentAt
                    ? new Date(msg.sentAt).toLocaleString()
                    : msg.createdAt
                      ? new Date(msg.createdAt).toLocaleString()
                      : ""}
                </span>
              </div>
              <p className="mb-2 text-xs font-medium text-(--ws-fg-60)">
                {msg.subject}
              </p>
              {msg.textBody ? (
                <p className="text-sm text-(--ws-fg-80) whitespace-pre-wrap">
                  {msg.textBody}
                </p>
              ) : msg.htmlBody ? (
                <div
                  className="prose prose-invert prose-sm max-w-none text-(--ws-fg-80)"
                  dangerouslySetInnerHTML={{ __html: msg.htmlBody }}
                />
              ) : null}
              {!!msg.attachments?.length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.attachments.map((attachment, index) => (
                    <span
                      key={`${attachment.name}-${index}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-(--ws-line) bg-(--ws-fill) px-2.5 py-1 text-xs text-(--ws-fg-60)"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {attachment.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <div className="border-t border-(--ws-line) bg-black/10 p-4">
        {replyRecipient ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-(--ws-fg)">Reply to {replyRecipient.name || replyRecipient.email}</p>
                <p className="text-xs text-(--ws-fg-40)">{replyRecipient.email}</p>
              </div>
              {compose.isError ? (
                <p className="text-xs font-medium text-(--ws-rose)">
                  {compose.error?.message || "Failed to send reply"}
                </p>
              ) : null}
            </div>
            <RichTextEditor
              placeholder="Write your reply..."
              value={replyBody}
              onChange={setReplyBody}
              toolbarVariant="minimal"
              minHeight="130px"
              maxHeight="260px"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleReply}
                disabled={compose.isPending || !extractPlainText(replyBody).trim()}
                className="gap-2 bg-linear-to-r from-blue-500 to-cyan-500 text-(--ws-fg) shadow-lg shadow-cyan-500/15 hover:from-blue-600 hover:to-cyan-600"
              >
                {compose.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send reply
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-(--ws-line) bg-(--ws-fill) px-4 py-3 text-sm text-(--ws-fg-40)">
            Replies appear here when someone responds to a school email. Select a thread with an inbound message to reply.
          </div>
        )}
      </div>
    </div>
  );
}

function ComposeView({ onSent }: { onSent: () => void }) {
  const compose = useComposeEmail();
  const { data: schoolPayload } = useSchool();
  const schoolName = schoolPayload?.data?.name?.trim() || "your school";
  const [to, setTo] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [attachments, setAttachments] = React.useState<ComposeAttachment[]>([]);

  const applyTemplate = (template: (typeof SCHOOL_EMAIL_TEMPLATES)[number]) => {
    setSubject(applySchoolTemplateVariables(template.subject, schoolName));
    setBody(applySchoolTemplateVariables(template.body, schoolName));
  };

  const handleSend = async () => {
    if (!to || !subject || !body) return;
    try {
      await compose.mutateAsync({
        to,
        subject,
        htmlContent: body,
        textContent: extractPlainText(body),
        attachments,
      });
      setTo("");
      setSubject("");
      setBody("");
      setAttachments([]);
      onSent();
    } catch {
      // handled by mutation state
    }
  };

  return (
    <Card className="border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) backdrop-blur-xl">
      <CardContent className="space-y-4 p-6">
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-(--ws-cyan)">
            Sent as {schoolName} through EduSentrix
          </p>
          <p className="mt-1 text-xs leading-5 text-cyan-50/65">
            Recipients will see a school context note in the email so the message is clearly from {schoolName}.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-(--ws-fg-70)">Templates</Label>
          <div className="flex flex-wrap gap-2">
            {SCHOOL_EMAIL_TEMPLATES.map((template) => (
              <Button
                key={template.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyTemplate(template)}
                className="gap-2 border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70) hover:bg-(--ws-fill-strong) hover:text-(--ws-fg)"
              >
                <FileText className="h-3.5 w-3.5" />
                {template.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-(--ws-fg-70)">To</Label>
          <Input
            placeholder="recipient@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) placeholder:text-(--ws-fg-40)"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-(--ws-fg-70)">Subject</Label>
          <Input
            placeholder="Email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) placeholder:text-(--ws-fg-40)"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-(--ws-fg-70)">Message</Label>
          <RichTextEditor
            placeholder="Write your message..."
            value={body}
            onChange={setBody}
            toolbarVariant="full"
            minHeight="220px"
            maxHeight="420px"
          />
        </div>
        <ComposeAttachmentPicker
          attachments={attachments}
          onChange={setAttachments}
          disabled={compose.isPending}
        />
        <div className="flex justify-end">
          <Button
            onClick={handleSend}
            disabled={compose.isPending || !to || !subject || !body}
            className="gap-2 bg-linear-to-r from-violet-500 to-purple-600 text-(--ws-fg) shadow-lg shadow-violet-500/20 hover:from-violet-600 hover:to-purple-700"
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
            className="h-16 animate-pulse rounded-lg bg-(--ws-fill)"
          />
        ))}
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-(--ws-fg-40)">
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
          className="border border-(--ws-line) bg-(--ws-fill)"
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-(--ws-fg)">{batch.subject}</p>
              <p className="mt-0.5 text-xs text-(--ws-fg-40)">
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
                        : "border-(--ws-line) text-(--ws-fg-40)",
                )}
              >
                {batch.status}
              </Badge>
              <span className="text-[10px] text-(--ws-fg-40)">
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
    <WorkspaceScope>
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
              <Mail className="h-6 w-6 text-(--ws-cyan)" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold tracking-tight text-(--ws-fg) lg:text-4xl">
                  Email
                </h1>
                <Badge
                  variant="outline"
                  className="border-blue-500/30 bg-blue-500/10 text-(--ws-cyan)"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  Communications
                </Badge>
              </div>
              <p className="mt-1 text-sm text-(--ws-fg-60)">
                Manage school emails, conversations, and bulk communications
              </p>
            </div>
          </div>

          <Button
            onClick={() => inboxQuery.refetch()}
            disabled={inboxQuery.isFetching}
            variant="ghost"
            className="gap-2 text-(--ws-fg-60) hover:text-(--ws-fg)"
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
      <div className="flex gap-1 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-1">
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
                ? "bg-(--ws-fill-strong) text-(--ws-fg)"
                : "text-(--ws-fg-50) hover:text-(--ws-fg-80)",
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
              "border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) backdrop-blur-xl md:w-96 shrink-0",
              selectedThreadId && "hidden md:block",
            )}
          >
            <div className="flex items-center gap-2 border-b border-(--ws-line) px-4 py-3">
              <div className="flex gap-1">
                {["open", "closed", "all"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      statusFilter === s
                        ? "bg-(--ws-fill-strong) text-(--ws-fg)"
                        : "text-(--ws-fg-40) hover:text-(--ws-fg-60)",
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
                      ? "bg-amber-500/20 text-(--ws-amber)"
                      : "text-(--ws-fg-40) hover:text-(--ws-fg-60)",
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
                    className="h-14 animate-pulse rounded-lg bg-(--ws-fill)"
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
              "flex-1 border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) backdrop-blur-xl min-h-[500px]",
              !selectedThreadId && "hidden md:flex",
            )}
          >
            {selectedThreadId ? (
              <MessageView
                threadId={selectedThreadId}
                onBack={() => setSelectedThreadId(null)}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-(--ws-fg-40)">
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
    </WorkspaceScope>
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
      <Card className="flex-1 border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) backdrop-blur-xl p-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-(--ws-fill)"
            />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex-1 border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) backdrop-blur-xl">
      {sentThreads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-(--ws-fg-40)">
          <Send className="mb-3 h-10 w-10" />
          <p className="text-sm">No sent conversations yet</p>
        </div>
      ) : (
        <div className="divide-y divide-(--ws-line)">
          {sentThreads.map((thread) => (
            <div key={thread._id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-(--ws-fg-80)">
                    {thread.subject}
                  </p>
                  <p className="mt-0.5 text-xs text-(--ws-fg-40)">
                    {thread.participants
                      .map((p) => p.name || p.email)
                      .slice(0, 2)
                      .join(", ")}
                  </p>
                </div>
                <span className="text-[10px] text-(--ws-fg-40)">
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

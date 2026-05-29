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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Inbox,
  Mail,
  Send,
  AlertCircle,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  MailPlus,
  Archive,
  RefreshCw,
  ShieldBan,
  Trash2,
  Plus,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  LifeBuoy,
  Megaphone,
} from "lucide-react";
import {
  usePlatformInbox,
  usePlatformThread,
  useUpdatePlatformThread,
  usePlatformCompose,
  usePlatformMailboxSync,
  usePlatformSuppressions,
  useAddSuppression,
  useRemoveSuppression,
  type PlatformEmailThread,
} from "@/hooks/platform/useEmailInbox";

type TabId = "inbox" | "compose" | "suppressions";
type MailboxId = "hello" | "support" | "billing";

const MAILBOX_META: Record<
  MailboxId,
  {
    label: string;
    address: string;
    description: string;
    icon: React.ReactNode;
    accent: string;
    border: string;
    bg: string;
  }
> = {
  hello: {
    label: "Hello",
    address: "hello@tryedusentrix.app",
    description: "Proposals, growth outreach, and general platform mail",
    icon: <Megaphone className="h-5 w-5" />,
    accent: "text-cyan-300",
    border: "border-cyan-500/40",
    bg: "bg-cyan-500/15",
  },
  support: {
    label: "Support",
    address: "support@tryedusentrix.app",
    description: "Platform support and school reply aliases routed here",
    icon: <LifeBuoy className="h-5 w-5" />,
    accent: "text-emerald-300",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/15",
  },
  billing: {
    label: "Billing",
    address: "billing@tryedusentrix.app",
    description: "Invoices, payment follow-ups, and billing conversations",
    icon: <HandCoins className="h-5 w-5" />,
    accent: "text-amber-300",
    border: "border-amber-500/40",
    bg: "bg-amber-500/15",
  },
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  sent: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  delivered: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  queued: <Clock className="h-3.5 w-3.5 text-amber-400" />,
  failed: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  received: <Mail className="h-3.5 w-3.5 text-blue-400" />,
};

function PlatformThreadList({
  threads,
  selectedId,
  mailbox,
  onSelect,
}: {
  threads: PlatformEmailThread[];
  selectedId: string | null;
  mailbox: MailboxId;
  onSelect: (id: string) => void;
}) {
  const meta = MAILBOX_META[mailbox];

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-white/40">
        <Inbox className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium text-white/60">No conversations</p>
        <p className="mt-1 text-xs text-white/35">
          Sync {meta.address} to pull mail from Spacemail
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
          Conversations in
        </p>
        <p className={cn("mt-0.5 truncate text-sm font-semibold", meta.accent)}>
          {meta.address}
        </p>
      </div>
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
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
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
              <span className="text-[10px] text-white/30">
                {thread.lastMessageAt
                  ? new Date(thread.lastMessageAt).toLocaleDateString()
                  : ""}
              </span>
            </div>
          </div>
        </button>
      ))}
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
}: {
  msg: NonNullable<PlatformEmailThread["messages"]>[number];
}) {
  const isOutbound = msg.direction === "outbound";
  const timestamp = msg.sentAt || msg.receivedAt || msg.createdAt;

  return (
    <div
      className={cn(
        "flex w-full",
        isOutbound ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[92%] rounded-2xl border px-4 py-3 sm:max-w-[85%]",
          isOutbound
            ? "border-teal-500/25 bg-teal-500/10"
            : "border-blue-500/25 bg-blue-500/10",
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "gap-1 text-[10px] font-semibold uppercase tracking-wide",
              isOutbound
                ? "border-teal-500/30 bg-teal-500/15 text-teal-200"
                : "border-blue-500/30 bg-blue-500/15 text-blue-200",
            )}
          >
            {isOutbound ? (
              <>
                <ArrowUpRight className="h-3 w-3" />
                Sent
              </>
            ) : (
              <>
                <ArrowDownLeft className="h-3 w-3" />
                Received
              </>
            )}
          </Badge>
          {STATUS_ICON[msg.status] || null}
          <span className="text-[10px] text-white/35">
            {timestamp ? new Date(timestamp).toLocaleString() : ""}
          </span>
        </div>

        <div className="mb-2 text-xs text-white/50">
          <span className="font-medium text-white/75">
            {msg.fromName || msg.from}
          </span>
          <span className="mx-1.5 text-white/25">&rarr;</span>
          <span>{msg.to}</span>
        </div>

        {msg.subject ? (
          <p className="mb-2 text-xs font-medium text-white/60">{msg.subject}</p>
        ) : null}

        {msg.textBody ? (
          <p className="text-sm text-white/85 whitespace-pre-wrap">{msg.textBody}</p>
        ) : msg.htmlBody ? (
          <div
            className="prose prose-invert prose-sm max-w-none text-white/85"
            dangerouslySetInnerHTML={{ __html: msg.htmlBody }}
          />
        ) : (
          <p className="text-sm italic text-white/40">No message body</p>
        )}

        {!!msg.attachments?.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            {msg.attachments.map((attachment, index) => (
              <span
                key={`${attachment.name}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60"
              >
                <FileText className="h-3.5 w-3.5" />
                {attachment.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlatformMessageView({
  threadId,
  mailbox,
  onBack,
}: {
  threadId: string;
  mailbox: MailboxId;
  onBack: () => void;
}) {
  const { data, isLoading } = usePlatformThread(threadId);
  const updateThread = useUpdatePlatformThread();
  const thread = data?.data;
  const messages = thread?.messages ?? [];
  const meta = MAILBOX_META[mailbox];

  const incoming = messages.filter((m) => m.direction === "inbound");
  const outgoing = messages.filter((m) => m.direction === "outbound");

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white/60 hover:text-white md:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {thread && (
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
              {thread.subject}
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              updateThread.mutate({ threadId, status: "archived" })
            }
            className="shrink-0 text-white/40 hover:text-white"
          >
            <Archive className="mr-1 h-4 w-4" /> Archive
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("gap-1.5", meta.border, meta.bg, meta.accent)}
          >
            {meta.icon}
            {meta.address}
          </Badge>
          <span className="text-xs text-white/40">
            {incoming.length} received · {outgoing.length} sent
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8">
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
          <p className="py-8 text-center text-sm text-white/40">
            No messages in this thread
          </p>
        ) : (
          <>
            {incoming.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-300/90">
                    <ArrowDownLeft className="h-4 w-4" />
                    Incoming
                  </div>
                  <div className="h-px flex-1 bg-blue-500/20" />
                  <span className="text-[10px] text-white/35">
                    {incoming.length} message{incoming.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-4">
                  {incoming.map((msg) => (
                    <MessageBubble key={msg._id} msg={msg} />
                  ))}
                </div>
              </section>
            )}

            {outgoing.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-300/90">
                    <ArrowUpRight className="h-4 w-4" />
                    Outgoing
                  </div>
                  <div className="h-px flex-1 bg-teal-500/20" />
                  <span className="text-[10px] text-white/35">
                    {outgoing.length} message{outgoing.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-4">
                  {outgoing.map((msg) => (
                    <MessageBubble key={msg._id} msg={msg} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PlatformComposeView({ onSent }: { onSent: () => void }) {
  const compose = usePlatformCompose();
  const [to, setTo] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [attachments, setAttachments] = React.useState<ComposeAttachment[]>([]);
  const [senderFamily, setSenderFamily] = React.useState<"hello" | "support" | "billing">(
    "hello",
  );

  const handleSend = async () => {
    if (!to || !subject || !body) return;
    try {
      await compose.mutateAsync({
        to,
        subject,
        htmlContent: body,
        textContent: extractPlainText(body),
        attachments,
        senderFamily,
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
    <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
      <CardContent className="space-y-4 p-6">
        <div className="space-y-2">
          <Label className="text-white/70">Send As</Label>
          <div className="flex gap-2">
            {(["hello", "support", "billing"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSenderFamily(f)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  senderFamily === f
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-white/5 text-white/40 hover:text-white/60",
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
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
            className="gap-2 bg-linear-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-700"
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

function SuppressionsView() {
  const { data, isLoading } = usePlatformSuppressions();
  const addSuppression = useAddSuppression();
  const removeSuppression = useRemoveSuppression();
  const suppressions = data?.data ?? [];

  const [email, setEmail] = React.useState("");
  const [reason, setReason] = React.useState("");

  const handleAdd = async () => {
    if (!email || !reason) return;
    try {
      await addSuppression.mutateAsync({ email, reason });
      setEmail("");
      setReason("");
    } catch {
      // handled by mutation state
    }
  };

  return (
    <div className="space-y-4">
      {/* Add suppression */}
      <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">
            Block an Email Address
          </h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30 flex-1"
            />
            <Input
              placeholder="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30 flex-1"
            />
            <Button
              onClick={handleAdd}
              disabled={addSuppression.isPending || !email || !reason}
              className="gap-2 bg-red-500/20 text-red-300 hover:bg-red-500/30"
            >
              {addSuppression.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Block
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-white/5"
                />
              ))}
            </div>
          ) : suppressions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/40">
              <ShieldBan className="mb-3 h-10 w-10" />
              <p className="text-sm">No suppressed addresses</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {suppressions.map((s) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-white">{s.email}</p>
                    <p className="text-xs text-white/40">
                      {s.reason} &middot; {s.source} &middot;{" "}
                      {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSuppression.mutate(s.email)}
                    disabled={removeSuppression.isPending}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PlatformEmailPage() {
  const [activeTab, setActiveTab] = React.useState<TabId>("inbox");
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(
    null,
  );
  const [mailboxFilter, setMailboxFilter] = React.useState<MailboxId>("support");

  const inboxQuery = usePlatformInbox({
    mailbox: mailboxFilter,
    status: "open",
  });
  const mailboxSync = usePlatformMailboxSync();
  const threads = inboxQuery.data?.data ?? [];
  const activeMailbox = MAILBOX_META[mailboxFilter];

  const handleSync = async (reset = false) => {
    try {
      const result = await mailboxSync.mutateAsync({
        mailbox: mailboxFilter,
        reset,
      });
      const box = result?.data?.mailboxes?.[0];
      if (box?.skipped) {
        toast.error(`Sync failed: ${box.skipReason || "IMAP error"}`);
        return;
      }
      const imported = result?.data?.totalPersisted ?? box?.persisted ?? 0;
      toast.success(
        imported > 0
          ? `Synced ${imported} new message${imported === 1 ? "" : "s"}`
          : "Inbox is up to date",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
      return;
    }
    await inboxQuery.refetch();
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "inbox", label: "Inbox", icon: <Inbox className="h-4 w-4" /> },
    { id: "compose", label: "Compose", icon: <MailPlus className="h-4 w-4" /> },
    {
      id: "suppressions",
      label: "Suppressions",
      icon: <ShieldBan className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl border",
              activeMailbox.border,
              activeMailbox.bg,
              activeMailbox.accent,
            )}>
              {activeMailbox.icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="bg-linear-to-r from-emerald-200 via-teal-200 to-cyan-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                  Platform Email
                </h1>
                <Badge
                  variant="outline"
                  className={cn("gap-1.5", activeMailbox.border, activeMailbox.bg, activeMailbox.accent)}
                >
                  {activeMailbox.icon}
                  {activeMailbox.label} inbox
                </Badge>
              </div>
              <p className="mt-1 text-sm font-medium text-white/75">
                {activeMailbox.address}
              </p>
              <p className="mt-0.5 text-xs text-white/45">
                {activeMailbox.description}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => void handleSync()}
              disabled={mailboxSync.isPending || inboxQuery.isFetching}
              variant="ghost"
              className="gap-2 text-emerald-300/90 hover:text-emerald-200"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  (mailboxSync.isPending || inboxQuery.isFetching) &&
                    "animate-spin",
                )}
              />
              Sync inbox
            </Button>
            <Button
              onClick={() => void handleSync(true)}
              disabled={mailboxSync.isPending}
              variant="ghost"
              className="gap-2 text-white/50 hover:text-white/80"
              title="Re-import recent mail from Spacemail (use if replies were missed)"
            >
              Full resync
            </Button>
          </div>
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
        <>
          {/* Mailbox switcher */}
          <div className="grid gap-3 sm:grid-cols-3">
            {(["hello", "support", "billing"] as const).map((mb) => {
              const meta = MAILBOX_META[mb];
              const isActive = mailboxFilter === mb;
              return (
                <button
                  key={mb}
                  type="button"
                  onClick={() => {
                    setMailboxFilter(mb);
                    setSelectedThreadId(null);
                  }}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    isActive
                      ? cn(meta.border, meta.bg, "ring-1 ring-white/10 shadow-lg shadow-black/20")
                      : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={cn("rounded-lg p-2", isActive ? meta.bg : "bg-white/5", meta.accent)}>
                      {meta.icon}
                    </div>
                    {isActive && (
                      <Badge className={cn("border-0 text-[10px]", meta.bg, meta.accent)}>
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className={cn("mt-3 text-sm font-semibold", isActive ? "text-white" : "text-white/70")}>
                    {meta.label}
                  </p>
                  <p className={cn("mt-0.5 truncate text-xs font-medium", isActive ? meta.accent : "text-white/45")}>
                    {meta.address}
                  </p>
                  <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-white/40">
                    {meta.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            {/* Thread list */}
            <Card
              className={cn(
                "border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl md:w-96 shrink-0",
                selectedThreadId && "hidden md:block",
              )}
            >
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
                <PlatformThreadList
                  threads={threads}
                  selectedId={selectedThreadId}
                  mailbox={mailboxFilter}
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
                <PlatformMessageView
                  threadId={selectedThreadId}
                  mailbox={mailboxFilter}
                  onBack={() => setSelectedThreadId(null)}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-white/30">
                  <div className={cn("mb-4 rounded-2xl border p-4", activeMailbox.border, activeMailbox.bg, activeMailbox.accent)}>
                    {activeMailbox.icon}
                  </div>
                  <p className="text-sm font-medium text-white/55">
                    {activeMailbox.label} inbox
                  </p>
                  <p className="mt-1 text-xs text-white/35">{activeMailbox.address}</p>
                  <p className="mt-3 text-sm">Select a conversation to view incoming and outgoing mail</p>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {activeTab === "compose" && (
        <PlatformComposeView onSent={() => setActiveTab("inbox")} />
      )}

      {activeTab === "suppressions" && <SuppressionsView />}
    </div>
  );
}

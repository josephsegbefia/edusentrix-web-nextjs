"use client";

import * as React from "react";
import {
  Bell,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquareText,
  Search,
  Send,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { StudentsPagination } from "@/components/admin/students/StudentsPagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor, extractPlainText } from "@/components/ui/rich-text-editor";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";

type CommunicationRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  channels: string[];
  stats?: {
    audienceCount?: number;
    deliveryCount?: number;
    sentCount?: number;
    skippedCount?: number;
    failedCount?: number;
  } | null;
  createdAt: string | null;
};

type CommunicationsPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type PreviewState = {
  summary: {
    total: number;
    inApp: number;
    email: number;
    whatsapp: number;
    sms: number;
    missingContact: number;
  };
  channelResults: {
    pending: number;
    skipped: number;
    byChannel: Record<string, { pending: number; skipped: number }>;
  };
  sampleRecipients: Array<{
    key: string;
    name: string;
    role: string;
    email: string | null;
    phone: string | null;
    reasonIncluded: string;
  }>;
};

type RecipientKind = "parent" | "teacher" | "student" | "staff";

type RecipientOption = {
  id: string;
  userId: string;
  role: RecipientKind;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  meta?: Record<string, unknown>;
};

const audienceOptions = [
  { value: "parents", label: "All parents" },
  { value: "teachers", label: "All teachers" },
  { value: "staff", label: "School staff" },
  { value: "students", label: "All students with accounts" },
  { value: "entire_school", label: "Entire school" },
  { value: "single_parent", label: "Single parent" },
  { value: "single_teacher", label: "Single teacher" },
  { value: "single_student", label: "Single student" },
  { value: "single_staff", label: "Single staff member" },
];

const typeOptions = [
  { value: "notice", label: "Notice" },
  { value: "announcement", label: "Announcement" },
  { value: "fee_reminder", label: "Fee reminder" },
  { value: "attendance_alert", label: "Attendance alert" },
  { value: "academic_update", label: "Academic update" },
  { value: "exam_notice", label: "Exam notice" },
  { value: "emergency_alert", label: "Emergency alert" },
  { value: "newsletter", label: "Newsletter" },
];

const priorityOptions = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
  { value: "low", label: "Low" },
];

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "queued", label: "Queued" },
  { value: "sending", label: "Sending" },
  { value: "sent", label: "Sent" },
  { value: "partially_sent", label: "Partially sent" },
  { value: "failed", label: "Failed" },
];

const tabOptions = [
  { value: "create", label: "Create Communication", description: "Compose and save a new draft" },
  { value: "recent", label: "Recent Communications", description: "Browse drafts and sent messages" },
  { value: "selected", label: "Selected Communication", description: "Preview, send, and inspect reach" },
] as const;

type CommunicationsTab = (typeof tabOptions)[number]["value"];

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <PremiumSelect value={value} onValueChange={onChange}>
      <PremiumSelectTrigger>
        <PremiumSelectValue />
      </PremiumSelectTrigger>
      <PremiumSelectContent>
        {options.map((option) => (
          <PremiumSelectItem key={option.value} value={option.value}>
            {option.label}
          </PremiumSelectItem>
        ))}
      </PremiumSelectContent>
    </PremiumSelect>
  );
}

function statusTone(status: string) {
  if (status === "sent") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (status === "partially_sent") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  if (status === "failed") return "border-red-400/30 bg-red-400/10 text-red-200";
  if (status === "queued" || status === "sending") return "border-blue-400/30 bg-blue-400/10 text-blue-200";
  return "border-white/10 bg-white/10 text-white/70";
}

function audienceKindFromType(value: string): RecipientKind | null {
  if (value === "single_parent") return "parent";
  if (value === "single_teacher") return "teacher";
  if (value === "single_student") return "student";
  if (value === "single_staff") return "staff";
  return null;
}

function audiencePayload(audienceType: string, recipient: RecipientOption | null) {
  const kind = audienceKindFromType(audienceType);
  if (kind) {
    return recipient ? { type: "custom_users", userIds: [recipient.userId], targetRoles: [kind] } : null;
  }
  return { type: audienceType };
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function PremiumInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={cn(
        "h-11 rounded-xl border-white/10 bg-white/[0.045] px-4 text-sm text-white shadow-none outline-none placeholder:text-white/30",
        "focus-visible:border-cyan-300/40 focus-visible:ring-2 focus-visible:ring-cyan-300/15",
        props.className,
      )}
    />
  );
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error || "Request failed");
  return json.data as T;
}

export default function AdminCommunicationsPage() {
  const [items, setItems] = React.useState<CommunicationRow[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectedItem, setSelectedItem] = React.useState<CommunicationRow | null>(null);
  const [activeTab, setActiveTab] = React.useState<CommunicationsTab>("create");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<PreviewState | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [listQuery, setListQuery] = React.useState("");
  const [pagination, setPagination] = React.useState<CommunicationsPagination>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });

  const [title, setTitle] = React.useState("");
  const [bodyHtml, setBodyHtml] = React.useState("");
  const [type, setType] = React.useState("notice");
  const [priority, setPriority] = React.useState("normal");
  const [audienceType, setAudienceType] = React.useState("parents");
  const [recipientQuery, setRecipientQuery] = React.useState("");
  const [recipientResults, setRecipientResults] = React.useState<RecipientOption[]>([]);
  const [selectedRecipient, setSelectedRecipient] = React.useState<RecipientOption | null>(null);
  const [recipientLoading, setRecipientLoading] = React.useState(false);
  const [channels, setChannels] = React.useState<string[]>(["in_app", "email"]);

  const selected = selectedItem ?? items.find((item) => item.id === selectedId) ?? null;
  const selectedAudienceKind = audienceKindFromType(audienceType);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        status: statusFilter,
      });
      if (listQuery.trim()) params.set("q", listQuery.trim());
      const data = await apiJson<{
        items: CommunicationRow[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/api/admin/communications?${params.toString()}`);
      setItems(data.items);
      setPagination({
        page: data.pagination.page,
        pageSize: data.pagination.limit,
        total: data.pagination.total,
        totalPages: Math.max(1, data.pagination.pages || 1),
      });
      setSelectedId((current) => current ?? data.items[0]?.id ?? null);
      setSelectedItem((current) => {
        if (!current) return data.items[0] ?? null;
        return data.items.find((item) => item.id === current.id) ?? current;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load communications");
    } finally {
      setLoading(false);
    }
  }, [listQuery, page, pageSize, statusFilter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [listQuery, statusFilter]);

  React.useEffect(() => {
    setSelectedRecipient(null);
    setRecipientQuery("");
    setRecipientResults([]);
  }, [audienceType]);

  React.useEffect(() => {
    if (!selectedAudienceKind) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRecipientLoading(true);
      try {
        const params = new URLSearchParams({
          kind: selectedAudienceKind,
          q: recipientQuery,
          limit: "12",
        });
        const data = await apiJson<{ items: RecipientOption[] }>(
          `/api/admin/communications/recipients?${params.toString()}`,
          { signal: controller.signal },
        );
        setRecipientResults(data.items);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to search recipients");
        }
      } finally {
        if (!controller.signal.aborted) setRecipientLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [selectedAudienceKind, recipientQuery]);

  async function createDraft() {
    setSaving(true);
    setError(null);
    setPreview(null);
    try {
      const bodyText = extractPlainText(bodyHtml);
      const audience = audiencePayload(audienceType, selectedRecipient);
      if (!audience) {
        throw new Error("Select the recipient before saving this communication");
      }
      const created = await apiJson<CommunicationRow>("/api/admin/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          bodyHtml,
          bodyText,
          type,
          priority,
          channels,
          audience,
        }),
      });
      setItems((current) => page === 1 ? [created, ...current].slice(0, pageSize) : current);
      setSelectedId(created.id);
      setSelectedItem(created);
      setActiveTab("selected");
      setTitle("");
      setBodyHtml("");
      setPage(1);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create communication");
    } finally {
      setSaving(false);
    }
  }

  async function previewAudience(id: string) {
    setError(null);
    try {
      const data = await apiJson<PreviewState>(`/api/admin/communications/${id}/preview-audience`);
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview audience");
    }
  }

  async function sendCommunication(id: string) {
    setSending(true);
    setError(null);
    try {
      await apiJson(`/api/admin/communications/${id}/send`, { method: "POST" });
      await load();
      await previewAudience(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send communication");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.1),transparent_32%),linear-gradient(180deg,#05070f_0%,#080b13_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-200/80">School Communications</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Communication Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Create one official message, choose the audience and channels, preview reach, then send and track delivery.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-2 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="px-4 py-2">
              <div className="text-lg font-semibold">{pagination.total}</div>
              <div className="text-xs text-white/45">Total</div>
            </div>
            <div className="px-4 py-2">
              <div className="text-lg font-semibold">{items.filter((item) => item.status === "sent").length}</div>
              <div className="text-xs text-white/45">Page sent</div>
            </div>
            <div className="px-4 py-2">
              <div className="text-lg font-semibold">{items.filter((item) => item.status === "draft").length}</div>
              <div className="text-xs text-white/45">Page drafts</div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100">
            {error}
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-1 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="grid gap-1 md:grid-cols-3">
            {tabOptions.map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "rounded-xl px-4 py-3 text-left transition",
                    isActive
                      ? "bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/20"
                      : "text-white/60 hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  <span className="block text-sm font-semibold">{tab.label}</span>
                  <span className={cn("mt-1 block text-xs", isActive ? "text-slate-700" : "text-white/40")}>{tab.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "create" ? (
          <Card className="overflow-hidden border-white/10 bg-[#0d1320]/90 text-white shadow-2xl shadow-black/30 backdrop-blur-xl">
            <CardContent className="space-y-5 p-0">
              <div className="border-b border-white/10 bg-white/[0.035] px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300/10 ring-1 ring-cyan-300/20">
                    <MessageSquareText className="h-5 w-5 text-cyan-200" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">Create communication</h2>
                    <p className="text-xs text-white/45">Compose once, route through selected channels.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-5 px-5 pb-5">
              <div className="space-y-2">
                <Label className="text-white/70">Title</Label>
                <PremiumInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="PTA meeting notice" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-white/70">Type</Label>
                  <SelectField value={type} onChange={setType} options={typeOptions} />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Priority</Label>
                  <SelectField value={priority} onChange={setPriority} options={priorityOptions} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Audience</Label>
                <SelectField value={audienceType} onChange={setAudienceType} options={audienceOptions} />
              </div>
              {selectedAudienceKind ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">Select one {selectedAudienceKind}</p>
                      <p className="text-xs text-white/45">Search by name, email, or phone.</p>
                    </div>
                    {selectedRecipient ? (
                      <button
                        type="button"
                        onClick={() => setSelectedRecipient(null)}
                        className="rounded-lg p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  {selectedRecipient ? (
                    <div className="flex items-center gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3">
                      {selectedRecipient.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selectedRecipient.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                          {initials(selectedRecipient.name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{selectedRecipient.name}</p>
                        <p className="truncate text-xs text-white/55">{selectedRecipient.email || selectedRecipient.phone || "No contact shown"}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                        <PremiumInput
                          value={recipientQuery}
                          onChange={(event) => setRecipientQuery(event.target.value)}
                          placeholder={`Search ${selectedAudienceKind}s`}
                          className="pl-9"
                        />
                      </div>
                      <div className="mt-2 max-h-64 space-y-2 overflow-auto pr-1">
                        {recipientLoading ? (
                          <div className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] py-5 text-sm text-white/50">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Searching
                          </div>
                        ) : recipientResults.length === 0 ? (
                          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center text-sm text-white/45">
                            No matching recipient
                          </div>
                        ) : (
                          recipientResults.map((recipient) => (
                            <button
                              key={recipient.id}
                              type="button"
                              onClick={() => setSelectedRecipient(recipient)}
                              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
                            >
                              {recipient.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={recipient.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                                  {initials(recipient.name)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-white">{recipient.name}</p>
                                <p className="truncate text-xs text-white/50">
                                  {recipient.email || recipient.phone || "No contact shown"}
                                  {recipient.meta?.linkedStudent ? ` · ${recipient.meta.linkedStudent}` : ""}
                                </p>
                              </div>
                              <UserRound className="h-4 w-4 text-white/30" />
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label className="text-white/70">Channels</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "in_app", Icon: Bell, label: "App" },
                    { value: "email", Icon: Mail, label: "Email" },
                  ].map(({ value, Icon, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setChannels((current) =>
                          current.includes(value)
                            ? current.filter((item) => item !== value)
                            : [...current, value],
                        )
                      }
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition hover:bg-white/10",
                        channels.includes(value)
                          ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100"
                          : "border-white/10 bg-white/[0.03] text-white/60",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Message</Label>
                <RichTextEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Write the official message..." />
              </div>
              <Button
                onClick={createDraft}
                disabled={saving || !title.trim() || !extractPlainText(bodyHtml).trim() || channels.length === 0 || Boolean(selectedAudienceKind && !selectedRecipient)}
                className="h-11 w-full rounded-xl bg-cyan-300 font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 hover:bg-cyan-200"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Save draft
              </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeTab === "recent" ? (
            <Card className="overflow-hidden border-white/10 bg-[#0d1320]/90 text-white shadow-2xl shadow-black/30 backdrop-blur-xl">
              <CardContent className="p-0">
                <div className="space-y-4 border-b border-white/10 bg-white/[0.035] px-5 py-4">
                  <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h2 className="font-semibold">Recent communications</h2>
                      <p className="mt-1 text-xs text-white/45">Find drafts, scheduled sends, and delivery history.</p>
                    </div>
                    <div className="text-xs text-white/45">{pagination.total.toLocaleString()} total records</div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                      <PremiumInput
                        value={listQuery}
                        onChange={(event) => setListQuery(event.target.value)}
                        placeholder="Search by communication title"
                        className="pl-9"
                      />
                    </div>
                    <SelectField value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
                  </div>
                </div>
                {loading ? (
                  <div className="flex h-72 items-center justify-center text-white/50">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex h-72 flex-col items-center justify-center text-white/45">
                    <Users className="mb-3 h-9 w-9" />
                    <p className="text-sm">No communications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(item.id);
                          setSelectedItem(item);
                          setPreview(null);
                          setActiveTab("selected");
                        }}
                        className={cn(
                          "w-full px-5 py-4 text-left transition hover:bg-white/[0.06]",
                          selectedId === item.id && "bg-cyan-300/10",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="mt-1 text-xs text-white/45">
                              {item.type.replace(/_/g, " ")} · {item.channels.join(", ")}
                            </p>
                          </div>
                          <span className={cn("rounded-full border px-2 py-1 text-[11px]", statusTone(item.status))}>
                            {item.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="border-t border-white/10 p-4">
                  <StudentsPagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    total={pagination.total}
                    pageSize={pagination.pageSize}
                    pageSizeOptions={[10, 20, 30, 50]}
                    itemLabel="communications"
                    onChangePage={setPage}
                    onChangePageSize={(nextSize) => {
                      setPageSize(nextSize);
                      setPage(1);
                    }}
                  />
                </div>
              </CardContent>
            </Card>
        ) : null}

        {activeTab === "selected" ? (
            <Card className="overflow-hidden border-white/10 bg-[#0d1320]/90 text-white shadow-2xl shadow-black/30 backdrop-blur-xl">
              <CardContent className="space-y-5 p-5">
                {selected ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-white/45">Selected communication</p>
                        <h2 className="mt-1 text-xl font-semibold">{selected.title}</h2>
                      </div>
                      <span className={cn("rounded-full border px-2 py-1 text-xs", statusTone(selected.status))}>
                        {selected.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-lg font-semibold">{selected.stats?.audienceCount ?? 0}</div>
                        <div className="text-xs text-white/45">Audience</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-lg font-semibold">{selected.stats?.sentCount ?? 0}</div>
                        <div className="text-xs text-white/45">Sent</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-lg font-semibold">{selected.stats?.failedCount ?? 0}</div>
                        <div className="text-xs text-white/45">Failed</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => previewAudience(selected.id)} className="border-white/10 bg-white/[0.03] text-white hover:bg-white/10">
                        <Users className="mr-2 h-4 w-4" />
                        Preview audience
                      </Button>
                      <Button
                        onClick={() => sendCommunication(selected.id)}
                        disabled={sending || !["draft", "scheduled", "failed"].includes(selected.status)}
                        className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                      >
                        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Send now
                      </Button>
                    </div>
                    {preview ? (
                      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          <div>
                            <div className="text-xl font-semibold">{preview.summary.total}</div>
                            <div className="text-xs text-cyan-100/60">Recipients</div>
                          </div>
                          <div>
                            <div className="text-xl font-semibold">{preview.channelResults.pending}</div>
                            <div className="text-xs text-cyan-100/60">Ready deliveries</div>
                          </div>
                          <div>
                            <div className="text-xl font-semibold">{preview.channelResults.skipped}</div>
                            <div className="text-xs text-cyan-100/60">Skipped</div>
                          </div>
                          <div>
                            <div className="text-xl font-semibold">{preview.summary.missingContact}</div>
                            <div className="text-xs text-cyan-100/60">Missing contact</div>
                          </div>
                        </div>
                        <div className="mt-4 max-h-56 space-y-2 overflow-auto pr-1">
                          {preview.sampleRecipients.map((recipient) => (
                            <div key={recipient.key} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium">{recipient.name}</p>
                                <span className="text-xs text-white/45">{recipient.role}</span>
                              </div>
                              <p className="mt-1 text-xs text-white/50">{recipient.email || recipient.phone || "No contact"} · {recipient.reasonIncluded}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-96 flex-col items-center justify-center text-white/45">
                    <MessageSquareText className="mb-3 h-10 w-10" />
                    <p>Select or create a communication</p>
                  </div>
                )}
              </CardContent>
            </Card>
        ) : null}
      </div>
    </div>
  );
}

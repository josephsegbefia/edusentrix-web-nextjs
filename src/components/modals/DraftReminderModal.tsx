import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Eye,
  Mail,
  MessageSquare,
  Send,
  Smartphone,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type ReminderHistoryItem,
  useFeeReminderHistory,
  useFeeReminderPreview,
  useSendFeeReminders,
  type ReminderSendResponse,
  type ReminderChannel,
} from "@/hooks/admin/useFeeReminders";
import { useBusyToast } from "@/hooks/useBusyToast";

type DraftReminderModalProps = {
  onClose: () => void;
  initialChannel?: ReminderChannel;
};

const CHANNELS: Array<{
  key: ReminderChannel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "email", label: "Email", icon: Mail },
  { key: "sms", label: "SMS", icon: MessageSquare },
  { key: "whatsapp", label: "WhatsApp", icon: Smartphone },
];

function formatMinorCurrency(minor: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format((minor || 0) / 100);
}

function formatDateTime(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function renderStatusBadge(status: "sent" | "failed" | "skipped") {
  if (status === "sent") {
    return (
      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
        Sent
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge className="border-rose-500/30 bg-rose-500/10 text-rose-300">
        Failed
      </Badge>
    );
  }
  return (
    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
      Skipped
    </Badge>
  );
}

function getRecipientContact(
  recipient: { email: string | null; phone: string | null },
  channel: ReminderChannel
) {
  if (channel === "email") {
    return recipient.email;
  }
  return recipient.phone;
}

function summarizeDeliveryStudents(
  students: Array<{ studentName: string; classGroupName: string | null }>
) {
  if (!students.length) return "No wards listed";
  const labels = students
    .slice(0, 4)
    .map((student) =>
      student.classGroupName
        ? `${student.studentName} (${student.classGroupName})`
        : student.studentName
    );
  if (students.length > 4) {
    labels.push(`+${students.length - 4} more`);
  }
  return labels.join(" • ");
}

type ReminderRunDetails = {
  runId: string;
  channel: ReminderChannel;
  createdAt?: string;
  summary: ReminderSendResponse["summary"];
  deliveries: NonNullable<ReminderSendResponse["deliveries"]>;
};

function toDetailsFromHistory(item: ReminderHistoryItem): ReminderRunDetails {
  return {
    runId: item.runId,
    channel: item.channel,
    createdAt: item.createdAt,
    summary: item.summary,
    deliveries: item.deliveries || [],
  };
}

function toDetailsFromSendResult(
  result: ReminderSendResponse,
  createdAt?: string
): ReminderRunDetails {
  return {
    runId: result.runId,
    channel: result.channel,
    createdAt,
    summary: result.summary,
    deliveries: result.deliveries || [],
  };
}

export function DraftReminderModal({ onClose, initialChannel = "email" }: DraftReminderModalProps) {
  const busy = useBusyToast();
  const queryClient = useQueryClient();
  const [channel, setChannel] = React.useState<ReminderChannel>(initialChannel);
  const [subject, setSubject] = React.useState("Fee Reminder: Outstanding Balance");
  const [message, setMessage] = React.useState(
    "Please settle your outstanding fees at your earliest convenience. Thank you."
  );
  const [onlyPrimaryGuardian, setOnlyPrimaryGuardian] = React.useState(false);
  const [maxRecipients, setMaxRecipients] = React.useState(200);
  const [lastSendAt, setLastSendAt] = React.useState<string | null>(null);
  const [lastSendResult, setLastSendResult] = React.useState<ReminderSendResponse | null>(
    null
  );
  const [detailsRun, setDetailsRun] = React.useState<ReminderRunDetails | null>(null);

  React.useEffect(() => {
    setChannel(initialChannel);
  }, [initialChannel]);

  const filters = React.useMemo(
    () => ({
      onlyPrimaryGuardian,
      maxRecipients: Math.max(1, Math.min(500, Number(maxRecipients) || 1)),
    }),
    [onlyPrimaryGuardian, maxRecipients]
  );

  const preview = useFeeReminderPreview(channel, filters, true);
  const sendReminders = useSendFeeReminders();
  const history = useFeeReminderHistory(8, true);

  const capability = preview.data?.capabilities?.[channel];
  const canSend =
    Boolean(capability?.enabled && capability?.ready) &&
    (preview.data?.summary.deliverableCount || 0) > 0;

  const handleSend = async () => {
    try {
      const result = await busy.promise(
        sendReminders.mutateAsync({
          channel,
          subject: channel === "email" ? subject : undefined,
          message: message.trim() || undefined,
          filter: filters,
        }),
        {
          loading: "Sending reminders...",
          success: "Fee reminders sent",
          error: (error: Error) => error.message || "Failed to send reminders",
        }
      );

      setLastSendResult(result);
      setLastSendAt(new Date().toISOString());
      void queryClient.invalidateQueries({
        queryKey: ["admin", "fees", "reminders", "history"],
      });

      const summary = result.summary;
      busy.info(
        `Sent ${summary.sent}/${summary.attempted} via ${channel.toUpperCase()} (${summary.failed} failed, ${summary.skipped} skipped).`
      );
    } catch {
      // Handled by busy toast.
    }
  };

  const previewRecipients = preview.data?.recipients || [];
  const previewListLimit = 30;
  const previewRecipientsVisible = previewRecipients.slice(0, previewListLimit);

  return (
    <div className="space-y-5">
      <div className="text-sm text-white/70">
        Send reminders to guardians with outstanding balances. Review the exact guardians
        and wards before sending.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CHANNELS.map((entry) => {
          const Icon = entry.icon;
          const isActive = channel === entry.key;
          const channelCapability = preview.data?.capabilities?.[entry.key];
          const isReady = Boolean(channelCapability?.enabled && channelCapability?.ready);

          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setChannel(entry.key)}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                isActive
                  ? "border-brand bg-brand/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-medium text-white">
                  <Icon className="h-4 w-4" />
                  {entry.label}
                </span>
                <Badge
                  variant="outline"
                  className={
                    isReady
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  }
                >
                  {isReady ? "Ready" : "Not ready"}
                </Badge>
              </div>
              <p className="text-xs text-white/60">
                {channelCapability?.message || "Loading channel status..."}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Audience</h3>
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              Includes all guardians with outstanding balances (issued, partially paid, and overdue).
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div>
                <Label className="text-white/80">Primary guardians only</Label>
                <p className="text-xs text-white/55">Skip secondary guardian contacts.</p>
              </div>
              <Switch
                checked={onlyPrimaryGuardian}
                onCheckedChange={setOnlyPrimaryGuardian}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Max recipients</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={maxRecipients}
                onChange={(event) => setMaxRecipients(Number(event.target.value || 1))}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Delivery Preview</h3>
          {preview.isLoading ? (
            <p className="text-sm text-white/60">Loading reminder preview...</p>
          ) : preview.isError ? (
            <p className="text-sm text-red-300">Failed to load reminder preview.</p>
          ) : (
            <div className="space-y-3 text-sm text-white/80">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-white/50">Recipients</p>
                  <p className="text-base font-semibold text-white">
                    {preview.data?.summary.recipientCount || 0}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-white/50">Deliverable ({channel})</p>
                  <p className="text-base font-semibold text-white">
                    {preview.data?.summary.deliverableCount || 0}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-white/50">Wards</p>
                  <p className="text-base font-semibold text-white">
                    {preview.data?.summary.studentCount || 0}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-white/50">Outstanding</p>
                  <p className="text-base font-semibold text-white">
                    {formatMinorCurrency(preview.data?.summary.totalOutstandingMinor || 0)}
                  </p>
                </div>
              </div>
              {preview.data?.summary.truncated ? (
                <p className="text-xs text-amber-300">
                  Showing first {preview.data.summary.recipientCount} of{" "}
                  {preview.data.summary.totalPotentialRecipients} matched recipients.
                </p>
              ) : null}
              <p className="text-xs text-white/55">
                Recipients without a {channel === "email" ? "valid email" : "valid phone"}
                {" "}
                are marked and skipped.
              </p>
            </div>
          )}
        </div>
      </div>

      {channel === "email" && (
        <div className="space-y-2">
          <Label className="text-white/80">Email subject</Label>
          <Input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-white/80">Custom message (optional)</Label>
        <Textarea
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Optional message to include in reminders..."
          className="border-white/10 bg-white/5 text-white"
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
          <Users className="h-4 w-4 text-white/70" />
          Recipients to be reminded
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {previewRecipientsVisible.map((recipient) => {
            const channelContact = getRecipientContact(recipient, channel);
            const missingContact =
              channel === "email" ? "Missing email (will be skipped)" : "Missing phone (will be skipped)";
            return (
            <div
              key={recipient.userId}
              className="rounded-lg border border-white/10 bg-black/10 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">{recipient.guardianName}</p>
                  <p className="mt-1 text-xs text-white/60">
                    Email: {recipient.email || "Not available"} • Phone:{" "}
                    {recipient.phone || "Not available"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {channelContact ? (
                    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                      Reachable on {channel.toUpperCase()}
                    </Badge>
                  ) : (
                    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                      {missingContact}
                    </Badge>
                  )}
                  <p className="text-xs text-white/60">
                    {formatMinorCurrency(recipient.totalOutstandingMinor)}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {recipient.students.map((student) => (
                  <div
                    key={`${recipient.userId}:${student.studentId}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2"
                  >
                    <p className="text-xs text-white/85">
                      {student.studentName}
                      {student.classGroupName ? ` • ${student.classGroupName}` : ""}
                    </p>
                    <p className="text-xs text-white/65">
                      {formatMinorCurrency(student.outstandingMinor)}
                      {student.overdueInvoiceCount > 0
                        ? ` • ${student.overdueInvoiceCount} overdue`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            );
          })}
          {previewRecipients.length > previewRecipientsVisible.length ? (
            <p className="text-xs text-amber-300">
              Showing {previewRecipientsVisible.length} of {previewRecipients.length} listed
              recipients in this panel.
            </p>
          ) : null}
          {previewRecipients.length === 0 && !preview.isLoading ? (
            <p className="text-sm text-white/60">No recipients matched the current filters.</p>
          ) : null}
        </div>
      </div>

      {lastSendResult ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            Last send results
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-white/60">Run ID: {lastSendResult.runId}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-white/15 bg-white/5 px-2.5 text-xs text-white hover:bg-white/10"
              onClick={() =>
                setDetailsRun(toDetailsFromSendResult(lastSendResult, lastSendAt || undefined))
              }
            >
              <Eye className="mr-1 h-3.5 w-3.5" />
              View recipients
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <p className="text-[11px] text-white/50">Attempted</p>
              <p className="text-base font-semibold text-white">
                {lastSendResult.summary.attempted}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <p className="text-[11px] text-white/50">Sent</p>
              <p className="text-base font-semibold text-emerald-300">
                {lastSendResult.summary.sent}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <p className="text-[11px] text-white/50">Failed</p>
              <p className="text-base font-semibold text-rose-300">
                {lastSendResult.summary.failed}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <p className="text-[11px] text-white/50">Skipped</p>
              <p className="text-base font-semibold text-amber-300">
                {lastSendResult.summary.skipped}
              </p>
            </div>
          </div>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {(lastSendResult.deliveries || []).map((delivery) => (
              <div
                key={`${lastSendResult.runId}:${delivery.recipientUserId}`}
                className="rounded-lg border border-white/10 bg-black/10 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-white">
                    {delivery.guardianName}
                    {delivery.contact ? ` • ${delivery.contact}` : ""}
                  </p>
                  {renderStatusBadge(delivery.status)}
                </div>
                {delivery.reason ? (
                  <p className="mt-1 text-xs text-amber-200">{delivery.reason}</p>
                ) : null}
                <p className="mt-1 text-xs text-white/65">
                  {delivery.students.length} ward(s) •{" "}
                  {formatMinorCurrency(delivery.totalOutstandingMinor)}
                </p>
                <p className="mt-1 text-[11px] text-white/55">
                  {summarizeDeliveryStudents(delivery.students)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
          <Clock3 className="h-4 w-4 text-white/70" />
          Recent reminder runs
        </div>
        {history.isLoading ? (
          <p className="text-sm text-white/60">Loading reminder history...</p>
        ) : history.isError ? (
          <p className="text-sm text-red-300">Failed to load reminder history.</p>
        ) : history.data?.length ? (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {history.data.map((item) => (
              <details
                key={item.id}
                className="rounded-lg border border-white/10 bg-black/10 p-3"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-white">
                      {item.channel.toUpperCase()} • {formatDateTime(item.createdAt)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 border-white/15 bg-white/5 px-2.5 text-xs text-white hover:bg-white/10"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDetailsRun(toDetailsFromHistory(item));
                        }}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        View recipients
                      </Button>
                      <div className="text-xs text-white/60">
                        Sent {item.summary.sent}/{item.summary.attempted}
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-white/55">
                    By{" "}
                    {item.actor
                      ? [item.actor.firstName, item.actor.lastName]
                          .filter(Boolean)
                          .join(" ") || item.actor.email || "Staff member"
                      : "Unknown"}
                    {" "}
                    • Run ID: {item.runId}
                  </p>
                </summary>
                <div className="mt-2 space-y-1.5">
                  {item.deliveries?.length ? (
                    item.deliveries.slice(0, 20).map((delivery) => (
                      <div
                        key={`${item.id}:${delivery.recipientUserId}`}
                        className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-white/85">
                            {delivery.guardianName}
                            {delivery.contact ? ` • ${delivery.contact}` : ""}
                          </p>
                          {renderStatusBadge(delivery.status)}
                        </div>
                        {delivery.reason ? (
                          <p className="mt-1 text-[11px] text-amber-200">{delivery.reason}</p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-white/60">
                          {delivery.students.length} ward(s) •{" "}
                          {formatMinorCurrency(delivery.totalOutstandingMinor)}
                        </p>
                        <p className="mt-1 text-[11px] text-white/55">
                          {summarizeDeliveryStudents(delivery.students)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white/60">
                      This run does not have stored delivery rows.
                    </div>
                  )}
                  {item.deliveries && item.deliveries.length > 20 ? (
                    <p className="text-[11px] text-white/55">
                      Showing first 20 of {item.deliveries.length} delivery rows.
                    </p>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/60">No reminder history yet.</p>
        )}
      </div>

      {capability && (!capability.enabled || !capability.ready) ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <div className="mb-1 inline-flex items-center gap-1.5 font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            Channel not ready
          </div>
          <p>{capability.message}</p>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button
          variant="outline"
          onClick={onClose}
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          Cancel
        </Button>
        <Button
          onClick={() => void handleSend()}
          disabled={sendReminders.isPending || preview.isLoading || !canSend}
          className="gap-2 bg-brand text-black hover:bg-brand/90"
        >
          <Send className="h-4 w-4" />
          {sendReminders.isPending ? "Sending..." : `Send ${channel.toUpperCase()} Reminder`}
        </Button>
      </div>

      <Dialog
        open={Boolean(detailsRun)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsRun(null);
          }
        }}
      >
        <DialogContent
          overlayClassName="z-[120] bg-black/70"
          className="z-[121] max-h-[90vh] max-w-[calc(100%-1rem)] overflow-hidden border border-white/10 bg-slate-950/95 p-0 text-white sm:max-w-4xl"
        >
          <DialogHeader className="border-b border-white/10 p-4 sm:p-6">
            <DialogTitle className="text-base sm:text-lg">
              Recipient Details ({detailsRun?.channel.toUpperCase() || "RUN"})
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60 sm:text-sm">
              Run ID: {detailsRun?.runId || "—"}
              {detailsRun?.createdAt ? ` • ${formatDateTime(detailsRun.createdAt)}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 overflow-y-auto p-4 sm:p-6">
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <p className="text-[11px] text-white/50">Attempted</p>
                <p className="text-base font-semibold text-white">
                  {detailsRun?.summary.attempted || 0}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <p className="text-[11px] text-white/50">Sent</p>
                <p className="text-base font-semibold text-emerald-300">
                  {detailsRun?.summary.sent || 0}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <p className="text-[11px] text-white/50">Failed</p>
                <p className="text-base font-semibold text-rose-300">
                  {detailsRun?.summary.failed || 0}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <p className="text-[11px] text-white/50">Skipped</p>
                <p className="text-base font-semibold text-amber-300">
                  {detailsRun?.summary.skipped || 0}
                </p>
              </div>
            </div>

            {detailsRun?.deliveries?.length ? (
              <div className="space-y-2.5">
                {detailsRun.deliveries.map((delivery) => (
                  <div
                    key={`${detailsRun.runId}:${delivery.recipientUserId}`}
                    className="rounded-lg border border-white/10 bg-black/10 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {delivery.guardianName}
                        </p>
                        <p className="text-xs text-white/60">
                          {delivery.contact || "No channel contact"}
                        </p>
                      </div>
                      {renderStatusBadge(delivery.status)}
                    </div>
                    {delivery.reason ? (
                      <p className="mt-1 text-xs text-amber-200">{delivery.reason}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-white/65">
                      {delivery.students.length} ward(s) •{" "}
                      {formatMinorCurrency(delivery.totalOutstandingMinor)}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {delivery.students.map((student) => (
                        <div
                          key={`${delivery.recipientUserId}:${student.studentId}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2"
                        >
                          <p className="text-xs text-white/85">
                            {student.studentName}
                            {student.classGroupName ? ` • ${student.classGroupName}` : ""}
                          </p>
                          <p className="text-xs text-white/65">
                            {formatMinorCurrency(student.outstandingMinor)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/60">No recipient rows stored for this run.</p>
            )}
          </div>

          <DialogFooter className="border-t border-white/10 p-4 sm:p-6">
            <Button
              variant="outline"
              onClick={() => setDetailsRun(null)}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

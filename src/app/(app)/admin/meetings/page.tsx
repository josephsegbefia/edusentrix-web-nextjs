"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  Video,
  Wallet,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { cn } from "@/lib/utils";
import { DelegateModuleBanner } from "@/components/delegations/DelegateModuleBanner";
import type { MeetingsCapabilities } from "@/lib/meetings/meetings-capabilities";

type CalendarOption = {
  id: string;
  name: string;
  isPublished: boolean;
};

type RecipientRole = "parent" | "teacher" | "bursar";

type RecipientOption = {
  userId: string;
  role: RecipientRole;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  wardIds: string[];
  wardNames: string[];
};

type MeetingRecord = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  kind: string;
  status: string;
  visibility: string;
  provider: string;
  providerStatus: string;
  providerRoomName?: string | null;
  providerLastError?: string | null;
  participantCount: number;
  counts: Record<string, number>;
  calendar: {
    id: string;
    name: string;
    isPublished: boolean;
  };
  host: {
    id: string;
    name: string;
    email: string | null;
  };
  participants: Array<{
    userId: string;
    role: RecipientRole;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    wardIds: string[];
    wardNames: string[];
  }>;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
};

type MeetingFormState = {
  calendarId: string;
  title: string;
  description: string;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string;
  endTime: string;
  kind: "general" | "pta" | "parent_conference" | "fee_consultation";
};

const recipientRoles: RecipientRole[] = ["parent", "teacher", "bursar"];

const recipientRoleConfig: Record<
  RecipientRole,
  {
    label: string;
    singular: string;
    description: string;
    emptyLabel: string;
    searchPlaceholder: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  parent: {
    label: "Parents",
    singular: "parent",
    description: "Invite one guardian or a full set of families.",
    emptyLabel: "No parents match this search.",
    searchPlaceholder: "Search parents by name, email, or ward",
    icon: Users,
  },
  teacher: {
    label: "Teachers",
    singular: "teacher",
    description: "Choose teaching staff for conferences or coordination calls.",
    emptyLabel: "No teachers match this search.",
    searchPlaceholder: "Search teachers by name or email",
    icon: GraduationCap,
  },
  bursar: {
    label: "Bursars",
    singular: "bursar",
    description: "Bring finance staff into fee consultations when needed.",
    emptyLabel: "No bursars match this search.",
    searchPlaceholder: "Search bursars by name or email",
    icon: Wallet,
  },
};

const meetingKindOptions = [
  { value: "general", label: "General meeting" },
  { value: "pta", label: "PTA session" },
  { value: "parent_conference", label: "Parent conference" },
  { value: "fee_consultation", label: "Fee consultation" },
] as const;

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const hour = Math.floor(index / 4);
  const minute = (index % 4) * 15;
  const date = new Date(2025, 0, 1, hour, minute);
  return {
    value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    label: format(date, "h:mm a"),
  };
});

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function roundToNextQuarterHour(date: Date) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const remainder = minutes % 15;
  if (remainder !== 0) {
    next.setMinutes(minutes + (15 - remainder));
  }
  return next;
}

function getTimeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

function combineDateAndTime(date: Date | null, timeValue: string) {
  if (!date) return null;
  const [hours, minutes] = timeValue.split(":").map((value) => Number(value));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function defaultMeetingForm(calendarId = ""): MeetingFormState {
  const start = roundToNextQuarterHour(new Date(Date.now() + 60 * 60 * 1000));
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  return {
    calendarId,
    title: "",
    description: "",
    startDate: start,
    endDate: end,
    startTime: getTimeValue(start),
    endTime: getTimeValue(end),
    kind: "general",
  };
}

function formatMeetingRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return `${format(start, "EEE, MMM d • h:mm a")} - ${format(end, "h:mm a")}`;
}

function kindLabel(kind: string) {
  const match = meetingKindOptions.find((option) => option.value === kind);
  return match?.label || "Meeting";
}

function countLabel(counts: Record<string, number>) {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([role, count]) => `${count} ${role}${count === 1 ? "" : "s"}`)
    .join(" · ");
}

function meetingProviderMessage(meeting: Pick<MeetingRecord, "provider" | "providerStatus">) {
  if (meeting.provider === "livekit" && meeting.providerStatus === "ready") {
    return "LiveKit room is ready. Invite-only scheduling and room provisioning are both active.";
  }

  if (meeting.provider === "livekit" && meeting.providerStatus === "failed") {
    return "LiveKit provisioning failed for this meeting. Scheduling and private visibility were still saved. Confirm LIVEKIT_URL uses your project’s HTTPS API host, and that LIVEKIT_API_KEY / LIVEKIT_API_SECRET match the LiveKit Cloud project (wss:// in LIVEKIT_URL is converted automatically for server API calls).";
  }

  if (meeting.provider === "livekit" && meeting.providerStatus === "pending") {
    return "LiveKit room provisioning is in progress for this meeting.";
  }

  if (meeting.providerStatus === "ended") {
    return "Video room has been closed for this meeting.";
  }

  return "Scheduling and private visibility are live. Real join-room provisioning is still pending.";
}

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

function AudienceRoleCard({
  role,
  active,
  selectedCount,
  onSelect,
}: {
  role: RecipientRole;
  active: boolean;
  selectedCount: number;
  onSelect: (role: RecipientRole) => void;
}) {
  const config = recipientRoleConfig[role];
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(role)}
      className={cn(
        "rounded-2xl border p-4 text-left transition",
        active
          ? "border-emerald-400/35 bg-emerald-500/10 shadow-[0_18px_40px_rgba(16,185,129,0.12)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full border",
              active
                ? "border-emerald-400/30 bg-emerald-500/15"
                : "border-white/10 bg-white/5"
            )}
          >
            <Icon className={cn("h-5 w-5", active ? "text-emerald-200" : "text-white/70")} />
          </div>
          <div className="min-w-0 flex-1 space-y-1 pr-1">
            <div className="text-sm font-semibold text-white">{config.label}</div>
            <div className="text-xs leading-5 text-white/55">{config.description}</div>
          </div>
        </div>

        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
            active
              ? "border-emerald-300/40 bg-emerald-400 text-black"
              : "border-white/10 bg-white/5 text-white/30"
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
          Selected
        </span>
        <span className="text-sm font-semibold text-white">{selectedCount}</span>
      </div>
    </button>
  );
}

function InviteSummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      <div className={cn("mt-1 text-xl font-semibold text-white", accent)}>{value}</div>
    </div>
  );
}

function RecipientResultCard({
  recipient,
  checked,
  onToggle,
}: {
  recipient: RecipientOption;
  checked: boolean;
  onToggle: (recipient: RecipientOption) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition",
        checked
          ? "border-emerald-400/30 bg-emerald-500/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={() => onToggle(recipient)}
        className="mt-0.5 border-white/30 data-[state=checked]:border-emerald-400 data-[state=checked]:bg-emerald-500"
      />

      <Avatar className="mt-0.5 h-11 w-11 border border-white/10">
        <AvatarImage src={recipient.avatarUrl || ""} alt={recipient.name} />
        <AvatarFallback className="bg-linear-to-br from-emerald-600 to-green-700 text-xs font-semibold text-white">
          {getInitials(recipient.name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{recipient.name}</div>
            <div className="truncate text-xs text-white/50">
              {recipient.email || "No email on file"}
            </div>
          </div>
          {checked && (
            <Badge className="border border-emerald-300/30 bg-emerald-500/10 text-emerald-100">
              Selected
            </Badge>
          )}
        </div>

        {recipient.role === "parent" && recipient.wardNames.length > 0 && (
          <div className="mt-2 text-xs text-white/60">
            Wards: {recipient.wardNames.join(", ")}
          </div>
        )}
      </div>
    </label>
  );
}

function SelectedParticipantPreview({
  participants,
}: {
  participants: RecipientOption[];
}) {
  if (participants.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-3 text-sm text-white/45">
        No invitees selected yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
          Selected People
        </div>
        <div className="text-xs text-white/55">
          {participants.length} ready for private visibility
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex -space-x-3">
          {participants.slice(0, 6).map((participant) => (
            <Avatar
              key={`${participant.role}:${participant.userId}`}
              className="h-10 w-10 border-2 border-[#0d1322]"
            >
              <AvatarImage src={participant.avatarUrl || ""} alt={participant.name} />
              <AvatarFallback className="bg-linear-to-br from-emerald-600 to-green-700 text-[11px] font-semibold text-white">
                {getInitials(participant.name)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        <div className="min-w-0 text-sm text-white/70">
          {participants
            .slice(0, 3)
            .map((participant) => participant.name)
            .join(", ")}
          {participants.length > 3 ? ` +${participants.length - 3} more` : ""}
        </div>
      </div>
    </div>
  );
}

export default function AdminMeetingsPage() {
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [capabilities, setCapabilities] = React.useState<MeetingsCapabilities | null>(
    null
  );
  const [calendars, setCalendars] = React.useState<CalendarOption[]>([]);
  const [meetings, setMeetings] = React.useState<MeetingRecord[]>([]);
  const [form, setForm] = React.useState<MeetingFormState>(() => defaultMeetingForm());
  const [selectedRecipients, setSelectedRecipients] = React.useState<RecipientOption[]>([]);
  const [loadingPage, setLoadingPage] = React.useState(true);
  const [loadingCalendars, setLoadingCalendars] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [retryingLiveKitId, setRetryingLiveKitId] = React.useState<string | null>(null);
  const [deletingMeetingId, setDeletingMeetingId] = React.useState<string | null>(null);
  const [meetingSearch, setMeetingSearch] = React.useState("");
  const [activeRecipientRole, setActiveRecipientRole] =
    React.useState<RecipientRole>("parent");
  const [recipientSearch, setRecipientSearch] = React.useState<Record<RecipientRole, string>>({
    parent: "",
    teacher: "",
    bursar: "",
  });
  const [recipientLoading, setRecipientLoading] = React.useState<Record<RecipientRole, boolean>>({
    parent: false,
    teacher: false,
    bursar: false,
  });
  const [recipientOptions, setRecipientOptions] = React.useState<
    Record<RecipientRole, RecipientOption[]>
  >({
    parent: [],
    teacher: [],
    bursar: [],
  });
  const [bulkSelecting, setBulkSelecting] = React.useState<
    RecipientRole | "all" | null
  >(null);

  const timezone = React.useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );
  const debouncedMeetingSearch = useDebouncedValue(meetingSearch, 250);
  const debouncedRecipientSearch = useDebouncedValue(
    recipientSearch[activeRecipientRole],
    300
  );

  const selectedKeys = React.useMemo(
    () =>
      new Set(
        selectedRecipients.map((recipient) => `${recipient.role}:${recipient.userId}`)
      ),
    [selectedRecipients]
  );

  const selectedCounts = React.useMemo(
    () =>
      selectedRecipients.reduce<Record<RecipientRole, number>>(
        (acc, recipient) => {
          acc[recipient.role] += 1;
          return acc;
        },
        { parent: 0, teacher: 0, bursar: 0 }
      ),
    [selectedRecipients]
  );

  const activeRoleConfig = recipientRoleConfig[activeRecipientRole];
  const activeSearchValue = recipientSearch[activeRecipientRole];
  const activeRecipientOptions = recipientOptions[activeRecipientRole];

  const upsertRecipients = React.useCallback((incoming: RecipientOption[]) => {
    setSelectedRecipients((current) => {
      const merged = new Map(
        current.map((recipient) => [
          `${recipient.role}:${recipient.userId}`,
          recipient,
        ])
      );

      incoming.forEach((recipient) => {
        merged.set(`${recipient.role}:${recipient.userId}`, recipient);
      });

      return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const removeRecipientsByRole = React.useCallback((role: RecipientRole) => {
    setSelectedRecipients((current) =>
      current.filter((recipient) => recipient.role !== role)
    );
  }, []);

  const loadCalendars = React.useCallback(async () => {
    const response = await fetch("/api/academic-calendars?all=1", {
      cache: "no-store",
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Failed to load calendars");
    }

    const nextCalendars = ((payload.data || []) as Array<{
      id: string;
      name: string;
      isPublished?: boolean;
    }>).map((calendar) => ({
      id: calendar.id,
      name: calendar.name,
      isPublished: Boolean(calendar.isPublished),
    }));

    setCalendars(nextCalendars);
    setForm((current) => {
      if (current.calendarId) return current;
      const preferred =
        nextCalendars.find((calendar) => calendar.isPublished) || nextCalendars[0];
      return defaultMeetingForm(preferred?.id || "");
    });
  }, []);

  const loadMeetings = React.useCallback(async (searchValue = "") => {
    const params = new URLSearchParams();
    params.set("status", "all");
    if (searchValue.trim()) params.set("q", searchValue.trim());

    const response = await fetch(`/api/admin/meetings?${params.toString()}`, {
      cache: "no-store",
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Failed to load meetings");
    }

    setMeetings(payload.data || []);
    if (payload.capabilities && typeof payload.capabilities === "object") {
      setCapabilities(payload.capabilities as MeetingsCapabilities);
    }
  }, []);

  const fetchRecipients = React.useCallback(
    async (
      role: RecipientRole,
      query: string,
      options?: { all?: boolean; limit?: number }
    ) => {
      const params = new URLSearchParams({
        role,
        q: query,
        limit: String(options?.limit || (options?.all ? 5000 : 18)),
      });

      if (options?.all) {
        params.set("all", "1");
      }

      const response = await fetch(`/api/admin/meetings/recipients?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load recipients");
      }

      return (payload.data || []) as RecipientOption[];
    },
    []
  );

  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoadingCalendars(true);
        await loadCalendars();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load calendars"
        );
      } finally {
        if (active) setLoadingCalendars(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadCalendars]);

  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoadingPage(true);
        await loadMeetings(debouncedMeetingSearch);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load meetings"
        );
      } finally {
        if (active) setLoadingPage(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [debouncedMeetingSearch, loadMeetings]);

  React.useEffect(() => {
    let active = true;

    if (
      !capabilities ||
      (!capabilities.canInvite && !capabilities.canCreate)
    ) {
      return;
    }

    (async () => {
      try {
        setRecipientLoading((current) => ({ ...current, [activeRecipientRole]: true }));
        const data = await fetchRecipients(activeRecipientRole, debouncedRecipientSearch);
        if (!active) return;
        setRecipientOptions((current) => ({
          ...current,
          [activeRecipientRole]: data,
        }));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load recipients"
        );
      } finally {
        if (active) {
          setRecipientLoading((current) => ({
            ...current,
            [activeRecipientRole]: false,
          }));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    activeRecipientRole,
    capabilities,
    debouncedRecipientSearch,
    fetchRecipients,
  ]);

  React.useEffect(() => {
    const nextStart = combineDateAndTime(form.startDate, form.startTime);
    const nextEnd = combineDateAndTime(form.endDate, form.endTime);
    if (!nextStart || !nextEnd || nextEnd > nextStart) return;

    const correctedEnd = new Date(nextStart.getTime() + 30 * 60 * 1000);
    const correctedDate = startOfDay(correctedEnd);
    const correctedTime = getTimeValue(correctedEnd);

    if (
      form.endDate?.getTime() === correctedDate.getTime() &&
      form.endTime === correctedTime
    ) {
      return;
    }

    setForm((current) => ({
      ...current,
      endDate: correctedDate,
      endTime: correctedTime,
    }));
  }, [form.endDate, form.endTime, form.startDate, form.startTime]);

  const handleToggleRecipient = React.useCallback((recipient: RecipientOption) => {
    setSelectedRecipients((current) => {
      const key = `${recipient.role}:${recipient.userId}`;
      const exists = current.some(
        (entry) => `${entry.role}:${entry.userId}` === key
      );

      if (exists) {
        return current.filter(
          (entry) => `${entry.role}:${entry.userId}` !== key
        );
      }

      return [...current, recipient].sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const handleSelectEntireRole = React.useCallback(
    async (role: RecipientRole) => {
      setBulkSelecting(role);
      try {
        const recipients = await fetchRecipients(role, "", { all: true });
        if (recipients.length === 0) {
          toast.error(`No ${recipientRoleConfig[role].label.toLowerCase()} available yet.`);
          return;
        }

        upsertRecipients(recipients);
        toast.success(
          `Selected ${recipients.length} ${recipientRoleConfig[role].label.toLowerCase()}.`
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to select recipients"
        );
      } finally {
        setBulkSelecting(null);
      }
    },
    [fetchRecipients, upsertRecipients]
  );

  const handleSelectEveryone = React.useCallback(async () => {
    setBulkSelecting("all");
    try {
      const groups = await Promise.all(
        recipientRoles.map((role) => fetchRecipients(role, "", { all: true }))
      );
      const everyone = groups.flat();

      if (everyone.length === 0) {
        toast.error("No meeting recipients are available yet.");
        return;
      }

      upsertRecipients(everyone);
      toast.success(`Selected ${everyone.length} recipients across the school.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to select recipients"
      );
    } finally {
      setBulkSelecting(null);
    }
  }, [fetchRecipients, upsertRecipients]);

  const handleCreateMeeting = async () => {
    if (!form.calendarId) {
      toast.error("Select a linked calendar first.");
      return;
    }

    if (!form.title.trim()) {
      toast.error("Meeting title is required.");
      return;
    }

    if (selectedRecipients.length === 0) {
      toast.error("Select at least one participant.");
      return;
    }

    const startsAt = combineDateAndTime(form.startDate, form.startTime);
    const endsAt = combineDateAndTime(form.endDate, form.endTime);

    if (!startsAt || !endsAt) {
      toast.error("Choose both a start date and an end date.");
      return;
    }

    if (endsAt <= startsAt) {
      toast.error("Meeting end time must be after the start time.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId: form.calendarId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          timezone,
          kind: form.kind,
          participants: selectedRecipients.map((recipient) => ({
            userId: recipient.userId,
            role: recipient.role,
            wardIds: recipient.role === "parent" ? recipient.wardIds : [],
          })),
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to schedule meeting");
      }

      if (payload.providerProvisionError) {
        toast.error("Meeting scheduled, but video room provisioning failed", {
          description: payload.providerProvisionError,
        });
      } else if (payload.data?.provider === "livekit" && payload.data?.providerStatus === "ready") {
        toast.success("Meeting scheduled and video room is ready");
      } else {
        toast.success("Meeting scheduled");
      }

      const nextCalendarId = form.calendarId;
      setForm(defaultMeetingForm(nextCalendarId));
      setSelectedRecipients([]);
      await loadMeetings(debouncedMeetingSearch);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to schedule meeting"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelMeeting = async (meetingId: string) => {
    setCancellingId(meetingId);
    try {
      const response = await fetch(`/api/admin/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to cancel meeting");
      }

      toast.success("Meeting cancelled");
      await loadMeetings(debouncedMeetingSearch);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel meeting"
      );
    } finally {
      setCancellingId(null);
    }
  };

  const handleDeleteCancelledMeeting = async (meetingId: string, title: string) => {
    const decision = await confirm({
      title: "Permanently remove meeting?",
      description: `Remove "${title}" from the queue. This also deletes the linked calendar entry and invite records.`,
      confirmLabel: "Remove meeting",
      intent: "destructive",
    });
    if (decision !== "confirm") return;

    setDeletingMeetingId(meetingId);
    try {
      const response = await fetch(`/api/admin/meetings/${meetingId}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to delete meeting");
      }

      toast.success("Meeting removed");
      await loadMeetings(debouncedMeetingSearch);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete meeting"
      );
    } finally {
      setDeletingMeetingId(null);
    }
  };

  const handleRetryLiveKitProvision = async (meetingId: string) => {
    setRetryingLiveKitId(meetingId);
    try {
      const response = await fetch(`/api/admin/meetings/${meetingId}/provision-livekit`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        const detail =
          (payload.providerProvisionError as string | undefined) ||
          (payload.error as string | undefined) ||
          "LiveKit provisioning failed.";
        toast.error("Could not create the video room", { description: detail });
        await loadMeetings(debouncedMeetingSearch);
        return;
      }

      toast.success("Video room is ready");
      await loadMeetings(debouncedMeetingSearch);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to retry video provisioning"
      );
    } finally {
      setRetryingLiveKitId(null);
    }
  };

  const publishedCalendarCount = calendars.filter((calendar) => calendar.isPublished).length;
  const canSchedule = Boolean(capabilities?.canCreate);
  const showDelegateBanner = Boolean(capabilities && !capabilities.isSchoolAdmin);
  const scheduleReadOnly =
    !loadingPage && capabilities !== null && !canSchedule;
  const blockCancel =
    capabilities !== null && !capabilities.canCancel;
  const blockEdit =
    capabilities !== null && !capabilities.canEdit;
  const blockStart =
    capabilities !== null && !capabilities.canStart;

  return (
    <div className="space-y-6">
      {showDelegateBanner ? <DelegateModuleBanner /> : null}
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_38%),linear-gradient(180deg,rgba(8,12,22,0.98),rgba(5,9,19,1))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge className="border border-emerald-400/25 bg-emerald-500/10 text-emerald-200">
              Meetings MVP
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                In-App Meetings
              </h1>
              <p className="max-w-3xl text-sm text-white/65">
                Schedule invite-only meetings for parents, teachers, and bursars.
                This slice publishes private meeting entries into the school calendar.
                When LiveKit env vars are set, a room is created automatically; you can
                retry from the list if provisioning fails.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">
                Linked Calendars
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {loadingCalendars ? "..." : calendars.length}
              </div>
              <div className="text-xs text-white/55">
                {publishedCalendarCount} published
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">
                Meetings In Scope
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {meetings.length}
              </div>
              <div className="text-xs text-white/55">
                scheduled, cancelled, and completed
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-white/10 bg-[#0d1322] text-white">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Video className="h-5 w-5 text-emerald-300" />
              Schedule A Meeting
            </CardTitle>
            <p className="text-sm text-white/55">
              {scheduleReadOnly
                ? "Scheduling is disabled for your current delegation."
                : "Pick a calendar, set the date and time, then search one audience at a time to build an invite-only meeting."}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {scheduleReadOnly ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-10 text-center">
                <p className="text-sm font-medium text-white/85">View-only access</p>
                <p className="mt-2 text-sm text-white/55">
                  Your delegation lets you review meetings but not schedule or change
                  them. Ask a school admin if you need organizer permissions.
                </p>
              </div>
            ) : (
              <>
            {calendars.length === 0 && !loadingCalendars && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
                No academic calendars exist yet.{" "}
                {!capabilities || capabilities.isSchoolAdmin ? (
                  <>
                    Create one in{" "}
                    <Link href="/admin/academic-calendar" className="underline underline-offset-4">
                      Academic Calendar
                    </Link>{" "}
                    before scheduling meetings.
                  </>
                ) : (
                  <>Ask a school admin to publish a calendar before new meetings can be scheduled.</>
                )}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.2em] text-white/45">
                  Linked Calendar
                </Label>
                <PremiumSelect
                  value={form.calendarId}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, calendarId: value }))
                  }
                >
                  <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                    <PremiumSelectValue placeholder="Select calendar" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {calendars.map((calendar) => (
                      <PremiumSelectItem key={calendar.id} value={calendar.id}>
                        {calendar.name}
                        {calendar.isPublished ? " · Published" : " · Draft"}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.2em] text-white/45">
                  Meeting Type
                </Label>
                <PremiumSelect
                  value={form.kind}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      kind: value as MeetingFormState["kind"],
                    }))
                  }
                >
                  <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                    <PremiumSelectValue placeholder="Select type" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {meetingKindOptions.map((option) => (
                      <PremiumSelectItem key={option.value} value={option.value}>
                        {option.label}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs uppercase tracking-[0.2em] text-white/45">
                  Title
                </Label>
                <Input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="e.g. Grade 5 parent conference"
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/35"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/45">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Starts
                </div>
                <div className="space-y-3">
                  <CustomDatePicker
                    value={form.startDate}
                    onChange={(date) =>
                      setForm((current) => ({
                        ...current,
                        startDate: date,
                        endDate:
                          current.endDate && date && current.endDate < startOfDay(date)
                            ? startOfDay(date)
                            : current.endDate,
                      }))
                    }
                    placeholder="Select start date"
                  />
                  <PremiumSelect
                    value={form.startTime}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, startTime: value }))
                    }
                  >
                    <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                      <PremiumSelectValue placeholder="Select start time" />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      {TIME_OPTIONS.map((option) => (
                        <PremiumSelectItem key={option.value} value={option.value}>
                          {option.label}
                        </PremiumSelectItem>
                      ))}
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/45">
                  <Clock className="h-3.5 w-3.5" />
                  Ends
                </div>
                <div className="space-y-3">
                  <CustomDatePicker
                    value={form.endDate}
                    onChange={(date) =>
                      setForm((current) => ({ ...current, endDate: date }))
                    }
                    minDate={form.startDate ? startOfDay(form.startDate) : undefined}
                    placeholder="Select end date"
                  />
                  <PremiumSelect
                    value={form.endTime}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, endTime: value }))
                    }
                  >
                    <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                      <PremiumSelectValue placeholder="Select end time" />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      {TIME_OPTIONS.map((option) => (
                        <PremiumSelectItem key={option.value} value={option.value}>
                          {option.label}
                        </PremiumSelectItem>
                      ))}
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs uppercase tracking-[0.2em] text-white/45">
                  Notes
                </Label>
                <Textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Optional context, agenda, or preparation notes"
                  className="min-h-[96px] border-white/10 bg-white/5 text-white placeholder:text-white/35"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Sparkles className="h-4 w-4 text-emerald-300" />
                    Invite Summary
                  </div>
                  <div className="text-xs text-white/50">
                    Invite-only calendar visibility is based on the counts below. Use
                    the role cards to switch the active search directory.
                  </div>
                </div>

                <Badge variant="secondary" className="bg-white/10 text-white/80">
                  {selectedRecipients.length} selected
                </Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <InviteSummaryStat
                  label="Total Invited"
                  value={selectedRecipients.length}
                  accent={selectedRecipients.length > 0 ? "text-emerald-200" : undefined}
                />
                <InviteSummaryStat label="Parents" value={selectedCounts.parent} />
                <InviteSummaryStat label="Teachers" value={selectedCounts.teacher} />
                <InviteSummaryStat label="Bursars" value={selectedCounts.bursar} />
              </div>

              <SelectedParticipantPreview participants={selectedRecipients} />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSelectEntireRole(activeRecipientRole)}
                  disabled={bulkSelecting !== null}
                  className="border-white/10 bg-transparent text-white hover:bg-white/10"
                >
                  {bulkSelecting === activeRecipientRole ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Selecting {activeRoleConfig.label.toLowerCase()}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Select all {activeRoleConfig.label.toLowerCase()}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSelectEveryone}
                  disabled={bulkSelecting !== null}
                  className="border-white/10 bg-transparent text-white hover:bg-white/10"
                >
                  {bulkSelecting === "all" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Selecting everyone
                    </>
                  ) : (
                    "Select everyone"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeRecipientsByRole(activeRecipientRole)}
                  disabled={selectedCounts[activeRecipientRole] === 0}
                  className="border-white/10 bg-transparent text-white hover:bg-white/10"
                >
                  Clear {activeRoleConfig.label.toLowerCase()}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedRecipients([])}
                  disabled={selectedRecipients.length === 0}
                  className="border-white/10 bg-transparent text-white hover:bg-white/10"
                >
                  Clear all
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-white">Choose An Audience</div>
                <div className="mt-1 text-xs text-white/50">
                  Switch between teachers, parents, and bursars. The search box below
                  changes based on the card you select.
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                {recipientRoles.map((role) => (
                  <AudienceRoleCard
                    key={role}
                    role={role}
                    active={role === activeRecipientRole}
                    selectedCount={selectedCounts[role]}
                    onSelect={setActiveRecipientRole}
                  />
                ))}
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-white">
                      {activeRoleConfig.label} Directory
                    </div>
                    <div className="text-xs text-white/50">
                      Search the active audience and tick the people you want to
                      invite.
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-white/10 text-white/75">
                    {selectedCounts[activeRecipientRole]} selected in this group
                  </Badge>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <Input
                      value={activeSearchValue}
                      onChange={(event) =>
                        setRecipientSearch((current) => ({
                          ...current,
                          [activeRecipientRole]: event.target.value,
                        }))
                      }
                      placeholder={activeRoleConfig.searchPlaceholder}
                      className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/35"
                    />
                  </div>

                  <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                    {recipientLoading[activeRecipientRole] ? (
                      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/60">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading {activeRoleConfig.label.toLowerCase()}...
                      </div>
                    ) : activeRecipientOptions.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-white/45">
                        {activeRoleConfig.emptyLabel}
                      </div>
                    ) : (
                      activeRecipientOptions.map((option) => (
                        <RecipientResultCard
                          key={`${option.role}:${option.userId}`}
                          recipient={option}
                          checked={selectedKeys.has(`${option.role}:${option.userId}`)}
                          onToggle={handleToggleRecipient}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-white/55">
                Meetings created here are private by default. Invitees will see them
                in their calendar. Video join links remain pending until provider
                provisioning is added.
              </div>
              <Button
                type="button"
                onClick={handleCreateMeeting}
                disabled={
                  saving ||
                  calendars.length === 0 ||
                  loadingCalendars ||
                  !canSchedule
                }
                className="min-w-[180px] bg-emerald-500 text-black hover:bg-emerald-400"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Schedule Meeting
                  </>
                )}
              </Button>
            </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0b1120] text-white">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Meeting Queue</CardTitle>
                <p className="mt-1 text-sm text-white/55">
                  Review meetings, cancel when plans change, or delete cancelled rows
                  to clear the queue.
                </p>
              </div>
              <div className="relative w-full max-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <Input
                  value={meetingSearch}
                  onChange={(event) => setMeetingSearch(event.target.value)}
                  placeholder="Search meetings"
                  className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/35"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingPage ? (
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6 text-sm text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading meetings...
              </div>
            ) : meetings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-center text-sm text-white/45">
                No meetings scheduled yet.
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold text-white">
                              {meeting.title}
                            </h3>
                            <Badge
                              className={cn(
                                "border",
                                meeting.status === "cancelled"
                                  ? "border-rose-400/25 bg-rose-500/10 text-rose-200"
                                  : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                              )}
                            >
                              {meeting.status}
                            </Badge>
                            <Badge className="border border-white/10 bg-white/10 text-white/75">
                              {kindLabel(meeting.kind)}
                            </Badge>
                          </div>
                          {meeting.description && (
                            <p className="mt-1 text-sm text-white/55">
                              {meeting.description}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {meeting.status !== "cancelled" ? (
                            <>
                              {meeting.provider === "livekit" &&
                              meeting.providerStatus === "ready" ? (
                                <Button
                                  asChild
                                  size="sm"
                                  className="bg-brand text-brand-foreground hover:bg-brand/90"
                                >
                                  <Link href={`/admin/meetings/${meeting.id}`}>Join room</Link>
                                </Button>
                              ) : null}
                              {meeting.provider === "livekit" &&
                              (meeting.providerStatus === "failed" ||
                                meeting.providerStatus === "pending") ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={
                                    blockStart || retryingLiveKitId === meeting.id
                                  }
                                  onClick={() => handleRetryLiveKitProvision(meeting.id)}
                                  className="border border-white/10 bg-white/10 text-white hover:bg-white/15"
                                >
                                  {retryingLiveKitId === meeting.id ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Retrying…
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                      Retry room setup
                                    </>
                                  )}
                                </Button>
                              ) : null}
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={
                                  blockCancel || cancellingId === meeting.id
                                }
                                onClick={() => handleCancelMeeting(meeting.id)}
                                className="border-white/10 bg-transparent text-white hover:bg-white/10"
                              >
                                {cancellingId === meeting.id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Cancelling
                                  </>
                                ) : (
                                  "Cancel"
                                )}
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                blockEdit || deletingMeetingId === meeting.id
                              }
                              onClick={() =>
                                handleDeleteCancelledMeeting(meeting.id, meeting.title)
                              }
                              className="border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                            >
                              {deletingMeetingId === meeting.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Deleting…
                                </>
                              ) : (
                                <>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-2 text-sm text-white/65">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-white/35" />
                          <span>{meeting.calendar.name}</span>
                          {!meeting.calendar.isPublished && (
                            <Badge className="border border-amber-400/25 bg-amber-500/10 text-amber-100">
                              Draft calendar
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-white/35" />
                          <span>{formatMeetingRange(meeting.startsAt, meeting.endsAt)}</span>
                        </div>
                        <div className="text-xs text-white/45">
                          {countLabel(meeting.counts) || `${meeting.participantCount} invited`}
                        </div>
                      </div>

                      <div
                        className={cn(
                          "rounded-2xl border px-3 py-2 text-xs",
                          meeting.providerStatus === "failed"
                            ? "border-rose-400/25 bg-rose-500/10 text-rose-100/90"
                            : "border-amber-400/20 bg-amber-500/10 text-amber-100/85"
                        )}
                      >
                        <div>
                          Video provider state: {meeting.providerStatus}.{" "}
                          {meetingProviderMessage(meeting)}
                        </div>
                        {meeting.provider === "livekit" &&
                          meeting.providerStatus === "failed" &&
                          meeting.providerLastError ? (
                          <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/25 p-2 font-mono text-[11px] text-white/80">
                            {meeting.providerLastError}
                          </pre>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {meeting.participants.slice(0, 5).map((participant) => (
                          <div
                            key={`${meeting.id}:${participant.role}:${participant.userId}`}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-white/80"
                          >
                            <Avatar className="h-6 w-6 border border-white/10">
                              <AvatarImage
                                src={participant.avatarUrl || ""}
                                alt={participant.name}
                              />
                              <AvatarFallback className="bg-linear-to-br from-emerald-600 to-green-700 text-[10px] font-semibold text-white">
                                {getInitials(participant.name)}
                              </AvatarFallback>
                            </Avatar>
                            {participant.name}
                          </div>
                        ))}
                        {meeting.participants.length > 5 && (
                          <Badge className="border border-white/10 bg-white/10 text-white/60">
                            +{meeting.participants.length - 5} more
                          </Badge>
                        )}
                      </div>

                      {meeting.status === "cancelled" && meeting.cancelReason && (
                        <div className="flex items-start gap-2 rounded-2xl border border-rose-400/15 bg-rose-500/10 px-3 py-2 text-xs text-rose-100/85">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{meeting.cancelReason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {confirmationDialog}
    </div>
  );
}

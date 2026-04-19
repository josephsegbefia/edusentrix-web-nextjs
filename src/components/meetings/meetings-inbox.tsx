"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Loader2,
  Search,
  Users,
  Video,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";

type ViewerRole = "school_admin" | "teacher" | "bursar" | "parent" | null;

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
  participantCount: number;
  counts: Record<string, number>;
  calendar: {
    id: string;
    name: string;
    isPublished: boolean;
  };
  host: {
    id: string;
    role: "school_admin" | "teacher" | "bursar";
    name: string;
    email: string | null;
  };
  participants: Array<{
    userId: string;
    role: "parent" | "teacher" | "bursar";
    name: string;
    email: string | null;
    avatarUrl: string | null;
    wardIds: string[];
    wardNames: string[];
  }>;
  viewer: {
    isHost: boolean;
    role: ViewerRole;
    inviteStatus: string;
    attendanceStatus: string;
    respondedAt: string | null;
    joinedAt: string | null;
    leftAt: string | null;
    canJoin: boolean;
  };
};

const statusOptions = [
  { value: "all", label: "All meetings" },
  { value: "scheduled", label: "Scheduled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
] as const;

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

function formatMeetingRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return `${format(start, "EEE, MMM d")} • ${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
}

function kindLabel(kind: string) {
  switch (kind) {
    case "pta":
      return "PTA session";
    case "parent_conference":
      return "Parent conference";
    case "fee_consultation":
      return "Fee consultation";
    default:
      return "General meeting";
  }
}

function providerMessage(meeting: Pick<MeetingRecord, "provider" | "providerStatus">) {
  if (meeting.provider === "livekit" && meeting.providerStatus === "ready") {
    return "Room is ready to join in app.";
  }
  if (meeting.provider === "livekit" && meeting.providerStatus === "pending") {
    return "Room provisioning is still running.";
  }
  if (meeting.provider === "livekit" && meeting.providerStatus === "failed") {
    return "Scheduling succeeded, but room provisioning failed.";
  }
  if (meeting.providerStatus === "ended") {
    return "Room has already been closed.";
  }
  return "Video room is not configured for this meeting yet.";
}

function viewerRoleLabel(role: ViewerRole) {
  switch (role) {
    case "school_admin":
      return "School admin";
    case "teacher":
      return "Teacher";
    case "bursar":
      return "Bursar";
    case "parent":
      return "Parent";
    default:
      return "Invitee";
  }
}

function countLabel(counts: Record<string, number>) {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([role, count]) => `${count} ${role}${count === 1 ? "" : "s"}`)
    .join(" · ");
}

export function MeetingsInbox({
  title,
  description,
  roomBasePath,
}: {
  title: string;
  description: string;
  roomBasePath: string;
}) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [status, setStatus] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [meetings, setMeetings] = React.useState<MeetingRecord[]>([]);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadMeetings() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set("status", status);
        if (debouncedSearch.trim()) {
          params.set("q", debouncedSearch.trim());
        }

        const response = await fetch(`/api/meetings?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to load meetings");
        }

        setMeetings(payload.data || []);
      } catch (loadError) {
        if ((loadError as Error).name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load meetings");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadMeetings();

    return () => controller.abort();
  }, [debouncedSearch, status]);

  const stats = React.useMemo(() => {
    const now = Date.now();
    return {
      total: meetings.length,
      ready: meetings.filter((meeting) => meeting.viewer.canJoin).length,
      upcoming: meetings.filter(
        (meeting) => meeting.status === "scheduled" && new Date(meeting.endsAt).getTime() >= now
      ).length,
      hosted: meetings.filter((meeting) => meeting.viewer.isHost).length,
    };
  }, [meetings]);

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-white/10 bg-linear-to-br from-sky-500/12 via-slate-950 to-emerald-500/10 p-6 shadow-[0_24px_80px_-40px_rgba(14,165,233,0.45)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge className="border border-sky-400/25 bg-sky-500/10 text-sky-100">
              In-app meetings
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
              <p className="max-w-2xl text-sm leading-6 text-white/65">{description}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/35">Ready now</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stats.ready}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/35">Upcoming</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stats.upcoming}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/35">Hosted by you</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stats.hosted}</p>
            </div>
          </div>
        </div>
      </section>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-white">Your meeting queue</CardTitle>
              <p className="mt-1 text-sm text-white/50">
                Private, invite-only school calls and parent conversations.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative w-full md:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search meetings"
                  className="border-white/10 bg-white/[0.04] pl-9 text-white placeholder:text-white/35"
                />
              </div>

              <PremiumSelect value={status} onValueChange={setStatus}>
                <PremiumSelectTrigger className="min-w-44">
                  <PremiumSelectValue placeholder="Filter status" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {statusOptions.map((option) => (
                    <PremiumSelectItem key={option.value} value={option.value}>
                      {option.label}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-8 text-sm text-white/55">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading meetings...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-6 text-sm text-rose-100/85">
              {error}
            </div>
          ) : meetings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-10 text-center text-sm text-white/45">
              No meetings matched this filter.
            </div>
          ) : (
            meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-white">{meeting.title}</h2>
                        <Badge
                          className={cn(
                            "border",
                            meeting.status === "cancelled"
                              ? "border-rose-400/25 bg-rose-500/10 text-rose-100"
                              : "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                          )}
                        >
                          {meeting.status}
                        </Badge>
                        <Badge className="border border-white/10 bg-white/10 text-white/75">
                          {kindLabel(meeting.kind)}
                        </Badge>
                        <Badge className="border border-white/10 bg-white/10 text-white/75">
                          {viewerRoleLabel(meeting.viewer.role)}
                        </Badge>
                      </div>

                      {meeting.description ? (
                        <p className="max-w-3xl text-sm leading-6 text-white/60">
                          {meeting.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        asChild
                        size="sm"
                        className="rounded-full bg-brand px-4 text-brand-foreground hover:bg-brand/90"
                      >
                        <Link href={`${roomBasePath}/${meeting.id}`}>
                          {meeting.viewer.canJoin ? "Join room" : "View room"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                        <div className="flex items-center gap-2 text-white/75">
                          <CalendarDays className="h-4 w-4 text-white/35" />
                          <span className="text-sm">{formatMeetingRange(meeting.startsAt, meeting.endsAt)}</span>
                        </div>
                        <p className="mt-2 text-xs text-white/40">{meeting.calendar.name}</p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                        <div className="flex items-center gap-2 text-white/75">
                          <Clock3 className="h-4 w-4 text-white/35" />
                          <span className="text-sm">{providerMessage(meeting)}</span>
                        </div>
                        <p className="mt-2 text-xs text-white/40">
                          Provider state: {meeting.providerStatus}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <Users className="h-4 w-4 text-white/35" />
                        <span>{countLabel(meeting.counts) || `${meeting.participantCount} invited`}</span>
                      </div>
                      <p className="mt-2 text-xs text-white/40">
                        Hosted by {meeting.host.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {meeting.participants.slice(0, 6).map((participant) => (
                      <div
                        key={`${meeting.id}:${participant.userId}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-2.5 py-1"
                      >
                        <Avatar className="h-7 w-7 border border-white/10">
                          <AvatarImage src={participant.avatarUrl || ""} alt={participant.name} />
                          <AvatarFallback className="bg-linear-to-br from-sky-600 to-cyan-700 text-[10px] font-semibold text-white">
                            {getInitials(participant.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-white/75">{participant.name}</span>
                      </div>
                    ))}
                    {meeting.participants.length > 6 ? (
                      <Badge className="border border-white/10 bg-white/10 text-white/60">
                        +{meeting.participants.length - 6} more
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

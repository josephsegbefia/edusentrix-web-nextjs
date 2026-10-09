"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { ArrowLeft, Loader2, Mic, ShieldCheck, VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MeetingDetail = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  kind: string;
  status: string;
  provider: string;
  providerStatus: string;
  providerRoomName?: string | null;
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
    wardNames: string[];
  }>;
  viewer: {
    isHost: boolean;
    role: "school_admin" | "teacher" | "bursar" | "parent" | null;
    inviteStatus: string;
    attendanceStatus: string;
    canJoin: boolean;
  };
};

type JoinPayload = {
  provider: string;
  providerStatus: string;
  roomName: string;
  serverUrl: string;
  token: string;
  identity: string;
  participant: {
    displayName: string;
    role: string;
    isHost: boolean;
  };
};

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
  return `${format(start, "EEEE, MMM d")} • ${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
}

function providerMessage(meeting: Pick<MeetingDetail, "provider" | "providerStatus">) {
  if (meeting.provider === "livekit" && meeting.providerStatus === "ready") {
    return "The room is ready. Joining will request access to your camera and microphone.";
  }
  if (meeting.provider === "livekit" && meeting.providerStatus === "pending") {
    return "Room provisioning is still in progress. Try again shortly.";
  }
  if (meeting.provider === "livekit" && meeting.providerStatus === "failed") {
    return "Scheduling succeeded, but the room did not provision correctly.";
  }
  if (meeting.providerStatus === "ended") {
    return "This meeting room has already been closed.";
  }
  return "A real-time room has not been configured for this meeting yet.";
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

export function MeetingRoomClient({
  meetingId,
  backHref,
  backLabel,
}: {
  meetingId: string;
  backHref: string;
  backLabel: string;
}) {
  const [meeting, setMeeting] = React.useState<MeetingDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [joining, setJoining] = React.useState(false);
  const [session, setSession] = React.useState<JoinPayload | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadMeeting() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/meetings/${meetingId}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to load meeting");
        }

        setMeeting(payload.data);
      } catch (loadError) {
        if ((loadError as Error).name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load meeting");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadMeeting();

    return () => controller.abort();
  }, [meetingId]);

  const handleJoin = React.useCallback(async () => {
    try {
      setJoining(true);
      setError(null);

      const response = await fetch(`/api/meetings/${meetingId}/join-token`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to join meeting");
      }

      setSession(payload.data);
    } catch (joinError) {
      const message = joinError instanceof Error ? joinError.message : "Failed to join meeting";
      setError(message);
      toast.error("Could not join meeting", { description: message });
    } finally {
      setJoining(false);
    }
  }, [meetingId]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-(--ws-line) bg-(--ws-fill) px-4 py-8 text-sm text-(--ws-fg-70)">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading meeting room...
      </div>
    );
  }

  if (error && !meeting) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" className="px-0 text-(--ws-fg-70) hover:bg-transparent hover:text-(--ws-fg)">
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-6 text-sm text-(--ws-rose)">
          {error}
        </div>
      </div>
    );
  }

  if (!meeting) return null;

  if (session) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Button asChild variant="ghost" className="mb-2 px-0 text-(--ws-fg-70) hover:bg-transparent hover:text-(--ws-fg)">
              <Link href={backHref}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-(--ws-fg)">{meeting.title}</h1>
              <Badge className="border border-emerald-400/25 bg-emerald-500/10 text-(--ws-emerald)">
                Live now
              </Badge>
            </div>
            <p className="mt-1 text-sm text-(--ws-fg-70)">{formatMeetingRange(meeting.startsAt, meeting.endsAt)}</p>
          </div>
        </div>

        <LiveKitRoom
          token={session.token}
          serverUrl={session.serverUrl}
          connect
          audio
          video
          data-lk-theme="default"
          className="lk-room-container h-[calc(100vh-12rem)] overflow-hidden rounded-[30px] border border-(--ws-line) bg-(--ws-fill-strong) shadow-[0_24px_80px_-40px_rgba(14,165,233,0.45)]"
          onDisconnected={() => {
            setSession(null);
            toast.message("You left the meeting room.");
          }}
          onError={(roomError) => {
            toast.error("Meeting room error", { description: roomError.message });
          }}
        >
          <VideoConference />
        </LiveKitRoom>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-2 px-0 text-(--ws-fg-70) hover:bg-transparent hover:text-(--ws-fg)">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backLabel}
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold text-(--ws-fg)">{meeting.title}</h1>
            <Badge
              className={cn(
                "border",
                meeting.status === "cancelled"
                  ? "border-rose-400/25 bg-rose-500/10 text-(--ws-rose)"
                  : "border-emerald-400/25 bg-emerald-500/10 text-(--ws-emerald)"
              )}
            >
              {meeting.status}
            </Badge>
            <Badge className="border border-(--ws-line) bg-(--ws-fill-strong) text-(--ws-fg-70)">
              {kindLabel(meeting.kind)}
            </Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-(--ws-fg-70)">
            {meeting.description || "Private in-app meeting room for invited school members only."}
          </p>
        </div>

        <Button
          onClick={handleJoin}
          disabled={!meeting.viewer.canJoin || joining}
          className="rounded-full bg-cyan-600 px-5 text-white hover:bg-cyan-500 hover:text-white disabled:cursor-not-allowed disabled:bg-(--ws-fill-strong) disabled:text-(--ws-fg-70)"
        >
          {joining ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Joining
            </>
          ) : (
            <>
              <VideoIcon className="mr-2 h-4 w-4" />
              Join meeting
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-(--ws-line) bg-(--ws-fill)">
          <CardHeader>
            <CardTitle className="text-(--ws-fg)">Before you join</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
              <p className="text-sm font-medium text-(--ws-fg)">{formatMeetingRange(meeting.startsAt, meeting.endsAt)}</p>
              <p className="mt-1 text-sm text-(--ws-fg-70)">{meeting.calendar.name}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                <div className="flex items-center gap-2 text-sm text-(--ws-fg-70)">
                  <ShieldCheck className="h-4 w-4 text-(--ws-fg-70)" />
                  <span>Invite-only access</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-(--ws-fg-70)">
                  Only authenticated school members who were invited can enter this room.
                </p>
              </div>

              <div className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4">
                <div className="flex items-center gap-2 text-sm text-(--ws-fg-70)">
                  <Mic className="h-4 w-4 text-(--ws-fg-70)" />
                  <span>Device access</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-(--ws-fg-70)">
                  Joining requests microphone and camera access directly from your browser.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-(--ws-amber)/85">
              {providerMessage(meeting)}
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-(--ws-rose)">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-(--ws-line) bg-(--ws-fill)">
            <CardHeader>
              <CardTitle className="text-(--ws-fg)">Host</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-(--ws-line)">
                  <AvatarImage src="" alt={meeting.host.name} />
                  <AvatarFallback className="bg-linear-to-br from-sky-600 to-cyan-700 text-xs font-semibold text-white">
                    {getInitials(meeting.host.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-(--ws-fg)">{meeting.host.name}</p>
                  <p className="text-xs text-(--ws-fg-70)">{meeting.host.role.replace("_", " ")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-(--ws-line) bg-(--ws-fill)">
            <CardHeader>
              <CardTitle className="text-(--ws-fg)">Participants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {meeting.participants.map((participant) => (
                <div
                  key={`${participant.userId}:${participant.role}`}
                  className="flex items-center gap-3 rounded-2xl border border-(--ws-line) bg-(--ws-fill) px-3 py-2.5"
                >
                  <Avatar className="h-9 w-9 border border-(--ws-line)">
                    <AvatarImage src={participant.avatarUrl || ""} alt={participant.name} />
                    <AvatarFallback className="bg-linear-to-br from-emerald-600 to-green-700 text-xs font-semibold text-white">
                      {getInitials(participant.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-(--ws-fg)">{participant.name}</p>
                    <p className="truncate text-xs text-(--ws-fg-70)">
                      {participant.wardNames.length > 0
                        ? participant.wardNames.join(", ")
                        : participant.role}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

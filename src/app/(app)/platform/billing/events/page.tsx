"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Clock3, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SchoolOption = {
  id: string;
  name: string;
  status: string;
};

type SubscriptionEventRow = {
  id: string;
  schoolId: string;
  schoolName: string;
  subscriptionId: string;
  eventType: string;
  actorEmail: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type EventsResponse = {
  schools: SchoolOption[];
  events: SubscriptionEventRow[];
};

const EVENT_LABELS: Record<string, string> = {
  subscription_assigned: "Assigned",
  subscription_updated: "Updated",
  subscription_suspended: "Suspended",
  subscription_reactivated: "Reactivated",
  subscription_cancelled: "Cancelled",
};

function renderMetadataValue(value: unknown) {
  if (value === null || value === undefined) return "none";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const serialized = JSON.stringify(value);
  return serialized.length > 72 ? `${serialized.slice(0, 69)}...` : serialized;
}

export default function PlatformBillingEventsPage() {
  const [loading, setLoading] = React.useState(true);
  const [selectedSchoolId, setSelectedSchoolId] = React.useState("all");
  const [data, setData] = React.useState<EventsResponse | null>(null);

  const loadEvents = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedSchoolId !== "all") {
        params.set("schoolId", selectedSchoolId);
      }
      const query = params.toString();
      const url = query
        ? `/api/platform/billing/subscriptions/events?${query}`
        : "/api/platform/billing/subscriptions/events";

      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load subscription events");
      }
      setData(json.data as EventsResponse);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load subscription events"
      );
    } finally {
      setLoading(false);
    }
  }, [selectedSchoolId]);

  React.useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  return (
    <div className="space-y-6 p-2 md:p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-fit px-0 text-white/70 hover:text-white"
          >
            <Link href="/platform/billing">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Billing
            </Link>
          </Button>
          <h1 className="text-3xl font-semibold text-white">
            Subscription Event Timeline
          </h1>
          <p className="text-sm text-white/60">
            Review manual subscription changes, pricing exceptions, suspensions,
            reactivations, and cancellations. This is the audit surface for the
            platform billing workflow.
          </p>
        </div>
        <Button asChild className="bg-cyan-600 text-white hover:bg-cyan-700">
          <Link href="/platform/billing/usage">Open Usage Attribution</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.35fr_1.65fr]">
        <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
          <CardHeader>
            <CardTitle className="text-xl">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/50">
                School
              </label>
              <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                  <SelectValue placeholder="All schools" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-950 text-white">
                  <SelectItem value="all">All schools</SelectItem>
                  {(data?.schools || []).map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-white/60">Events loaded</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {data?.events.length || 0}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-white/60">Schools in scope</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {selectedSchoolId === "all" ? data?.schools.length || 0 : 1}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start border border-white/10 text-white/70 hover:text-white"
              onClick={() => void loadEvents()}
            >
              Refresh Timeline
            </Button>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-cyan-300" />
              Audit Feed
            </CardTitle>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {!loading && (data?.events || []).length === 0 ? (
              <p className="text-sm text-white/60">
                No subscription events have been recorded yet.
              </p>
            ) : null}

            {(data?.events || []).map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                        {EVENT_LABELS[event.eventType] || event.eventType}
                      </span>
                      <span className="text-xs text-white/50">{event.schoolName}</span>
                    </div>
                    <p className="font-medium text-white">{event.summary}</p>
                    <p className="text-xs text-white/50">
                      {event.actorEmail || "Unknown actor"}
                    </p>
                    {event.metadata ? (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(event.metadata).map(([key, value]) => (
                          <span
                            key={`${event.id}-${key}`}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65"
                          >
                            {key}: {renderMetadataValue(value)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Clock3 className="h-4 w-4" />
                    {format(new Date(event.createdAt), "MMM d, yyyy h:mm a")}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

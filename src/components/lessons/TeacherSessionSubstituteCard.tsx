"use client";

import * as React from "react";
import { UserPlus, UserX, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  useAssignSessionSubstitute,
  useClearSessionSubstitute,
} from "@/hooks/teacher/useSessionSubstitute";
import type { LessonSessionDetailDto } from "@/types/lessons-v2";

type TeacherTarget = { id: string; label: string };

type Props = {
  sessionId: string;
  session: LessonSessionDetailDto;
  classGroupId: string;
};

export function TeacherSessionSubstituteCard({ sessionId, session, classGroupId }: Props) {
  const busyToast = useBusyToast();
  const assign = useAssignSessionSubstitute(sessionId);
  const clear = useClearSessionSubstitute(sessionId);
  const [query, setQuery] = React.useState("");
  const [targets, setTargets] = React.useState<TeacherTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState("");
  const [reason, setReason] = React.useState<"leave" | "absence" | "delegation" | "other">(
    "delegation",
  );

  const delivery = session.delivery;
  const ownerId = delivery?.ownerTeacherId;
  const scheduledId = delivery?.scheduledTeacherId;
  const hasSubstitute =
    Boolean(scheduledId && ownerId && String(scheduledId) !== String(ownerId));

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingTargets(true);
      try {
        const params = new URLSearchParams({
          type: "teacher",
          classGroupId,
          limit: "30",
        });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(
          `/api/teacher/studio/resources/share-targets?${params.toString()}`,
          { cache: "no-store" },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) return;
        const rows = (json.data?.targets ?? []) as Array<{ id: string; label: string }>;
        if (!cancelled) {
          setTargets(rows.map((t) => ({ id: t.id, label: t.label })));
        }
      } finally {
        if (!cancelled) setLoadingTargets(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [classGroupId, query]);

  const assignSubstitute = async () => {
    if (!selectedId) return;
    await busyToast.promise(
      assign.mutateAsync({
        substituteTeacherId: selectedId,
        substituteReason: reason,
      }),
      {
        loading: "Assigning substitute…",
        success: "Substitute teacher assigned",
        error: (e) => (e instanceof Error ? e.message : "Failed to assign"),
      },
    );
  };

  const removeSubstitute = async () => {
    await busyToast.promise(clear.mutateAsync(), {
      loading: "Reverting schedule…",
      success: "You are the scheduled teacher again",
      error: (e) => (e instanceof Error ? e.message : "Failed to clear"),
    });
  };

  return (
    <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-lg text-white">Substitute teacher</CardTitle>
        <p className="text-xs text-white/50">
          Delegate this period to a colleague. They can teach and complete the delivery; analytics
          record who actually taught.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasSubstitute ? (
          <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2.5 text-sm text-sky-100">
            A substitute is scheduled
            {delivery?.substituteReason ? ` (${delivery.substituteReason})` : ""}.
            {delivery?.actualTeacherId ? (
              <span className="mt-1 block text-xs text-sky-100/70">
                Actual teacher recorded when teaching started.
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-white/55">You are the scheduled teacher for this session.</p>
        )}

        <div className="space-y-2">
          <Label className="text-white/70">Find colleague</Label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="border-white/10 bg-white/5 text-white"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-white/70">Substitute</Label>
          <PremiumSelect value={selectedId} onValueChange={setSelectedId}>
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder={loadingTargets ? "Loading…" : "Select teacher"} />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {targets.map((t) => (
                <PremiumSelectItem key={t.id} value={t.id}>
                  {t.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>

        <div className="space-y-2">
          <Label className="text-white/70">Reason</Label>
          <PremiumSelect value={reason} onValueChange={(v) => setReason(v as typeof reason)}>
            <PremiumSelectTrigger>
              <PremiumSelectValue />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="delegation">Delegation</PremiumSelectItem>
              <PremiumSelectItem value="leave">Leave</PremiumSelectItem>
              <PremiumSelectItem value="absence">Absence</PremiumSelectItem>
              <PremiumSelectItem value="other">Other</PremiumSelectItem>
            </PremiumSelectContent>
          </PremiumSelect>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void assignSubstitute()}
            disabled={!selectedId || assign.isPending}
            className="bg-teal-500/25 text-teal-100 hover:bg-teal-500/35"
          >
            {assign.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Assign substitute
          </Button>
          {hasSubstitute ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void removeSubstitute()}
              disabled={clear.isPending}
              className="border-white/10 bg-white/5 text-white/75"
            >
              <UserX className="mr-2 h-4 w-4" />
              Clear substitute
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

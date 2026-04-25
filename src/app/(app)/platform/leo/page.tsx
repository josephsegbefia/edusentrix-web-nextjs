"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  useLeoPlatformSettings,
  useUpdateLeoPlatformSettings,
} from "@/hooks/leo/useLeoPlatformSettings";
import { PlatformPill, PlatformSection } from "@/components/platform/platform-page-primitives";
import { isLeoCopilotClientRuntimeEnabled } from "@/lib/leo/runtime";
import { LeoIcon } from "@/components/icons/LeoIcon";

export default function PlatformLeoPage() {
  const busy = useBusyToast();
  const { data, isLoading, isError, error, refetch } = useLeoPlatformSettings();
  const update = useUpdateLeoPlatformSettings();

  const [defaultState, setDefaultState] = React.useState<"enabled" | "disabled">("disabled");
  const [forcedMode, setForcedMode] = React.useState<"none" | "force_enabled" | "force_disabled">("none");
  const [allowSchoolOverride, setAllowSchoolOverride] = React.useState(true);
  const [allowSchoolSelfService, setAllowSchoolSelfService] = React.useState(false);
  const [rolloutNotes, setRolloutNotes] = React.useState("");

  React.useEffect(() => {
    if (!data?.platform) return;
    const p = data.platform;
    setDefaultState(p.defaultState);
    setForcedMode(p.forcedMode);
    setAllowSchoolOverride(p.allowSchoolOverride);
    setAllowSchoolSelfService(p.allowSchoolSelfService);
    setRolloutNotes(p.rolloutNotes || "");
  }, [data?.platform]);

  const dirty = data
    ? defaultState !== data.platform.defaultState ||
      forcedMode !== data.platform.forcedMode ||
      allowSchoolOverride !== data.platform.allowSchoolOverride ||
      allowSchoolSelfService !== data.platform.allowSchoolSelfService ||
      (rolloutNotes || "") !== (data.platform.rolloutNotes || "")
    : false;

  async function onSave() {
    await busy.promise(
      update.mutateAsync({
        defaultState,
        forcedMode,
        allowSchoolOverride,
        allowSchoolSelfService,
        rolloutNotes: rolloutNotes.trim() || null,
      }),
      { loading: "Saving platform Leo…", success: "Platform Leo settings saved", error: (e) => (e as Error).message }
    );
    await refetch();
  }

  return (
    <div className="space-y-6 p-2 md:p-4">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link
            href="/platform/flags"
            className="mb-2 inline-flex items-center gap-1 text-sm text-white/50 hover:text-white/80"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Feature flags
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <LeoIcon className="h-7 w-7 text-amber-300" />
            Leo Copilot
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Global defaults, force modes, and whether schools can self-serve. Pair with
            <code className="mx-1 rounded bg-white/10 px-1.5 font-mono text-xs">ai_leo_copilot</code>
            on subscription tiers and runtime env in deployment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data && (
            <Badge variant="outline" className="border-white/20 text-white/70">
              DB row: {data.platform.persisted ? "saved" : "defaults only (save to persist)"}
            </Badge>
          )}
        </div>
      </div>

      <PlatformSection
        title="Runtime (read-only)"
        description="Kills the API and client launcher when false. Set in the deployment environment."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-white/45">Server</p>
            <p className="mt-1 font-mono text-sm text-white/90">FEATURE_LEO_COPILOT_RUNTIME_ENABLED</p>
            <div className="mt-2">
              <PlatformPill tone={data?.runtimeServer ? "emerald" : "rose"}>
                {data?.runtimeServer ? "true" : "false"}
              </PlatformPill>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-white/45">Browser (launcher)</p>
            <p className="mt-1 font-mono text-sm text-white/90">NEXT_PUBLIC_FEATURE_LEO_COPILOT_…</p>
            <div className="mt-2">
              <PlatformPill tone={isLeoCopilotClientRuntimeEnabled() ? "emerald" : "rose"}>
                {isLeoCopilotClientRuntimeEnabled() ? "true" : "false"}
              </PlatformPill>
            </div>
          </div>
        </div>
      </PlatformSection>

      {isLoading ? (
        <div className="flex items-center gap-2 text-white/50">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : isError ? (
        <p className="text-rose-200">{error instanceof Error ? error.message : "Error"}</p>
      ) : !data ? null : (
        <PlatformSection
          title="Platform policy"
          description="Applies to all schools. Use force modes for pilots; prefer entitlement keys on tiers for steady state."
        >
          <div className="grid max-w-3xl gap-6">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/70">Default when no school override</Label>
                <Select value={defaultState} onValueChange={(v) => setDefaultState(v as "enabled" | "disabled")}>
                  <SelectTrigger className="border-white/10 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Disabled by default</SelectItem>
                    <SelectItem value="enabled">Enabled by default (still needs plan)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Force mode (overrides entitlements / schools)</Label>
                <Select
                  value={forcedMode}
                  onValueChange={(v) =>
                    setForcedMode(v as "none" | "force_enabled" | "force_disabled")
                  }
                >
                  <SelectTrigger className="border-white/10 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="force_enabled">Force ON (all schools)</SelectItem>
                    <SelectItem value="force_disabled">Force OFF (all schools)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label className="text-white/80">Allow school to override (inherit vs on/off)</Label>
                <p className="text-xs text-white/45">When off, only platform force modes apply at school level.</p>
              </div>
              <Switch checked={allowSchoolOverride} onCheckedChange={setAllowSchoolOverride} />
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label className="text-white/80">Allow school self-service</Label>
                <p className="text-xs text-white/45">
                  Lets school admins open /admin settings → Features and edit local Leo + pilot bypass.
                </p>
              </div>
              <Switch
                checked={allowSchoolSelfService}
                onCheckedChange={setAllowSchoolSelfService}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Rollout notes (internal)</Label>
              <Textarea
                value={rolloutNotes}
                onChange={(e) => setRolloutNotes(e.target.value)}
                className="min-h-[100px] border-white/10 bg-black/20 text-white"
                placeholder="Who is in the pilot, when it ends, who to contact…"
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={onSave}
                disabled={!dirty || update.isPending}
                className="bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
              >
                {update.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="ml-2">Save platform Leo</span>
              </Button>
            </div>
          </div>
        </PlatformSection>
      )}
    </div>
  );
}

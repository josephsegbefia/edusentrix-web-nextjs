"use client";

import * as React from "react";
import { AlertCircle, Info, Loader2, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/auth-provider";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  useLeoSchoolSettings,
  useUpdateLeoSchoolSettings,
} from "@/hooks/leo/useLeoSchoolSettings";
import { cn } from "@/lib/utils";
import type { SchoolLeoSettingsDTO } from "@/lib/leo/types";
import { LeoIcon } from "@/components/icons/LeoIcon";

function reasonLabel(reason: string): string {
  switch (reason) {
    case "enabled":
      return "Enabled";
    case "disabled_runtime":
      return "Off (env)";
    case "disabled_platform":
      return "Off (platform)";
    case "disabled_plan":
      return "Off (plan)";
    case "disabled_school":
      return "Off (school)";
    case "disabled_role":
      return "Off (role)";
    default:
      return reason;
  }
}

export function SchoolLeoSettingsCard() {
  const { me } = useAuth();
  const busy = useBusyToast();
  const isSchoolAdmin = me?.role === "school_admin";
  const { data, isLoading, isError, error, refetch } = useLeoSchoolSettings();
  const update = useUpdateLeoSchoolSettings();

  const canEdit = Boolean(
    data?.canSchoolEdit && isSchoolAdmin
  );

  const [accessOverride, setAccessOverride] = React.useState<
    SchoolLeoSettingsDTO["accessOverride"] | ""
  >("");
  const [entitlementBypass, setEntitlementBypass] = React.useState(false);

  React.useEffect(() => {
    if (!data?.leo) return;
    const leo = data.leo as SchoolLeoSettingsDTO;
    setAccessOverride(leo.accessOverride);
    setEntitlementBypass(!!leo.entitlementBypass);
  }, [data?.leo]);

  async function onSave() {
    if (!canEdit || !accessOverride) return;
    await busy.promise(
      update.mutateAsync({
        accessOverride: accessOverride as SchoolLeoSettingsDTO["accessOverride"],
        entitlementBypass,
      }),
      { loading: "Saving Leo…", success: "Leo school settings updated", error: (e) => (e as Error).message }
    );
    await refetch();
  }

  const dirty = data?.leo
    ? (data.leo as SchoolLeoSettingsDTO).accessOverride !== accessOverride ||
      !!(data.leo as SchoolLeoSettingsDTO).entitlementBypass !== entitlementBypass
    : false;

  return (
    <Card className="border border-white/10 bg-linear-to-br from-amber-900/20 to-slate-950/90 backdrop-blur-xl">
      <CardContent className="p-6">
        <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold text-white">
          <LeoIcon className="h-5 w-5 text-amber-300" />
          Leo Copilot
        </h3>
        <p className="mb-4 text-sm text-white/50">
          Control whether this school can use the assistant when your plan and platform allow it.
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Leo settings…
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error instanceof Error ? error.message : "Could not load"}
          </div>
        ) : !data ? null : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-white/55">Status:</span>
              <Badge
                className={cn(
                  "border-0",
                  data.access?.effectiveEnabled
                    ? "bg-emerald-500/25 text-emerald-200"
                    : "bg-white/10 text-white/70"
                )}
              >
                {data.access?.effectiveEnabled ? "Active for you" : "Not available"}{" "}
                {data.access?.reason && !data.access?.effectiveEnabled
                  ? `· ${reasonLabel(String(data.access.reason))}`
                  : ""}
              </Badge>
            </div>
            {data.access?.reasonDetail && !data.access?.effectiveEnabled ? (
              <p className="text-xs text-white/45">{data.access.reasonDetail}</p>
            ) : null}

            {!data.platform.allowSchoolSelfService && (
              <div className="flex gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/65">
                <Info className="h-4 w-4 shrink-0 text-amber-300" />
                School-level toggles are managed by the platform team for now.
              </div>
            )}

            {data.platform.allowSchoolSelfService && !isSchoolAdmin && (
              <p className="text-xs text-white/45">
                Only school administrators can change these options.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/70">School access</Label>
                <Select
                  value={accessOverride || (data.leo as SchoolLeoSettingsDTO).accessOverride}
                  onValueChange={(v) =>
                    setAccessOverride(v as SchoolLeoSettingsDTO["accessOverride"])
                  }
                  disabled={!canEdit}
                >
                  <SelectTrigger className="border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Inherit from platform + plan</SelectItem>
                    <SelectItem value="enabled">Enabled (when plan allows)</SelectItem>
                    <SelectItem value="disabled">Disabled for this school</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3 sm:col-span-1">
                <div>
                  <Label className="text-white/80">Pilot bypass (entitlement)</Label>
                  <p className="text-xs text-white/45">
                    Allow this school to use Leo before the subscription feature is on the plan.
                    Platform approval only.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Switch
                    checked={entitlementBypass}
                    onCheckedChange={setEntitlementBypass}
                    disabled={!canEdit}
                  />
                </div>
              </div>
            </div>

            {canEdit && (
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
                  <span className="ml-2">Save Leo settings</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

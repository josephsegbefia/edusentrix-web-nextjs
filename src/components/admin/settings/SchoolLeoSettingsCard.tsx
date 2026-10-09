"use client";

import * as React from "react";
import { AlertCircle, Info, Loader2, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
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
    <Card className="border border-(--ws-line) bg-linear-to-br from-amber-500/10 to-(--ws-panel-to) backdrop-blur-xl">
      <CardContent className="p-6">
        <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold text-(--ws-fg)">
          <LeoIcon className="h-5 w-5 text-(--ws-amber)" />
          Leo Copilot
        </h3>
        <p className="mb-4 text-sm text-(--ws-fg-70)">
          Control whether this school can use the assistant when your plan and platform allow it.
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-(--ws-fg-70)">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Leo settings…
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-(--ws-rose)">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error instanceof Error ? error.message : "Could not load"}
          </div>
        ) : !data ? null : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-(--ws-fg-70)">Status:</span>
              <Badge
                className={cn(
                  "border-0",
                  data.access?.effectiveEnabled
                    ? "bg-emerald-500/25 text-(--ws-emerald)"
                    : "bg-(--ws-fill-strong) text-(--ws-fg-70)"
                )}
              >
                {data.access?.effectiveEnabled ? "Active for you" : "Not available"}{" "}
                {data.access?.reason && !data.access?.effectiveEnabled
                  ? `· ${reasonLabel(String(data.access.reason))}`
                  : ""}
              </Badge>
            </div>
            {data.access?.reasonDetail && !data.access?.effectiveEnabled ? (
              <p className="text-xs text-(--ws-fg-70)">{data.access.reasonDetail}</p>
            ) : null}

            {!data.platform.allowSchoolSelfService && (
              <div className="flex gap-2 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-3 text-sm text-(--ws-fg-70)">
                <Info className="h-4 w-4 shrink-0 text-(--ws-amber)" />
                School-level toggles are managed by the platform team for now.
              </div>
            )}

            {data.platform.allowSchoolSelfService && !isSchoolAdmin && (
              <p className="text-xs text-(--ws-fg-70)">
                Only school administrators can change these options.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-(--ws-fg-70)">School access</Label>
                <PremiumSelect
                  value={accessOverride || (data.leo as SchoolLeoSettingsDTO).accessOverride}
                  onValueChange={(v) =>
                    setAccessOverride(v as SchoolLeoSettingsDTO["accessOverride"])
                  }
                  disabled={!canEdit}
                >
                  <PremiumSelectTrigger className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg)">
                    <PremiumSelectValue placeholder="Select" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="inherit">Inherit from platform + plan</PremiumSelectItem>
                    <PremiumSelectItem value="enabled">Enabled (when plan allows)</PremiumSelectItem>
                    <PremiumSelectItem value="disabled">Disabled for this school</PremiumSelectItem>
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <div className="flex flex-col justify-between gap-2 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-3 sm:col-span-1">
                <div>
                  <Label className="text-(--ws-fg-70)">Pilot bypass (entitlement)</Label>
                  <p className="text-xs text-(--ws-fg-70)">
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
                  className="bg-amber-500/20 text-(--ws-amber) hover:bg-amber-500/30"
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

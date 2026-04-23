"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useSchool, useUpdateSchool } from "@/hooks/admin/useSchool";
import { CURATED_SCHOOL_IANA_TIMEZONES } from "@/lib/constants/school-timezones";
import { isValidIanaTimeZone } from "@/lib/validation/iana-timezone";
import { Globe, Loader2, Sparkles } from "lucide-react";

function browserSuggestedTimeZone(): string {
  if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat === "undefined") {
    return "UTC";
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function SchoolTimeZoneSettingsCard() {
  const { data, isLoading, isError } = useSchool();
  const updateSchool = useUpdateSchool();
  const busy = useBusyToast();
  const suggested = React.useMemo(() => browserSuggestedTimeZone(), []);

  const [draft, setDraft] = React.useState("");
  const school = data?.data;

  React.useEffect(() => {
    if (!school) return;
    setDraft(school.timeZone || "Africa/Accra");
  }, [school?.id, school?.timeZone]);

  const isDirty = React.useMemo(() => {
    if (!school) return false;
    return (school.timeZone || "Africa/Accra").trim() !== draft.trim();
  }, [draft, school]);

  const canSave =
    Boolean(school) &&
    isDirty &&
    draft.trim().length > 0 &&
    isValidIanaTimeZone(draft.trim()) &&
    !updateSchool.isPending;

  const applySuggestion = () => {
    setDraft(suggested);
  };

  const handleSave = async () => {
    if (!school) return;
    const timeZone = draft.trim();
    if (!isValidIanaTimeZone(timeZone)) return;
    try {
      const saved = await busy.promise(updateSchool.mutateAsync({ timeZone }), {
        loading: "Saving time zone...",
        success: "Time zone saved",
        error: (e: Error) => e.message || "Failed to save",
      });
      setDraft(saved.timeZone);
    } catch {
      // toast
    }
  };

  if (isLoading) {
    return (
      <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
        <CardContent className="p-6">
          <div className="h-6 w-48 animate-pulse rounded bg-white/10" />
          <div className="mt-4 h-11 w-full max-w-md animate-pulse rounded-xl bg-white/5" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !school) {
    return (
      <Card className="border border-rose-500/25 bg-rose-950/20">
        <CardContent className="p-6 text-sm text-rose-200">Could not load school.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Globe className="h-5 w-5 text-cyan-300" />
              Regional and time zone
            </CardTitle>
            <CardDescription className="text-white/55">
              Used for local times in the admin, reports, and future reminder scheduling.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-cyan-500/30 bg-cyan-500/10 text-[11px] text-cyan-100"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              Suggested: {suggested}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="border border-white/10 bg-white/5 text-white hover:bg-white/10"
              onClick={applySuggestion}
            >
              Use suggested
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-white/80">IANA time zone</Label>
          <div className="flex max-w-lg flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Africa/Accra"
              className="border-white/10 bg-white/5 font-mono text-sm text-white"
              list="curated-iana-timezones"
              autoComplete="off"
              spellCheck={false}
            />
            <datalist id="curated-iana-timezones">
              {CURATED_SCHOOL_IANA_TIMEZONES.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </div>
          {draft.trim() && !isValidIanaTimeZone(draft.trim()) ? (
            <p className="text-sm text-amber-200/90">Enter a valid IANA zone (e.g. Africa/Accra).</p>
          ) : (
            <p className="text-xs text-white/45">
              Pick from the list or type any valid IANA identifier your browser accepts.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="bg-gradient-to-r from-cyan-600 to-violet-600 text-white"
          >
            {updateSchool.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save time zone"
            )}
          </Button>
          {isDirty && isValidIanaTimeZone(draft.trim()) ? (
            <span className="text-xs text-white/45">Unsaved changes</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  FlaskConical,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  InternalTestSchoolConfigDTO,
  InternalTestSchoolSummaryDTO,
} from "@/lib/internal-test/serialize-config";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { InternalTestLeoHint } from "@/components/internal-test/InternalTestLeoHint";
import {
  PHRASE_DISABLE_TEST_SCHOOL,
  PHRASE_ENABLE_TEST_SCHOOL,
} from "@/lib/internal-test/constants";
import { InternalTestViewAsTab } from "./view-as-tab";
import { InternalTestAuditActivityTab } from "./audit-activity-tab";

function effectiveDeliveryLines(cfg: InternalTestSchoolConfigDTO | null): string[] {
  if (!cfg) return [];
  return [
    `Invitation email: ${cfg.suppressEmailInvitations ? "suppressed" : "sent normally"}`,
    `SMS: ${cfg.suppressSms ? "suppressed" : "enabled"}`,
    `WhatsApp: ${cfg.suppressWhatsapp ? "suppressed" : "enabled"}`,
    `Push: ${cfg.suppressPushNotifications ? "suppressed" : "enabled"}`,
    `Parent alerts: ${cfg.suppressParentNotifications ? "suppressed" : "enabled"}`,
    cfg.disableRealPaymentCollection
      ? "Payments: real collection disabled"
      : cfg.useSandboxPayments
        ? "Payments: sandbox keys expected"
        : "Payments: standard",
  ];
}

type ConfigPayload = {
  school: InternalTestSchoolSummaryDTO;
  config: InternalTestSchoolConfigDTO | null;
};

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs leading-relaxed text-white/50">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

export default function PlatformSchoolInternalTestPage() {
  const params = useParams<{ id: string }>();
  const schoolId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [loading, setLoading] = React.useState(true);
  const [toolsDisabled, setToolsDisabled] = React.useState(false);
  const [payload, setPayload] = React.useState<ConfigPayload | null>(null);

  const [enablePhrase, setEnablePhrase] = React.useState("");
  const [activationSecret, setActivationSecret] = React.useState("");
  const [activateNotes, setActivateNotes] = React.useState("");
  const [activating, setActivating] = React.useState(false);

  const [disablePhrase, setDisablePhrase] = React.useState("");
  const [disableSecret, setDisableSecret] = React.useState("");
  const [disabling, setDisabling] = React.useState(false);

  const [draft, setDraft] = React.useState<InternalTestSchoolConfigDTO | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      setToolsDisabled(false);
      const res = await fetch(`/api/platform/schools/${schoolId}/internal-test/config`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        if (json?.code === "INTERNAL_TEST_TOOLS_DISABLED") {
          setToolsDisabled(true);
          setPayload(null);
          return;
        }
        throw new Error(json?.error || "Failed to load internal test settings");
      }
      const data = json.data as ConfigPayload;
      setPayload(data);
      setDraft(data.config ? { ...data.config } : null);
      if (
        data.school.isInternalTestSchool &&
        data.school.internalTest?.enabled &&
        !data.config
      ) {
        toast.error("Internal test is enabled but configuration is missing. Contact engineering.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleActivate() {
    if (!schoolId) return;
    try {
      setActivating(true);
      const res = await fetch(`/api/platform/schools/${schoolId}/internal-test/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          confirmationPhrase: enablePhrase.trim(),
          activationSecret: activationSecret.trim(),
          notes: activateNotes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Activation failed");
      }
      toast.success("Internal test mode enabled.");
      setEnablePhrase("");
      setActivationSecret("");
      setActivateNotes("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setActivating(false);
    }
  }

  async function handleDisable() {
    if (!schoolId) return;
    try {
      setDisabling(true);
      const res = await fetch(`/api/platform/schools/${schoolId}/internal-test/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationPhrase: disablePhrase.trim(),
          activationSecret: disableSecret.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to disable");
      }
      toast.success("Internal test mode disabled.");
      setDisablePhrase("");
      setDisableSecret("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disable");
    } finally {
      setDisabling(false);
    }
  }

  async function saveConfig() {
    if (!schoolId || !draft || !payload?.school.isInternalTestSchool) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/platform/schools/${schoolId}/internal-test/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suppressEmailInvitations: draft.suppressEmailInvitations,
          autoActivateCreatedUsers: draft.autoActivateCreatedUsers,
          markEmailsAsVerified: draft.markEmailsAsVerified,
          suppressSms: draft.suppressSms,
          suppressWhatsapp: draft.suppressWhatsapp,
          suppressPushNotifications: draft.suppressPushNotifications,
          suppressParentNotifications: draft.suppressParentNotifications,
          useSandboxPayments: draft.useSandboxPayments,
          disableRealPaymentCollection: draft.disableRealPaymentCollection,
          allowImpersonation: draft.allowImpersonation,
          showInternalTestBadge: draft.showInternalTestBadge,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Save failed");
      }
      toast.success("Configuration saved.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const enabled = Boolean(payload?.school.isInternalTestSchool && payload.school.internalTest?.enabled);
  const dirty =
    draft &&
    payload?.config &&
    (Object.keys(draft) as (keyof InternalTestSchoolConfigDTO)[]).some(
      (k) => k !== "updatedAt" && draft[k] !== payload.config![k]
    );

  const effectiveConfig =
    dirty && draft ? draft : payload?.config ?? null;

  return (
    <div className="space-y-6 p-2 md:p-4">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-white/70 hover:text-white">
          <Link href={schoolId ? `/platform/schools/${schoolId}` : "/platform/schools"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to school
          </Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Internal test controls
            </h1>
            <p className="mt-1 text-sm text-white/60">
              Safe QA and demo prep — invitations and payments stay suppressed when configured.
            </p>
            {!loading && payload && !toolsDisabled ? (
              <InternalTestLeoHint className="mt-4">
                <p className="font-medium text-violet-100">
                  Hi, I&apos;m <span className="text-violet-200">Leo</span>. Quick map of this page
                </p>
                <ul className="list-inside list-disc space-y-1 text-xs text-white/75 md:text-sm">
                  <li>
                    <strong className="text-white/90">Status</strong> — read-only: environment label,
                    internal-test mode, and when the school was enabled. Use the School ID when talking to
                    engineering or copying API paths.
                  </li>
                  <li>
                    <strong className="text-white/90">Enable</strong> (when off) — typed phrase + server
                    secret only; nothing here is shown to the school.
                  </li>
                  <li>
                    <strong className="text-white/90">Safety controls</strong> — toggles change real
                    behaviour (invites, channels, payments, badges, impersonation). Always hit{" "}
                    <strong className="text-white">Save configuration</strong> after edits.
                  </li>
                  <li>
                    <strong className="text-white/90">View as / Activity</strong> — impersonation and audit
                    tail for this school only.
                  </li>
                  <li>
                    <strong className="text-white/90">Danger zone</strong> — turns internal test off for
                    the school; existing data stays, but suppressions stop applying to new actions.
                  </li>
                </ul>
              </InternalTestLeoHint>
            ) : null}
          </div>
          {enabled ? (
            <Badge
              variant="outline"
              className="w-fit border-cyan-500/35 bg-cyan-500/15 text-sm font-medium text-cyan-100"
            >
              Internal test school
            </Badge>
          ) : null}
        </div>
      </div>

      {loading && !payload ? (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6">
          <div className="flex items-center gap-2 text-sm text-white/55">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Loading internal test settings…
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24 rounded-xl bg-white/10" />
            <Skeleton className="h-24 rounded-xl bg-white/10" />
            <Skeleton className="h-24 rounded-xl bg-white/10" />
          </div>
          <Skeleton className="h-40 rounded-xl bg-white/10" />
          <Skeleton className="h-32 rounded-xl bg-white/10" />
        </div>
      ) : null}

      {toolsDisabled ? (
        <div className="space-y-3">
          <Alert className="border-amber-500/25 bg-amber-500/10 text-amber-100">
            <ShieldAlert className="h-4 w-4 text-amber-200" />
            <AlertTitle>Tools disabled on this deployment</AlertTitle>
            <AlertDescription className="text-amber-100/85">
              Set <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">ENABLE_INTERNAL_TEST_TOOLS=true</code>{" "}
              and restart the server. Internal test APIs stay off until then.
            </AlertDescription>
          </Alert>
          <InternalTestLeoHint>
            <p className="text-xs text-white/75">
              <strong className="text-violet-100">Leo:</strong> This flag is read at request time on the
              server. After changing <code className="rounded bg-black/35 px-1 text-[11px]">.env</code> on
              Vercel or your host, redeploy or restart so Next.js picks it up—client-only refreshes will not
              unlock the routes.
            </p>
          </InternalTestLeoHint>
        </div>
      ) : null}

      {!loading && payload ? (
        <>
          <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-xl shadow-black/30">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <ShieldCheck className="h-5 w-5 text-cyan-300" />
                </span>
                Status
              </CardTitle>
              <p className="text-sm text-white/60">
                School ID:{" "}
                <code className="rounded-md bg-black/40 px-2 py-0.5 text-xs text-white/85">{schoolId}</code>
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-white/75">
                <span>
                  Environment:{" "}
                  <strong className="text-white">{payload.school.environmentType}</strong>
                </span>
                <span>
                  Mode:{" "}
                  <strong className="text-white">
                    {payload.school.internalTest?.mode?.replace(/_/g, " ") ?? "—"}
                  </strong>
                </span>
              </div>
              {payload.school.internalTest?.enabledAt ? (
                <p className="text-xs text-white/45">
                  Enabled {new Date(payload.school.internalTest.enabledAt).toLocaleString()}
                </p>
              ) : null}
              <InternalTestLeoHint className="mt-4 border-white/10 bg-black/25">
                <p className="text-xs font-medium text-violet-100/95">Leo — reading this card</p>
                <p className="text-xs text-white/70">
                  Nothing here is editable. <strong className="text-white/85">Environment</strong> comes
                  from the school record. <strong className="text-white/85">Mode</strong> reflects how
                  this test school was tagged at activation. The{" "}
                  <strong className="text-white/85">School ID</strong> is the Mongo identifier in URLs and
                  logs.
                </p>
              </InternalTestLeoHint>
            </CardContent>
          </Card>

          {enabled && effectiveConfig ? (
            <Alert className="border-cyan-500/25 bg-cyan-950/35 text-cyan-50">
              <ShieldCheck className="h-4 w-4 text-cyan-200" />
              <AlertTitle className="text-cyan-100">Effective outbound delivery</AlertTitle>
              <AlertDescription className="text-cyan-100/85">
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                  {effectiveDeliveryLines(effectiveConfig).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-cyan-100/60">
                  Reflects saved configuration unless you have unsaved edits (shown from draft).
                </p>
                <p className="mt-3 border-t border-cyan-500/20 pt-3 text-xs text-cyan-100/70">
                  <span className="font-medium text-cyan-50/90">Leo:</span> This strip is read-only—it mirrors
                  what outbound delivery will look like once you save (or your current draft if you have
                  unsaved toggles). It does not run a live send test.
                </p>
              </AlertDescription>
            </Alert>
          ) : null}

          {!enabled ? (
            <Card className="border-emerald-500/20 bg-linear-to-br from-emerald-950/40 via-slate-950 to-black">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <FlaskConical className="h-5 w-5 text-emerald-300" />
                  Enable internal test mode
                </CardTitle>
                <p className="text-sm text-white/60">
                  Type the phrase exactly, then enter the server activation secret (not shown to schools).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <InternalTestLeoHint>
                  <p className="font-medium text-violet-100">
                    Leo — what to put in each field below
                  </p>
                  <ul className="list-inside list-disc space-y-1.5 text-xs text-white/75 md:text-sm">
                    <li>
                      <strong className="text-white/90">Confirmation phrase</strong> — type exactly{" "}
                      <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[11px] text-cyan-100/90">
                        {PHRASE_ENABLE_TEST_SCHOOL}
                      </code>{" "}
                      (same spelling and spaces as production docs). Copy-paste is fine.
                    </li>
                    <li>
                      <strong className="text-white/90">Activation secret</strong> — the value of{" "}
                      <code className="rounded bg-black/40 px-1 py-0.5 text-[11px] text-white/80">
                        INTERNAL_TEST_ACTIVATION_SECRET
                      </code>{" "}
                      from the server environment your browser is talking to. Never share it in tickets or
                      with schools; it is not their password.
                    </li>
                    <li>
                      <strong className="text-white/90">Notes (optional)</strong> — free text for your
                      team (ticket link, scenario name, who asked). Helpful when reviewing audit logs
                      later.
                    </li>
                  </ul>
                </InternalTestLeoHint>
                <div className="space-y-2">
                  <Label className="text-white/70">Confirmation phrase</Label>
                  <Input
                    value={enablePhrase}
                    onChange={(e) => setEnablePhrase(e.target.value)}
                    placeholder="ENABLE TEST SCHOOL"
                    className="border-white/10 bg-black/35 font-mono text-sm text-white placeholder:text-white/35"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Activation secret</Label>
                  <Input
                    type="password"
                    value={activationSecret}
                    onChange={(e) => setActivationSecret(e.target.value)}
                    placeholder="INTERNAL_TEST_ACTIVATION_SECRET value"
                    className="border-white/10 bg-black/35 text-sm text-white placeholder:text-white/35"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Notes (optional)</Label>
                  <Textarea
                    value={activateNotes}
                    onChange={(e) => setActivateNotes(e.target.value)}
                    placeholder="Why this school is marked for internal testing…"
                    className="min-h-[88px] border-white/10 bg-black/35 text-sm text-white placeholder:text-white/35"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => void handleActivate()}
                  disabled={activating || !enablePhrase.trim() || !activationSecret.trim()}
                  className="bg-brand text-black hover:bg-brand/90"
                >
                  {activating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enabling…
                    </>
                  ) : (
                    "Enable internal test mode"
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {enabled && draft ? (
            <>
              <Tabs defaultValue="settings" className="w-full space-y-6">
                <TabsList className="border border-white/10 bg-black/40 p-1">
                  <TabsTrigger
                    value="settings"
                    className="data-[state=active]:bg-white/15 data-[state=active]:text-white"
                  >
                    Safety controls
                  </TabsTrigger>
                  <TabsTrigger
                    value="view-as"
                    className="data-[state=active]:bg-white/15 data-[state=active]:text-white"
                  >
                    View as
                  </TabsTrigger>
                  <TabsTrigger
                    value="activity"
                    className="data-[state=active]:bg-white/15 data-[state=active]:text-white"
                  >
                    Activity
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="settings" className="mt-0 space-y-6 outline-none">
              <InternalTestLeoHint>
                <p className="font-medium text-violet-100">Leo — Safety controls cheat sheet</p>
                <p className="text-xs text-white/70 md:text-sm">
                  Each switch changes how the <em>school</em> behaves for new and updated records. Real
                  schools are unaffected. After any change, press{" "}
                  <strong className="text-white">Save configuration</strong> or nothing is persisted. The
                  cyan strip above summarizes delivery once saved (or from your unsaved draft when you have
                  local edits).
                </p>
                <ul className="list-inside list-disc space-y-1 border-t border-white/10 pt-2 text-xs text-white/70 md:text-sm">
                  <li>
                    <strong className="text-white/85">Email &amp; accounts</strong> — invitation
                    suppression stops real invite mail for users created under this school; auto-activate and
                    mark-verified help synthetic accounts behave in the UI without inbox flows.
                  </li>
                  <li>
                    <strong className="text-white/85">Outbound notifications</strong> — SMS, WhatsApp,
                    push, and parent alerts: turn on per channel when you intentionally want to test that
                    channel; leave on suppress for quieter QA.
                  </li>
                  <li>
                    <strong className="text-white/85">Payments</strong> — sandbox vs disable collection
                    pairs with your Paystack keys and product rules; use when you must not move real money.
                  </li>
                  <li>
                    <strong className="text-white/85">Tools &amp; visibility</strong> — impersonation and the
                    badge warn humans they are in a test school shell.
                  </li>
                </ul>
              </InternalTestLeoHint>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-white/10 bg-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-white">Email &amp; accounts</CardTitle>
                    <p className="text-xs text-white/50">Invitation behaviour for users created in this school.</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <ToggleRow
                      label="Suppress email invitations"
                      description="Do not send invitation emails for new users while still creating memberships."
                      checked={draft.suppressEmailInvitations}
                      disabled={saving}
                      onCheckedChange={(v) => setDraft({ ...draft, suppressEmailInvitations: v })}
                    />
                    <ToggleRow
                      label="Auto-activate created users"
                      description="Mark accounts active when compatible with your user model."
                      checked={draft.autoActivateCreatedUsers}
                      disabled={saving}
                      onCheckedChange={(v) => setDraft({ ...draft, autoActivateCreatedUsers: v })}
                    />
                    <ToggleRow
                      label="Treat emails as verified"
                      description="Skip pending verification for synthetic addresses when appropriate."
                      checked={draft.markEmailsAsVerified}
                      disabled={saving}
                      onCheckedChange={(v) => setDraft({ ...draft, markEmailsAsVerified: v })}
                    />
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-white">Outbound notifications</CardTitle>
                    <p className="text-xs text-white/50">Prevent external channels from firing for test traffic.</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <ToggleRow
                      label="Suppress SMS"
                      checked={draft.suppressSms}
                      disabled={saving}
                      onCheckedChange={(v) => setDraft({ ...draft, suppressSms: v })}
                      description="Do not send SMS to generated or manual numbers."
                    />
                    <ToggleRow
                      label="Suppress WhatsApp"
                      checked={draft.suppressWhatsapp}
                      disabled={saving}
                      onCheckedChange={(v) => setDraft({ ...draft, suppressWhatsapp: v })}
                      description="Block WhatsApp sends initiated by this school."
                    />
                    <ToggleRow
                      label="Suppress push notifications"
                      checked={draft.suppressPushNotifications}
                      disabled={saving}
                      onCheckedChange={(v) => setDraft({ ...draft, suppressPushNotifications: v })}
                      description="Avoid push delivery for test events."
                    />
                    <ToggleRow
                      label="Suppress parent notifications"
                      checked={draft.suppressParentNotifications}
                      disabled={saving}
                      onCheckedChange={(v) => setDraft({ ...draft, suppressParentNotifications: v })}
                      description="Reduce noisy parent-facing alerts during QA."
                    />
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-white">Payments</CardTitle>
                    <p className="text-xs text-white/50">Keep money movement simulated.</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <ToggleRow
                      label="Sandbox payments"
                      checked={draft.useSandboxPayments}
                      disabled={saving}
                      onCheckedChange={(v) => setDraft({ ...draft, useSandboxPayments: v })}
                      description="Record test references instead of live collections."
                    />
                    <ToggleRow
                      label="Disable real payment collection"
                      checked={draft.disableRealPaymentCollection}
                      disabled={saving}
                      onCheckedChange={(v) => setDraft({ ...draft, disableRealPaymentCollection: v })}
                      description="Block flows that would debit guardians or settle payouts."
                    />
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-white">Tools &amp; visibility</CardTitle>
                    <p className="text-xs text-white/50">Impersonation and badge.</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <ToggleRow
                      label="Allow impersonation"
                      checked={draft.allowImpersonation}
                      disabled={saving}
                      onCheckedChange={(v) => setDraft({ ...draft, allowImpersonation: v })}
                      description="Platform-only login-as for marked test users when implemented."
                    />
                    <ToggleRow
                      label="Show internal test badge"
                      checked={draft.showInternalTestBadge}
                      disabled={saving}
                      onCheckedChange={(v) => setDraft({ ...draft, showInternalTestBadge: v })}
                      description="Surface a visible badge in school-scoped layouts."
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void saveConfig()}
                  disabled={saving || !dirty}
                  className={cn(
                    "bg-brand text-black hover:bg-brand/90",
                    !dirty && "opacity-60"
                  )}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save configuration"
                  )}
                </Button>
                {draft ? (
                  <p className="text-xs text-white/45">
                    Last saved {new Date(draft.updatedAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <InternalTestLeoHint className="border-white/10 bg-black/20">
                <p className="text-xs text-white/75">
                  <strong className="text-violet-100">Leo:</strong>{" "}
                  <strong className="text-white/90">Save configuration</strong> stays faded until something
                  changed from the last saved snapshot. If you toggled switches and nothing enables, you may
                  be looking at an already-matching draft—flip a control off and on to confirm.
                </p>
              </InternalTestLeoHint>
                </TabsContent>

                <TabsContent value="view-as" className="mt-0 outline-none">
                  <InternalTestViewAsTab
                    schoolId={schoolId ?? ""}
                    allowImpersonation={draft.allowImpersonation}
                  />
                </TabsContent>

                <TabsContent value="activity" className="mt-0 outline-none">
                  <InternalTestAuditActivityTab schoolId={schoolId ?? ""} />
                </TabsContent>
              </Tabs>
            </>
          ) : null}

          {enabled ? (
            <Card className="border-rose-500/25 bg-linear-to-br from-rose-950/50 via-slate-950 to-black">
              <CardHeader>
                <CardTitle className="text-lg text-rose-100">Danger zone</CardTitle>
                <p className="text-sm text-rose-100/75">
                  Disabling stops future invitation suppression for this school. Data is not deleted.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <InternalTestLeoHint className="border-rose-500/20 bg-rose-950/25">
                  <p className="font-medium text-rose-100">Leo — before you disable</p>
                  <ul className="list-inside list-disc space-y-1 text-xs text-rose-100/85 md:text-sm">
                    <li>
                      <strong className="text-white">Confirmation phrase</strong> — type exactly{" "}
                      <code className="rounded bg-black/35 px-1 py-0.5 font-mono text-[11px]">
                        {PHRASE_DISABLE_TEST_SCHOOL}
                      </code>
                      . Same rules as enable: exact string, no extra spaces.
                    </li>
                    <li>
                      <strong className="text-white">Activation secret</strong> — same{" "}
                      <code className="rounded bg-black/35 px-1 py-0.5 text-[11px]">
                        INTERNAL_TEST_ACTIVATION_SECRET
                      </code>{" "}
                      you used to enable. Proves someone with deploy access is performing the action.
                    </li>
                    <li>
                      Disabling does <strong className="text-white">not</strong> delete users or invoices;
                      it only stops future internal-test suppressions and gates from applying.
                    </li>
                  </ul>
                </InternalTestLeoHint>
                <div className="space-y-2">
                  <Label className="text-white/80">Confirmation phrase</Label>
                  <Input
                    value={disablePhrase}
                    onChange={(e) => setDisablePhrase(e.target.value)}
                    placeholder="DISABLE TEST SCHOOL"
                    className="border-rose-500/20 bg-black/40 font-mono text-sm text-white placeholder:text-white/35"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Activation secret</Label>
                  <Input
                    type="password"
                    value={disableSecret}
                    onChange={(e) => setDisableSecret(e.target.value)}
                    className="border-rose-500/20 bg-black/40 text-sm text-white placeholder:text-white/35"
                    autoComplete="off"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleDisable()}
                  disabled={disabling || !disablePhrase.trim() || !disableSecret.trim()}
                  className="border-rose-400/40 bg-rose-500/15 text-rose-50 hover:bg-rose-500/25"
                >
                  {disabling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Disabling…
                    </>
                  ) : (
                    "Disable internal test mode"
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

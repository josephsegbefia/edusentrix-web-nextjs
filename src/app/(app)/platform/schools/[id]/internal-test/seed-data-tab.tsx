"use client";

import * as React from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { InternalTestLeoHint } from "@/components/internal-test/InternalTestLeoHint";
import { PHRASE_RESET_TEST_DATA } from "@/lib/internal-test/constants";

type JobSummary = {
  id: string;
  testDataBatchId: string;
  status: string;
  scope: string;
  completedAt: string | null;
  steps?: Array<{ key: string; label: string; status: string; error?: string; skipReason?: string }>;
};

export function InternalTestSeedDataTab(props: {
  schoolId: string;
  schoolName: string;
  allowSeedGeneration: boolean;
  allowResetGeneratedData: boolean;
}) {
  const { schoolId, schoolName, allowSeedGeneration, allowResetGeneratedData } = props;

  const [jobs, setJobs] = React.useState<JobSummary[]>([]);
  const [loadingJobs, setLoadingJobs] = React.useState(false);

  const [p1Name, setP1Name] = React.useState("Term 1");
  const [p1Term, setP1Term] = React.useState("Term 1");
  const [p1Start, setP1Start] = React.useState("");
  const [p1End, setP1End] = React.useState("");
  const [p2Enabled, setP2Enabled] = React.useState(false);
  const [p2Name, setP2Name] = React.useState("Term 2");
  const [p2Term, setP2Term] = React.useState("Term 2");
  const [p2Start, setP2Start] = React.useState("");
  const [p2End, setP2End] = React.useState("");
  const [p2Current, setP2Current] = React.useState(false);

  const [studentsPerClass, setStudentsPerClass] = React.useState(2);
  const [teacherCount, setTeacherCount] = React.useState(4);
  const [parentRatio, setParentRatio] = React.useState(1);

  /** core_v1 = Core only; extended_v2 = Core V1 + Chunk 10 modules (each step isolated). */
  const [generationScope, setGenerationScope] = React.useState<"core_v1" | "extended_v2">("core_v1");

  const [running, setRunning] = React.useState(false);
  const [confirmSchoolName, setConfirmSchoolName] = React.useState("");
  const [showRunConfirm, setShowRunConfirm] = React.useState(false);

  const [resetBatchId, setResetBatchId] = React.useState("");
  const [resetPhrase, setResetPhrase] = React.useState("");
  const [resetSecret, setResetSecret] = React.useState("");
  const [resetting, setResetting] = React.useState(false);

  const loadJobs = React.useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoadingJobs(true);
      const res = await fetch(`/api/platform/schools/${schoolId}/internal-test/generation-jobs`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load jobs");
      }
      setJobs((json.data?.items as JobSummary[]) ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load jobs");
    } finally {
      setLoadingJobs(false);
    }
  }, [schoolId]);

  React.useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  async function runGeneration() {
    if (!schoolId || confirmSchoolName.trim() !== schoolName.trim()) {
      toast.error("Type the school name exactly to confirm.");
      return;
    }
    const periods: Array<{
      name: string;
      termLabel: string;
      startDate: string;
      endDate: string;
      isCurrent: boolean;
    }> = [
      {
        name: p1Name.trim(),
        termLabel: p1Term.trim(),
        startDate: new Date(p1Start).toISOString(),
        endDate: new Date(p1End).toISOString(),
        isCurrent: !p2Enabled || !p2Current,
      },
    ];
    if (p2Enabled) {
      periods.push({
        name: p2Name.trim(),
        termLabel: p2Term.trim(),
        startDate: new Date(p2Start).toISOString(),
        endDate: new Date(p2End).toISOString(),
        isCurrent: p2Current,
      });
    }

    try {
      setRunning(true);
      const res = await fetch(`/api/platform/schools/${schoolId}/internal-test/generation-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: generationScope,
          academicPeriods: periods,
          counts: {
            studentsPerClassGroup: studentsPerClass,
            teachers: teacherCount,
            parentsPerStudentRatio: parentRatio,
          },
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success !== true) {
        throw new Error(json?.error || "Generation failed");
      }
      toast.success(
        generationScope === "extended_v2"
          ? "Core + extended generation finished."
          : "Core V1 generation finished."
      );
      setShowRunConfirm(false);
      setConfirmSchoolName("");
      await loadJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setRunning(false);
    }
  }

  async function runReset() {
    if (!schoolId || !resetBatchId.trim()) return;
    try {
      setResetting(true);
      const res = await fetch(`/api/platform/schools/${schoolId}/internal-test/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testDataBatchId: resetBatchId.trim(),
          confirmationPhrase: resetPhrase.trim(),
          activationSecret: resetSecret.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Reset failed");
      }
      toast.success("Generated data removed for this batch.");
      setResetPhrase("");
      setResetSecret("");
      await loadJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  if (!allowSeedGeneration) {
    return (
      <div className="space-y-4">
        <Alert className="border-white/15 bg-white/5 text-white/80">
          <AlertTitle className="text-white">Seed generation disabled</AlertTitle>
          <AlertDescription className="text-white/60">
            Turn on &quot;Allow seed generation&quot; in Safety controls, save, then return here.
          </AlertDescription>
        </Alert>
        <InternalTestLeoHint>
          <p className="font-medium text-violet-100">Leo</p>
          <p className="text-xs text-white/75 md:text-sm">
            Open the <strong className="text-white/90">Safety controls</strong> tab, find{" "}
            <strong className="text-white/90">Allow seed generation</strong>, switch it on, then click{" "}
            <strong className="text-white/90">Save configuration</strong>. Until that saves, this tab stays
            locked so nobody accidentally runs bulk jobs against the wrong policy.
          </p>
        </InternalTestLeoHint>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <InternalTestLeoHint>
        <p className="font-medium text-violet-100">Leo — Seed data tab field guide</p>
        <ul className="list-inside list-disc space-y-1 text-xs text-white/75 md:text-sm">
          <li>
            <strong className="text-white/90">Academic periods</strong> —{" "}
            <strong className="text-white/85">Name</strong> is a friendly label;{" "}
            <strong className="text-white/85">Term label</strong> is stored on the period record.{" "}
            <strong className="text-white/85">Start / End</strong> must not overlap between period 1 and 2;
            exactly one row must be marked current (Period 1 is current when second period is off, or use
            the Period 2 switch).
          </li>
          <li>
            <strong className="text-white/90">Generation scope</strong> — <em>Core only</em> seeds grades,
            classes, users, fees, notices. <em>Core + extended</em> adds optional modules (curriculum row,
            poll, campaign, meeting, vendor, store item, AI usage, analytics metric); extended steps can
            fail without undoing core.
          </li>
          <li>
            <strong className="text-white/90">Counts</strong> — caps are enforced server-side (students per
            class 1–30, teachers 1–20, parents per student 1–3). Lower numbers mean faster jobs and less noise.
          </li>
          <li>
            <strong className="text-white/90">Run generation</strong> — opens a confirm card: type the{" "}
            <strong className="text-white/85">exact school name</strong> shown in the prompt (same spelling
            and spacing as the platform school record) so bulk create cannot be clicked by mistake.
          </li>
          <li>
            <strong className="text-white/90">Recent jobs</strong> — each block shows{" "}
            <code className="rounded bg-black/35 px-1 text-[11px]">testDataBatchId</code> you need for reset;
            expand steps to see which module failed.
          </li>
          <li>
            <strong className="text-white/90">Reset batch</strong> — paste the batch id from a job, type the
            phrase{" "}
            <code className="rounded bg-black/35 px-1 font-mono text-[11px] text-cyan-100/90">
              {PHRASE_RESET_TEST_DATA}
            </code>
            , then the same activation secret as enable/disable. Only registry-linked seed rows for that
            batch are removed; manual data stays.
          </li>
        </ul>
      </InternalTestLeoHint>
      <Card className="border-white/10 bg-white/5 text-white">
        <CardHeader>
          <CardTitle className="text-lg">Academic periods</CardTitle>
          <p className="text-sm text-white/55">
            Provide 1–2 non-overlapping periods; exactly one must be current.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label className="text-white/70">Period 1 name</Label>
            <Input
              value={p1Name}
              onChange={(e) => setP1Name(e.target.value)}
              className="border-white/10 bg-black/35 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Term label</Label>
            <Input
              value={p1Term}
              onChange={(e) => setP1Term(e.target.value)}
              className="border-white/10 bg-black/35 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Start / End</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={p1Start}
                onChange={(e) => setP1Start(e.target.value)}
                className="border-white/10 bg-black/35 text-white"
              />
              <Input
                type="date"
                value={p1End}
                onChange={(e) => setP1End(e.target.value)}
                className="border-white/10 bg-black/35 text-white"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 md:col-span-2">
            <div>
              <p className="text-sm font-medium text-white">Second period</p>
              <p className="text-xs text-white/50">Optional — enable for two-term setups.</p>
            </div>
            <Switch checked={p2Enabled} onCheckedChange={setP2Enabled} />
          </div>
          {p2Enabled ? (
            <>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-white/70">Period 2 name</Label>
                <Input
                  value={p2Name}
                  onChange={(e) => setP2Name(e.target.value)}
                  className="border-white/10 bg-black/35 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Term label</Label>
                <Input
                  value={p2Term}
                  onChange={(e) => setP2Term(e.target.value)}
                  className="border-white/10 bg-black/35 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Start / End</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={p2Start}
                    onChange={(e) => setP2Start(e.target.value)}
                    className="border-white/10 bg-black/35 text-white"
                  />
                  <Input
                    type="date"
                    value={p2End}
                    onChange={(e) => setP2End(e.target.value)}
                    className="border-white/10 bg-black/35 text-white"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 md:col-span-2">
                <div>
                  <p className="text-sm font-medium text-white">Period 2 is current</p>
                </div>
                <Switch checked={p2Current} onCheckedChange={setP2Current} />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5 text-white">
        <CardHeader>
          <CardTitle className="text-lg">Generation scope</CardTitle>
          <p className="text-sm text-white/55">
            Extended modules run after core steps; each extended step can fail without rolling back core data.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <RadioGroup
            value={generationScope}
            onValueChange={(v) => setGenerationScope(v as "core_v1" | "extended_v2")}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3">
              <RadioGroupItem value="core_v1" id="scope-core" className="mt-1 border-white/40" />
              <span>
                <span className="font-medium text-white">Core only (recommended)</span>
                <span className="mt-1 block text-xs text-white/50">
                  Grades, classes, users, fees, notices — stable baseline for QA.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3">
              <RadioGroupItem value="extended_v2" id="scope-ext" className="mt-1 border-white/40" />
              <span>
                <span className="font-medium text-white">Core + extended</span>
                <span className="mt-1 block text-xs text-white/50">
                  Adds curriculum/SOW, polls, fundraising, meetings, vendors, store sample, AI usage, analytics
                  metrics — optional extended demos.
                </span>
              </span>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5 text-white">
        <CardHeader>
          <CardTitle className="text-lg">Counts (Core V1)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-white/70">Students per class group</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={studentsPerClass}
              onChange={(e) => setStudentsPerClass(Number(e.target.value))}
              className="border-white/10 bg-black/35 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Teachers</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={teacherCount}
              onChange={(e) => setTeacherCount(Number(e.target.value))}
              className="border-white/10 bg-black/35 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/70">Parents per student</Label>
            <Input
              type="number"
              min={1}
              max={3}
              value={parentRatio}
              onChange={(e) => setParentRatio(Number(e.target.value))}
              className="border-white/10 bg-black/35 text-white"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="bg-brand text-black hover:bg-brand/90"
          onClick={() => setShowRunConfirm(true)}
          disabled={running || !p1Start || !p1End}
        >
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              {generationScope === "extended_v2" ? "Run Core + extended generation" : "Run Core V1 generation"}
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={() => void loadJobs()} disabled={loadingJobs}>
          Refresh jobs
        </Button>
      </div>

      {showRunConfirm ? (
        <Card className="border-amber-500/30 bg-amber-950/30 text-white">
          <CardHeader>
            <CardTitle className="text-lg text-amber-100">Confirm destructive seed</CardTitle>
            <p className="text-sm text-amber-100/80">
              This creates many records (grades, classes, users, fees). Type the school name{" "}
              <strong>{schoolName}</strong> to continue.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <InternalTestLeoHint className="border-amber-500/25 bg-black/30">
              <p className="text-xs font-medium text-amber-100">Leo — confirmation field</p>
              <p className="text-xs text-white/75">
                Paste or type the school name <strong className="text-white">exactly</strong> as shown
                above (trim accidental spaces in your head, but the comparison is strict). If the button
                stays disabled, compare character-by-character with the school overview title on the
                previous page.
              </p>
            </InternalTestLeoHint>
            <Input
              value={confirmSchoolName}
              onChange={(e) => setConfirmSchoolName(e.target.value)}
              placeholder="School name"
              className="border-amber-500/25 bg-black/40 text-white"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                className="bg-brand text-black"
                onClick={() => void runGeneration()}
                disabled={running}
              >
                Start generation
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowRunConfirm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-white/10 bg-white/5 text-white">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-lg">Recent jobs</CardTitle>
          {loadingJobs ? <Loader2 className="h-4 w-4 animate-spin text-white/50" /> : null}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {loadingJobs && jobs.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl bg-white/10" />
              <Skeleton className="h-16 w-full rounded-xl bg-white/10" />
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-white/50">No generation jobs yet.</p>
          ) : (
            jobs.map((j) => (
              <div
                key={j.id}
                className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white/85"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-white/60">{j.testDataBatchId}</span>
                  <span className="text-xs uppercase text-cyan-200/90">{j.status}</span>
                </div>
                <p className="mt-1 text-xs text-white/45">
                  Job ID: {j.id} · Scope: {j.scope}
                </p>
                {j.steps?.length ? (
                  <ul className="mt-2 max-h-40 overflow-auto text-xs text-white/55">
                    {j.steps.map((s) => (
                      <li key={s.key}>
                        {s.label}: <strong className="text-white/75">{s.status}</strong>
                        {s.error ? ` — ${s.error}` : ""}
                        {s.skipReason ? ` — ${s.skipReason}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {allowResetGeneratedData ? (
        <Card className="border-rose-500/25 bg-rose-950/40 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-rose-100">
              <RotateCcw className="h-5 w-5" />
              Reset generated data
            </CardTitle>
            <p className="text-sm text-rose-100/75">
              Deletes only documents recorded for the batch ID (manual data stays). Phrase:{" "}
              <code className="rounded bg-black/40 px-1">RESET TEST DATA</code>
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <InternalTestLeoHint className="border-rose-500/25 bg-rose-950/30">
              <p className="text-xs font-medium text-rose-100">Leo — reset fields</p>
              <ul className="list-inside list-disc space-y-1 text-xs text-rose-100/85">
                <li>
                  <strong className="text-white">testDataBatchId</strong> — copy the{" "}
                  <code className="rounded bg-black/35 px-1 font-mono text-[11px]">bth_…</code> value from a
                  finished job in Recent jobs. Wrong id = nothing deleted or wrong batch.
                </li>
                <li>
                  <strong className="text-white">Confirmation phrase</strong> — must match{" "}
                  <code className="rounded bg-black/35 px-1 font-mono text-[11px]">{PHRASE_RESET_TEST_DATA}</code>{" "}
                  exactly (all caps, spaces as written).
                </li>
                <li>
                  <strong className="text-white">Activation secret</strong> — same server secret as enable /
                  disable; proves operator intent alongside the phrase.
                </li>
              </ul>
            </InternalTestLeoHint>
            <div className="space-y-2">
              <Label className="text-white/80">testDataBatchId</Label>
              <Input
                value={resetBatchId}
                onChange={(e) => setResetBatchId(e.target.value)}
                placeholder="bth_…"
                className="border-rose-500/20 bg-black/40 font-mono text-sm text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Confirmation phrase</Label>
              <Input
                value={resetPhrase}
                onChange={(e) => setResetPhrase(e.target.value)}
                className="border-rose-500/20 bg-black/40 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Activation secret</Label>
              <Input
                type="password"
                value={resetSecret}
                onChange={(e) => setResetSecret(e.target.value)}
                className="border-rose-500/20 bg-black/40 text-white"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={resetting || !resetBatchId.trim()}
              onClick={() => void runReset()}
              className="border-rose-400/40 text-rose-50"
            >
              {resetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting…
                </>
              ) : (
                "Reset batch"
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Alert className="border-white/10 bg-white/5 text-white/70">
          <AlertDescription>
            Enable &quot;Allow reset of generated data&quot; in Safety controls to use batch reset.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

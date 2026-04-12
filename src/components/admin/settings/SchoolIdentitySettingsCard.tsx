"use client";

import * as React from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useSchool, useUpdateSchool, type SchoolInfo } from "@/hooks/admin/useSchool";
import { Camera, Loader2, School, ShieldCheck, UploadCloud } from "lucide-react";

const SCHOOL_PLACEHOLDER_SRC = "/placeholders/school-logo-placeholder.svg";

type IdentityFormState = {
  name: string;
  motto: string;
  gesSchoolCode: string;
  logo: string | null;
};

function buildFormState(school: SchoolInfo): IdentityFormState {
  return {
    name: school.name,
    motto: school.motto || "",
    gesSchoolCode: school.gesSchoolCode || "",
    logo: school.logo || null,
  };
}

function curriculumLabel(curriculumCode?: string) {
  const labels: Record<string, string> = {
    ghana_nacca: "NaCCA",
    cambridge: "Cambridge",
    ib_pyp: "IB PYP",
    ib_myp: "IB MYP",
    british_nc: "British NC",
    american: "American",
    hybrid: "Hybrid",
  };
  if (!curriculumCode) return "Curriculum not set";
  return labels[curriculumCode] || curriculumCode;
}

export function SchoolIdentitySettingsCard() {
  const { data, isLoading, isError } = useSchool();
  const updateSchool = useUpdateSchool();
  const busy = useBusyToast();
  const [form, setForm] = React.useState<IdentityFormState | null>(null);

  const school = data?.data;

  // Sync local form from server only when identity fields change — never depend on `form`
  // here or setState loops (Maximum update depth exceeded).
  React.useEffect(() => {
    if (!school) return;
    setForm(buildFormState(school));
  }, [
    school?.id,
    school?.name,
    school?.motto,
    school?.gesSchoolCode,
    school?.logo,
  ]);

  const isDirty = React.useMemo(() => {
    if (!school || !form) return false;
    return (
      school.name.trim() !== form.name.trim() ||
      (school.motto || "").trim() !== form.motto.trim() ||
      (school.gesSchoolCode || "").trim() !== form.gesSchoolCode.trim() ||
      (school.logo || null) !== (form.logo || null)
    );
  }, [form, school]);

  const canSave = Boolean(form?.name.trim()) && isDirty && !updateSchool.isPending;

  const handleSave = async () => {
    if (!form) return;

    const payload = {
      name: form.name.trim(),
      motto: form.motto.trim() || null,
      gesSchoolCode: form.gesSchoolCode.trim() || null,
      logo: form.logo || null,
    };

    try {
      const saved = await busy.promise(updateSchool.mutateAsync(payload), {
        loading: "Saving school identity...",
        success: "School identity saved",
        error: (error: Error) => error.message || "Failed to save school identity",
      });

      setForm(buildFormState(saved));
    } catch {
      // Busy toast handles the surface error
    }
  };

  if (isLoading) {
    return (
      <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
        <CardContent className="p-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
              <div className="h-11 w-full animate-pulse rounded-xl bg-white/5" />
              <div className="h-28 w-full animate-pulse rounded-xl bg-white/5" />
              <div className="h-11 w-full animate-pulse rounded-xl bg-white/5" />
            </div>
            <div className="h-[340px] animate-pulse rounded-2xl bg-white/5" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !school || !form) {
    return (
      <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-white/70">
            <School className="h-5 w-5 text-white/40" />
            School identity could not be loaded right now.
          </div>
        </CardContent>
      </Card>
    );
  }

  const previewLogo = form.logo || SCHOOL_PLACEHOLDER_SRC;

  return (
    <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
      <CardContent className="p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10">
                <Camera className="h-5 w-5 text-cyan-200" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  School Identity
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-white/60">
                  Update the school name, motto, logo, and key identity details
                  shown across the admin, teacher, parent, and student sidebars.
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/70">School Name</Label>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? { ...current, name: event.target.value }
                        : current
                    )
                  }
                  className="border-white/10 bg-white/5 text-white"
                  placeholder="Enter school name"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">GES School Code</Label>
                <Input
                  value={form.gesSchoolCode}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? { ...current, gesSchoolCode: event.target.value }
                        : current
                    )
                  }
                  className="border-white/10 bg-white/5 text-white"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">School Motto</Label>
              <Textarea
                value={form.motto}
                onChange={(event) =>
                  setForm((current) =>
                    current
                      ? { ...current, motto: event.target.value }
                      : current
                  )
                }
                maxLength={160}
                rows={4}
                className="min-h-[120px] border-white/10 bg-white/5 text-white placeholder:text-white/30"
                placeholder="Add a motto that represents the school's identity"
              />
              <p className="text-xs text-white/45">
                Keep it short. This appears as a supporting identity line in the
                sidebar.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="border-white/10 bg-white/5 text-white/70"
              >
                {school.type}
              </Badge>
              <Badge
                variant="outline"
                className="border-white/10 bg-white/5 text-white/70"
              >
                {curriculumLabel(school.curriculumCode)}
              </Badge>
              <Badge
                variant="outline"
                className="border-white/10 bg-white/5 text-white/70"
              >
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                School Admin visible
              </Badge>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40">
              Sidebar Preview
            </p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-card/60 p-4 shadow-lg shadow-black/20">
              <div className="flex items-start gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900 via-slate-900 to-slate-950 ring-1 ring-white/5">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-cyan-400/10"
                  />
                  <Image
                    src={previewLogo}
                    alt={form.name || school.name}
                    fill
                    sizes="56px"
                    className="object-contain p-2"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {form.name.trim() || school.name}
                      </p>
                      <p className="mt-1 text-xs italic leading-5 text-white/55">
                        {form.motto.trim()
                          ? `"${form.motto.trim()}"`
                          : `${curriculumLabel(school.curriculumCode)} curriculum`}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-violet-400/25 bg-violet-500/15 text-[10px] font-semibold tracking-[0.16em] text-violet-100"
                    >
                      School Admin
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="border-white/10 bg-white/5 text-[10px] text-white/70"
                    >
                      {school.type}
                    </Badge>
                    {(form.gesSchoolCode.trim() || school.gesSchoolCode) ? (
                      <Badge
                        variant="outline"
                        className="border-white/10 bg-white/5 text-[10px] text-white/70"
                      >
                        GES {form.gesSchoolCode.trim() || school.gesSchoolCode}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <ImageUploader
                schoolId={school.id}
                subjectRole="schools"
                label="Upload school logo"
                onUploaded={({ url }) =>
                  setForm((current) =>
                    current ? { ...current, logo: url } : current
                  )
                }
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setForm((current) =>
                    current ? { ...current, logo: null } : current
                  )
                }
                className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
              >
                Use Placeholder
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="gap-2 bg-gradient-to-r from-cyan-500 to-sky-600 text-white hover:from-cyan-600 hover:to-sky-700"
              >
                {updateSchool.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    Save Identity
                  </>
                )}
              </Button>
            </div>

            <p className="mt-3 text-xs leading-5 text-white/45">
              Identity changes save separately from the timetable and attendance
              settings below.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

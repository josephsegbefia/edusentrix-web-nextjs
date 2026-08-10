"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns/format";
import { parse as parseDateFns } from "date-fns/parse";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  MapPin,
  Plus,
  School,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GhanaPhoneInput } from "@/components/ui/ghana-phone-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { GHANA_REGIONS, type GhanaRegion } from "@/constants/ghanaRegions";
import {
  CURRICULUM_OPTIONS,
  getCurriculumProfile,
  type CurriculumCode,
} from "@/constants/curriculum-profiles";
import { EDUSENTRIX_LOGO_ALT, EDUSENTRIX_LOGO_PATH } from "@/lib/branding";
import {
  createManualLaunchPeriod,
  normalizeAcademicPeriodsInOrder,
  reconcileLaunchPeriodYearLabels,
  type LaunchPeriodDraft,
} from "@/lib/academic-periods/launch-period-defaults";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Bootstrap = {
  user: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    dateOfBirth: string | null;
    address: string;
    avatarUrl: string;
    pendingOnboarding: boolean;
  };
  school: {
    id: string;
    name: string;
    type: "Basic" | "Secondary";
    curriculumCode?: CurriculumCode;
    address: string;
    city: string;
    region: string;
    status: "pending" | "active";
  } | null;
  assistedByPlatform?: boolean;
  targetUserId?: string;
};

type Period = LaunchPeriodDraft;

const STEPS = [
  {
    id: 1,
    title: "Profile",
    description: "Confirm the admin identity that owns this workspace.",
    icon: UserRound,
  },
  {
    id: 2,
    title: "School",
    description: "Set the school profile, curriculum, and location.",
    icon: School,
  },
  {
    id: 3,
    title: "Academic periods",
    description: "Add the academic periods you want to start with.",
    icon: GraduationCap,
  },
] as const;

const launchInputClass =
  "h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/30 transition-all duration-200 focus:border-brand focus:bg-white/[0.07] focus:ring-2 focus:ring-brand/20 focus:shadow-[0_0_16px_rgba(14,165,233,0.08)]";

const launchTextAreaClass =
  "min-h-[112px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 transition-all duration-200 focus:border-brand focus:bg-white/[0.07] focus:ring-2 focus:ring-brand/20 focus:shadow-[0_0_16px_rgba(14,165,233,0.08)]";

const launchLabelClass =
  "text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42";

type Step = (typeof STEPS)[number]["id"];

export type LaunchWizardProps = {
  variant: "school" | "platform";
  platformSchoolId?: string;
};

function parseDateValue(value: string): Date | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const d = parseDateFns(trimmed, "yyyy-MM-dd", new Date());
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(12, 0, 0, 0);
  return d;
}

function SurfaceSection({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5 shadow-lg shadow-black/20 backdrop-blur-sm sm:p-6",
        className
      )}
    >
      <div className="mb-5 flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-brand">
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
            {eyebrow}
          </p>
          <h3 className="text-lg font-semibold tracking-tight text-white">
            {title}
          </h3>
          <p className="max-w-2xl text-sm leading-6 text-white/52">
            {description}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function LaunchWizard({ variant, platformSchoolId }: LaunchWizardProps) {
  const apiBase = useMemo(() => {
    if (variant === "platform") {
      return `/api/platform/schools/${platformSchoolId}/onboarding`;
    }
    return "/api/onboarding";
  }, [platformSchoolId, variant]);

  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [data, setData] = useState<Bootstrap | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPublicId, setAvatarPublicId] = useState<string | null>(null);

  const [schoolName, setSchoolName] = useState("");
  const [schoolType, setSchoolType] = useState<"Basic" | "Secondary">("Basic");
  const [curriculumCode, setCurriculumCode] =
    useState<CurriculumCode>("ghana_nacca");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");

  const [periods, setPeriods] = useState<Period[]>(() => [
    createManualLaunchPeriod(true),
  ]);
  const [activePeriodIndex, setActivePeriodIndex] = useState(0);

  const curriculumProfile = useMemo(
    () => getCurriculumProfile(curriculumCode),
    [curriculumCode]
  );

  useEffect(() => {
    if (variant === "platform" && !platformSchoolId) {
      setBootstrapError("Missing school identifier.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setBootstrapError(null);
        const res = await fetch(`${apiBase}/bootstrap`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "Bootstrap failed");
        }

        const payload: Bootstrap = await res.json();
        setData(payload);

        setFirstName(payload.user.firstName || "");
        setLastName(payload.user.lastName || "");
        setPhone(payload.user.phone || "");
        setDob(payload.user.dateOfBirth?.substring(0, 10) || "");
        setAddress(payload.user.address || "");
        setAvatarUrl(payload.user.avatarUrl || "");

        if (payload.school) {
          setSchoolName(payload.school.name || "");
          setSchoolType(payload.school.type || "Basic");
          setCurriculumCode(payload.school.curriculumCode || "ghana_nacca");
          setSchoolAddress(payload.school.address || "");
          setCity(payload.school.city || "");
          setRegion(payload.school.region || "");
        }

        setActivePeriodIndex(0);
      } catch (error) {
        setBootstrapError(
          error instanceof Error ? error.message : "Failed to load launch data"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase, platformSchoolId, variant]);

  const canContinueStep1 = useMemo(
    () => firstName.trim().length >= 1 && lastName.trim().length >= 1,
    [firstName, lastName]
  );

  const canContinueStep2 = useMemo(
    () => schoolName.trim().length >= 2,
    [schoolName]
  );

  const canFinish = useMemo(() => periods.length > 0, [periods.length]);

  useEffect(() => {
    setActivePeriodIndex((current) =>
      Math.min(current, Math.max(periods.length - 1, 0))
    );
  }, [periods.length]);

  function setCurrentPeriod(index: number) {
    setPeriods((current) =>
      current.map((period, periodIndex) => ({
        ...period,
        isCurrent: periodIndex === index,
      }))
    );
  }

  function updatePeriod(index: number, patch: Partial<Period>) {
    setPeriods((current) => {
      const mapped = current.map((period, periodIndex) =>
        periodIndex === index ? { ...period, ...patch } : period
      );
      if (patch.isYearEndTerminal !== undefined) {
        return reconcileLaunchPeriodYearLabels(mapped);
      }
      return mapped;
    });
  }

  function addPeriod() {
    setPeriods((current) => {
      const next = [...current, createManualLaunchPeriod(false)];
      setActivePeriodIndex(next.length - 1);
      return next;
    });
  }

  function removePeriod(index: number) {
    if (periods.length <= 1) {
      toast.error("Keep at least one academic period.");
      return;
    }

    setPeriods((current) => {
      const next = current.filter((_, periodIndex) => periodIndex !== index);
      if (!next.some((period) => period.isCurrent)) {
        const fallbackIndex = Math.min(index, next.length - 1);
        next[fallbackIndex] = { ...next[fallbackIndex], isCurrent: true };
      }
      return next;
    });

    setActivePeriodIndex((current) =>
      Math.min(current, Math.max(periods.length - 2, 0))
    );
  }

  async function persistSchoolProfile() {
    if (!data?.school) {
      throw new Error("No school bound to your account");
    }

    const schoolPayload =
      variant === "platform"
        ? {
            name: schoolName.trim(),
            type: schoolType,
            curriculumCode,
            address: schoolAddress.trim() || undefined,
            city: city.trim() || undefined,
            region: region.trim() || undefined,
          }
        : {
            schoolId: data.school.id,
            name: schoolName.trim(),
            type: schoolType,
            curriculumCode,
            address: schoolAddress.trim() || undefined,
            city: city.trim() || undefined,
            region: region.trim() || undefined,
          };

    const res = await fetch(
      variant === "platform" ? `${apiBase}/school` : "/api/onboarding/school",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schoolPayload),
      }
    );

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      throw new Error(error?.error || "Failed to save school profile");
    }
  }

  async function saveStep1() {
    setSaving(true);
    let shouldKeepBusy = false;
    try {
      const saved = await persistProfileStep();
      if (saved) {
        toast.success("Profile saved");
        setCurrentStep(2);
      }
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function persistProfileStep(overrides?: {
    avatarUrl?: string;
    avatarPublicId?: string | null;
  }) {
    const profileFirstName = firstName.trim() || data?.user.firstName?.trim() || "";
    const profileLastName = lastName.trim() || data?.user.lastName?.trim() || "";

    if (!profileFirstName || !profileLastName) {
      toast.error("Enter your first and last name before saving your profile photo.");
      return false;
    }

    const nextAvatarUrl = (overrides?.avatarUrl ?? avatarUrl).trim();
    const nextAvatarPublicId = overrides?.avatarPublicId ?? avatarPublicId;

    const res = await fetch(
      variant === "platform" ? `${apiBase}/profile` : "/api/onboarding/profile",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: profileFirstName,
          lastName: profileLastName,
          phone: phone.trim() || undefined,
          dateOfBirth: dob ? new Date(dob).toISOString() : undefined,
          address: address.trim() || undefined,
          avatarUrl: nextAvatarUrl || undefined,
          avatarPublicId: nextAvatarPublicId || undefined,
        }),
      }
    );

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      toast.error(error?.error || "Failed to save profile");
      return false;
    }

    setData((current) =>
      current
        ? {
            ...current,
            user: {
              ...current.user,
              firstName: profileFirstName,
              lastName: profileLastName,
              avatarUrl: nextAvatarUrl,
            },
          }
        : current
    );

    return true;
  }

  async function handleAvatarUploaded(url: string, publicId: string) {
    setAvatarUrl(url);
    setAvatarPublicId(publicId || null);
    setData((current) =>
      current
        ? {
            ...current,
            user: {
              ...current.user,
              avatarUrl: url,
            },
          }
        : current
    );

    const saved = await persistProfileStep({
      avatarUrl: url,
      avatarPublicId: publicId || null,
    });

    if (!saved) {
      toast.message("Photo uploaded", {
        description: "Continue to save your profile when your name fields are ready.",
      });
    }
  }

  async function saveStep2() {
    setSaving(true);
    try {
      await persistSchoolProfile();

      toast.success("School profile saved");
      setCurrentStep(3);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save school profile"
      );
    } finally {
      setSaving(false);
    }
  }

  async function finishOnboarding() {
    if (!data?.school) {
      toast.error("No school bound");
      return;
    }

    if (periods.length === 0) {
      toast.error("Please define at least one academic period");
      return;
    }

    const periodsToSubmit = normalizeAcademicPeriodsInOrder(periods);
    const normalizedChanged =
      JSON.stringify(periodsToSubmit) !== JSON.stringify(periods);
    if (normalizedChanged) {
      setPeriods(periodsToSubmit);
    }

    for (const period of periodsToSubmit) {
      const missing: string[] = [];
      if (!period.yearLabel?.trim()) missing.push("academic year label");
      if (!period.term?.trim()) missing.push("term");
      if (!period.startDate) missing.push("start date");
      if (!period.endDate) missing.push("end date");
      if (missing.length > 0) {
        toast.error(
          `Complete ${period.term || "this period"}: ${missing.join(", ")}`
        );
        return;
      }
      if (period.endDate <= period.startDate) {
        toast.error(
          `End date must be after start date for ${period.yearLabel} - ${period.term}`
        );
        return;
      }
    }

    if (normalizedChanged) {
      toast.info(
        "Adjusted term dates so periods do not overlap. Review the timeline before completing."
      );
    }

    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periods: periodsToSubmit.map((period) => ({
            yearLabel: period.yearLabel,
            term: period.term,
            startDate: period.startDate,
            endDate: period.endDate,
            isCurrent: period.isCurrent,
            isYearEndTerminal: period.isYearEndTerminal ?? false,
          })),
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        toast.error(`Failed to finalize: ${error?.error ?? res.statusText}`);
        return;
      }

      toast.success("School launch completed");
      shouldKeepBusy = true;
      setRedirecting(true);
      setTimeout(() => {
        window.location.href =
          variant === "platform" && platformSchoolId
            ? `/platform/schools/${platformSchoolId}`
            : "/admin";
      }, 1200);
    } catch {
      toast.error("Failed to finalize school launch");
      setRedirecting(false);
    } finally {
      if (!shouldKeepBusy) {
        setSaving(false);
      }
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-dvh overflow-hidden bg-bg text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 68% 44% at 16% 14%, rgba(14,165,233,0.16) 0%, transparent 60%), radial-gradient(ellipse 48% 34% at 82% 18%, rgba(109,40,217,0.14) 0%, transparent 58%)",
          }}
        />
        <div className="relative flex min-h-dvh items-center justify-center px-4">
          <div className="rounded-[2rem] border border-white/10 bg-card/70 px-10 py-12 shadow-2xl shadow-black/40 backdrop-blur-2xl">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <p className="text-sm text-white/55">Loading launch wizard…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="min-h-screen bg-bg text-white">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="max-w-lg rounded-[2rem] border border-white/10 bg-card/75 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-xl">
            <h2 className="text-xl font-semibold">Could not load launch wizard</h2>
            <p className="mt-3 text-sm leading-6 text-white/55">{bootstrapError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.school) {
    return (
      <div className="min-h-screen bg-bg text-white">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="max-w-lg rounded-[2rem] border border-white/10 bg-card/75 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-xl">
            <h2 className="text-2xl font-semibold">
              {variant === "platform" ? "School not available" : "No school invite found"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/55">
              {variant === "platform"
                ? "This school could not be loaded for assisted onboarding."
                : "We could not find a school workspace linked to your account. Sign in with the email address used on your enrolment application, or contact support if you already received an invite."}
            </p>
            {data?.user?.email ? (
              <p className="mt-4 text-xs uppercase tracking-[0.18em] text-white/35">
                Signed in as {data.user.email}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const stepMeta = STEPS.find((step) => step.id === currentStep);
  const progressPercent = Math.round((currentStep / STEPS.length) * 100);
  const StepIcon = stepMeta?.icon ?? Sparkles;
  const profileDisplayName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    [data.user.firstName, data.user.lastName].filter(Boolean).join(" ") ||
    data.user.email;
  const profileInitial = profileDisplayName.charAt(0).toUpperCase();
  const activePeriod = periods[activePeriodIndex] ?? periods[0];

  return (
    <div className="min-h-dvh bg-bg px-4 py-8 text-white antialiased sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl items-center justify-center">
        <Card className="w-full border border-white/10 bg-linear-to-br from-card/92 via-card/88 to-card/84 shadow-2xl shadow-black/35 backdrop-blur-2xl">
          <CardContent className="p-6 sm:p-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-lg shadow-black/20 ring-1 ring-white/5">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-cyan-400/12"
                    />
                    <Image
                      src={EDUSENTRIX_LOGO_PATH}
                      alt={EDUSENTRIX_LOGO_ALT}
                      fill
                      sizes="48px"
                      className="object-contain px-1.5 py-1"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tracking-tight text-white">
                      {variant === "platform"
                        ? "Assisted School Launch"
                        : "School Launch Wizard"}
                    </p>
                    <p className="text-xs text-white/42">{data.school.name}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/48">
                    <Sparkles className="h-3.5 w-3.5 text-brand" />
                    Step {currentStep} of {STEPS.length}
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
                      Finish your workspace setup
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Keep this simple. Confirm the admin profile, set the
                      school basics, then review the academic periods.
                      Payment setup happens later in Settings.
                    </p>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-brand">
                      <StepIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
                          Current step
                        </p>
                        <h2 className="mt-1 text-lg font-semibold text-white">
                          {stepMeta?.title}
                        </h2>
                      </div>
                      <p className="text-sm leading-6 text-white/55">
                        {stepMeta?.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                      <span>Progress</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/8">
                      <div
                        className="h-2 rounded-full bg-linear-to-r from-brand to-sky-300 transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/58">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 border border-white/10">
                      {avatarUrl ? (
                        <AvatarImage
                          src={avatarUrl}
                          alt={profileDisplayName}
                        />
                      ) : null}
                      <AvatarFallback className="bg-white/10 text-sm font-semibold text-white/80">
                        {profileInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-white/82">{profileDisplayName}</p>
                      <p className="mt-1 text-white/55">{data.user.email}</p>
                      <p className="mt-2">
                        School status{" "}
                        <span className="font-medium text-white/82">
                          {data.school.status}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <AnimatePresence mode="wait">
                    {currentStep === 1 && (
                      <motion.div
                        key="profile-step"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        className="space-y-6"
                      >
                        <SurfaceSection
                          icon={UserRound}
                          eyebrow="Avatar"
                          title="Profile photo"
                          description="Use a clear admin photo so staff and platform operators can recognize the account quickly."
                        >
                          {data.school ? (
                            <ImageUploader
                              schoolId={data.school.id}
                              subjectRole="school_admins"
                              maxSizeMB={5}
                              initialPreviewUrl={avatarUrl}
                              onUploaded={({ url, publicId }) => {
                                void handleAvatarUploaded(url, publicId);
                              }}
                            />
                          ) : (
                            <div className="grid h-36 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-white/35">
                              Photo upload unavailable
                            </div>
                          )}
                        </SurfaceSection>

                        <SurfaceSection
                          icon={UserRound}
                          eyebrow="Identity"
                          title="Admin profile"
                          description="Names may already be prefilled from the invite or application. Edit them here before entering the workspace."
                        >
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="firstName" className={launchLabelClass}>
                                First name
                              </Label>
                              <Input
                                id="firstName"
                                value={firstName}
                                onChange={(event) => setFirstName(event.target.value)}
                                placeholder="First name"
                                className={launchInputClass}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="lastName" className={launchLabelClass}>
                                Last name
                              </Label>
                              <Input
                                id="lastName"
                                value={lastName}
                                onChange={(event) => setLastName(event.target.value)}
                                placeholder="Last name"
                                className={launchInputClass}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="phone" className={launchLabelClass}>
                                Phone number
                              </Label>
                              <GhanaPhoneInput
                                id="phone"
                                value={phone}
                                onChange={(event) => setPhone(event.target.value)}
                                className={launchInputClass}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className={launchLabelClass}>Date of birth</Label>
                              <CustomDatePicker
                                value={parseDateValue(dob)}
                                onChange={(date) =>
                                  setDob(date ? format(date, "yyyy-MM-dd") : "")
                                }
                                placeholder="Select date"
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="address" className={launchLabelClass}>
                                Address
                              </Label>
                              <Textarea
                                id="address"
                                value={address}
                                onChange={(event) => setAddress(event.target.value)}
                                placeholder="Enter your address"
                                className={launchTextAreaClass}
                              />
                            </div>
                          </div>
                        </SurfaceSection>

                        <div className="space-y-3 border-t border-white/8 pt-6">
                          <Button
                            onClick={saveStep1}
                            disabled={!canContinueStep1 || saving}
                            size="lg"
                            className="w-full rounded-2xl bg-brand text-black shadow-lg shadow-brand/20 hover:bg-sky-300"
                          >
                            {saving ? "Saving..." : "Continue"}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {currentStep === 2 && (
                      <motion.div
                        key="school-step"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        className="space-y-6"
                      >
                        <SurfaceSection
                          icon={Building2}
                          eyebrow="School profile"
                          title="Identity and curriculum"
                          description="These settings determine the school’s default academic structure."
                        >
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="schoolName" className={launchLabelClass}>
                                School name
                              </Label>
                              <Input
                                id="schoolName"
                                value={schoolName}
                                onChange={(event) => setSchoolName(event.target.value)}
                                placeholder="Enter your school name"
                                className={launchInputClass}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className={launchLabelClass}>School type</Label>
                              <PremiumSelect
                                value={schoolType}
                                onValueChange={(value: "Basic" | "Secondary") =>
                                  setSchoolType(value)
                                }
                              >
                                <PremiumSelectTrigger
                                  icon={<Building2 className="h-4 w-4" />}
                                  className="border-white/10 bg-white/5"
                                >
                                  <PremiumSelectValue placeholder="Select school type" />
                                </PremiumSelectTrigger>
                                <PremiumSelectContent className="z-[300]">
                                  <PremiumSelectItem value="Basic">
                                    Basic School
                                  </PremiumSelectItem>
                                  <PremiumSelectItem value="Secondary">
                                    Secondary School
                                  </PremiumSelectItem>
                                </PremiumSelectContent>
                              </PremiumSelect>
                            </div>

                            <div className="space-y-2">
                              <Label className={launchLabelClass}>Curriculum</Label>
                              <PremiumSelect
                                value={curriculumCode}
                                onValueChange={(value) =>
                                  setCurriculumCode(value as CurriculumCode)
                                }
                              >
                                <PremiumSelectTrigger
                                  icon={<BookOpen className="h-4 w-4" />}
                                  className="border-white/10 bg-white/5"
                                >
                                  <PremiumSelectValue placeholder="Select curriculum" />
                                </PremiumSelectTrigger>
                                <PremiumSelectContent className="z-[300] max-h-72 overflow-y-auto">
                                  {CURRICULUM_OPTIONS.map((option) => (
                                    <PremiumSelectItem
                                      key={option.code}
                                      value={option.code}
                                      description={option.description}
                                    >
                                      {option.label}
                                    </PremiumSelectItem>
                                  ))}
                                </PremiumSelectContent>
                              </PremiumSelect>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/62">
                              <p className="font-semibold text-white">
                                {curriculumProfile.label}
                              </p>
                              <p className="mt-1">{curriculumProfile.description}</p>
                            </div>
                          </div>
                        </SurfaceSection>

                        <SurfaceSection
                          icon={MapPin}
                          eyebrow="Location"
                          title="School address"
                          description="This appears across reports, notices, and billing records."
                        >
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="schoolAddress" className={launchLabelClass}>
                                Address
                              </Label>
                              <Input
                                id="schoolAddress"
                                value={schoolAddress}
                                onChange={(event) => setSchoolAddress(event.target.value)}
                                placeholder="School address"
                                className={launchInputClass}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="city" className={launchLabelClass}>
                                City
                              </Label>
                              <Input
                                id="city"
                                value={city}
                                onChange={(event) => setCity(event.target.value)}
                                placeholder="City"
                                className={launchInputClass}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className={launchLabelClass}>Region</Label>
                              <PremiumSelect
                                value={
                                  GHANA_REGIONS.includes(region as GhanaRegion)
                                    ? region
                                    : ""
                                }
                                onValueChange={(value) => setRegion(value)}
                              >
                                <PremiumSelectTrigger
                                  icon={<MapPin className="h-4 w-4" />}
                                  className="border-white/10 bg-white/5"
                                >
                                  <PremiumSelectValue placeholder="Select region" />
                                </PremiumSelectTrigger>
                                <PremiumSelectContent className="z-[300] max-h-72 overflow-y-auto">
                                  {GHANA_REGIONS.map((regionOption) => (
                                    <PremiumSelectItem
                                      key={regionOption}
                                      value={regionOption}
                                    >
                                      {regionOption}
                                    </PremiumSelectItem>
                                  ))}
                                </PremiumSelectContent>
                              </PremiumSelect>
                            </div>
                          </div>
                        </SurfaceSection>

                        <div className="space-y-3 border-t border-white/8 pt-6">
                          <Button
                            variant="outline"
                            onClick={() => setCurrentStep(1)}
                            size="lg"
                            className="w-full rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                          >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                          </Button>
                          <Button
                            onClick={saveStep2}
                            disabled={!canContinueStep2 || saving}
                            size="lg"
                            className="w-full rounded-2xl bg-brand text-black shadow-lg shadow-brand/20 hover:bg-sky-300"
                          >
                            {saving ? "Saving..." : "Continue"}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {currentStep === 3 && (
                      <motion.div
                        key="curriculum-step"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        className="space-y-6"
                      >
                        <SurfaceSection
                          icon={CalendarDays}
                          eyebrow="Academic periods"
                          title="Academic periods"
                          description="Add each period you want to start with, set its dates, and choose which one is current. Only the periods you define here are saved when you finish."
                        >
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white/58">
                              <p>
                                Define each period yourself. Nothing is pre-filled from
                                the curriculum — only what you add here is saved.
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addPeriod}
                                className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Add period
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {periods.map((period, index) => {
                                const isActive = index === activePeriodIndex;
                                return (
                                  <button
                                    key={`${period.term}-${index}`}
                                    type="button"
                                    onClick={() => setActivePeriodIndex(index)}
                                    className={cn(
                                      "min-w-[140px] rounded-[1.25rem] border px-4 py-3 text-left transition-all",
                                      isActive
                                        ? "border-brand/35 bg-brand/10 shadow-lg shadow-brand/10"
                                        : "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.06]"
                                    )}
                                  >
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/38">
                                      Period {index + 1}
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-white">
                                      {period.term.trim() || "Untitled period"}
                                    </p>
                                    <p className="mt-1 text-xs text-white/48">
                                      {period.isCurrent
                                        ? "Current period"
                                        : period.isYearEndTerminal
                                          ? "Year-end period"
                                          : "Open step"}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>

                            {activePeriod ? (
                              <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5 shadow-lg shadow-black/20">
                                <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-white/8 pb-4">
                                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
                                    Period {activePeriodIndex + 1} of {periods.length}
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/78">
                                    {activePeriod.term.trim() || "Untitled period"}
                                  </span>
                                  {activePeriod.isCurrent ? (
                                    <span className="rounded-full border border-brand/20 bg-brand/12 px-3 py-1 text-sm font-medium text-white">
                                      Current
                                    </span>
                                  ) : null}
                                  {activePeriod.isYearEndTerminal ? (
                                    <span className="rounded-full border border-amber-400/20 bg-amber-500/12 px-3 py-1 text-sm font-medium text-amber-100">
                                      Year-end
                                    </span>
                                  ) : null}
                                </div>

                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label className={launchLabelClass}>Academic year label</Label>
                                    <Input
                                      value={activePeriod.yearLabel}
                                      onChange={(event) =>
                                        updatePeriod(activePeriodIndex, {
                                          yearLabel: event.target.value,
                                        })
                                      }
                                      placeholder="e.g. 2026/2027"
                                      className={launchInputClass}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label className={launchLabelClass}>Term name</Label>
                                    <Input
                                      value={activePeriod.term}
                                      onChange={(event) =>
                                        updatePeriod(activePeriodIndex, {
                                          term: event.target.value,
                                        })
                                      }
                                      placeholder="e.g. Term 3"
                                      className={launchInputClass}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label className={launchLabelClass}>Start date</Label>
                                    <CustomDatePicker
                                      value={parseDateValue(activePeriod.startDate)}
                                      onChange={(date) =>
                                        updatePeriod(activePeriodIndex, {
                                          startDate: date
                                            ? format(date, "yyyy-MM-dd")
                                            : "",
                                        })
                                      }
                                      placeholder="Select start date"
                                      className="w-full"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label className={launchLabelClass}>End date</Label>
                                    <CustomDatePicker
                                      value={parseDateValue(activePeriod.endDate)}
                                      onChange={(date) =>
                                        updatePeriod(activePeriodIndex, {
                                          endDate: date
                                            ? format(date, "yyyy-MM-dd")
                                            : "",
                                        })
                                      }
                                      placeholder="Select end date"
                                      className="w-full"
                                    />
                                  </div>

                                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="space-y-1">
                                        <Label className={launchLabelClass}>
                                          Year-end period
                                        </Label>
                                        <p className="text-sm leading-6 text-white/55">
                                          Mark this when the period closes the academic year.
                                          Promotions and billing use this flag.
                                        </p>
                                      </div>
                                      <Switch
                                        checked={Boolean(activePeriod.isYearEndTerminal)}
                                        onCheckedChange={(checked) =>
                                          updatePeriod(activePeriodIndex, {
                                            isYearEndTerminal: checked,
                                          })
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-3 sm:flex-row">
                                    <Button
                                      type="button"
                                      variant={activePeriod.isCurrent ? "default" : "outline"}
                                      onClick={() => setCurrentPeriod(activePeriodIndex)}
                                      className={
                                        activePeriod.isCurrent
                                          ? "flex-1 rounded-2xl bg-brand text-black hover:bg-sky-300"
                                          : "flex-1 rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                                      }
                                    >
                                      {activePeriod.isCurrent
                                        ? "Current period"
                                        : "Set as current period"}
                                    </Button>
                                    {periods.length > 1 ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => removePeriod(activePeriodIndex)}
                                        className="rounded-2xl border-rose-500/20 bg-rose-500/5 text-rose-200 hover:bg-rose-500/10 hover:text-rose-100"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Remove
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </SurfaceSection>

                        <div className="space-y-3 border-t border-white/8 pt-6">
                          <Button
                            variant="outline"
                            onClick={() => setCurrentStep(2)}
                            size="lg"
                            className="w-full rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                          >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                          </Button>
                          <Button
                            onClick={finishOnboarding}
                            disabled={!canFinish || saving || redirecting}
                            size="lg"
                            className="w-full rounded-2xl bg-brand text-black shadow-lg shadow-brand/20 hover:bg-sky-300"
                          >
                            {redirecting
                              ? "Opening workspace..."
                              : saving
                                ? "Finishing..."
                                : "Complete school launch"}
                            <CheckCircle2 className="ml-2 h-4 w-4" />
                          </Button>
                          <p className="text-center text-sm text-white/40">
                            Need to stop now? Your progress on each step is saved
                            when you continue.
                          </p>
                        </div>
                      </motion.div>
                    )}
              </AnimatePresence>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

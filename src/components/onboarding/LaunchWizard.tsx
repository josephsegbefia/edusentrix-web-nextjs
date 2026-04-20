"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BankBranchCombo } from "@/components/banks/BankBranchCombo";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { format } from "date-fns/format";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Mail,
  ShieldCheck,
  Award,
  BookOpen,
  Building2,
  Globe,
  GraduationCap,
  MapPin,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { GHANA_REGIONS, type GhanaRegion } from "@/constants/ghanaRegions";
import { EDUSENTRIX_LOGO_ALT, EDUSENTRIX_LOGO_PATH } from "@/lib/branding";
import { toast } from "sonner";
import { ImageUploader } from "@/components/upload/ImageUploader";
import {
  CURRICULUM_OPTIONS,
  getCurriculumProfile,
  type CurriculumCode,
} from "@/constants/curriculum-profiles";
import { getSubjectNamesForCurriculum } from "@/constants/curriculum-subject-templates";

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
    bank?: {
      bankName?: string;
      branchName?: string;
      sortCode?: string;
      accountName?: string;
      accountNumber?: string;
    };
    paymentSetup?: {
      status?:
        | "not_started"
        | "awaiting_billing_owner"
        | "details_submitted"
        | "pending_provisioning"
        | "review_required"
        | "provisioned"
        | "failed";
      ownerName?: string;
      ownerEmail?: string;
    };
    status: "pending" | "active";
  } | null;
  subjectSuggestions: string[];
  assistedByPlatform?: boolean;
  targetUserId?: string;
};

type Period = {
  yearLabel: string;
  term: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
};

const STEPS = [
  { id: 1, title: "Profile", description: "Your information" },
  { id: 2, title: "School Details", description: "School information" },
  { id: 3, title: "Payment Setup", description: "Billing authority" },
  { id: 4, title: "Curriculum", description: "Subjects & periods" },
] as const;

const launchInputClass =
  "h-11 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/25 transition-all duration-200 focus:border-brand focus:bg-white/[0.07] focus:ring-2 focus:ring-brand/20 focus:shadow-[0_0_16px_rgba(14,165,233,0.08)]";

const launchLabelClass =
  "text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40";

function LaunchSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-px flex-1 bg-white/6" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
        {children}
      </span>
      <span className="h-px flex-1 bg-white/6" />
    </div>
  );
}

function LaunchFeaturePill({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/3 px-3 py-1.5 text-xs font-medium text-white/55 backdrop-blur-sm">
      <Icon className="h-3.5 w-3.5 text-brand" />
      {label}
    </div>
  );
}

function FloatingOrbLaunch({
  className,
  delay = "0s",
}: {
  className: string;
  delay?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      style={{
        animation: "float 8s ease-in-out infinite",
        animationDelay: delay,
      }}
    />
  );
}

function LaunchMarketingAside({
  variant,
  userEmail,
}: {
  variant: "school" | "platform";
  userEmail: string;
}) {
  return (
    <div className="relative flex flex-col justify-between gap-10">
      <div className="flex items-center gap-3">
        <Image
          src={EDUSENTRIX_LOGO_PATH}
          alt={EDUSENTRIX_LOGO_ALT}
          width={40}
          height={40}
          className="rounded-xl"
        />
        <span className="text-lg font-semibold tracking-tight text-white">
          EduSentrix
        </span>
      </div>

      <div className="space-y-5">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Guided school launch
        </div>

        <h1 className="max-w-md text-[2.25rem] font-bold leading-[1.1] tracking-tight sm:text-4xl">
          <span className="bg-linear-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
            Finish setting up{" "}
          </span>
          <span className="bg-linear-to-r from-violet-400 to-brand bg-clip-text text-transparent">
            your workspace
          </span>
        </h1>

        <p className="max-w-md text-base leading-7 text-white/50">
          {variant === "platform" ? (
            <>
              You&apos;re completing launch for the school admin account{" "}
              <span className="font-medium text-white/80">{userEmail}</span>.
            </>
          ) : (
            <>
              Same polished experience as our public enrol form — profile,
              school details, payouts, then curriculum.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <LaunchFeaturePill icon={TrendingUp} label="Fee-ready" />
        <LaunchFeaturePill icon={GraduationCap} label="Academics" />
        <LaunchFeaturePill icon={MessageSquare} label="Comms" />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 font-medium text-white/70 transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          Sign in instead
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-1 py-2.5 font-medium text-white/40 transition-all duration-200 hover:text-white"
        >
          Back to website
        </Link>
      </div>
    </div>
  );
}

type Step = (typeof STEPS)[number]["id"];
type PaymentAuthorityMode = "self" | "owner_invite";

export type LaunchWizardProps = {
  variant: "school" | "platform";
  /** Required when variant is platform — Mongo school id */
  platformSchoolId?: string;
};

export function LaunchWizard({ variant, platformSchoolId }: LaunchWizardProps) {
  const apiBase = useMemo(() => {
    if (variant === "platform") {
      return `/api/platform/schools/${platformSchoolId}/onboarding`;
    }
    return "/api/onboarding";
  }, [variant, platformSchoolId]);

  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [bankPick, setBankPick] = useState<{
    bankName: string;
    branchName: string;
    sortCode: string;
  } | null>(null);

  // Step 1: admin profile state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState<string>("");
  const [address, setAddress] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPublicId, setAvatarPublicId] = useState<string | null>(null);

  // Step 2: school + curriculum
  const [schoolName, setSchoolName] = useState("");
  const [schoolType, setSchoolType] = useState<"Basic" | "Secondary">("Basic");
  const [curriculumCode, setCurriculumCode] =
    useState<CurriculumCode>("ghana_nacca");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [bankName, setBankName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [paymentAuthorityMode, setPaymentAuthorityMode] =
    useState<PaymentAuthorityMode>("self");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerInviteLocked, setOwnerInviteLocked] = useState(false);

  const [subjectPool, setSubjectPool] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");

  const [periods, setPeriods] = useState<Period[]>([
    {
      yearLabel: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
      term: "Term 1",
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(
        new Date(new Date().setMonth(new Date().getMonth() + 3)),
        "yyyy-MM-dd"
      ),
      isCurrent: true,
    },
  ]);

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

        // hydrate step 1
        setFirstName(payload.user.firstName || "");
        setLastName(payload.user.lastName || "");
        setPhone(payload.user.phone || "");
        setDob(
          payload.user.dateOfBirth
            ? payload.user.dateOfBirth.substring(0, 10)
            : ""
        );
        setAddress(payload.user.address || "");
        setAvatarUrl(payload.user.avatarUrl || "");

        // hydrate step 2
        if (payload.school) {
          setSchoolName(payload.school.name || "");
          setSchoolType(payload.school.type || "Basic");
          setCurriculumCode(payload.school.curriculumCode || "ghana_nacca");
          setSchoolAddress(payload.school.address || "");
          setCity(payload.school.city || "");
          setRegion(payload.school.region || "");
          setBankName(payload.school.bank?.bankName || "");
          setBranchName(payload.school.bank?.branchName || "");
          setSortCode(payload.school.bank?.sortCode || "");
          setAccountName(payload.school.bank?.accountName || "");
          setAccountNumber(payload.school.bank?.accountNumber || "");
          setOwnerName(payload.school.paymentSetup?.ownerName || "");
          setOwnerEmail(payload.school.paymentSetup?.ownerEmail || "");

          const normalizedUserEmail = payload.user.email.toLowerCase().trim();
          const normalizedOwnerEmail =
            payload.school.paymentSetup?.ownerEmail?.toLowerCase().trim() || "";
          const ownerIsDifferentUser =
            Boolean(normalizedOwnerEmail) &&
            normalizedOwnerEmail !== normalizedUserEmail;

          setPaymentAuthorityMode(ownerIsDifferentUser ? "owner_invite" : "self");
          setOwnerInviteLocked(
            ownerIsDifferentUser &&
              payload.school.paymentSetup?.status === "awaiting_billing_owner"
          );

          setBankPick((prev) => {
            const b = payload.school?.bank;
            if (!b?.bankName || !b?.branchName || !b?.sortCode) return prev;
            return {
              bankName: b.bankName,
              branchName: b.branchName,
              sortCode: b.sortCode,
            };
          });
        }
        setSubjectPool(payload.subjectSuggestions || []);
        setSelectedSubjects(payload.subjectSuggestions.slice(0, 5)); // pick some by default
      } catch (e) {
        setBootstrapError(
          e instanceof Error ? e.message : "Failed to load launch data"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase, variant, platformSchoolId]);

  const addSubject = () => {
    const v = newSubject.trim();
    if (!v) return;
    if (!selectedSubjects.includes(v)) setSelectedSubjects((s) => [...s, v]);
    if (!subjectPool.includes(v)) setSubjectPool((p) => [...p, v]);
    setNewSubject("");
  };

  const removeSubject = (v: string) => {
    setSelectedSubjects((s) => s.filter((x) => x !== v));
  };

  const setCurrentPeriod = (idx: number) => {
    setPeriods((arr) => arr.map((p, i) => ({ ...p, isCurrent: i === idx })));
  };

  const canContinueStep1 = useMemo(
    () => firstName.trim().length >= 1 && lastName.trim().length >= 1,
    [firstName, lastName]
  );
  const canContinueStep2 = useMemo(
    () => schoolName.trim().length >= 2,
    [schoolName]
  );
  const canContinueStep4 = useMemo(
    () => selectedSubjects.length > 0 && periods.length > 0,
    [selectedSubjects.length, periods.length]
  );

  async function persistSchoolProfile(options?: {
    bank?: {
      bankName?: string;
      branchName?: string;
      sortCode?: string;
      accountName?: string;
      accountNumber?: string;
    };
  }) {
    if (!data?.school) {
      throw new Error("No school bound to your account");
    }

    const bankPayload = options?.bank ?? {
      bankName: bankName.trim() || undefined,
      branchName: branchName.trim() || undefined,
      sortCode: sortCode.trim() || undefined,
      accountName: accountName.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
    };

    const schoolPayload =
      variant === "platform"
        ? {
            name: schoolName.trim(),
            type: schoolType,
            curriculumCode,
            address: schoolAddress.trim() || undefined,
            city: city.trim() || undefined,
            region: region.trim() || undefined,
            bank: bankPayload,
          }
        : {
            schoolId: data.school.id,
            name: schoolName.trim(),
            type: schoolType,
            curriculumCode,
            address: schoolAddress.trim() || undefined,
            city: city.trim() || undefined,
            region: region.trim() || undefined,
            bank: bankPayload,
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

    return (await res.json().catch(() => null)) as
      | {
          success?: boolean;
          data?: {
            paymentSetupStatus?: string;
            reviewReason?: string | null;
          };
        }
      | null;
  }

  async function saveStep1() {
    setSaving(true);
    try {
      const res = await fetch(
        variant === "platform"
          ? `${apiBase}/profile`
          : "/api/onboarding/profile",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim() || undefined,
            dateOfBirth: dob ? new Date(dob).toISOString() : undefined,
            address: address.trim() || undefined,
            avatarUrl: avatarUrl.trim() || undefined,
            avatarPublicId: avatarPublicId || undefined,
          }),
        }
      );
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        toast.error(error?.error || "Failed to save profile");
        return;
      }
      toast.success("Profile saved");
      setCurrentStep(2);
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function saveStep2() {
    setSaving(true);
    try {
      await persistSchoolProfile();

      const newSubjects = getSubjectNamesForCurriculum(
        curriculumCode,
        schoolType === "Secondary" ? "SHS" : undefined
      );
      setSubjectPool(newSubjects);
      setSelectedSubjects(newSubjects);

      const profile = getCurriculumProfile(curriculumCode);
      const defaultTerm = profile.termLabels[0] || "Term 1";
      setPeriods([
        {
          yearLabel: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
          term: defaultTerm,
          startDate: format(new Date(), "yyyy-MM-dd"),
          endDate: format(
            new Date(new Date().setMonth(new Date().getMonth() + 3)),
            "yyyy-MM-dd"
          ),
          isCurrent: true,
        },
      ]);

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

  async function saveStep3() {
    setSaving(true);
    try {
      if (paymentAuthorityMode === "owner_invite") {
        if (ownerInviteLocked) {
          toast.success("Billing owner invitation already in progress");
          setCurrentStep(4);
          return;
        }

        if (ownerName.trim().length < 2) {
          toast.error("Please enter the billing owner's name");
          return;
        }

        if (!/\S+@\S+\.\S+/.test(ownerEmail.trim())) {
          toast.error("Please enter a valid billing owner email");
          return;
        }

        await persistSchoolProfile({
          bank: {
            bankName: undefined,
            branchName: undefined,
            sortCode: undefined,
            accountName: undefined,
            accountNumber: undefined,
          },
        });

        const inviteRes = await fetch(
          variant === "platform"
            ? `${apiBase}/owner-invite`
            : "/api/admin/settings/payment-setup/owner-invite",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ownerName: ownerName.trim(),
              ownerEmail: ownerEmail.trim(),
            }),
          }
        );

        const invitePayload = await inviteRes.json().catch(() => null);
        if (!inviteRes.ok || !invitePayload?.success) {
          toast.error(
            invitePayload?.error || "Failed to invite the billing owner"
          );
          return;
        }

        setOwnerInviteLocked(true);
        toast.success("Billing owner invitation sent");
        setCurrentStep(4);
        return;
      }

      const result = await persistSchoolProfile();
      toast.success("Bank details saved");
      if (result?.data?.paymentSetupStatus === "review_required") {
        toast.warning(
          result.data.reviewReason ||
            "These payout details need manual review before online payments can be activated."
        );
      }
      setCurrentStep(4);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save bank details"
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
    if (selectedSubjects.length === 0) {
      toast.error("Please select at least one subject");
      return;
    }
    if (periods.length === 0) {
      toast.error("Please define at least one academic period");
      return;
    }

    // basic validation
    for (const p of periods) {
      if (!p.yearLabel || !p.term || !p.startDate || !p.endDate) {
        toast.error("Please complete all academic period fields");
        return;
      }
      if (new Date(p.endDate) <= new Date(p.startDate)) {
        toast.error(
          `End date must be after start date for ${p.yearLabel} - ${p.term}`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjects: selectedSubjects,
          periods: periods.map((p) => ({
            yearLabel: p.yearLabel,
            term: p.term,
            startDate: p.startDate,
            endDate: p.endDate,
            isCurrent: p.isCurrent,
          })),
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => null);
        toast.error(`Failed to finalize: ${e?.error ?? res.statusText}`);
        return;
      }
      toast.success("Onboarding completed!");
      setTimeout(() => {
        window.location.href =
          variant === "platform" && platformSchoolId
            ? `/platform/schools/${platformSchoolId}`
            : "/admin";
      }, 1500);
    } catch {
      toast.error("Failed to finalize school launch");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-dvh bg-bg text-white antialiased">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139,92,246,0.15) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 80% 60%, rgba(14,165,233,0.1) 0%, transparent 50%)",
          }}
        />
        <FloatingOrbLaunch
          className="left-[20%] top-[20%] h-64 w-64 bg-emerald-500/10"
          delay="0s"
        />
        <div className="relative flex min-h-dvh items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-card/60 px-10 py-12 backdrop-blur-xl"
          >
            <div className="size-12 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            <p className="text-sm text-white/55">Loading launch data…</p>
          </motion.div>
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center px-6">
        <div className="text-center max-w-lg space-y-3">
          <h2 className="text-xl font-semibold">Could not load launch wizard</h2>
          <p className="text-muted">{bootstrapError}</p>
        </div>
      </div>
    );
  }

  if (!data?.school) {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md px-6"
        >
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-semibold mb-2">
            {variant === "platform"
              ? "School not available"
              : "No School Invite Found"}
          </h2>
          <p className="text-muted">
            {variant === "platform"
              ? "This school could not be loaded for assisted onboarding."
              : "Please ensure you have a valid school invitation linked to your account."}
          </p>
        </motion.div>
      </div>
    );
  }

  const stepMeta = STEPS.find((s) => s.id === currentStep);

  return (
    <div className="relative min-h-dvh bg-bg text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139,92,246,0.2) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 80% 60%, rgba(14,165,233,0.12) 0%, transparent 50%), radial-gradient(ellipse 50% 30% at 20% 80%, rgba(109,40,217,0.12) 0%, transparent 50%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <FloatingOrbLaunch
        className="left-[8%] top-[12%] h-72 w-72 bg-violet-500/15"
        delay="0s"
      />
      <FloatingOrbLaunch
        className="-right-20 top-[45%] h-80 w-80 bg-brand/10"
        delay="2s"
      />
      <FloatingOrbLaunch
        className="bottom-[8%] left-[25%] h-56 w-56 bg-primary/10"
        delay="4s"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-brand/30 to-transparent"
      />

      <div className="relative mx-auto grid min-h-dvh max-w-7xl items-start gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16 lg:px-8 lg:py-16">
        <div className="hidden lg:block">
          <LaunchMarketingAside
            variant={variant}
            userEmail={data.user.email}
          />
        </div>

        <div className="relative mx-auto w-full max-w-xl space-y-8 lg:mx-0 lg:max-w-none">
          {/* Numbered steps */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-between"
          >
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <motion.button
                  onClick={() => {
                    // Allow going back to completed steps
                    if (step.id < currentStep) {
                      setCurrentStep(step.id);
                    }
                  }}
                  whileHover={step.id < currentStep ? { scale: 1.1 } : {}}
                  whileTap={{ scale: 0.95 }}
                  className={`relative flex items-center justify-center size-14 rounded-full border-2 transition-all shadow-lg ${
                    step.id < currentStep
                      ? "bg-brand border-brand text-black cursor-pointer hover:shadow-brand/50"
                      : step.id === currentStep
                      ? "bg-primary border-primary text-white shadow-primary/30"
                      : "bg-card/50 border-border text-muted backdrop-blur-sm"
                  }`}
                >
                  {step.id < currentStep ? (
                    <CheckCircle2 className="size-7" />
                  ) : (
                    <span className="font-bold text-lg">{step.id}</span>
                  )}
                  {step.id === currentStep && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0, 0.5],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                      }}
                    />
                  )}
                </motion.button>
                <div className="mt-3 text-center">
                  <div
                    className={`text-sm font-semibold ${
                      step.id === currentStep ? "text-white" : "text-muted"
                    }`}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-muted/80 mt-1">
                    {step.description}
                  </div>
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div className="relative h-1 flex-1 mx-6">
                  <div className="absolute inset-0 bg-border rounded-full" />
                  <motion.div
                    className={`absolute inset-0 rounded-full ${
                      step.id < currentStep ? "bg-brand" : "bg-transparent"
                    }`}
                    initial={{ width: 0 }}
                    animate={{
                      width: step.id < currentStep ? "100%" : "0%",
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </div>
          ))}
        </motion.div>

        <div className="relative mx-auto w-full">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-[2.1rem] bg-linear-to-br from-brand/20 via-transparent to-primary/20 opacity-60 blur-xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-4xl bg-linear-to-br from-brand/10 via-transparent to-primary/10"
          />

          <div className="relative overflow-hidden rounded-4xl border border-white/8 bg-card/80 shadow-2xl shadow-black/50 backdrop-blur-2xl">
            <div className="border-b border-white/6 bg-white/3 px-6 py-5 sm:px-8">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
                    <Sparkles className="h-3.5 w-3.5 text-brand" />
                    {variant === "platform"
                      ? "Assisted launch"
                      : "School launch"}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      {stepMeta?.title ?? "Setup"}
                    </h1>
                    <p className="mt-1 text-sm text-white/45">
                      {stepMeta?.description ?? ""}
                    </p>
                  </div>
                </div>
                <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-brand sm:flex">
                  <Award className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 border-t border-white/6 pt-4 lg:hidden">
                <div className="flex items-center gap-3">
                  <Image
                    src={EDUSENTRIX_LOGO_PATH}
                    alt={EDUSENTRIX_LOGO_ALT}
                    width={36}
                    height={36}
                    className="rounded-xl"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">EduSentrix</p>
                    <p className="text-xs text-white/35">School workspace setup</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <LaunchFeaturePill icon={TrendingUp} label="Fees" />
                  <LaunchFeaturePill icon={GraduationCap} label="Academics" />
                  <LaunchFeaturePill icon={Globe} label="Ghana-ready" />
                </div>
              </div>
            </div>

            <div className="relative px-6 py-7 sm:px-8 sm:py-8">
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-brand/5 via-transparent to-primary/5" />
              <div className="relative">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  <p className="text-sm text-white/50">
                    Names are prefilled from your enrolment application when
                    available. You can edit them before continuing.
                  </p>

                  <div className="space-y-6">
                    {/* Avatar Upload */}
                    <div className="space-y-3">
                      <Label className={launchLabelClass}>
                        Profile Photo
                      </Label>
                      {data?.school ? (
                        <ImageUploader
                          schoolId={data.school.id}
                          subjectRole="school_admins"
                          maxSizeMB={5}
                          onUploaded={({ url, publicId }) => {
                            setAvatarUrl(url);
                            setAvatarPublicId(publicId);
                          }}
                        />
                      ) : (
                        <div className="h-28 rounded-xl border border-border/50 bg-background/40 grid place-items-center text-muted text-sm"></div>
                      )}
                    </div>

                    {/* Name Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className={launchLabelClass}>
                          First Name *
                        </Label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          className={launchInputClass}
                          placeholder="John"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className={launchLabelClass}>
                          Last Name *
                        </Label>
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          className={launchInputClass}
                          placeholder="Doe"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone" className={launchLabelClass}>
                          Phone Number
                        </Label>
                        <Input
                          id="phone"
                          placeholder="+233 XX XXX XXXX"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className={launchInputClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dob" className={launchLabelClass}>
                          Date of Birth
                        </Label>
                        <CustomDatePicker
                          value={
                            dob
                              ? new Date(`${dob}T12:00:00`)
                              : null
                          }
                          onChange={(d) =>
                            setDob(d ? format(d, "yyyy-MM-dd") : "")
                          }
                          placeholder="Select date"
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address" className={launchLabelClass}>
                        Address
                      </Label>
                      <Textarea
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={3}
                        className={`${launchInputClass} min-h-[88px] resize-none py-3`}
                        placeholder="Enter your full address"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-6 border-t border-white/10">
                    <Button
                      onClick={saveStep1}
                      disabled={!canContinueStep1 || saving}
                      size="lg"
                      className="rounded-2xl bg-brand px-6 text-black shadow-lg shadow-brand/20 hover:bg-sky-300 min-w-[140px]"
                    >
                      {saving ? "Saving..." : "Continue"}
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  <LaunchSectionLabel>School information</LaunchSectionLabel>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="schoolName" className={launchLabelClass}>
                        School Name *
                      </Label>
                      <Input
                        id="schoolName"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        className={launchInputClass}
                        placeholder="Enter your school name"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className={launchLabelClass}>School Type</Label>
                        <PremiumSelect
                          value={schoolType}
                          onValueChange={(v: "Basic" | "Secondary") =>
                            setSchoolType(v)
                          }
                        >
                          <PremiumSelectTrigger
                            icon={<Building2 className="h-4 w-4" />}
                            className="border-white/10 bg-white/5"
                          >
                            <PremiumSelectValue placeholder="Select type" />
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
                          onValueChange={(v) =>
                            setCurriculumCode(v as CurriculumCode)
                          }
                        >
                          <PremiumSelectTrigger
                            icon={<BookOpen className="h-4 w-4" />}
                            className="border-white/10 bg-white/5"
                          >
                            <PremiumSelectValue placeholder="Curriculum" />
                          </PremiumSelectTrigger>
                          <PremiumSelectContent className="z-[300] max-h-72 overflow-y-auto">
                            {CURRICULUM_OPTIONS.map((c) => (
                              <PremiumSelectItem key={c.code} value={c.code}>
                                {c.label}
                              </PremiumSelectItem>
                            ))}
                          </PremiumSelectContent>
                        </PremiumSelect>
                      </div>
                    </div>
                    {curriculumCode !== "ghana_nacca" && (
                      <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
                        <p className="text-sm text-white/80">
                          {getCurriculumProfile(curriculumCode).description}
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="schoolAddress" className={launchLabelClass}>
                        Address
                      </Label>
                      <Input
                        id="schoolAddress"
                        value={schoolAddress}
                        onChange={(e) => setSchoolAddress(e.target.value)}
                        className={launchInputClass}
                        placeholder="School address"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city" className={launchLabelClass}>
                          City
                        </Label>
                        <Input
                          id="city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className={launchInputClass}
                          placeholder="City"
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
                          onValueChange={(v) => setRegion(v)}
                        >
                          <PremiumSelectTrigger
                            icon={<MapPin className="h-4 w-4" />}
                            className="border-white/10 bg-white/5"
                          >
                            <PremiumSelectValue placeholder="Select region" />
                          </PremiumSelectTrigger>
                          <PremiumSelectContent className="z-[300] max-h-64 overflow-y-auto">
                            {GHANA_REGIONS.map((r) => (
                              <PremiumSelectItem key={r} value={r}>
                                {r}
                              </PremiumSelectItem>
                            ))}
                          </PremiumSelectContent>
                        </PremiumSelect>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-6 border-t border-white/10">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      size="lg"
                      className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Back
                    </Button>
                    <Button
                      onClick={saveStep2}
                      disabled={!canContinueStep2 || saving}
                      size="lg"
                      className="rounded-2xl bg-brand text-black shadow-lg shadow-brand/20 hover:bg-sky-300 min-w-[140px]"
                    >
                      {saving ? "Saving..." : "Continue"}
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  <LaunchSectionLabel>Payment setup</LaunchSectionLabel>
                  <p className="text-sm text-white/50">
                    Add payout details now or invite your billing owner to
                    complete Paystack setup securely.
                  </p>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (ownerInviteLocked) return;
                          setPaymentAuthorityMode("self");
                        }}
                        className={`rounded-2xl border p-5 text-left transition ${
                          paymentAuthorityMode === "self"
                            ? "border-brand/40 bg-brand/10 shadow-lg shadow-brand/10"
                            : "border-white/10 bg-white/[0.04] hover:border-white/20"
                        } ${ownerInviteLocked ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl border border-brand/20 bg-brand/10 p-2">
                            <ShieldCheck className="size-5 text-brand" />
                          </div>
                          <div className="space-y-2">
                            <p className="font-semibold text-white">
                              I am authorized
                            </p>
                            <p className="text-sm text-muted">
                              Add the school's payout bank details now and keep payment setup moving.
                            </p>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentAuthorityMode("owner_invite")}
                        className={`rounded-2xl border p-5 text-left transition ${
                          paymentAuthorityMode === "owner_invite"
                            ? "border-brand/40 bg-brand/10 shadow-lg shadow-brand/10"
                            : "border-white/10 bg-white/[0.04] hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl border border-brand/20 bg-brand/10 p-2">
                            <Mail className="size-5 text-brand" />
                          </div>
                          <div className="space-y-2">
                            <p className="font-semibold text-white">
                              Invite the billing owner
                            </p>
                            <p className="text-sm text-muted">
                              Send a secure setup link to the person authorized to control the school's payout account.
                            </p>
                          </div>
                        </div>
                      </button>
                    </div>

                    {paymentAuthorityMode === "self" ? (
                      <>
                        <div className="space-y-2">
                          <Label className={launchLabelClass}>
                            Bank & Branch
                          </Label>
                          <BankBranchCombo
                            value={bankPick}
                            onChange={(v) => {
                              setBankPick(v);
                              setBankName(v?.bankName || "");
                              setBranchName(v?.branchName || "");
                              setSortCode(v?.sortCode || "");
                            }}
                            nameHiddenSortCode="sortCode"
                          />
                          {bankPick && (
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-xs text-muted mt-2 px-3 py-2 rounded-lg bg-brand/10 border border-brand/20"
                            >
                              Selected:{" "}
                              <strong className="text-brand">
                                {bankPick.bankName}
                              </strong>{" "}
                              - {bankPick.branchName} (sort: {bankPick.sortCode})
                            </motion.p>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="accountName" className={launchLabelClass}>
                              Account Name
                            </Label>
                            <Input
                              id="accountName"
                              value={accountName}
                              onChange={(e) => setAccountName(e.target.value)}
                              className={launchInputClass}
                              placeholder="Account holder name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="accountNumber" className={launchLabelClass}>
                              Account Number
                            </Label>
                            <Input
                              id="accountNumber"
                              value={accountNumber}
                              onChange={(e) => setAccountNumber(e.target.value)}
                              className={launchInputClass}
                              placeholder="Account number"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4 rounded-2xl border border-brand/20 bg-brand/5 p-5">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-white">
                            Billing owner handoff
                          </p>
                          <p className="text-sm text-muted">
                            The invited billing owner will receive a secure sign-in path and land directly in Payment Setup.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="billingOwnerName" className={launchLabelClass}>
                              Billing owner name
                            </Label>
                            <Input
                              id="billingOwnerName"
                              value={ownerName}
                              onChange={(e) => setOwnerName(e.target.value)}
                              className={launchInputClass}
                              placeholder="Owner or finance authority"
                              disabled={ownerInviteLocked}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="billingOwnerEmail" className={launchLabelClass}>
                              Billing owner email
                            </Label>
                            <Input
                              id="billingOwnerEmail"
                              value={ownerEmail}
                              onChange={(e) => setOwnerEmail(e.target.value)}
                              className={launchInputClass}
                              placeholder="owner@school.edu.gh"
                              disabled={ownerInviteLocked}
                            />
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75">
                          {ownerInviteLocked
                            ? `Billing owner invitation already sent to ${ownerEmail}. You can continue setup while they complete payment setup later.`
                            : "If you are not authorized to add payout details, send the setup link to the billing owner and continue with the rest of school launch."}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between pt-6 border-t border-white/10">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      size="lg"
                      className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Back
                    </Button>
                    <Button
                      onClick={saveStep3}
                      disabled={saving}
                      size="lg"
                      className="rounded-2xl bg-brand text-black shadow-lg shadow-brand/20 hover:bg-sky-300 min-w-[140px]"
                    >
                      {saving
                        ? "Saving..."
                        : paymentAuthorityMode === "owner_invite" &&
                            !ownerInviteLocked
                          ? "Send Invite"
                          : "Continue"}
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  <LaunchSectionLabel>Curriculum & periods</LaunchSectionLabel>
                  <p className="text-sm text-white/50">
                    Select subjects and define academic periods. Dates use the
                    calendar picker for consistency with the rest of the app.
                  </p>

                  {/* Subjects */}
                  <div className="space-y-6">
                    <div>
                      <Label className={`${launchLabelClass} mb-3 block`}>
                        Subjects
                      </Label>
                      <div className="flex gap-2 mb-4">
                        <Input
                          placeholder="Add custom subject"
                          value={newSubject}
                          onChange={(e) => setNewSubject(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter"
                              ? (e.preventDefault(), addSubject())
                              : null
                          }
                          className={launchInputClass}
                        />
                        <Button
                          type="button"
                          onClick={addSubject}
                          variant="outline"
                          className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                        >
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {subjectPool.map((s) => {
                          const active = selectedSubjects.includes(s);
                          return (
                            <motion.button
                              key={s}
                              type="button"
                              onClick={() =>
                                active
                                  ? removeSubject(s)
                                  : setSelectedSubjects((prev) => [...prev, s])
                              }
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                                active
                                  ? "bg-brand text-black border-brand shadow-lg shadow-brand/20"
                                  : "border-border hover:border-brand/50 hover:bg-card/50"
                              }`}
                            >
                              {s}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Academic Periods */}
                    <div className="space-y-4">
                      <Label className={`${launchLabelClass} block`}>
                        Academic Periods
                      </Label>
                      {periods.map((p, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm md:grid-cols-5 md:items-end"
                        >
                          <div className="space-y-2">
                            <Label className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                              Year label
                            </Label>
                            <Input
                              value={p.yearLabel}
                              onChange={(e) => {
                                const v = e.target.value;
                                setPeriods((arr) =>
                                  arr.map((x, i) =>
                                    i === idx ? { ...x, yearLabel: v } : x
                                  )
                                );
                              }}
                              className={launchInputClass}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                              Term
                            </Label>
                            <Input
                              value={p.term}
                              onChange={(e) => {
                                const v = e.target.value;
                                setPeriods((arr) =>
                                  arr.map((x, i) =>
                                    i === idx ? { ...x, term: v } : x
                                  )
                                );
                              }}
                              className={launchInputClass}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                              Start
                            </Label>
                            <CustomDatePicker
                              value={
                                p.startDate
                                  ? new Date(`${p.startDate}T12:00:00`)
                                  : null
                              }
                              onChange={(d) => {
                                const v = d ? format(d, "yyyy-MM-dd") : "";
                                setPeriods((arr) =>
                                  arr.map((x, i) =>
                                    i === idx ? { ...x, startDate: v } : x
                                  )
                                );
                              }}
                              placeholder="Start date"
                              className="w-full"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                              End
                            </Label>
                            <CustomDatePicker
                              value={
                                p.endDate
                                  ? new Date(`${p.endDate}T12:00:00`)
                                  : null
                              }
                              onChange={(d) => {
                                const v = d ? format(d, "yyyy-MM-dd") : "";
                                setPeriods((arr) =>
                                  arr.map((x, i) =>
                                    i === idx ? { ...x, endDate: v } : x
                                  )
                                );
                              }}
                              placeholder="End date"
                              className="w-full"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={p.isCurrent ? "default" : "outline"}
                              onClick={() => setCurrentPeriod(idx)}
                              size="sm"
                              className={
                                p.isCurrent
                                  ? "rounded-xl bg-brand text-black"
                                  : "rounded-xl border-white/15 bg-white/5"
                              }
                            >
                              {p.isCurrent ? "Current" : "Set current"}
                            </Button>
                            {periods.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  setPeriods((arr) =>
                                    arr.filter((_, i) => i !== idx)
                                  )
                                }
                                size="sm"
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setPeriods((arr) => [
                            ...arr,
                            {
                              yearLabel: `${new Date().getFullYear()}/${
                                new Date().getFullYear() + 1
                              }`,
                              term: `Term ${arr.length + 1}`,
                              startDate: format(new Date(), "yyyy-MM-dd"),
                              endDate: format(
                                new Date(
                                  new Date().setMonth(new Date().getMonth() + 3)
                                ),
                                "yyyy-MM-dd"
                              ),
                              isCurrent: false,
                            },
                          ])
                        }
                        className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                      >
                        Add period
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-between pt-6 border-t border-white/10">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(3)}
                      size="lg"
                      className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Back
                    </Button>
                    <Button
                      onClick={finishOnboarding}
                      disabled={!canContinueStep4 || saving}
                      size="lg"
                      className="rounded-2xl bg-brand text-black shadow-lg shadow-brand/20 hover:bg-sky-300 min-w-[180px]"
                    >
                      {saving ? "Finishing..." : "Complete Onboarding"}
                      <CheckCircle2 className="ml-2 size-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

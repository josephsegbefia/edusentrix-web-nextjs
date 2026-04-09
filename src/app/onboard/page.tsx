"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import { BankBranchCombo } from "@/components/banks/BankBranchCombo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns/format";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Mail,
  ShieldCheck,
} from "lucide-react";
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

type Step = (typeof STEPS)[number]["id"];
type PaymentAuthorityMode = "self" | "owner_invite";

export default function OnboardPage() {
  const [loading, setLoading] = useState(true);
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
    (async () => {
      try {
        const res = await fetch("/api/onboarding/bootstrap", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Bootstrap failed");
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
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

    const res = await fetch("/api/onboarding/school", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: data.school.id,
        name: schoolName.trim(),
        type: schoolType,
        curriculumCode,
        address: schoolAddress.trim() || undefined,
        city: city.trim() || undefined,
        region: region.trim() || undefined,
        bank: bankPayload,
      }),
    });

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
      const res = await fetch("/api/onboarding/profile", {
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
      });
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
          "/api/admin/settings/payment-setup/owner-invite",
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
      const res = await fetch("/api/onboarding/finish", {
        method: "POST",
      });
      if (!res.ok) {
        const e = await res.json().catch(() => null);
        toast.error(`Failed to finalize: ${e?.error ?? res.statusText}`);
        return;
      }
      toast.success("Onboarding completed!");
      // redirect to dashboard
      setTimeout(() => {
        window.location.href = "/admin";
      }, 1500);
    } catch {
      toast.error("Failed to finalize school launch");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="size-12 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          <p className="text-muted">Loading launch data…</p>
        </motion.div>
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
            No School Invite Found
          </h2>
          <p className="text-muted">
            Please ensure you have a valid school invitation linked to your
            account.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-white relative overflow-hidden">
      {/* Premium gradient background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(50% 50% at 15% 15%, var(--color-brand) 0%, transparent 60%), radial-gradient(60% 40% at 85% 10%, var(--color-primary) 0%, transparent 65%)",
          filter: "blur(100px)",
        }}
      />

      {/* Animated grid pattern */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 py-12 md:py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-brand/10 border border-brand/20">
            <Sparkles className="size-4 text-brand" />
            <span className="text-sm font-medium text-brand">School Setup</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4 bg-linear-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
            Launch Your School
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Complete your school setup in a few simple steps. Let&apos;s get you
            started.
          </p>
        </motion.div>

        {/* Step indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12 flex items-center justify-between"
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

        {/* Step content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-card/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative"
        >
          {/* Subtle glow effect */}
          <div className="absolute inset-0 bg-linear-to-br from-brand/5 via-transparent to-primary/5 pointer-events-none" />

          <div className="relative p-8 md:p-12">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold bg-linear-to-r from-white to-white/80 bg-clip-text text-transparent">
                      Your Profile
                    </h2>
                    <p className="text-muted text-base">
                      Tell us a bit about yourself to personalize your
                      experience
                    </p>
                  </div>

                  <div className="space-y-6">
                    {/* Avatar Upload */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">
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
                        <Label
                          htmlFor="firstName"
                          className="text-sm font-semibold"
                        >
                          First Name *
                        </Label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          className="bg-background/50 border-border h-11"
                          placeholder="John"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="lastName"
                          className="text-sm font-semibold"
                        >
                          Last Name *
                        </Label>
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          className="bg-background/50 border-border h-11"
                          placeholder="Doe"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="phone"
                          className="text-sm font-semibold"
                        >
                          Phone Number
                        </Label>
                        <Input
                          id="phone"
                          placeholder="+233 XX XXX XXXX"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="bg-background/50 border-border h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dob" className="text-sm font-semibold">
                          Date of Birth
                        </Label>
                        <Input
                          id="dob"
                          type="date"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className="bg-background/50 border-border h-11"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="address"
                        className="text-sm font-semibold"
                      >
                        Address
                      </Label>
                      <Textarea
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={3}
                        className="bg-background/50 border-border resize-none"
                        placeholder="Enter your full address"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-6 border-t border-border/50">
                    <Button
                      onClick={saveStep1}
                      disabled={!canContinueStep1 || saving}
                      size="lg"
                      className="bg-brand text-black hover:bg-brand/90 shadow-lg shadow-brand/20 min-w-[140px]"
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
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold bg-linear-to-r from-white to-white/80 bg-clip-text text-transparent">
                      School Information
                    </h2>
                    <p className="text-muted text-base">
                      Basic details about your school
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label
                        htmlFor="schoolName"
                        className="text-sm font-semibold"
                      >
                        School Name *
                      </Label>
                      <Input
                        id="schoolName"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        className="bg-background/50 border-border h-11"
                        placeholder="Enter your school name"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">
                          School Type
                        </Label>
                        <Select
                          value={schoolType}
                          onValueChange={(v: "Basic" | "Secondary") =>
                            setSchoolType(v)
                          }
                        >
                          <SelectTrigger className="bg-background/50 border-border h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            <SelectItem value="Basic">Basic</SelectItem>
                            <SelectItem value="Secondary">Secondary</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">
                          Curriculum
                        </Label>
                        <Select
                          value={curriculumCode}
                          onValueChange={(v) =>
                            setCurriculumCode(v as CurriculumCode)
                          }
                        >
                          <SelectTrigger className="bg-background/50 border-border h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {CURRICULUM_OPTIONS.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                      <Label
                        htmlFor="schoolAddress"
                        className="text-sm font-semibold"
                      >
                        Address
                      </Label>
                      <Input
                        id="schoolAddress"
                        value={schoolAddress}
                        onChange={(e) => setSchoolAddress(e.target.value)}
                        className="bg-background/50 border-border h-11"
                        placeholder="School address"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city" className="text-sm font-semibold">
                          City
                        </Label>
                        <Input
                          id="city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="bg-background/50 border-border h-11"
                          placeholder="City"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="region"
                          className="text-sm font-semibold"
                        >
                          Region
                        </Label>
                        <Input
                          id="region"
                          value={region}
                          onChange={(e) => setRegion(e.target.value)}
                          className="bg-background/50 border-border h-11"
                          placeholder="Region"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-6 border-t border-border/50">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      size="lg"
                      className="border-border"
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Back
                    </Button>
                    <Button
                      onClick={saveStep2}
                      disabled={!canContinueStep2 || saving}
                      size="lg"
                      className="bg-brand text-black hover:bg-brand/90 shadow-lg shadow-brand/20 min-w-[140px]"
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
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold bg-linear-to-r from-white to-white/80 bg-clip-text text-transparent">
                      Payment Setup
                    </h2>
                    <p className="text-muted text-base">
                      Choose whether you will add the payout account now or hand payment setup to the school's billing owner
                    </p>
                  </div>

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
                            : "border-border/70 bg-background/40 hover:border-border"
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
                            : "border-border/70 bg-background/40 hover:border-border"
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
                          <Label className="text-sm font-semibold">
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
                            <Label
                              htmlFor="accountName"
                              className="text-sm font-semibold"
                            >
                              Account Name
                            </Label>
                            <Input
                              id="accountName"
                              value={accountName}
                              onChange={(e) => setAccountName(e.target.value)}
                              className="bg-background/50 border-border h-11"
                              placeholder="Account holder name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="accountNumber"
                              className="text-sm font-semibold"
                            >
                              Account Number
                            </Label>
                            <Input
                              id="accountNumber"
                              value={accountNumber}
                              onChange={(e) => setAccountNumber(e.target.value)}
                              className="bg-background/50 border-border h-11"
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
                            <Label
                              htmlFor="billingOwnerName"
                              className="text-sm font-semibold"
                            >
                              Billing owner name
                            </Label>
                            <Input
                              id="billingOwnerName"
                              value={ownerName}
                              onChange={(e) => setOwnerName(e.target.value)}
                              className="bg-background/50 border-border h-11"
                              placeholder="Owner or finance authority"
                              disabled={ownerInviteLocked}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="billingOwnerEmail"
                              className="text-sm font-semibold"
                            >
                              Billing owner email
                            </Label>
                            <Input
                              id="billingOwnerEmail"
                              value={ownerEmail}
                              onChange={(e) => setOwnerEmail(e.target.value)}
                              className="bg-background/50 border-border h-11"
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

                  <div className="flex justify-between pt-6 border-t border-border/50">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      size="lg"
                      className="border-border"
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Back
                    </Button>
                    <Button
                      onClick={saveStep3}
                      disabled={saving}
                      size="lg"
                      className="bg-brand text-black hover:bg-brand/90 shadow-lg shadow-brand/20 min-w-[140px]"
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
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold bg-linear-to-r from-white to-white/80 bg-clip-text text-transparent">
                      Curriculum Setup
                    </h2>
                    <p className="text-muted text-base">
                      Configure subjects and academic periods for your school
                    </p>
                  </div>

                  {/* Subjects */}
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-semibold mb-3 block">
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
                          className="bg-background/50 border-border"
                        />
                        <Button
                          type="button"
                          onClick={addSubject}
                          variant="outline"
                          className="border-border"
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
                      <Label className="text-sm font-semibold block">
                        Academic Periods
                      </Label>
                      {periods.map((p, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end p-5 bg-background/40 rounded-xl border border-border/50 backdrop-blur-sm"
                        >
                          <div className="space-y-2">
                            <Label className="text-xs text-muted">
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
                              className="bg-background/50 border-border"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted">Term</Label>
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
                              className="bg-background/50 border-border"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted">Start</Label>
                            <Input
                              type="date"
                              value={p.startDate}
                              onChange={(e) => {
                                const v = e.target.value;
                                setPeriods((arr) =>
                                  arr.map((x, i) =>
                                    i === idx ? { ...x, startDate: v } : x
                                  )
                                );
                              }}
                              className="bg-background/50 border-border"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted">End</Label>
                            <Input
                              type="date"
                              value={p.endDate}
                              onChange={(e) => {
                                const v = e.target.value;
                                setPeriods((arr) =>
                                  arr.map((x, i) =>
                                    i === idx ? { ...x, endDate: v } : x
                                  )
                                );
                              }}
                              className="bg-background/50 border-border"
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
                                  ? "bg-brand text-black"
                                  : "border-border"
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
                        className="border-border"
                      >
                        Add period
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-between pt-6 border-t border-border/50">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(3)}
                      size="lg"
                      className="border-border"
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Back
                    </Button>
                    <Button
                      onClick={finishOnboarding}
                      disabled={!canContinueStep4 || saving}
                      size="lg"
                      className="bg-brand text-black hover:bg-brand/90 shadow-lg shadow-brand/20 min-w-[180px]"
                    >
                      {saving ? "Finishing..." : "Complete Onboarding"}
                      <CheckCircle2 className="ml-2 size-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Bootstrap = {
  user: {
    email: string;
    name: string;
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
  { id: 3, title: "Banking", description: "Payment details" },
  { id: 4, title: "Curriculum", description: "Subjects & periods" },
] as const;

type Step = (typeof STEPS)[number]["id"];

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
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState<string>("");
  const [address, setAddress] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Step 2: school + curriculum
  const [schoolName, setSchoolName] = useState("");
  const [schoolType, setSchoolType] = useState<"Basic" | "Secondary">("Basic");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [bankName, setBankName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

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
        setName(payload.user.name || "");
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
          setSchoolAddress(payload.school.address || "");
          setCity(payload.school.city || "");
          setRegion(payload.school.region || "");
          setBankName(payload.school.bank?.bankName || "");
          setBranchName(payload.school.bank?.branchName || "");
          setSortCode(payload.school.bank?.sortCode || "");
          setAccountName(payload.school.bank?.accountName || "");
          setAccountNumber(payload.school.bank?.accountNumber || "");

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

  const canContinueStep1 = useMemo(() => name.trim().length >= 2, [name]);
  const canContinueStep2 = useMemo(
    () => schoolName.trim().length >= 2,
    [schoolName]
  );
  const canContinueStep4 = useMemo(
    () => selectedSubjects.length > 0 && periods.length > 0,
    [selectedSubjects.length, periods.length]
  );

  async function saveStep1() {
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone || null,
          dateOfBirth: dob ? new Date(dob).toISOString() : null,
          address: address || null,
          avatarUrl: avatarUrl || null,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to save profile");
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
    if (!data?.school) {
      toast.error("No school bound to your account");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding/school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: data.school.id,
          name: schoolName,
          type: schoolType,
          address: schoolAddress || null,
          city: city || null,
          region: region || null,
          bank: {
            bankName: bankName || null,
            branchName: branchName || null,
            sortCode: sortCode || null,
            accountName: accountName || null,
            accountNumber: accountNumber || null,
          },
        }),
      });
      if (!res.ok) {
        toast.error("Failed to save school profile");
        return;
      }
      toast.success("School profile saved");
      setCurrentStep(3);
    } catch {
      toast.error("Failed to save school profile");
    } finally {
      setSaving(false);
    }
  }

  async function saveStep3() {
    // Step 3 is banking, which is part of school details
    // We can save it here or move to step 2
    await saveStep2();
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: data.school.id,
          subjects: selectedSubjects,
          periods: periods.map((p) => ({
            ...p,
            startDate: new Date(p.startDate).toISOString(),
            endDate: new Date(p.endDate).toISOString(),
            isCurrent: !!p.isCurrent,
          })),
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => null);
        toast.error(`Failed to finalize: ${e?.details ?? res.statusText}`);
        return;
      }
      toast.success("Onboarding completed!");
      // redirect to dashboard
      setTimeout(() => {
        window.location.href = "/admin";
      }, 1500);
    } catch {
      toast.error("Failed to finalize onboarding");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center">
        <div className="text-muted">Loading…</div>
      </div>
    );
  }
  if (!data?.school) {
    return (
      <div className="min-h-screen bg-bg text-white flex items-center justify-center">
        <div className="text-muted">
          No school invite found for your account.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-white">
      {/* Premium gradient background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(50% 50% at 15% 15%, var(--color-brand) 0%, transparent 60%), radial-gradient(60% 40% at 85% 10%, var(--color-primary) 0%, transparent 65%)",
          filter: "blur(90px)",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            School Onboarding
          </h1>
          <p className="text-muted">
            Complete your school setup in a few simple steps
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-between">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <button
                  onClick={() => {
                    // Allow going back to completed steps
                    if (step.id < currentStep) {
                      setCurrentStep(step.id);
                    }
                  }}
                  className={`flex items-center justify-center size-12 rounded-full border-2 transition-all ${
                    step.id < currentStep
                      ? "bg-brand border-brand text-black cursor-pointer hover:scale-105"
                      : step.id === currentStep
                      ? "bg-primary border-primary text-white"
                      : "bg-card border-border text-muted"
                  }`}
                >
                  {step.id < currentStep ? (
                    <CheckCircle2 className="size-6" />
                  ) : (
                    <span className="font-semibold">{step.id}</span>
                  )}
                </button>
                <div className="mt-2 text-center">
                  <div
                    className={`text-sm font-medium ${
                      step.id === currentStep ? "text-white" : "text-muted"
                    }`}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {step.description}
                  </div>
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-4 transition-colors ${
                    step.id < currentStep ? "bg-brand" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="bg-card/90 backdrop-blur border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="p-8 md:p-12">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">
                      Your Profile
                    </h2>
                    <p className="text-muted">Tell us a bit about yourself</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium">
                        Full name *
                      </Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="bg-background/50 border-border"
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-sm font-medium">
                          Phone
                        </Label>
                        <Input
                          id="phone"
                          placeholder="+233..."
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="bg-background/50 border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dob" className="text-sm font-medium">
                          Date of birth
                        </Label>
                        <Input
                          id="dob"
                          type="date"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className="bg-background/50 border-border"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-sm font-medium">
                        Address
                      </Label>
                      <Textarea
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={3}
                        className="bg-background/50 border-border resize-none"
                        placeholder="Your address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="avatarUrl"
                        className="text-sm font-medium"
                      >
                        Avatar URL
                      </Label>
                      <Input
                        id="avatarUrl"
                        placeholder="https://..."
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        className="bg-background/50 border-border"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={saveStep1}
                      disabled={!canContinueStep1 || saving}
                      className="bg-brand text-black hover:opacity-90"
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
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">
                      School Information
                    </h2>
                    <p className="text-muted">
                      Basic details about your school
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="schoolName"
                        className="text-sm font-medium"
                      >
                        School name *
                      </Label>
                      <Input
                        id="schoolName"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        className="bg-background/50 border-border"
                        placeholder="Your School Name"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Type</Label>
                        <Select
                          value={schoolType}
                          onValueChange={(v: "Basic" | "Secondary") =>
                            setSchoolType(v)
                          }
                        >
                          <SelectTrigger className="bg-background/50 border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            <SelectItem value="Basic">Basic</SelectItem>
                            <SelectItem value="Secondary">Secondary</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="schoolAddress"
                          className="text-sm font-medium"
                        >
                          Address
                        </Label>
                        <Input
                          id="schoolAddress"
                          value={schoolAddress}
                          onChange={(e) => setSchoolAddress(e.target.value)}
                          className="bg-background/50 border-border"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city" className="text-sm font-medium">
                          City
                        </Label>
                        <Input
                          id="city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="bg-background/50 border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="region" className="text-sm font-medium">
                          Region
                        </Label>
                        <Input
                          id="region"
                          value={region}
                          onChange={(e) => setRegion(e.target.value)}
                          className="bg-background/50 border-border"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="border-border"
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Back
                    </Button>
                    <Button
                      onClick={saveStep2}
                      disabled={!canContinueStep2 || saving}
                      className="bg-brand text-black hover:opacity-90"
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
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">
                      Bank Details
                    </h2>
                    <p className="text-muted">
                      Payment and banking information
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
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
                        <p className="text-xs text-muted">
                          Selected: <strong>{bankPick.bankName}</strong> -{" "}
                          {bankPick.branchName} (sort: {bankPick.sortCode})
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="accountName"
                          className="text-sm font-medium"
                        >
                          Account name
                        </Label>
                        <Input
                          id="accountName"
                          value={accountName}
                          onChange={(e) => setAccountName(e.target.value)}
                          className="bg-background/50 border-border"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="accountNumber"
                          className="text-sm font-medium"
                        >
                          Account number
                        </Label>
                        <Input
                          id="accountNumber"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          className="bg-background/50 border-border"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      className="border-border"
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Back
                    </Button>
                    <Button
                      onClick={saveStep3}
                      disabled={saving}
                      className="bg-brand text-black hover:opacity-90"
                    >
                      {saving ? "Saving..." : "Continue"}
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
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">
                      Curriculum Setup
                    </h2>
                    <p className="text-muted">
                      Configure subjects and academic periods
                    </p>
                  </div>

                  {/* Subjects */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
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
                            <button
                              key={s}
                              type="button"
                              onClick={() =>
                                active
                                  ? removeSubject(s)
                                  : setSelectedSubjects((prev) => [...prev, s])
                              }
                              className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                                active
                                  ? "bg-brand text-black border-brand"
                                  : "border-border hover:border-brand/50"
                              }`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Academic Periods */}
                    <div className="space-y-4">
                      <Label className="text-sm font-medium block">
                        Academic Periods
                      </Label>
                      {periods.map((p, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end p-4 bg-background/30 rounded-lg border border-border"
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
                        </div>
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

                  <div className="flex justify-between pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(3)}
                      className="border-border"
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Back
                    </Button>
                    <Button
                      onClick={finishOnboarding}
                      disabled={!canContinueStep4 || saving}
                      className="bg-brand text-black hover:opacity-90"
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
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

const PeriodSchema = z.object({
  yearLabel: z.string().min(1),
  term: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isCurrent: z.boolean().optional().default(false),
});

export default function OnboardPage() {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
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

  const [periods, setPeriods] = useState<Array<z.infer<typeof PeriodSchema>>>([
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

  async function saveStep1() {
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
      alert("Failed to save profile");
      return;
    }
    setStep(2);
  }

  async function saveSchool() {
    if (!data?.school) return alert("No school bound to your account");
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
      alert("Failed to save school profile");
      return;
    }
    alert("School profile saved");
  }

  async function finishOnboarding() {
    if (!data?.school) return alert("No school bound");
    if (selectedSubjects.length === 0)
      return alert("Please select at least one subject");
    if (periods.length === 0)
      return alert("Please define at least one academic period");

    // basic validation
    for (const p of periods) {
      if (!p.yearLabel || !p.term || !p.startDate || !p.endDate) {
        return alert("Please complete all academic period fields");
      }
      if (new Date(p.endDate) <= new Date(p.startDate)) {
        return alert(
          `End date must be after start date for ${p.yearLabel} - ${p.term}`
        );
      }
    }

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
      alert(`Failed to finalize: ${e?.details ?? res.statusText}`);
      return;
    }
    // redirect to dashboard
    window.location.href = "/dashboard";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-50 py-8 px-4 flex items-center justify-center">
        <div className="text-gray-700">Loading…</div>
      </div>
    );
  }
  if (!data?.school) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-50 py-8 px-4 flex items-center justify-center">
        <div className="text-gray-700">
          No school invite found for your account.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-8 py-6 text-white">
            <h1 className="text-3xl font-bold mb-2">
              {step === 1 ? "Complete Your Profile" : "School Setup"}
            </h1>
            <p className="text-blue-100 opacity-90">
              {step === 1
                ? "Let's start by setting up your administrator profile"
                : "Configure your school information and curriculum"}
            </p>
            {/* Progress bar */}
            <div className="mt-4 h-2 w-full bg-blue-500/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${(step / 2) * 100}%` }}
              />
            </div>
          </div>

          {/* Form Content */}
          <div className="p-8">
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Administrator Information
                  </h2>
                  <div className="space-y-2">
                    <Label
                      htmlFor="name"
                      className="text-sm font-medium text-gray-700"
                    >
                      Full name *
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="phone"
                        className="text-sm font-medium text-gray-700"
                      >
                        Phone
                      </Label>
                      <Input
                        id="phone"
                        placeholder="+233…"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="dob"
                        className="text-sm font-medium text-gray-700"
                      >
                        Date of birth
                      </Label>
                      <Input
                        id="dob"
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="address"
                      className="text-sm font-medium text-gray-700"
                    >
                      Address
                    </Label>
                    <Textarea
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={3}
                      className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="avatarUrl"
                      className="text-sm font-medium text-gray-700"
                    >
                      Avatar URL
                    </Label>
                    <Input
                      id="avatarUrl"
                      placeholder="https://…"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={saveStep1}
                    disabled={!canContinueStep1}
                    className="w-full bg-linear-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white py-3 px-6 rounded-lg font-semibold text-base transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none disabled:opacity-50 cursor-pointer"
                  >
                    Save & Continue
                  </Button>
                  <p className="text-xs text-gray-500 text-center mt-3">
                    Fields marked with * are required
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                {/* School Profile */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    School Information
                  </h2>
                  <div className="space-y-2">
                    <Label
                      htmlFor="schoolName"
                      className="text-sm font-medium text-gray-700"
                    >
                      School name
                    </Label>
                    <Input
                      id="schoolName"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">
                        Type
                      </Label>
                      <Select
                        value={schoolType}
                        onValueChange={(v: "Basic" | "Secondary") =>
                          setSchoolType(v)
                        }
                      >
                        <SelectTrigger className="bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="Basic" className="cursor-pointer">
                            Basic
                          </SelectItem>
                          <SelectItem
                            value="Secondary"
                            className="cursor-pointer"
                          >
                            Secondary
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="schoolAddress"
                        className="text-sm font-medium text-gray-700"
                      >
                        Address
                      </Label>
                      <Input
                        id="schoolAddress"
                        value={schoolAddress}
                        onChange={(e) => setSchoolAddress(e.target.value)}
                        className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="city"
                        className="text-sm font-medium text-gray-700"
                      >
                        City
                      </Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="region"
                        className="text-sm font-medium text-gray-700"
                      >
                        Region
                      </Label>
                      <Input
                        id="region"
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Banking */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Bank Details
                  </h2>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
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
                      <p className="text-xs text-gray-500">
                        Selected: <strong>{bankPick.bankName}</strong> -{" "}
                        {bankPick.branchName} (sort: {bankPick.sortCode})
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="bankName"
                        className="text-sm font-medium text-gray-700"
                      >
                        Bank name
                      </Label>
                      <Input
                        id="bankName"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="branchName"
                        className="text-sm font-medium text-gray-700"
                      >
                        Branch name
                      </Label>
                      <Input
                        id="branchName"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="sortCode"
                        className="text-sm font-medium text-gray-700"
                      >
                        Sort code (6 digits)
                      </Label>
                      <Input
                        id="sortCode"
                        value={sortCode}
                        onChange={(e) =>
                          setSortCode(
                            e.target.value.replace(/\D/g, "").slice(0, 6)
                          )
                        }
                        className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="accountName"
                        className="text-sm font-medium text-gray-700"
                      >
                        Account name
                      </Label>
                      <Input
                        id="accountName"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="accountNumber"
                        className="text-sm font-medium text-gray-700"
                      >
                        Account number
                      </Label>
                      <Input
                        id="accountNumber"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      onClick={saveSchool}
                      className="cursor-pointer"
                    >
                      Save school profile
                    </Button>
                  </div>
                </div>

                {/* Subjects */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Subjects
                  </h2>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add custom subject"
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter"
                          ? (e.preventDefault(), addSubject())
                          : null
                      }
                      className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                    <Button
                      type="button"
                      onClick={addSubject}
                      className="cursor-pointer"
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
                          className={`px-3 py-1 rounded-full border text-sm cursor-pointer transition-colors ${
                            active
                              ? "bg-blue-600 text-white border-blue-600"
                              : "border-gray-300 hover:border-blue-500"
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
                  <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Academic Periods
                  </h2>
                  {periods.map((p, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
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
                          className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
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
                          className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          Start
                        </Label>
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
                          className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          End
                        </Label>
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
                          className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={p.isCurrent ? "default" : "outline"}
                          onClick={() => setCurrentPeriod(idx)}
                          className="cursor-pointer"
                        >
                          {p.isCurrent ? "Current" : "Make current"}
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
                            className="cursor-pointer"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2">
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
                      className="cursor-pointer"
                    >
                      Add period
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setStep(1)}
                        className="cursor-pointer"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={finishOnboarding}
                        className="bg-linear-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white cursor-pointer"
                      >
                        Finish onboarding
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

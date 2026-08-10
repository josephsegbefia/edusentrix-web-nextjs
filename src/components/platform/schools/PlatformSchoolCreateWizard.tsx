"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GhanaPhoneInput } from "@/components/ui/ghana-phone-input";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { CURRICULUM_PROFILES, type CurriculumCode } from "@/constants/curriculum-profiles";

export function PlatformSchoolCreateWizard() {
  const router = useRouter();
  const [schoolName, setSchoolName] = React.useState("");
  const [type, setType] = React.useState<"Basic" | "SHS">("Basic");
  const [curriculumCode, setCurriculumCode] = React.useState<CurriculumCode>("ghana_nacca");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [region, setRegion] = React.useState("");
  const [schoolEmail, setSchoolEmail] = React.useState("");
  const [schoolPhone, setSchoolPhone] = React.useState("");
  const [gesSchoolCode, setGesSchoolCode] = React.useState("");
  const [adminName, setAdminName] = React.useState("");
  const [adminEmail, setAdminEmail] = React.useState("");
  const [adminPhone, setAdminPhone] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    let shouldKeepBusy = false;
    try {
      const res = await fetch("/api/platform/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school: {
            name: schoolName,
            type,
            curriculumCode,
            address,
            city,
            region,
            email: schoolEmail,
            phone: schoolPhone,
            gesSchoolCode,
          },
          admin: { fullName: adminName, email: adminEmail, phone: adminPhone },
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to create school");
      shouldKeepBusy = true;
      router.push(`/platform/schools/${payload.data.schoolId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create school");
    } finally {
      if (!shouldKeepBusy) {
        setBusy(false);
      }
    }
  }

  return (
    <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
      {error ? <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="School name" className="h-11 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/30" />
        <PremiumSelect value={type} onValueChange={(value) => setType(value as "Basic" | "SHS")}>
          <PremiumSelectTrigger><PremiumSelectValue placeholder="School type" /></PremiumSelectTrigger>
          <PremiumSelectContent><PremiumSelectItem value="Basic">Basic</PremiumSelectItem><PremiumSelectItem value="SHS">SHS</PremiumSelectItem></PremiumSelectContent>
        </PremiumSelect>
        <PremiumSelect value={curriculumCode} onValueChange={(value) => setCurriculumCode(value as CurriculumCode)}>
          <PremiumSelectTrigger><PremiumSelectValue placeholder="Curriculum" /></PremiumSelectTrigger>
          <PremiumSelectContent>{Object.values(CURRICULUM_PROFILES).map((profile) => <PremiumSelectItem key={profile.code} value={profile.code} description={profile.description}>{profile.label}</PremiumSelectItem>)}</PremiumSelectContent>
        </PremiumSelect>
        <input value={schoolEmail} onChange={(e) => setSchoolEmail(e.target.value)} placeholder="School email" className="h-11 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/30" />
        <GhanaPhoneInput unstyled value={schoolPhone} onChange={(e) => setSchoolPhone(e.target.value)} placeholder="School phone" className="h-11 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/30" />
        <input value={gesSchoolCode} onChange={(e) => setGesSchoolCode(e.target.value)} placeholder="GES code optional" className="h-11 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/30" />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="h-11 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/30" />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="h-11 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/30" />
        <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region" className="h-11 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/30" />
      </div>
      <div className="grid gap-4 border-t border-white/10 pt-5 lg:grid-cols-2">
        <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Primary admin full name" className="h-11 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/30" />
        <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="Primary admin email" className="h-11 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/30" />
        <GhanaPhoneInput unstyled value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} placeholder="Primary admin phone" className="h-11 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none placeholder:text-white/30" />
      </div>
      <Button disabled={!schoolName.trim() || !adminName.trim() || !adminEmail.includes("@") || busy} onClick={() => void submit()} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
        <Plus className="mr-2 h-4 w-4" />
        {busy ? "Creating..." : "Create School"}
      </Button>
    </div>
  );
}

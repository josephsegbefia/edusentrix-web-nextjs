"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  Landmark,
  Loader2,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/fees/money";
import { computeSubscriptionPricing } from "@/lib/platform-billing/subscription-pricing";
import { cn } from "@/lib/utils";

type PayoutMethod = "bank" | "mobile_money";

type PayoutDestination = {
  method: PayoutMethod;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  providerName: string;
  notes: string;
};

type AuditEntry = {
  changedAt: string | null;
  changedByEmail: string | null;
  summary: string | null;
  subscriptionPayoutMasked: string | null;
  transactionFeePayoutMasked: string | null;
};

type BillingSettingsResponse = {
  subscriptionPayout: Partial<PayoutDestination> | null;
  transactionFeePayout: Partial<PayoutDestination> | null;
  lastVerifiedAt: string | null;
  updatedByEmail: string | null;
  updatedAt: string | null;
  auditLog: AuditEntry[];
};

type VerificationState = {
  open: boolean;
  challengeId: string;
  maskedPhone: string;
  deliveryMode: string;
  expiresAt: string;
  code: string;
  debugCode?: string;
};

type SchoolFeePolicyMode = "platform_default" | "custom" | "disabled";

type SchoolFeePolicyRecord = {
  id: string;
  name: string;
  status: string;
  paymentReady: boolean;
  transactionFeePolicy: {
    mode: SchoolFeePolicyMode;
    percent: number | null;
    capMinor: number | null;
    notes: string | null;
    updatedAt: string | null;
  };
  effectiveTransactionFee: {
    percent: number;
    capMinor: number | null;
  };
};

type SchoolFeeForm = {
  mode: SchoolFeePolicyMode;
  percent: string;
  capMinor: string;
  notes: string;
};

type SubscriptionTierRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMinor: number;
  billingCadence: "term" | "annual" | "monthly" | "custom";
  version?: number;
  studentLimit: number | null;
  provisional: boolean;
  active: boolean;
};

type SchoolSubscriptionRecord = {
  id: string;
  name: string;
  status: string;
  subscription: {
    id: string;
    tierId: string | null;
    status:
      | "draft"
      | "trial"
      | "trialing"
      | "pilot"
      | "active"
      | "past_due"
      | "grace"
      | "restricted_read_only"
      | "suspended"
      | "cancelled"
      | "expired"
      | "archived";
    lifecycleMode: "trial" | "pilot" | "paid" | "custom" | null;
    billingCadence: "term" | "annual" | "monthly" | "custom" | null;
    startsAt: string | null;
    endsAt: string | null;
    trialEndsAt: string | null;
    basePriceMinor: number;
    manualPriceOverrideMinor: number | null;
    discountMode: "none" | "percent" | "fixed";
    discountValue: number | null;
    effectivePriceMinor: number;
    note: string | null;
    pilotEndsAt: string | null;
    gracePeriodEndsAt: string | null;
    usageResetPolicy: "term" | "annual" | "custom" | null;
    updatedAt: string | null;
  } | null;
};

type SubscriptionForm = {
  tierId: string;
  status: NonNullable<SchoolSubscriptionRecord["subscription"]>["status"];
  billingCadence: "term" | "annual" | "monthly" | "custom" | "";
  startsAt: string;
  endsAt: string;
  trialStartsAt: string;
  trialEndsAt: string;
  pilotStartsAt: string;
  manualPriceOverrideMinor: string;
  discountMode: "none" | "percent" | "fixed";
  discountValue: string;
  note: string;
  pilotEndsAt: string;
  gracePeriodEndsAt: string;
  usageResetPolicy: "term" | "annual" | "custom" | "";
};

type SubscriptionDateField =
  | "startsAt"
  | "endsAt"
  | "trialStartsAt"
  | "trialEndsAt"
  | "pilotStartsAt"
  | "pilotEndsAt"
  | "gracePeriodEndsAt";

function dateStringToDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateToDateString(date: Date | null): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lifecycleModeFromStatus(
  status: SubscriptionForm["status"]
): "trial" | "pilot" | "paid" | null {
  if (status === "trial" || status === "trialing") return "trial";
  if (status === "pilot") return "pilot";
  if (
    status === "active" ||
    status === "past_due" ||
    status === "grace" ||
    status === "restricted_read_only" ||
    status === "suspended" ||
    status === "expired"
  ) {
    return "paid";
  }
  return null;
}

function emptyDestination(): PayoutDestination {
  return {
    method: "bank",
    accountName: "",
    accountNumber: "",
    bankName: "",
    bankCode: "",
    providerName: "",
    notes: "",
  };
}

function normalizeDestination(
  input: Partial<PayoutDestination> | null | undefined
): PayoutDestination {
  return {
    method:
      input?.method === "mobile_money" ? "mobile_money" : ("bank" as PayoutMethod),
    accountName: input?.accountName || "",
    accountNumber: input?.accountNumber || "",
    bankName: input?.bankName || "",
    bankCode: input?.bankCode || "",
    providerName: input?.providerName || "",
    notes: input?.notes || "",
  };
}

function serializeDestination(input: PayoutDestination) {
  return {
    method: input.method,
    accountName: input.accountName.trim(),
    accountNumber: input.accountNumber.trim(),
    bankName: input.bankName.trim() || null,
    bankCode: input.bankCode.trim() || null,
    providerName: input.providerName.trim() || null,
    notes: input.notes.trim() || null,
  };
}

function schoolFeeFormFromPolicy(
  policy: SchoolFeePolicyRecord | null
): SchoolFeeForm {
  return {
    mode: policy?.transactionFeePolicy.mode || "platform_default",
    percent:
      typeof policy?.transactionFeePolicy.percent === "number"
        ? String(policy.transactionFeePolicy.percent)
        : "",
    capMinor:
      typeof policy?.transactionFeePolicy.capMinor === "number"
        ? String(policy.transactionFeePolicy.capMinor)
        : "",
    notes: policy?.transactionFeePolicy.notes || "",
  };
}

function subscriptionFormFromRecord(
  record: SchoolSubscriptionRecord | null,
  tiers: SubscriptionTierRecord[]
): SubscriptionForm {
  const currentTierIsAssignable = tiers.some(
    (tier) => tier.id === record?.subscription?.tierId
  );

  return {
    tierId:
      currentTierIsAssignable && record?.subscription?.tierId
        ? record.subscription.tierId
        : tiers[0]?.id || "",
    status: record?.subscription?.status || "draft",
    billingCadence:
      record?.subscription?.billingCadence || tiers[0]?.billingCadence || "",
    startsAt: record?.subscription?.startsAt || "",
    endsAt: record?.subscription?.endsAt || "",
    trialStartsAt: "",
    trialEndsAt: record?.subscription?.trialEndsAt || "",
    pilotStartsAt: "",
    manualPriceOverrideMinor:
      typeof record?.subscription?.manualPriceOverrideMinor === "number"
        ? String(record.subscription.manualPriceOverrideMinor)
        : "",
    discountMode: record?.subscription?.discountMode || "none",
    discountValue:
      typeof record?.subscription?.discountValue === "number"
        ? String(record.subscription.discountValue)
        : "",
    note: record?.subscription?.note || "",
    pilotEndsAt: record?.subscription?.pilotEndsAt || "",
    gracePeriodEndsAt: record?.subscription?.gracePeriodEndsAt || "",
    usageResetPolicy: record?.subscription?.usageResetPolicy || "",
  };
}

function PayoutSection({
  title,
  description,
  icon: Icon,
  value,
  onChange,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  value: PayoutDestination;
  onChange: (next: PayoutDestination) => void;
}) {
  const setField = <K extends keyof PayoutDestination>(
    field: K,
    nextValue: PayoutDestination[K]
  ) => {
    onChange({ ...value, [field]: nextValue });
  };

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <Icon className="h-4 w-4 text-white/70" />
          </span>
          {title}
        </CardTitle>
        <p className="text-sm text-white/60">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-white/50">
            Payout Method
          </label>
          <Select
            value={value.method}
            onValueChange={(next) => setField("method", next as PayoutMethod)}
          >
            <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
              <SelectValue placeholder="Select payout method" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-slate-950 text-white">
              <SelectItem value="bank">Bank Account</SelectItem>
              <SelectItem value="mobile_money">Mobile Money</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white/50">
              Account Name
            </label>
            <Input
              value={value.accountName}
              onChange={(event) => setField("accountName", event.target.value)}
              className="border-white/10 bg-white/5 text-white"
              placeholder="EduSentrix Ltd"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white/50">
              {value.method === "bank" ? "Account Number" : "Phone Number"}
            </label>
            <Input
              value={value.accountNumber}
              onChange={(event) => setField("accountNumber", event.target.value)}
              className="border-white/10 bg-white/5 text-white"
              placeholder={value.method === "bank" ? "0123456789" : "233xxxxxxxxx"}
            />
          </div>
        </div>

        {value.method === "bank" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                Bank Name
              </label>
              <Input
                value={value.bankName}
                onChange={(event) => setField("bankName", event.target.value)}
                className="border-white/10 bg-white/5 text-white"
                placeholder="Bank name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                Bank Code
              </label>
              <Input
                value={value.bankCode}
                onChange={(event) => setField("bankCode", event.target.value)}
                className="border-white/10 bg-white/5 text-white"
                placeholder="Optional routing code"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-white/50">
              Provider Name
            </label>
            <Input
              value={value.providerName}
              onChange={(event) => setField("providerName", event.target.value)}
              className="border-white/10 bg-white/5 text-white"
              placeholder="MTN MoMo, Telecel Cash, AirtelTigo Money"
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-white/50">
            Internal Notes
          </label>
          <Textarea
            value={value.notes}
            onChange={(event) => setField("notes", event.target.value)}
            className="border-white/10 bg-white/5 text-white"
            placeholder="Why this destination exists, who reconciles it, or any settlement note."
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlatformBillingPage() {
  const [loading, setLoading] = React.useState(true);
  const [schoolPoliciesLoading, setSchoolPoliciesLoading] = React.useState(true);
  const [subscriptionLoading, setSubscriptionLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [schoolFeeSaving, setSchoolFeeSaving] = React.useState(false);
  const [subscriptionSaving, setSubscriptionSaving] = React.useState(false);
  const [subscriptionPayout, setSubscriptionPayout] = React.useState<PayoutDestination>(
    emptyDestination()
  );
  const [transactionFeePayout, setTransactionFeePayout] =
    React.useState<PayoutDestination>(emptyDestination());
  const [changeNote, setChangeNote] = React.useState("");
  const [settingsMeta, setSettingsMeta] = React.useState<{
    lastVerifiedAt: string | null;
    updatedAt: string | null;
    updatedByEmail: string | null;
    auditLog: AuditEntry[];
  }>({
    lastVerifiedAt: null,
    updatedAt: null,
    updatedByEmail: null,
    auditLog: [],
  });
  const [verification, setVerification] = React.useState<VerificationState>({
    open: false,
    challengeId: "",
    maskedPhone: "",
    deliveryMode: "",
    expiresAt: "",
    code: "",
  });
  const [platformDefaultFee, setPlatformDefaultFee] = React.useState<{
    percent: number;
    capMinor: number | null;
  }>({
    percent: 0,
    capMinor: null,
  });
  const [schoolPolicies, setSchoolPolicies] = React.useState<
    SchoolFeePolicyRecord[]
  >([]);
  const [selectedSchoolId, setSelectedSchoolId] = React.useState("");
  const [schoolFeeForm, setSchoolFeeForm] = React.useState<SchoolFeeForm>({
    mode: "platform_default",
    percent: "",
    capMinor: "",
    notes: "",
  });
  const [subscriptionTiers, setSubscriptionTiers] = React.useState<
    SubscriptionTierRecord[]
  >([]);
  const [schoolSubscriptions, setSchoolSubscriptions] = React.useState<
    SchoolSubscriptionRecord[]
  >([]);
  const [selectedSubscriptionSchoolId, setSelectedSubscriptionSchoolId] =
    React.useState("");
  const [subscriptionForm, setSubscriptionForm] = React.useState<SubscriptionForm>(
    {
      tierId: "",
      status: "draft",
      billingCadence: "",
      startsAt: "",
      endsAt: "",
      trialStartsAt: "",
      trialEndsAt: "",
      pilotStartsAt: "",
      manualPriceOverrideMinor: "",
      discountMode: "none",
      discountValue: "",
      note: "",
      pilotEndsAt: "",
      gracePeriodEndsAt: "",
      usageResetPolicy: "",
    }
  );

  const loadSettings = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/platform/billing/payout-settings", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load payout settings");
      }

      const data = json.data as BillingSettingsResponse;
      setSubscriptionPayout(normalizeDestination(data.subscriptionPayout));
      setTransactionFeePayout(normalizeDestination(data.transactionFeePayout));
      setSettingsMeta({
        lastVerifiedAt: data.lastVerifiedAt,
        updatedAt: data.updatedAt,
        updatedByEmail: data.updatedByEmail,
        auditLog: Array.isArray(data.auditLog) ? data.auditLog : [],
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load payout settings"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const loadSchoolPolicies = React.useCallback(async () => {
    try {
      setSchoolPoliciesLoading(true);
      const res = await fetch("/api/platform/billing/school-fees", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load school fee policies");
      }

      const schools = Array.isArray(json.data?.schools)
        ? (json.data.schools as SchoolFeePolicyRecord[])
        : [];
      setPlatformDefaultFee({
        percent: Number(json.data?.platformDefault?.percent || 0),
        capMinor:
          typeof json.data?.platformDefault?.capMinor === "number"
            ? Number(json.data.platformDefault.capMinor)
            : null,
      });
      setSchoolPolicies(schools);
      setSelectedSchoolId((current) => {
        if (current && schools.some((school) => school.id === current)) {
          return current;
        }
        return schools[0]?.id || "";
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load school fee policies"
      );
    } finally {
      setSchoolPoliciesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSchoolPolicies();
  }, [loadSchoolPolicies]);

  const loadSubscriptions = React.useCallback(async () => {
    try {
      setSubscriptionLoading(true);
      const res = await fetch("/api/platform/billing/subscriptions", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load subscriptions");
      }

      const tiers = Array.isArray(json.data?.tiers)
        ? (json.data.tiers as SubscriptionTierRecord[])
        : [];
      const schools = Array.isArray(json.data?.schools)
        ? (json.data.schools as SchoolSubscriptionRecord[])
        : [];

      setSubscriptionTiers(tiers);
      setSchoolSubscriptions(schools);
      setSelectedSubscriptionSchoolId((current) => {
        if (current && schools.some((school) => school.id === current)) {
          return current;
        }
        return schools[0]?.id || "";
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load subscriptions"
      );
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  const selectedSchool = React.useMemo(
    () => schoolPolicies.find((school) => school.id === selectedSchoolId) || null,
    [schoolPolicies, selectedSchoolId]
  );

  const selectedSubscriptionSchool = React.useMemo(
    () =>
      schoolSubscriptions.find((school) => school.id === selectedSubscriptionSchoolId) ||
      null,
    [schoolSubscriptions, selectedSubscriptionSchoolId]
  );

  const selectedSubscriptionTier = React.useMemo(
    () => subscriptionTiers.find((tier) => tier.id === subscriptionForm.tierId) || null,
    [subscriptionForm.tierId, subscriptionTiers]
  );

  React.useEffect(() => {
    setSchoolFeeForm(schoolFeeFormFromPolicy(selectedSchool));
  }, [selectedSchool]);

  React.useEffect(() => {
    setSubscriptionForm(
      subscriptionFormFromRecord(selectedSubscriptionSchool, subscriptionTiers)
    );
  }, [selectedSubscriptionSchool, subscriptionTiers]);

  const subscriptionPricingPreview = React.useMemo(() => {
    if (!selectedSubscriptionTier) return null;

    const manualPriceOverrideMinor =
      subscriptionForm.manualPriceOverrideMinor.trim() === ""
        ? null
        : Number(subscriptionForm.manualPriceOverrideMinor.trim());
    const discountValue =
      subscriptionForm.discountValue.trim() === ""
        ? null
        : Number(subscriptionForm.discountValue.trim());

    return computeSubscriptionPricing({
      basePriceMinor: selectedSubscriptionTier.priceMinor,
      manualPriceOverrideMinor,
      discountMode: subscriptionForm.discountMode,
      discountValue,
    });
  }, [selectedSubscriptionTier, subscriptionForm]);

  const setSubscriptionDateField = React.useCallback(
    (field: SubscriptionDateField, date: Date | null) => {
      setSubscriptionForm((current) => ({
        ...current,
        [field]: dateToDateString(date),
      }));
    },
    []
  );

  const requestVerification = React.useCallback(async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/platform/billing/payout-settings/challenge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriptionPayout: serializeDestination(subscriptionPayout),
          transactionFeePayout: serializeDestination(transactionFeePayout),
          changeNote: changeNote.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to start verification");
      }

      setVerification({
        open: true,
        challengeId: String(json.data?.challengeId || ""),
        maskedPhone: String(json.data?.maskedPhone || ""),
        deliveryMode: String(json.data?.deliveryMode || ""),
        expiresAt: String(json.data?.expiresAt || ""),
        code: "",
        debugCode:
          typeof json.data?.debugCode === "string" ? json.data.debugCode : undefined,
      });
      toast.success("Verification code sent to the platform admin phone.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start verification"
      );
    } finally {
      setSaving(false);
    }
  }, [changeNote, subscriptionPayout, transactionFeePayout]);

  const confirmVerification = React.useCallback(async () => {
    try {
      setVerifying(true);
      const res = await fetch("/api/platform/billing/payout-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengeId: verification.challengeId,
          code: verification.code.trim(),
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Verification failed");
      }

      const data = json.data as BillingSettingsResponse;
      setSubscriptionPayout(normalizeDestination(data.subscriptionPayout));
      setTransactionFeePayout(normalizeDestination(data.transactionFeePayout));
      setSettingsMeta({
        lastVerifiedAt: data.lastVerifiedAt,
        updatedAt: data.updatedAt,
        updatedByEmail: data.updatedByEmail,
        auditLog: Array.isArray(data.auditLog) ? data.auditLog : [],
      });
      setVerification((current) => ({
        ...current,
        open: false,
        code: "",
      }));
      setChangeNote("");
      toast.success("Payout routing updated successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }, [verification.challengeId, verification.code]);

  const saveSchoolFeePolicy = React.useCallback(async () => {
    if (!selectedSchool) return;

    try {
      setSchoolFeeSaving(true);
      const percentValue =
        schoolFeeForm.percent.trim() === ""
          ? null
          : Number(schoolFeeForm.percent.trim());
      const capMinorValue =
        schoolFeeForm.capMinor.trim() === ""
          ? null
          : Number(schoolFeeForm.capMinor.trim());

      const res = await fetch(
        `/api/platform/billing/school-fees/${encodeURIComponent(selectedSchool.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: schoolFeeForm.mode,
            percent: percentValue,
            capMinor: capMinorValue,
            notes: schoolFeeForm.notes.trim() || null,
          }),
        }
      );

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to update school fee policy");
      }

      const updated = json.data as {
        id: string;
        transactionFeePolicy: SchoolFeePolicyRecord["transactionFeePolicy"];
        effectiveTransactionFee: SchoolFeePolicyRecord["effectiveTransactionFee"];
      };

      setSchoolPolicies((current) =>
        current.map((school) =>
          school.id === updated.id
            ? {
                ...school,
                transactionFeePolicy: updated.transactionFeePolicy,
                effectiveTransactionFee: updated.effectiveTransactionFee,
              }
            : school
        )
      );
      toast.success(`Updated transaction fee policy for ${selectedSchool.name}.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update school fee policy"
      );
    } finally {
      setSchoolFeeSaving(false);
    }
  }, [schoolFeeForm, selectedSchool]);

  const saveSchoolSubscription = React.useCallback(async () => {
    if (!selectedSubscriptionSchool || !subscriptionForm.tierId) return;

    try {
      setSubscriptionSaving(true);
      const manualPriceOverrideMinor =
        subscriptionForm.manualPriceOverrideMinor.trim() === ""
          ? null
          : Number(subscriptionForm.manualPriceOverrideMinor.trim());
      const discountValue =
        subscriptionForm.discountValue.trim() === ""
          ? null
          : Number(subscriptionForm.discountValue.trim());

      const res = await fetch(
        `/api/platform/billing/subscriptions/${encodeURIComponent(
          selectedSubscriptionSchool.id
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tierId: subscriptionForm.tierId,
            status: subscriptionForm.status,
            lifecycleMode: lifecycleModeFromStatus(subscriptionForm.status),
            billingCadence: subscriptionForm.billingCadence || null,
            startsAt: subscriptionForm.startsAt.trim() || null,
            endsAt: subscriptionForm.endsAt.trim() || null,
            trialStartsAt: subscriptionForm.trialStartsAt.trim() || null,
            trialEndsAt: subscriptionForm.trialEndsAt.trim() || null,
            pilotStartsAt: subscriptionForm.pilotStartsAt.trim() || null,
            manualPriceOverrideMinor,
            discountMode: subscriptionForm.discountMode,
            discountValue,
            note: subscriptionForm.note.trim() || null,
            pilotEndsAt: subscriptionForm.pilotEndsAt.trim() || null,
            gracePeriodEndsAt:
              subscriptionForm.gracePeriodEndsAt.trim() || null,
            usageResetPolicy: subscriptionForm.usageResetPolicy || null,
          }),
        }
      );

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to update subscription");
      }

      const updated = json.data as {
        schoolId: string;
        tierId: string;
        status: SubscriptionForm["status"];
        lifecycleMode: "trial" | "pilot" | "paid" | null;
        billingCadence: SubscriptionForm["billingCadence"] | null;
        startsAt: string | null;
        endsAt: string | null;
        trialEndsAt: string | null;
        basePriceMinor: number;
        manualPriceOverrideMinor: number | null;
        discountMode: "none" | "percent" | "fixed";
        discountValue: number | null;
        effectivePriceMinor: number;
        note: string | null;
        pilotEndsAt: string | null;
        gracePeriodEndsAt: string | null;
        updatedAt: string | null;
      };

      setSchoolSubscriptions((current) =>
        current.map((school) =>
          school.id === updated.schoolId
            ? {
                ...school,
                subscription: {
                  id: school.subscription?.id || `${school.id}-subscription`,
                  tierId: updated.tierId,
                  status: updated.status,
                  lifecycleMode: updated.lifecycleMode || null,
                  billingCadence: updated.billingCadence || null,
                  startsAt: updated.startsAt,
                  endsAt: updated.endsAt,
                  trialEndsAt: updated.trialEndsAt,
                  basePriceMinor: updated.basePriceMinor,
                  manualPriceOverrideMinor: updated.manualPriceOverrideMinor,
                  discountMode: updated.discountMode,
                  discountValue: updated.discountValue,
                  effectivePriceMinor: updated.effectivePriceMinor,
                  note: updated.note,
                  pilotEndsAt: updated.pilotEndsAt,
                  gracePeriodEndsAt: updated.gracePeriodEndsAt,
                  usageResetPolicy: subscriptionForm.usageResetPolicy || null,
                  updatedAt: updated.updatedAt,
                },
              }
            : school
        )
      );
      toast.success(`Updated subscription for ${selectedSubscriptionSchool.name}.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update subscription"
      );
    } finally {
      setSubscriptionSaving(false);
    }
  }, [selectedSubscriptionSchool, subscriptionForm]);

  return (
    <div className="space-y-6 p-2 md:p-4">
      <Dialog
        open={verification.open}
        onOpenChange={(open) => {
          if (!verifying) {
            setVerification((current) => ({ ...current, open }));
          }
        }}
      >
        <DialogContent className="max-w-lg border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white">
          <DialogHeader>
            <DialogTitle>Verify Payout Account Change</DialogTitle>
            <DialogDescription className="text-white/60">
              Enter the one-time code sent to {verification.maskedPhone}. This
              verification is required before payout routing can be changed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              <div className="flex items-center gap-2 text-white">
                <Smartphone className="h-4 w-4 text-emerald-300" />
                Phone verification required
              </div>
              <p className="mt-2">
                Delivery mode:{" "}
                <span className="font-medium text-white">
                  {verification.deliveryMode || "whatsapp"}
                </span>
              </p>
              {verification.expiresAt ? (
                <p className="mt-1">
                  Code expires at{" "}
                  <span className="font-medium text-white">
                    {format(new Date(verification.expiresAt), "MMM d, yyyy h:mm a")}
                  </span>
                </p>
              ) : null}
            </div>

            {verification.debugCode ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <p className="font-medium text-amber-200">Development Code</p>
                <p className="mt-1">
                  Local transport is stubbed. Use <span className="font-mono">{verification.debugCode}</span> to complete verification.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                Verification Code
              </label>
              <Input
                value={verification.code}
                onChange={(event) =>
                  setVerification((current) => ({
                    ...current,
                    code: event.target.value.replace(/\D/g, "").slice(0, 6),
                  }))
                }
                className="border-white/10 bg-white/5 text-white"
                placeholder="Enter 6-digit code"
                inputMode="numeric"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              disabled={verifying}
              onClick={() =>
                setVerification((current) => ({
                  ...current,
                  open: false,
                  code: "",
                }))
              }
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={verifying || verification.code.trim().length !== 6}
              onClick={confirmVerification}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying
                </>
              ) : (
                "Verify and Apply"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-3">
        <Button asChild className="bg-cyan-600 text-white hover:bg-cyan-700">
          <Link href="/platform/billing/tiers">Manage Tiers</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="border border-white/10 text-white/70 hover:text-white"
        >
          <Link href="/platform/billing/events">View Timeline</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="border border-white/10 text-white/70 hover:text-white"
        >
          <Link href="/platform/billing/sync">Provider Sync</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="border border-white/10 text-white/70 hover:text-white"
        >
          <Link href="/platform/billing/usage">Usage Attribution</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="border border-white/10 text-white/70 hover:text-white"
        >
          <Link href="/platform/billing/costs">Cost Ledger</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="border border-white/10 text-white/70 hover:text-white"
        >
          <Link href="/platform/billing/revenue">Revenue Analytics</Link>
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-4">
          <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
                  <ShieldCheck className="h-5 w-5 text-emerald-300" />
                </span>
                Platform Billing Controls
              </CardTitle>
              <p className="text-sm text-white/60">
                Manage where subscription revenue and EduSentrix transaction fee
                revenue are paid out. Any change requires a phone-based
                verification challenge.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100/80">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div className="space-y-1">
                    <p className="font-medium text-amber-200">
                      High-risk financial configuration
                    </p>
                    <p>
                      These destinations control real money movement. Subscription
                      revenue and platform transaction fees are routed
                      independently, and changes are blocked until the platform
                      admin verifies with a one-time code sent to the admin phone.
                    </p>
                  </div>
                </div>
              </div>

              <PayoutSection
                title="Subscription Fee Payout"
                description="Subscription charges paid by schools are routed here."
                icon={Landmark}
                value={subscriptionPayout}
                onChange={setSubscriptionPayout}
              />

              <PayoutSection
                title="Transaction Fee Payout"
                description="EduSentrix transaction fees collected on payment flows are routed here."
                icon={Wallet}
                value={transactionFeePayout}
                onChange={setTransactionFeePayout}
              />

              <Card className="border-white/10 bg-white/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-white">
                    Change Note
                  </CardTitle>
                  <p className="text-sm text-white/60">
                    Add an internal reason for this payout routing change.
                  </p>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={changeNote}
                    onChange={(event) => setChangeNote(event.target.value)}
                    className="border-white/10 bg-white/5 text-white"
                    placeholder="Example: moving transaction fees to the primary treasury MoMo account after pilot review."
                  />
                </CardContent>
              </Card>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-white/60">
                  Saving these changes will send a verification code to the
                  platform admin phone number on file.
                </div>
                <Button
                  type="button"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={requestVerification}
                  disabled={loading || saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Code
                    </>
                  ) : (
                    "Request Verification Code"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/70">
              <div className="flex items-center gap-2 text-emerald-200">
                <BadgeCheck className="h-4 w-4" />
                2FA required for payout changes
              </div>
              <div>
                <span className="text-white/50">Last verified change:</span>{" "}
                <span className="text-white">
                  {settingsMeta.lastVerifiedAt
                    ? format(new Date(settingsMeta.lastVerifiedAt), "MMM d, yyyy h:mm a")
                    : "Not set yet"}
                </span>
              </div>
              <div>
                <span className="text-white/50">Last updated by:</span>{" "}
                <span className="text-white">
                  {settingsMeta.updatedByEmail || "Not available"}
                </span>
              </div>
              <div>
                <span className="text-white/50">Settings loaded:</span>{" "}
                <span className={cn("text-white", loading && "opacity-60")}>
                  {loading ? "Loading..." : "Ready"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent Audit Trail</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white"
                onClick={() => void loadSettings()}
              >
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading audit trail
                </div>
              ) : settingsMeta.auditLog.length > 0 ? (
                settingsMeta.auditLog.map((entry, index) => (
                  <div
                    key={`${entry.changedAt || "entry"}-${index}`}
                    className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm"
                  >
                    <p className="font-medium text-white">
                      {entry.summary || "Payout routing updated"}
                    </p>
                    <p className="mt-1 text-white/50">
                      {entry.changedAt
                        ? format(new Date(entry.changedAt), "MMM d, yyyy h:mm a")
                        : "Unknown time"}
                      {entry.changedByEmail ? ` • ${entry.changedByEmail}` : ""}
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-white/60">
                      <p>
                        Subscription payout:{" "}
                        <span className="text-white/80">
                          {entry.subscriptionPayoutMasked || "not set"}
                        </span>
                      </p>
                      <p>
                        Transaction fee payout:{" "}
                        <span className="text-white/80">
                          {entry.transactionFeePayoutMasked || "not set"}
                        </span>
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/60">
                  No verified payout changes yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
              <Building2 className="h-5 w-5 text-cyan-300" />
            </span>
            School Transaction Fee Policies
          </CardTitle>
          <p className="text-sm text-white/60">
            Override the platform transaction fee per school. This directly
            controls the EduSentrix fee charged during parent fee checkout for
            that school.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            <p className="font-medium text-white">Platform default fee</p>
            <p className="mt-1 text-white/65">
              {platformDefaultFee.percent}%{" "}
              {platformDefaultFee.capMinor !== null
                ? `with a cap of ${formatMoney(platformDefaultFee.capMinor)}`
                : "with no cap"}
            </p>
          </div>

          {schoolPoliciesLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading school fee policies
            </div>
          ) : schoolPolicies.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              No schools found yet.
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[0.65fr_1.35fr]">
              <Card className="border-white/10 bg-white/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-white">
                    Select School
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select
                    value={selectedSchoolId}
                    onValueChange={(value) => setSelectedSchoolId(value)}
                  >
                    <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder="Choose a school" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-950 text-white">
                      {schoolPolicies.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedSchool ? (
                    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                      <p className="font-medium text-white">{selectedSchool.name}</p>
                      <p className="text-white/60">
                        Status: {selectedSchool.status}
                      </p>
                      <p
                        className={cn(
                          "text-white/60",
                          !selectedSchool.paymentReady && "text-amber-200"
                        )}
                      >
                        {selectedSchool.paymentReady
                          ? "Online payments configured"
                          : "No Paystack subaccount configured yet"}
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-white">
                    Fee Policy
                  </CardTitle>
                  <p className="text-sm text-white/60">
                    Choose whether this school inherits the platform default,
                    uses a custom fee, or pays no EduSentrix transaction fee.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                        Policy Mode
                      </label>
                      <Select
                        value={schoolFeeForm.mode}
                        onValueChange={(value) =>
                          setSchoolFeeForm((current) => ({
                            ...current,
                            mode: value as SchoolFeePolicyMode,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-slate-950 text-white">
                          <SelectItem value="platform_default">
                            Platform Default
                          </SelectItem>
                          <SelectItem value="custom">Custom Fee</SelectItem>
                          <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                        Effective Fee
                      </label>
                      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
                        {schoolFeeForm.mode === "platform_default"
                          ? `${platformDefaultFee.percent}% ${
                              platformDefaultFee.capMinor !== null
                                ? `(cap ${formatMoney(platformDefaultFee.capMinor)})`
                                : "(no cap)"
                            }`
                          : schoolFeeForm.mode === "disabled"
                          ? "0% (disabled)"
                          : `${schoolFeeForm.percent || "0"}% ${
                              schoolFeeForm.capMinor.trim()
                                ? `(cap ${formatMoney(
                                    Number(schoolFeeForm.capMinor || 0)
                                  )})`
                                : "(no cap)"
                            }`}
                      </div>
                    </div>
                  </div>

                  {schoolFeeForm.mode === "custom" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                          Fee Percent
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={schoolFeeForm.percent}
                          onChange={(event) =>
                            setSchoolFeeForm((current) => ({
                              ...current,
                              percent: event.target.value,
                            }))
                          }
                          className="border-white/10 bg-white/5 text-white"
                          placeholder="2.50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                          Cap (minor units)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={schoolFeeForm.capMinor}
                          onChange={(event) =>
                            setSchoolFeeForm((current) => ({
                              ...current,
                              capMinor: event.target.value,
                            }))
                          }
                          className="border-white/10 bg-white/5 text-white"
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                      Internal Notes
                    </label>
                    <Textarea
                      value={schoolFeeForm.notes}
                      onChange={(event) =>
                        setSchoolFeeForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      className="border-white/10 bg-white/5 text-white"
                      placeholder="Why this school is on a custom fee arrangement."
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-white/60">
                      {selectedSchool?.transactionFeePolicy.updatedAt
                        ? `Last updated ${format(
                            new Date(selectedSchool.transactionFeePolicy.updatedAt),
                            "MMM d, yyyy h:mm a"
                          )}`
                        : "No school-specific update recorded yet."}
                    </div>
                    <Button
                      type="button"
                      className="bg-cyan-600 text-white hover:bg-cyan-700"
                      disabled={!selectedSchool || schoolFeeSaving}
                      onClick={saveSchoolFeePolicy}
                    >
                      {schoolFeeSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving Policy
                        </>
                      ) : (
                        "Save School Fee Policy"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-linear-to-br from-slate-900 via-slate-950 to-black text-white shadow-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
              <BadgeCheck className="h-5 w-5 text-emerald-300" />
            </span>
            School Subscription Controls
          </CardTitle>
          <p className="text-sm text-white/60">
            Assign provisional pilot tiers, apply manual price overrides, and
            apply school-specific subscription discounts. These controls only
            affect subscription pricing. Transaction fees remain separate.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {subscriptionLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading subscription controls
            </div>
          ) : schoolSubscriptions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
              No schools available for subscription assignment yet.
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
              <Card className="border-white/10 bg-white/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-white">
                    Select School
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select
                    value={selectedSubscriptionSchoolId}
                    onValueChange={(value) => setSelectedSubscriptionSchoolId(value)}
                  >
                    <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder="Choose a school" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-slate-950 text-white">
                      {schoolSubscriptions.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedSubscriptionSchool ? (
                    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                      <p className="font-medium text-white">
                        {selectedSubscriptionSchool.name}
                      </p>
                      <p className="text-white/60">
                        School status: {selectedSubscriptionSchool.status}
                      </p>
                      <p className="text-white/60">
                        Current subscription status:{" "}
                        {selectedSubscriptionSchool.subscription?.status || "not assigned"}
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100/80">
                    <p className="font-medium text-amber-200">Pilot tiers only</p>
                    <p className="mt-1">
                      These subscription tiers are temporary and should be
                      reviewed after the pilot closes with real usage and cost
                      data.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-white">
                    Subscription Details
                  </CardTitle>
                  <p className="text-sm text-white/60">
                    Choose a tier, then apply an override and discount if the
                    school needs a negotiated pilot arrangement.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                        Subscription Tier
                      </label>
                      <Select
                        value={subscriptionForm.tierId}
                        onValueChange={(value) =>
                          setSubscriptionForm((current) => ({
                            ...current,
                            tierId: value,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                          <SelectValue placeholder="Select a tier" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-slate-950 text-white">
                          {subscriptionTiers.map((tier) => (
                            <SelectItem key={tier.id} value={tier.id}>
                              {tier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                        Subscription Status
                      </label>
                      <Select
                        value={subscriptionForm.status}
                        onValueChange={(value) =>
                          setSubscriptionForm((current) => ({
                            ...current,
                            status: value as SubscriptionForm["status"],
                          }))
                        }
                      >
                        <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-slate-950 text-white">
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="trialing">Trialing</SelectItem>
                          <SelectItem value="pilot">Pilot</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="past_due">Past Due</SelectItem>
                          <SelectItem value="grace">Grace</SelectItem>
                          <SelectItem value="restricted_read_only">Read Only</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                        Billing Cadence
                      </label>
                      <Select
                        value={subscriptionForm.billingCadence || "none"}
                        onValueChange={(value) =>
                          setSubscriptionForm((current) => ({
                            ...current,
                            billingCadence:
                              value === "none"
                                ? ""
                                : (value as SubscriptionForm["billingCadence"]),
                          }))
                        }
                      >
                        <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                          <SelectValue placeholder="Select cadence" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-slate-950 text-white">
                          <SelectItem value="none">Use tier default</SelectItem>
                          <SelectItem value="term">Term</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                        Usage Reset Policy
                      </label>
                      <Select
                        value={subscriptionForm.usageResetPolicy || "none"}
                        onValueChange={(value) =>
                          setSubscriptionForm((current) => ({
                            ...current,
                            usageResetPolicy:
                              value === "none"
                                ? ""
                                : (value as SubscriptionForm["usageResetPolicy"]),
                          }))
                        }
                      >
                        <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                          <SelectValue placeholder="Select reset policy" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-slate-950 text-white">
                          <SelectItem value="none">Not set</SelectItem>
                          <SelectItem value="term">Term</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selectedSubscriptionTier ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                      <p className="font-medium text-white">
                        {selectedSubscriptionTier.name}
                      </p>
                      <p className="mt-1 text-white/60">
                        {selectedSubscriptionTier.description || "No tier description set."}
                      </p>
                      <p className="mt-2 text-white/70">
                        Base {selectedSubscriptionTier.billingCadence} price:{" "}
                        <span className="font-medium text-white">
                          {formatMoney(selectedSubscriptionTier.priceMinor)}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-white/50">
                        Version {selectedSubscriptionTier.version || 1}
                      </p>
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-3">
                    <CustomDatePicker label="Starts On" value={dateStringToDate(subscriptionForm.startsAt)} onChange={(date) => setSubscriptionDateField("startsAt", date)} placeholder="Select start date" />
                    <CustomDatePicker label="Ends On" value={dateStringToDate(subscriptionForm.endsAt)} onChange={(date) => setSubscriptionDateField("endsAt", date)} placeholder="Select end date" />
                    <CustomDatePicker label="Grace Ends On" value={dateStringToDate(subscriptionForm.gracePeriodEndsAt)} onChange={(date) => setSubscriptionDateField("gracePeriodEndsAt", date)} placeholder="Select grace end date" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                        Manual Price Override (minor units)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={subscriptionForm.manualPriceOverrideMinor}
                        onChange={(event) =>
                          setSubscriptionForm((current) => ({
                            ...current,
                            manualPriceOverrideMinor: event.target.value,
                          }))
                        }
                        className="border-white/10 bg-white/5 text-white"
                        placeholder="Leave blank to use tier price"
                      />
                    </div>

                    <CustomDatePicker label="Pilot Ends On" value={dateStringToDate(subscriptionForm.pilotEndsAt)} onChange={(date) => setSubscriptionDateField("pilotEndsAt", date)} placeholder="Select pilot end date" />
                    <CustomDatePicker label="Trial Ends On" value={dateStringToDate(subscriptionForm.trialEndsAt)} onChange={(date) => setSubscriptionDateField("trialEndsAt", date)} placeholder="Select trial end date" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                        Discount Type
                      </label>
                      <Select
                        value={subscriptionForm.discountMode}
                        onValueChange={(value) =>
                          setSubscriptionForm((current) => ({
                            ...current,
                            discountMode: value as SubscriptionForm["discountMode"],
                          }))
                        }
                      >
                        <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                          <SelectValue placeholder="Select discount type" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-slate-950 text-white">
                          <SelectItem value="none">No Discount</SelectItem>
                          <SelectItem value="percent">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                        Discount Value
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step={subscriptionForm.discountMode === "percent" ? "0.01" : "1"}
                        value={subscriptionForm.discountValue}
                        onChange={(event) =>
                          setSubscriptionForm((current) => ({
                            ...current,
                            discountValue: event.target.value,
                          }))
                        }
                        className="border-white/10 bg-white/5 text-white"
                        placeholder={
                          subscriptionForm.discountMode === "percent"
                            ? "e.g. 15"
                            : subscriptionForm.discountMode === "fixed"
                            ? "Minor units"
                            : "No discount"
                        }
                        disabled={subscriptionForm.discountMode === "none"}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-white/50">
                      Internal Notes
                    </label>
                    <Textarea
                      value={subscriptionForm.note}
                      onChange={(event) =>
                        setSubscriptionForm((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                      className="border-white/10 bg-white/5 text-white"
                      placeholder="Why this school has a special subscription arrangement."
                    />
                  </div>

                  <Card className="border-white/10 bg-black/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-white">
                        Effective Price Preview
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {subscriptionPricingPreview ? (
                        <>
                          <div className="flex items-center justify-between gap-4 text-white/70">
                            <span>Tier base price</span>
                            <span className="text-white">
                              {formatMoney(
                                subscriptionPricingPreview.baseTierPriceMinor
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-white/70">
                            <span>Effective base after override</span>
                            <span className="text-white">
                              {formatMoney(
                                subscriptionPricingPreview.effectiveBasePriceMinor
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-white/70">
                            <span>Discount amount</span>
                            <span className="text-white">
                              {formatMoney(
                                subscriptionPricingPreview.discountAmountMinor
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-2 font-medium text-emerald-200">
                            <span>Final subscription price</span>
                            <span>
                              {formatMoney(subscriptionPricingPreview.finalPriceMinor)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="text-white/60">
                          Select a subscription tier to preview pricing.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-white/60">
                      Discounts reduce only the subscription price. They do not
                      affect the separate transaction fee configuration.
                    </div>
                    <Button
                      type="button"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={
                        !selectedSubscriptionSchool ||
                        !subscriptionForm.tierId ||
                        subscriptionSaving
                      }
                      onClick={saveSchoolSubscription}
                    >
                      {subscriptionSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving Subscription
                        </>
                      ) : (
                        "Save Subscription"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

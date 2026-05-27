"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  CreditCard,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { glassPanelClass, glassInsetClass, glassPrimaryButtonClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

type PolicyRow = {
  _id: string;
  scope: string;
  schoolId: string | null;
  category: string | null;
  chargeType: string;
  percentageBps: number | null;
  fixedFeeMinor: number | null;
  minChargeMinor: number | null;
  maxChargeMinor: number | null;
  payerMode: string;
  active: boolean;
  description: string | null;
  createdAt: string;
};

const PAYER_MODE_LABELS: Record<string, string> = {
  payer_pays: "Parent/payer pays",
  school_absorbs: "School absorbs",
  waived: "Waived",
};

const CATEGORY_LABELS: Record<string, string> = {
  school_fee: "School fees",
  admission_fee: "Admission fees",
  store_payment: "Store / order payments",
  learn_subscription: "Learn subscriptions",
  meeting_credit_purchase: "Meeting credits",
  leo_credit_purchase: "Leo AI credits",
  storage_addon_purchase: "Storage add-ons",
  event_or_trip_payment: "Event / trip payments",
  donation_or_fundraising: "Donations / fundraising",
};

const SCOPE_LABELS: Record<string, string> = {
  global: "Global default",
  school: "School default",
  category: "Category default",
  school_category: "School + category",
};

const SCOPE_TONE: Record<string, string> = {
  global: "border-teal-500/30 bg-teal-500/10 text-teal-200",
  school: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  category: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  school_category: "border-amber-500/30 bg-amber-500/10 text-amber-200",
};

function formatBps(bps: number | null) {
  if (bps === null) return "—";
  return `${(bps / 100).toFixed(2)}%`;
}

function formatGHSm(minor: number | null) {
  if (minor === null) return "—";
  return `GHS ${(minor / 100).toFixed(2)}`;
}

function rateLabel(p: PolicyRow) {
  if (p.payerMode === "waived") return "Waived";
  if (p.chargeType === "percentage") return formatBps(p.percentageBps);
  if (p.chargeType === "fixed") return formatGHSm(p.fixedFeeMinor);
  return `${formatBps(p.percentageBps)} + ${formatGHSm(p.fixedFeeMinor)}`;
}

export default function PaymentChargesPage() {
  const [policies, setPolicies] = React.useState<PolicyRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const [newScope, setNewScope] = React.useState("global");
  const [newCategory, setNewCategory] = React.useState("");
  const [newChargeType, setNewChargeType] = React.useState("percentage");
  const [newBps, setNewBps] = React.useState("120");
  const [newFixed, setNewFixed] = React.useState("");
  const [newMin, setNewMin] = React.useState("");
  const [newMax, setNewMax] = React.useState("");
  const [newPayerMode, setNewPayerMode] = React.useState("payer_pays");
  const [newDesc, setNewDesc] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/subscriptions/payment-charges?activeOnly=false");
      const json = await res.json();
      if (json.success) setPolicies(json.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function onCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        scope: newScope,
        chargeType: newChargeType,
        payerMode: newPayerMode,
        active: true,
        description: newDesc || null,
      };
      if (newCategory) body.category = newCategory;
      if (newBps) body.percentageBps = Math.round(parseFloat(newBps) * 100);
      if (newFixed) body.fixedFeeMinor = Math.round(parseFloat(newFixed) * 100);
      if (newMin) body.minChargeMinor = Math.round(parseFloat(newMin) * 100);
      if (newMax) body.maxChargeMinor = Math.round(parseFloat(newMax) * 100);

      const res = await fetch("/api/platform/subscriptions/payment-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Policy created.");
        setShowCreate(false);
        load();
      } else {
        toast.error(typeof json.error === "string" ? json.error : "Failed to create.");
      }
    } catch { toast.error("Network error."); }
    finally { setCreating(false); }
  }

  async function onToggle(id: string, active: boolean) {
    await fetch(`/api/platform/subscriptions/payment-charges/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    load();
  }

  async function onDelete(id: string) {
    await fetch(`/api/platform/subscriptions/payment-charges/${id}`, { method: "DELETE" });
    toast.success("Policy deactivated.");
    load();
  }

  const grouped = React.useMemo(() => {
    const order = ["global", "category", "school", "school_category"];
    return order
      .map((scope) => ({
        scope,
        items: policies.filter((p) => p.scope === scope),
      }))
      .filter((g) => g.items.length > 0);
  }, [policies]);

  return (
    <div className="space-y-5 p-2 md:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/platform/subscriptions" className="mb-1 flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70">
            <ChevronLeft className="h-3 w-3" /> Subscriptions
          </Link>
          <h1 className="text-xl font-semibold text-white">Payment charges</h1>
          <p className="text-xs text-white/40">
            Configure transaction fee policies for all payment categories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/40 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className={cn("inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium", glassPrimaryButtonClass)}
          >
            <Plus className="h-4 w-4" /> New policy
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className={cn(glassPanelClass, "px-5 py-4")}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
          <p className="mb-4 text-sm font-semibold text-white">New charge policy</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Scope</label>
              <select value={newScope} onChange={(e) => setNewScope(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none">
                {Object.entries(SCOPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Category (optional)</label>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none">
                <option value="">All categories</option>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Charge type</label>
              <select value={newChargeType} onChange={(e) => setNewChargeType(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none">
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed fee</option>
                <option value="hybrid">Percentage + Fixed</option>
              </select>
            </div>
            {(newChargeType === "percentage" || newChargeType === "hybrid") && (
              <div>
                <label className="block text-[10px] text-white/40 mb-1">Rate (%)</label>
                <input type="number" min="0" max="100" step="0.01" value={newBps}
                  onChange={(e) => setNewBps(e.target.value)}
                  placeholder="e.g. 1.20"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none" />
              </div>
            )}
            {(newChargeType === "fixed" || newChargeType === "hybrid") && (
              <div>
                <label className="block text-[10px] text-white/40 mb-1">Fixed fee (GHS)</label>
                <input type="number" min="0" step="0.01" value={newFixed}
                  onChange={(e) => setNewFixed(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none" />
              </div>
            )}
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Min charge (GHS)</label>
              <input type="number" min="0" step="0.01" value={newMin}
                onChange={(e) => setNewMin(e.target.value)}
                placeholder="Optional floor"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Max charge (GHS)</label>
              <input type="number" min="0" step="0.01" value={newMax}
                onChange={(e) => setNewMax(e.target.value)}
                placeholder="Optional cap"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Payer mode</label>
              <select value={newPayerMode} onChange={(e) => setNewPayerMode(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none">
                <option value="payer_pays">Parent / payer pays</option>
                <option value="school_absorbs">School absorbs</option>
                <option value="waived">Waived</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] text-white/40 mb-1">Description</label>
              <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Internal note…"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-white/20" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onCreate} disabled={creating}
              className={cn("inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium", glassPrimaryButtonClass, creating && "opacity-50 cursor-not-allowed")}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create policy
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/50 hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Policy groups */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-white/30" /></div>
      ) : grouped.length === 0 ? (
        <div className={cn(glassInsetClass, "flex items-center gap-3 px-5 py-8")}>
          <CreditCard className="h-5 w-5 text-white/20" />
          <div>
            <p className="text-sm text-white/50">No charge policies configured.</p>
            <p className="text-xs text-white/30">Create a global default to start applying transaction fees.</p>
          </div>
        </div>
      ) : grouped.map(({ scope, items }) => (
        <div key={scope}>
          <p className="mb-2 text-xs font-semibold text-white/40">{SCOPE_LABELS[scope]}</p>
          <div className={cn(glassPanelClass, "divide-y divide-white/5 px-0 py-0")}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
            {items.map((p) => (
              <div key={p._id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", SCOPE_TONE[p.scope] ?? "")}>
                    {SCOPE_LABELS[p.scope]}
                  </span>
                  {p.category && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50">
                      {CATEGORY_LABELS[p.category] ?? p.category}
                    </span>
                  )}
                  <span className="font-mono text-xs text-white/70">{rateLabel(p)}</span>
                  <span className="text-[10px] text-white/40">{PAYER_MODE_LABELS[p.payerMode]}</span>
                  {p.minChargeMinor ? <span className="text-[10px] text-white/30">min {formatGHSm(p.minChargeMinor)}</span> : null}
                  {p.maxChargeMinor ? <span className="text-[10px] text-white/30">cap {formatGHSm(p.maxChargeMinor)}</span> : null}
                  {p.description && <span className="text-[10px] text-white/25">— {p.description}</span>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={() => onToggle(p._id, !p.active)}
                    className={cn("rounded-full border p-1 transition", p.active
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/30"
                      : "border-white/10 bg-white/5 text-white/30 hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-500/30")}>
                    {p.active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => onDelete(p._id)}
                    className="rounded-full border border-white/10 bg-white/5 p-1 text-white/30 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  Plus,
  RefreshCw,
  ShoppingCart,
  Zap,
  HardDrive,
  Users,
  MessageCircle,
  MessageSquare,
  Tv,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { glassPanelClass, glassInsetClass, glassPrimaryButtonClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type PackageRow = {
  _id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  quantity: number;
  displayQuantity: number | null;
  displayUnit: string | null;
  priceMinor: number;
  active: boolean;
  availableToPlans: string[];
  expiresWithBillingPeriod: boolean;
  sortOrder: number;
};

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  leo_credits: Zap,
  meeting_participant_minutes: Tv,
  storage_bytes: HardDrive,
  learn_seats: Users,
  sms_credits: MessageCircle,
  whatsapp_credits: MessageSquare,
};

const TYPE_LABEL: Record<string, string> = {
  leo_credits: "Leo AI Credits",
  meeting_participant_minutes: "Meeting minutes",
  storage_bytes: "Storage",
  learn_seats: "Learn seats",
  sms_credits: "SMS",
  whatsapp_credits: "WhatsApp",
};

const TYPE_TONE: Record<string, string> = {
  leo_credits: "text-teal-300",
  meeting_participant_minutes: "text-cyan-300",
  storage_bytes: "text-violet-300",
  learn_seats: "text-emerald-300",
  sms_credits: "text-amber-300",
  whatsapp_credits: "text-lime-300",
};

function formatGHS(minor: number) {
  return `GHS ${(minor / 100).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
}

function qtyLabel(p: PackageRow) {
  if (p.displayQuantity && p.displayUnit) return `${p.displayQuantity} ${p.displayUnit}`;
  if (p.displayUnit) return `${p.quantity} ${p.displayUnit}`;
  return `${p.quantity.toLocaleString()}`;
}

const TYPES_ORDER = ["leo_credits", "meeting_participant_minutes", "storage_bytes", "learn_seats", "sms_credits", "whatsapp_credits"];

export default function AddOnCatalogPage() {
  const [packages, setPackages] = React.useState<PackageRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // Create form
  const [form, setForm] = React.useState({
    code: "",
    name: "",
    description: "",
    type: "leo_credits",
    quantity: "100",
    displayQuantity: "",
    displayUnit: "credits",
    priceMinor: "500",
    expiresWithBillingPeriod: true,
    sortOrder: "0",
  });

  // Edit price state (inline)
  const [editPrice, setEditPrice] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/subscriptions/add-ons?activeOnly=false");
      const json = await res.json();
      if (json.success) setPackages(json.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function onCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const body = {
        code: form.code,
        name: form.name,
        description: form.description || null,
        type: form.type,
        quantity: parseInt(form.quantity, 10),
        displayQuantity: form.displayQuantity ? parseFloat(form.displayQuantity) : null,
        displayUnit: form.displayUnit || null,
        priceMinor: Math.round(parseFloat(form.priceMinor) * 100),
        active: true,
        expiresWithBillingPeriod: form.expiresWithBillingPeriod,
        sortOrder: parseInt(form.sortOrder, 10),
      };
      const res = await fetch("/api/platform/subscriptions/add-ons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Package created.");
        setShowCreate(false);
        load();
      } else {
        toast.error(typeof json.error === "string" ? json.error : "Failed.");
      }
    } catch { toast.error("Network error."); }
    finally { setCreating(false); }
  }

  async function onToggle(id: string, active: boolean) {
    await fetch(`/api/platform/subscriptions/add-ons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    toast.success(active ? "Activated." : "Deactivated.");
    load();
  }

  async function onSavePrice(id: string) {
    const minor = Math.round(parseFloat(editPrice) * 100);
    if (isNaN(minor)) { toast.error("Invalid price."); return; }
    await fetch(`/api/platform/subscriptions/add-ons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceMinor: minor }),
    });
    toast.success("Price updated.");
    setEditingId(null);
    load();
  }

  const grouped = TYPES_ORDER
    .map((type) => ({ type, items: packages.filter((p) => p.type === type) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5 p-2 md:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/platform/subscriptions" className="mb-1 flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70">
            <ChevronLeft className="h-3 w-3" /> Subscriptions
          </Link>
          <h1 className="text-xl font-semibold text-white">Add-on catalog</h1>
          <p className="text-xs text-white/40">Purchasable credit packages available to schools.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/40 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setShowCreate((v) => !v)}
            className={cn("inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium", glassPrimaryButtonClass)}>
            <Plus className="h-4 w-4" /> New package
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className={cn(glassPanelClass, "px-5 py-4")}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
          <p className="mb-4 text-sm font-semibold text-white">New add-on package</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { key: "code", label: "Code (e.g. leo_500)", type: "text" },
              { key: "name", label: "Display name", type: "text" },
              { key: "quantity", label: "Quantity (native units)", type: "number" },
              { key: "displayQuantity", label: "Display qty (optional)", type: "number" },
              { key: "displayUnit", label: "Display unit (e.g. credits, GB)", type: "text" },
              { key: "priceMinor", label: "Price (GHS)", type: "number" },
              { key: "sortOrder", label: "Sort order", type: "number" },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-[10px] text-white/40 mb-1">{label}</label>
                <input type={type} value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none" />
              </div>
            ))}
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Type</label>
              <PremiumSelect value={form.type} onValueChange={(value) => setForm((f) => ({ ...f, type: value }))}>
                <PremiumSelectTrigger className="w-full rounded-xl border-white/10 bg-white/5 text-xs text-white">
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {Object.entries(TYPE_LABEL).map(([v, l]) => (
                    <PremiumSelectItem key={v} value={v}>{l}</PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] text-white/40 mb-1">Description</label>
              <input type="text" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-white/20" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.expiresWithBillingPeriod}
                onChange={(e) => setForm((f) => ({ ...f, expiresWithBillingPeriod: e.target.checked }))}
                className="accent-teal-400" id="exp-flag" />
              <label htmlFor="exp-flag" className="text-xs text-white/50">Expires with billing period</label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onCreate} disabled={creating}
              className={cn("inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium", glassPrimaryButtonClass, creating && "opacity-50")}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/50 hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-white/30" /></div>
      ) : grouped.length === 0 ? (
        <div className={cn(glassInsetClass, "flex items-center gap-3 px-5 py-8")}>
          <ShoppingCart className="h-5 w-5 text-white/20" />
          <p className="text-sm text-white/50">No packages yet. Create one above.</p>
        </div>
      ) : grouped.map(({ type, items }) => {
        const Icon = TYPE_ICON[type] ?? ShoppingCart;
        return (
          <div key={type}>
            <div className="mb-2 flex items-center gap-2">
              <Icon className={cn("h-3.5 w-3.5", TYPE_TONE[type] ?? "text-white/40")} />
              <p className="text-xs font-semibold text-white/40">{TYPE_LABEL[type]}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <div key={p._id} className={cn(glassPanelClass, "px-4 py-4")}>
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={cn("text-sm font-medium", p.active ? "text-white/80" : "text-white/30 line-through")}>{p.name}</p>
                      <p className="font-mono text-[10px] text-white/25">{p.code}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { setEditingId(p._id); setEditPrice(String(p.priceMinor / 100)); }}
                        className="rounded-lg border border-white/10 bg-white/5 p-1 text-white/30 hover:text-white">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => onToggle(p._id, !p.active)}
                        className={cn("rounded-lg border p-1 transition", p.active
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-white/10 bg-white/5 text-white/30")}>
                        {p.active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  {p.description && <p className="mt-1 text-[11px] text-white/30">{p.description}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-white/50">{qtyLabel(p)}</span>
                    {editingId === p._id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-white/40">GHS</span>
                        <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                          className="w-16 rounded-lg border border-white/20 bg-white/10 px-1.5 py-0.5 text-xs text-white outline-none" />
                        <button type="button" onClick={() => onSavePrice(p._id)}
                          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1 text-emerald-300">
                          <Check className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => setEditingId(null)}
                          className="rounded-lg border border-white/10 bg-white/5 p-1 text-white/40">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="font-mono text-sm font-semibold text-white/80">{formatGHS(p.priceMinor)}</span>
                    )}
                  </div>
                  {p.expiresWithBillingPeriod && (
                    <p className="mt-1 text-[10px] text-white/25">Expires with billing period</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

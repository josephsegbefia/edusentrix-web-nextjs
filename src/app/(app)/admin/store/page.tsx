"use client";

import * as React from "react";
import Image from "next/image";
import {
  BadgeCheck,
  Boxes,
  Clock3,
  ImageIcon,
  Loader2,
  PackagePlus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/fees/money";
import { useSchool } from "@/hooks/admin/useSchool";
import { ImageUploader } from "@/components/upload/ImageUploader";
import { cn } from "@/lib/utils";

type ProductRow = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  isActive: boolean;
  sortOrder: number;
  imageUrl?: string | null;
};

type OrderRow = {
  id: string;
  status: string;
  totalMinor: number;
  parentLabel: string;
  studentLabel: string;
  paidAt: string | null;
  createdAt: string | null;
};

const glassPanel =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/35 backdrop-blur-xl";

function PanelChrome({ corner = "top" }: { corner?: "top" | "bottom" }) {
  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 via-transparent to-transparent",
          corner === "top"
            ? "bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-cyan-500/8"
            : "bg-[radial-gradient(ellipse_at_bottom_left,var(--tw-gradient-stops))] from-teal-500/8"
        )}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />
    </>
  );
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "cyan" | "emerald" | "amber" | "violet";
}) {
  const tones = {
    cyan: "border-cyan-300/20 bg-cyan-400/10 text-cyan-200",
    emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-300/20 bg-amber-400/10 text-amber-200",
    violet: "border-violet-300/20 bg-violet-400/10 text-violet-200",
  };

  return (
    <Card className={glassPanel}>
      <PanelChrome />
      <CardContent className="relative z-10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-white/45">{label}</p>
            <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
          </div>
          <div className={cn("rounded-xl border p-2", tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-sm leading-5 text-white/50">{helper}</p>
      </CardContent>
    </Card>
  );
}

function statusTone(status: string) {
  if (status === "paid" || status === "fulfilled") return "border-emerald-300/25 text-emerald-100 bg-emerald-400/10";
  if (status === "pending" || status === "awaiting_payment") return "border-amber-300/25 text-amber-100 bg-amber-400/10";
  if (status === "cancelled" || status === "failed") return "border-rose-300/25 text-rose-100 bg-rose-400/10";
  return "border-white/20 text-white/75 bg-white/5";
}

export default function AdminSchoolStorePage() {
  const { data: schoolPayload } = useSchool();
  const schoolId = schoolPayload?.data?.id ?? "";

  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [orders, setOrders] = React.useState<OrderRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priceGhs, setPriceGhs] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [catalogSearch, setCatalogSearch] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, oRes] = await Promise.all([
        fetch("/api/admin/store/products", { cache: "no-store" }),
        fetch("/api/admin/store/orders", { cache: "no-store" }),
      ]);
      const pJson = await pRes.json().catch(() => null);
      const oJson = await oRes.json().catch(() => null);
      if (pJson?.success && Array.isArray(pJson.data)) setProducts(pJson.data);
      if (oJson?.success && Array.isArray(oJson.data)) setOrders(oJson.data);
    } catch {
      toast.error("Failed to load store");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    const ghs = Number.parseFloat(priceGhs);
    if (!name.trim() || !Number.isFinite(ghs) || ghs < 0) {
      toast.error("Enter a valid name and price (GHS)");
      return;
    }
    const priceMinor = Math.round(ghs * 100);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/store/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          priceMinor,
          imageUrl: imageUrl || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to add product");
      }
      toast.success("Product added");
      setName("");
      setDescription("");
      setPriceGhs("");
      setImageUrl(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: ProductRow, next: boolean) {
    try {
      const res = await fetch(`/api/admin/store/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Update failed");
      setProducts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, isActive: next } : x))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-white/10 bg-slate-950/80 text-white/60">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading store…
        </div>
      </div>
    );
  }

  const activeProducts = products.filter((product) => product.isActive).length;
  const inactiveProducts = products.length - activeProducts;
  const totalSalesMinor = orders
    .filter((order) => order.status === "paid" || order.status === "fulfilled")
    .reduce((sum, order) => sum + order.totalMinor, 0);
  const pendingOrders = orders.filter(
    (order) => order.status === "pending" || order.status === "awaiting_payment"
  ).length;
  const filteredProducts = products.filter((product) => {
    const query = catalogSearch.trim().toLowerCase();
    if (!query) return true;
    return `${product.name} ${product.description}`.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/95 via-slate-950 to-black p-5 shadow-2xl shadow-black/40 sm:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 shadow-lg shadow-cyan-500/10">
              <Store className="h-6 w-6 text-cyan-200" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white/55">Commerce</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                School store
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                Publish supplies for parents, track purchases, and keep store revenue moving through
                the existing Paystack flow.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border border-white/10 bg-white/5 px-3 py-1.5 text-white/70">
              <BadgeCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-300" />
              {activeProducts} active
            </Badge>
            <Badge className="border border-white/10 bg-white/5 px-3 py-1.5 text-white/70">
              <ReceiptText className="mr-1.5 h-3.5 w-3.5 text-cyan-200" />
              {orders.length} orders
            </Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Products"
          value={products.length}
          helper={`${inactiveProducts} inactive item${inactiveProducts === 1 ? "" : "s"} hidden from parents.`}
          icon={Boxes}
          tone="cyan"
        />
        <StatCard
          label="Active catalog"
          value={activeProducts}
          helper="Items currently visible in the parent store."
          icon={ShoppingBag}
          tone="emerald"
        />
        <StatCard
          label="Store sales"
          value={formatMoney(totalSalesMinor)}
          helper="Paid or fulfilled order value recorded here."
          icon={WalletCards}
          tone="violet"
        />
        <StatCard
          label="Pending"
          value={pendingOrders}
          helper="Orders still waiting on payment or completion."
          icon={Clock3}
          tone="amber"
        />
      </div>

      <Card className={glassPanel}>
        <PanelChrome />
        <CardHeader className="relative z-10 border-b border-white/5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <PackagePlus className="h-4 w-4 text-cyan-200" />
                Add product
              </CardTitle>
              <p className="mt-1 text-sm text-white/50">
                Create a parent-facing item with price, description, and optional image.
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-cyan-300/20 bg-cyan-400/10 text-cyan-100">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Parent checkout ready
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 p-5">
          <form onSubmit={addProduct} className="grid gap-4 lg:grid-cols-[1fr_1fr_320px]">
            <div className="space-y-2">
              <Label className="text-white/80">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 border-white/10 bg-black/30 text-white placeholder:text-white/35"
                placeholder="e.g. Exercise books (pack)"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Price (GHS)</Label>
              <Input
                value={priceGhs}
                onChange={(e) => setPriceGhs(e.target.value)}
                className="h-11 border-white/10 bg-black/30 text-white placeholder:text-white/35"
                placeholder="12.00"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2 lg:row-span-3">
              <Label className="text-white/80">Photo</Label>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                {schoolId ? (
                  <>
                    <ImageUploader
                      schoolId={schoolId}
                      subjectRole="schools"
                      label="Upload product image"
                      onUploaded={(payload) => setImageUrl(payload.url)}
                    />
                    {imageUrl ? (
                      <p className="mt-2 text-xs text-emerald-300/90">
                        Image ready — will save with product.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="grid min-h-32 place-items-center rounded-lg border border-dashed border-white/10 text-center text-sm text-white/45">
                    School profile is still loading.
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label className="text-white/80">Description (optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-11 border-white/10 bg-black/30 text-white placeholder:text-white/35"
                placeholder="Short parent-facing note"
              />
            </div>
            <div className="lg:col-span-2">
              <Button
                type="submit"
                disabled={saving}
                className="h-11 bg-linear-to-r from-teal-500 to-cyan-600 px-5 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add product
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className={glassPanel}>
        <PanelChrome corner="bottom" />
        <CardHeader className="relative z-10 border-b border-white/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base text-white">Catalog</CardTitle>
              <p className="mt-1 text-sm text-white/50">
                Toggle availability without removing product history.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-3 h-4 w-4 text-white/35" />
              <Input
                value={catalogSearch}
                onChange={(event) => setCatalogSearch(event.target.value)}
                className="h-10 border-white/10 bg-black/30 pl-9 text-white placeholder:text-white/35"
                placeholder="Search catalog..."
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 p-5">
          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
              <ShoppingBag className="mx-auto h-9 w-9 text-white/30" />
              <p className="mt-3 font-semibold text-white">
                {products.length === 0 ? "No products yet" : "No matching products"}
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-white/50">
                {products.length === 0
                  ? "Add the first product above to make it available for parent checkout."
                  : "Adjust the search term to find another catalog item."}
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((p) => (
                <li
                  key={p.id}
                  className="group rounded-xl border border-white/10 bg-black/25 p-3 transition-colors hover:border-cyan-400/25 hover:bg-black/35"
                >
                  <div className="flex gap-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                      {p.imageUrl ? (
                        <Image
                          src={p.imageUrl}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-white/25" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">{p.name}</p>
                          <p className="mt-1 text-sm font-semibold text-cyan-200">
                            {formatMoney(p.priceMinor)}
                          </p>
                        </div>
                        <Switch checked={p.isActive} onCheckedChange={(v) => void toggleActive(p, v)} />
                      </div>
                      {p.description ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/50">
                          {p.description}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs leading-5 text-white/35">No description added.</p>
                      )}
                      <div className="mt-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border text-[10px]",
                            p.isActive
                              ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                              : "border-white/15 bg-white/5 text-white/50"
                          )}
                        >
                          {p.isActive ? "Visible to parents" : "Hidden"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className={glassPanel}>
        <PanelChrome />
        <CardHeader className="relative z-10 border-b border-white/5">
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <ReceiptText className="h-4 w-4 text-cyan-200" />
            Orders
          </CardTitle>
          <p className="text-sm text-white/50">
            Recent parent purchases and checkout status.
          </p>
        </CardHeader>
        <CardContent className="relative z-10 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/70">When</TableHead>
                <TableHead className="text-white/70">Parent</TableHead>
                <TableHead className="text-white/70">Student</TableHead>
                <TableHead className="text-white/70">Status</TableHead>
                <TableHead className="text-white/70">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow className="border-white/10">
                  <TableCell colSpan={5} className="py-8 text-center text-white/50">
                    No orders yet. Parent purchases will appear here.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow key={o.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="text-white/80 text-sm">
                      {o.paidAt
                        ? new Date(o.paidAt).toLocaleString()
                        : o.createdAt
                          ? new Date(o.createdAt).toLocaleString()
                          : "—"}
                    </TableCell>
                    <TableCell className="text-white text-sm">{o.parentLabel}</TableCell>
                    <TableCell className="text-white text-sm">{o.studentLabel}</TableCell>
                    <TableCell className="text-sm capitalize">
                      <Badge variant="outline" className={cn("border text-[10px]", statusTone(o.status))}>
                        {o.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-cyan-200">
                      {formatMoney(o.totalMinor)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

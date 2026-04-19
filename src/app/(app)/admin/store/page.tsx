"use client";

import * as React from "react";
import { Loader2, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
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
      <div className="flex min-h-[30vh] items-center justify-center gap-2 text-white/60">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <ShoppingBag className="h-8 w-8 text-brand" />
        <div>
          <h1 className="text-2xl font-semibold text-white">School store</h1>
          <p className="text-sm text-white/60">
            List supplies for parents. Sales settle through your existing Paystack setup.
          </p>
        </div>
      </div>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white text-base">Add product</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addProduct} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-white/80">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/5 border-white/10"
                placeholder="e.g. Exercise books (pack)"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Price (GHS)</Label>
              <Input
                value={priceGhs}
                onChange={(e) => setPriceGhs(e.target.value)}
                className="bg-white/5 border-white/10"
                placeholder="12.00"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-white/80">Description (optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>
            {schoolId ? (
              <div className="space-y-2 md:col-span-2">
                <Label className="text-white/80">Photo (optional)</Label>
                <ImageUploader
                  schoolId={schoolId}
                  subjectRole="schools"
                  label="Upload product image"
                  onUploaded={(payload) => setImageUrl(payload.url)}
                />
                {imageUrl ? (
                  <p className="text-xs text-emerald-300/90">Image ready — will save with product.</p>
                ) : null}
              </div>
            ) : null}
            <div className="md:col-span-2">
              <Button
                type="submit"
                disabled={saving}
                className="bg-brand text-black hover:bg-brand/90"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
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

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white text-base">Catalog</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/70 w-16">Photo</TableHead>
                <TableHead className="text-white/70">Product</TableHead>
                <TableHead className="text-white/70">Price</TableHead>
                <TableHead className="text-white/70">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow className="border-white/10">
                  <TableCell colSpan={4} className="text-white/50">
                    No products yet.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((p) => (
                  <TableRow key={p.id} className="border-white/10">
                    <TableCell>
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-10 w-10 rounded object-cover border border-white/10"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-white/5 border border-white/10" />
                      )}
                    </TableCell>
                    <TableCell className="text-white">
                      <div className="font-medium">{p.name}</div>
                      {p.description ? (
                        <div className="text-xs text-white/50">{p.description}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-brand">
                      {formatMoney(p.priceMinor)}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.isActive}
                        onCheckedChange={(v) => void toggleActive(p, v)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white text-base">Orders</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
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
                  <TableCell colSpan={5} className="text-white/50">
                    No orders yet.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow key={o.id} className="border-white/10">
                    <TableCell className="text-white/80 text-sm">
                      {o.paidAt
                        ? new Date(o.paidAt).toLocaleString()
                        : o.createdAt
                          ? new Date(o.createdAt).toLocaleString()
                          : "—"}
                    </TableCell>
                    <TableCell className="text-white text-sm">{o.parentLabel}</TableCell>
                    <TableCell className="text-white text-sm">{o.studentLabel}</TableCell>
                    <TableCell className="text-sm capitalize text-white/80">
                      {o.status.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-brand">{formatMoney(o.totalMinor)}</TableCell>
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

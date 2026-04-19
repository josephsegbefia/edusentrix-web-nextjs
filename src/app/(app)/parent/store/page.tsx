"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ShoppingBag, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import { formatMoney } from "@/lib/fees/money";

type Product = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  imageUrl?: string | null;
};

type Ward = { id: string; name: string };

export default function ParentSchoolStorePage() {
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");

  const [wards, setWards] = React.useState<Ward[]>([]);
  const [wardId, setWardId] = React.useState<string>("");
  const [products, setProducts] = React.useState<Product[]>([]);
  const [cart, setCart] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<{
    totalMinor: number;
    platformFeeMinor: number;
    paystackKeyMode: string;
  } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [wRes, pRes] = await Promise.all([
          fetch("/api/parent/wards", { cache: "no-store" }),
          fetch("/api/parent/store/products", { cache: "no-store" }),
        ]);
        const wJson = await wRes.json().catch(() => null);
        const pJson = await pRes.json().catch(() => null);
        if (!cancelled && wJson?.success && wJson.data?.wards?.length) {
          const list: Ward[] = wJson.data.wards.map(
            (w: { id: string; name: string }) => ({
              id: w.id,
              name: w.name,
            })
          );
          setWards(list);
          setWardId(list[0]?.id || "");
        }
        if (!cancelled && pJson?.success && Array.isArray(pJson.data)) {
          setProducts(pJson.data);
        }
      } catch {
        toast.error("Failed to load store");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (checkout === "paystack") {
      toast.success("Payment complete — thank you!");
      setCart({});
    }
  }, [checkout]);

  const cartLines = React.useMemo(() => {
    return Object.entries(cart)
      .map(([productId, qty]) => {
        const p = products.find((x) => x.id === productId);
        if (!p || qty < 1) return null;
        return { product: p, quantity: qty };
      })
      .filter(Boolean) as Array<{ product: Product; quantity: number }>;
  }, [cart, products]);

  const cartTotalMinor = React.useMemo(() => {
    return cartLines.reduce(
      (s, { product, quantity }) => s + product.priceMinor * quantity,
      0
    );
  }, [cartLines]);

  function setQty(productId: string, q: number) {
    setCart((prev) => {
      const next = { ...prev };
      if (q < 1) delete next[productId];
      else next[productId] = q;
      return next;
    });
  }

  async function openCheckout() {
    if (!wardId) {
      toast.error("Select a student first");
      return;
    }
    if (cartLines.length === 0) {
      toast.error("Add items to your cart");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/parent/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: wardId,
          lines: cartLines.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
          })),
          preview: true,
          returnPath: "/parent/store",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Could not start checkout");
      }
      setPreview({
        totalMinor: Number(json.data?.totalMinor || 0),
        platformFeeMinor: Number(json.data?.platformFeeMinor || 0),
        paystackKeyMode: String(json.data?.paystackKeyMode || "unset"),
      });
      setCheckoutOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmPay() {
    if (!wardId || cartLines.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/parent/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: wardId,
          lines: cartLines.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
          })),
          returnPath: "/parent/store",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Could not open Paystack");
      }
      const url = String(json.data?.authorizationUrl || "");
      if (!url) throw new Error("Missing Paystack URL");
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-white/60">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading school store…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <ShoppingBag className="h-7 w-7 text-brand" />
            School store
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Supplies from your school — pay securely with Paystack.
          </p>
        </div>
        <div className="flex flex-col gap-1 w-full sm:w-64">
          <span className="text-xs text-white/50">Purchase for</span>
          <Select value={wardId} onValueChange={setWardId}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Select ward" />
            </SelectTrigger>
            <SelectContent>
              {wards.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {products.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-10 text-center text-white/60">
            No products listed yet. Check back later.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {products.map((p) => {
            const qty = cart[p.id] || 0;
            return (
              <Card key={p.id} className="border-white/10 bg-white/5 overflow-hidden">
                {p.imageUrl ? (
                  <div className="aspect-[16/9] w-full bg-white/5 border-b border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-white">{p.name}</CardTitle>
                  <p className="text-sm text-brand font-medium">
                    {formatMoney(p.priceMinor, p.currency)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {p.description ? (
                    <p className="text-sm text-white/70 line-clamp-3">{p.description}</p>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-white/20"
                      onClick={() => setQty(p.id, Math.max(0, qty - 1))}
                    >
                      −
                    </Button>
                    <span className="text-white w-8 text-center">{qty}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-white/20"
                      onClick={() => setQty(p.id, qty + 1)}
                    >
                      +
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {cartLines.length > 0 && (
        <Card className="border-brand/30 bg-brand/5">
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-6">
            <div>
              <p className="text-white font-medium">Cart total</p>
              <p className="text-2xl font-bold text-brand">
                {formatMoney(cartTotalMinor)}
              </p>
            </div>
            <Button
              className="bg-brand text-black hover:bg-brand/90"
              onClick={() => void openCheckout()}
              disabled={submitting || !wardId}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Pay with Paystack
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-base text-white">Recent orders</CardTitle>
        </CardHeader>
        <CardContent>
          <OrdersList />
        </CardContent>
      </Card>

      <ResponsiveModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Confirm checkout"
        widthClass="max-w-md"
      >
        {preview ? (
          <div className="space-y-3 text-sm text-white">
            <p>
              Total:{" "}
              <span className="font-semibold text-brand">
                {formatMoney(preview.totalMinor)}
              </span>
            </p>
            <p className="text-white/60">
              Platform fee (estimated): {formatMoney(preview.platformFeeMinor)}
            </p>
            {preview.paystackKeyMode === "test" ? (
              <p className="text-amber-200/90 text-xs">
                Paystack test mode — charges appear in the test dashboard only.
              </p>
            ) : null}
            <Button
              className="w-full bg-brand text-black hover:bg-brand/90"
              onClick={() => void confirmPay()}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Continue to Paystack"
              )}
            </Button>
          </div>
        ) : null}
      </ResponsiveModal>
    </div>
  );
}

function OrdersList() {
  const [orders, setOrders] = React.useState<
    Array<{
      id: string;
      status: string;
      totalMinor: number;
      wardName: string;
      createdAt: string | null;
      paidAt: string | null;
    }>
  >([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/parent/store/orders", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (json?.success && Array.isArray(json.data)) setOrders(json.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <p className="text-white/50 text-sm">Loading…</p>;
  }
  if (orders.length === 0) {
    return <p className="text-white/50 text-sm">No orders yet.</p>;
  }

  return (
    <ul className="space-y-2 text-sm">
      {orders.map((o) => (
        <li
          key={o.id}
          className="flex flex-wrap justify-between gap-2 border-b border-white/10 pb-2"
        >
          <span className="text-white/80">
            {o.wardName} · {o.status}
          </span>
          <span className="text-brand">{formatMoney(o.totalMinor)}</span>
          <span className="text-white/40 w-full text-xs">
            {o.paidAt ? `Paid ${new Date(o.paidAt).toLocaleString()}` : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}

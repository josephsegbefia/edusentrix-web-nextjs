"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowUp,
  ArrowDown,
  ClipboardList,
  Loader2,
  ShoppingCart,
  Users,
} from "lucide-react";
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
import { formatMoney } from "@/lib/fees/money";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";

type Ward = { id: string; name: string };

type ProgramSummary = {
  id: string;
  name: string;
  periodLabel: string;
  purchaseByDate: string | null;
  requiredProgress: { done: number; total: number; complete: boolean };
};

type LineDetail = {
  id: string;
  storeProductId: string;
  productName: string;
  description: string;
  priceMinor: number;
  currency: string;
  imageUrl: string | null;
  subjectId: string | null;
  subjectName: string | null;
  required: boolean;
  quantityExpected: number;
  quantityPaid: number;
  quantityRemaining: number;
  satisfied: boolean;
  notes: string;
  sortOrder: number;
};

export default function ParentSupplyListsPage() {
  const searchParams = useSearchParams();
  const programFromUrl = searchParams.get("program");

  const [wards, setWards] = React.useState<Ward[]>([]);
  const [wardId, setWardId] = React.useState("");
  const [programs, setPrograms] = React.useState<ProgramSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detail, setDetail] = React.useState<{
    program: {
      id: string;
      name: string;
      description: string;
      periodLabel: string;
      purchaseByDate: string | null;
    };
    lines: LineDetail[];
    priorityOrder: string[];
  } | null>(null);
  const [household, setHousehold] = React.useState<
    Array<{
      student: { id: string; name: string };
      programs: Array<{
        id: string;
        name: string;
        periodLabel: string;
        requiredProgress: { done: number; total: number; complete: boolean };
      }>;
    }>
  >([]);

  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [checkoutPreview, setCheckoutPreview] = React.useState<{
    totalMinor: number;
    platformFeeMinor: number;
    paystackKeyMode: string;
  } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const selectedProgramId = programFromUrl || "";

  const cartLines = React.useMemo(() => {
    if (!detail) return [];
    return detail.lines.filter((l) => l.quantityRemaining > 0);
  }, [detail]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [wRes, hRes] = await Promise.all([
          fetch("/api/parent/wards", { cache: "no-store" }),
          fetch("/api/parent/supply-programs/household", { cache: "no-store" }),
        ]);
        const wJson = await wRes.json().catch(() => null);
        const hJson = await hRes.json().catch(() => null);
        const wardList = wJson?.data?.wards ?? wJson?.wards;
        if (!cancelled && wJson?.success && Array.isArray(wardList)) {
          const list = wardList.map(
            (w: { id: string; firstName?: string; lastName?: string; name?: string }) => ({
              id: w.id,
              name:
                w.name ||
                [w.firstName, w.lastName].filter(Boolean).join(" ") ||
                "Ward",
            })
          );
          setWards(list);
          setWardId((prev) => prev || (list[0]?.id ?? ""));
        }
        if (!cancelled && hJson?.success && Array.isArray(hJson.data)) {
          setHousehold(hJson.data);
        }
      } catch {
        if (!cancelled) toast.error("Failed to load wards");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!wardId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/parent/supply-programs?studentId=${encodeURIComponent(wardId)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);
        if (!cancelled && json?.success && Array.isArray(json.data)) {
          setPrograms(json.data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wardId]);

  React.useEffect(() => {
    if (!wardId || !selectedProgramId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(
          `/api/parent/supply-programs/${selectedProgramId}?studentId=${encodeURIComponent(wardId)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);
        if (!cancelled && json?.success && json.data) {
          setDetail(json.data);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wardId, selectedProgramId]);

  async function savePriority(nextIds: string[]) {
    if (!wardId || !selectedProgramId) return;
    try {
      const res = await fetch(
        `/api/parent/supply-programs/${selectedProgramId}/priority`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: wardId, orderedLineIds: nextIds }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed");
      const r = await fetch(
        `/api/parent/supply-programs/${selectedProgramId}?studentId=${encodeURIComponent(wardId)}`,
        { cache: "no-store" }
      );
      const jr = await r.json().catch(() => null);
      if (jr?.success && jr.data) setDetail(jr.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save order");
    }
  }

  function moveLine(lineId: string, dir: -1 | 1) {
    if (!detail) return;
    const ids = detail.lines.map((l) => l.id);
    const ix = ids.indexOf(lineId);
    if (ix < 0) return;
    const j = ix + dir;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[ix], next[j]] = [next[j], next[ix]];
    void savePriority(next);
  }

  async function previewCheckout() {
    if (!wardId || !detail || !selectedProgramId) return;
    const lines = cartLines.map((l) => ({
      productId: l.storeProductId,
      quantity: Math.min(1, l.quantityRemaining),
      supplyProgramLineId: l.id,
    }));
    if (lines.length === 0) {
      toast.error("Nothing left to pay for on this list");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/parent/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: wardId,
          supplyProgramId: selectedProgramId,
          lines,
          preview: true,
          returnPath: `/parent/supplies?program=${encodeURIComponent(selectedProgramId)}`,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Preview failed");
      }
      setCheckoutPreview(json.data);
      setCheckoutOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmPay() {
    if (!wardId || !detail || !selectedProgramId || !checkoutPreview) return;
    const lines = cartLines.map((l) => ({
      productId: l.storeProductId,
      quantity: Math.min(1, l.quantityRemaining),
      supplyProgramLineId: l.id,
    }));
    setSubmitting(true);
    try {
      const res = await fetch("/api/parent/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: wardId,
          supplyProgramId: selectedProgramId,
          lines,
          preview: false,
          returnPath: `/parent/supplies?program=${encodeURIComponent(selectedProgramId)}`,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Checkout failed");
      }
      const url = json.data?.authorizationUrl as string | undefined;
      if (!url) throw new Error("Missing Paystack URL");
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !wards.length) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-white/60">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <ClipboardList className="h-7 w-7 text-brand" />
          Supply lists
        </h1>
        <p className="text-sm text-white/60 mt-1 max-w-2xl">
          School-assigned requirements by period. Set your purchase order, then pay in
          parts — progress syncs after Paystack confirms payment.
        </p>
      </div>

      {household.length > 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-brand" />
              Household summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {household.map((row) => (
              <div key={row.student.id} className="border-b border-white/10 pb-3 last:border-0">
                <p className="font-medium text-white">{row.student.name}</p>
                <ul className="mt-1 space-y-1 text-white/70">
                  {row.programs.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span>
                        {p.name}
                        {p.periodLabel ? (
                          <span className="text-white/50"> · {p.periodLabel}</span>
                        ) : null}
                      </span>
                      <span
                        className={
                          p.requiredProgress.complete
                            ? "text-emerald-400"
                            : "text-amber-200/90"
                        }
                      >
                        {p.requiredProgress.done}/{p.requiredProgress.total} required
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1 w-full sm:w-64">
          <span className="text-xs text-white/50">Child</span>
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
        <Button
          asChild
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
        >
          <Link href="/parent/store">Browse school store</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-base text-white">Your programs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {programs.length === 0 ? (
              <p className="text-sm text-white/50">No published lists for this child.</p>
            ) : (
              programs.map((p) => (
                <Link
                  key={p.id}
                  href={`/parent/supplies?program=${encodeURIComponent(p.id)}`}
                  className={`block rounded-lg border px-3 py-2 text-sm transition-colors ${
                    selectedProgramId === p.id
                      ? "border-brand/50 bg-brand/10 text-white"
                      : "border-white/10 bg-white/5 text-white/90 hover:border-white/20"
                  }`}
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-white/50 flex justify-between mt-1">
                    <span>{p.periodLabel || "—"}</span>
                    <span>
                      {p.requiredProgress.done}/{p.requiredProgress.total} required
                    </span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 md:min-h-[200px]">
          <CardHeader>
            <CardTitle className="text-base text-white">Selected list</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedProgramId ? (
              <p className="text-sm text-white/50">Pick a program on the left.</p>
            ) : detailLoading ? (
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : detail ? (
              <div className="space-y-2 text-sm">
                <p className="text-white font-medium">{detail.program.name}</p>
                {detail.program.description ? (
                  <p className="text-white/60">{detail.program.description}</p>
                ) : null}
                {detail.program.purchaseByDate ? (
                  <p className="text-amber-200/90 text-xs">
                    Purchase by {new Date(detail.program.purchaseByDate).toLocaleDateString()}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-white/50">Could not load program.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {detail && selectedProgramId ? (
        <Card className="border-white/10 bg-white/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-white">Items & priority</CardTitle>
            <p className="text-xs text-white/50">
              Use arrows to set purchase order (most urgent first).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {detail.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-white/10 bg-white/3 p-3"
                >
                  <div className="flex gap-3 flex-1 min-w-0">
                    {line.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={line.imageUrl}
                        alt=""
                        className="h-16 w-16 rounded-md object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-md bg-white/5 border border-white/10 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-white truncate">{line.productName}</div>
                      <div className="text-xs text-white/50">
                        {line.subjectName ? `${line.subjectName} · ` : ""}
                        {line.required ? "Required" : "Optional"}
                        {" · "}
                        Paid {line.quantityPaid}/{line.quantityExpected}
                      </div>
                      {line.notes ? (
                        <div className="text-xs text-white/40 mt-1">{line.notes}</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-brand font-semibold">
                      {formatMoney(line.priceMinor, line.currency)}
                    </span>
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 border-white/20"
                        onClick={() => moveLine(line.id, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 border-white/20"
                        onClick={() => moveLine(line.id, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right text-sm w-full sm:w-28">
                    {line.satisfied ? (
                      <span className="text-emerald-400">Complete</span>
                    ) : (
                      <span className="text-amber-200/90">
                        {line.quantityRemaining} left
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-white/10 pt-4">
              <div>
                <p className="text-white text-sm">Pay next (first unpaid items)</p>
                <p className="text-xs text-white/50">
                  One unit per item in this pass — run again to continue.
                </p>
              </div>
              <Button
                className="bg-brand text-black hover:bg-brand/90"
                disabled={submitting || cartLines.length === 0}
                onClick={() => void previewCheckout()}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Checkout ({cartLines.length} lines)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ResponsiveModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Confirm checkout"
        widthClass="max-w-md"
      >
        {checkoutPreview ? (
          <div className="space-y-3 text-sm text-white">
            <p>
              Total:{" "}
              <span className="font-semibold text-brand">
                {formatMoney(checkoutPreview.totalMinor)}
              </span>
            </p>
            <p className="text-white/60">
              Platform fee (estimated): {formatMoney(checkoutPreview.platformFeeMinor)}
            </p>
            {checkoutPreview.paystackKeyMode === "test" ? (
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

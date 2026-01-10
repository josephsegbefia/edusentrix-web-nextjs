// src/app/demo/(app)/admin/fees/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Loader2,
  Eye,
  Receipt,
  TrendingUp,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns/format";

interface Invoice {
  _id: string;
  invoiceNumber: string;
  studentName: string;
  studentId?: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  dueDate?: string;
  createdAt: string;
}

interface Summary {
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  invoiceCount: number;
  paidCount: number;
  pendingCount: number;
}

export default function DemoFeesPage() {
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/demo/fees?page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.data || []);
        setSummary(data.summary || null);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Failed to fetch fees:", error);
    } finally {
      setLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statusColors: Record<string, string> = {
    paid: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    partial: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    pending: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    overdue: "bg-red-500/20 text-red-300 border-red-500/30",
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link
            href="/demo/admin"
            className="text-white/60 hover:text-white transition-colors text-sm mb-2 block"
          >
            ← Dashboard
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-amber-400" />
            Fee Management
            <Badge variant="outline" className="border-amber-500/50 text-amber-400">
              DEMO
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            Track invoices and payments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            Bulk Create
          </Button>
          <Button disabled>Create Invoice</Button>
        </div>
      </div>

      {/* Demo Notice */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-3">
          <p className="text-sm text-amber-200/80">
            <Eye className="h-4 w-4 inline mr-2" />
            Viewing demo data. Create/edit operations are disabled.
          </p>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden border border-white/10 bg-white/5">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/20 via-emerald-500/5 to-transparent" />
            <CardContent className="relative z-10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                  <TrendingUp className="h-4 w-4 text-emerald-300" />
                </div>
                <span className="text-xs text-white/60 uppercase">Total Invoiced</span>
              </div>
              <div className="text-2xl font-bold text-white">
                ₵{summary.totalInvoiced.toLocaleString()}
              </div>
              <div className="text-xs text-white/50 mt-1">
                {summary.invoiceCount} invoices
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-white/10 bg-white/5">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/20 via-blue-500/5 to-transparent" />
            <CardContent className="relative z-10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                  <CheckCircle2 className="h-4 w-4 text-blue-300" />
                </div>
                <span className="text-xs text-white/60 uppercase">Collected</span>
              </div>
              <div className="text-2xl font-bold text-emerald-400">
                ₵{summary.totalCollected.toLocaleString()}
              </div>
              <div className="text-xs text-white/50 mt-1">
                {summary.paidCount} paid invoices
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-white/10 bg-white/5">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/20 via-amber-500/5 to-transparent" />
            <CardContent className="relative z-10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
                  <Clock className="h-4 w-4 text-amber-300" />
                </div>
                <span className="text-xs text-white/60 uppercase">Outstanding</span>
              </div>
              <div className="text-2xl font-bold text-amber-400">
                ₵{summary.totalOutstanding.toLocaleString()}
              </div>
              <div className="text-xs text-white/50 mt-1">
                {summary.pendingCount} pending
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-white/10 bg-white/5">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-purple-500/20 via-purple-500/5 to-transparent" />
            <CardContent className="relative z-10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                  <Receipt className="h-4 w-4 text-purple-300" />
                </div>
                <span className="text-xs text-white/60 uppercase">Collection Rate</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {summary.totalInvoiced > 0
                  ? `${Math.round((summary.totalCollected / summary.totalInvoiced) * 100)}%`
                  : "—"}
              </div>
              <div className="text-xs text-white/50 mt-1">This term</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoice List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-white/40" />
        </div>
      ) : invoices.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="py-12 text-center">
            <Receipt className="h-12 w-12 mx-auto mb-4 text-white/20" />
            <h3 className="text-lg font-semibold mb-2">No invoices found</h3>
            <p className="text-white/60">No demo invoices available</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-xs font-semibold text-white/60 uppercase">Invoice #</th>
                  <th className="text-left p-4 text-xs font-semibold text-white/60 uppercase">Student</th>
                  <th className="text-right p-4 text-xs font-semibold text-white/60 uppercase">Amount</th>
                  <th className="text-right p-4 text-xs font-semibold text-white/60 uppercase">Paid</th>
                  <th className="text-right p-4 text-xs font-semibold text-white/60 uppercase">Balance</th>
                  <th className="text-left p-4 text-xs font-semibold text-white/60 uppercase">Status</th>
                  <th className="text-left p-4 text-xs font-semibold text-white/60 uppercase">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4 font-mono text-sm text-white">{inv.invoiceNumber}</td>
                    <td className="p-4">
                      <div className="font-medium text-white">{inv.studentName}</div>
                      {inv.studentId && (
                        <div className="text-xs text-white/50">{inv.studentId}</div>
                      )}
                    </td>
                    <td className="p-4 text-right font-medium text-white">
                      ₵{inv.totalAmount.toLocaleString()}
                    </td>
                    <td className="p-4 text-right text-emerald-400">
                      ₵{inv.paidAmount.toLocaleString()}
                    </td>
                    <td className="p-4 text-right text-amber-400">
                      ₵{inv.balance.toLocaleString()}
                    </td>
                    <td className="p-4">
                      <Badge
                        variant="outline"
                        className={`capitalize ${statusColors[inv.status] || ""}`}
                      >
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-white/70">
                      {inv.dueDate ? format(new Date(inv.dueDate), "MMM d, yyyy") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-white/60 px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";

type DemoLeadRow = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  schoolName: string;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

type SandboxPool = Record<string, number>;

type PageData = {
  leads: DemoLeadRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: { activeSessions: number; sandboxPool: SandboxPool };
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  active_demo: "bg-green-100 text-green-800",
  completed_demo: "bg-gray-100 text-gray-700",
  follow_up_due: "bg-amber-100 text-amber-800",
  converted: "bg-purple-100 text-purple-800",
  closed_lost: "bg-red-100 text-red-700",
};

const STATUSES = [
  "",
  "new",
  "active_demo",
  "completed_demo",
  "follow_up_due",
  "converted",
  "closed_lost",
];

export default function PlatformDemoLeadsPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/platform/demo-leads?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demo Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track prospects who have used the demo platform
          </p>
        </div>
      </div>

      {data && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Active Sessions"
            value={data.stats.activeSessions}
          />
          <StatCard
            label="Available Sandboxes"
            value={data.stats.sandboxPool.available ?? 0}
          />
          <StatCard
            label="Allocated"
            value={data.stats.sandboxPool.allocated ?? 0}
          />
          <StatCard
            label="Total Leads"
            value={data.pagination.total}
          />
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium">Filter by status:</label>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || "All"}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">School</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">First seen</th>
              <th className="px-4 py-3 font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : !data?.leads.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No leads yet.
                </td>
              </tr>
            ) : (
              data.leads.map((lead) => (
                <tr key={lead._id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{lead.fullName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.phone}</td>
                  <td className="px-4 py-3">{lead.schoolName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[lead.status] || "bg-gray-100 text-gray-700"}`}
                    >
                      {lead.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(lead.firstSeenAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(lead.lastSeenAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page >= data.pagination.totalPages}
              className="rounded border border-border px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

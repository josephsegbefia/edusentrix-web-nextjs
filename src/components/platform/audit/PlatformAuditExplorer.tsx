"use client";

import { useCallback, useEffect, useState } from "react";

type AuditRow = {
  id: string;
  domain: string;
  actionCode: string;
  result: string;
  occurredAt: string;
  actorType: string;
  actorRole: string | null;
  targetEntityType: string;
  targetEntityId: string;
  streamKey: string | null;
};

const DOMAINS = [
  "",
  "applications",
  "billing",
  "finance",
  "timetable",
  "identity",
  "academics",
  "communication",
  "system",
  "email",
] as const;

export default function PlatformAuditExplorer() {
  const [domain, setDomain] = useState<string>("");
  const [actionCode, setActionCode] = useState("");
  const [items, setItems] = useState<AuditRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor: string | null, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", "40");
        if (domain) params.set("domain", domain);
        if (actionCode.trim()) params.set("actionCode", actionCode.trim());
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/platform/audit?${params.toString()}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load audit events");
        }
        const rows = json.data.items as AuditRow[];
        setNextCursor(json.data.nextCursor ?? null);
        setItems((prev) => (append ? [...prev, ...rows] : rows));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
        if (!append) setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [domain, actionCode]
  );

  useEffect(() => {
    void load(null, false);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Domain</span>
          <select
            className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm min-w-[160px]"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          >
            {DOMAINS.map((d) => (
              <option key={d || "all"} value={d}>
                {d || "All"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-[200px]">
          <span className="text-muted-foreground">Action code</span>
          <input
            className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
            placeholder="e.g. payment.recorded"
            value={actionCode}
            onChange={(e) => setActionCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load(null, false);
            }}
          />
        </label>
        <button
          type="button"
          className="rounded-md bg-emerald-600/90 hover:bg-emerald-600 text-white px-4 py-2 text-sm font-medium"
          onClick={() => void load(null, false)}
        >
          Apply
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-muted-foreground">
              <th className="p-3 font-medium">When</th>
              <th className="p-3 font-medium">Domain</th>
              <th className="p-3 font-medium">Action</th>
              <th className="p-3 font-medium">Result</th>
              <th className="p-3 font-medium">Actor</th>
              <th className="p-3 font-medium">Target</th>
              <th className="p-3 font-medium">Stream</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.id}
                className="border-b border-white/5 hover:bg-white/[0.03]"
              >
                <td className="p-3 whitespace-nowrap text-muted-foreground">
                  {new Date(row.occurredAt).toLocaleString()}
                </td>
                <td className="p-3">{row.domain}</td>
                <td className="p-3 font-mono text-xs">{row.actionCode}</td>
                <td className="p-3">{row.result}</td>
                <td className="p-3">
                  {row.actorType}
                  {row.actorRole ? ` · ${row.actorRole}` : ""}
                </td>
                <td className="p-3 font-mono text-xs">
                  {row.targetEntityType}
                  <span className="text-muted-foreground">
                    {" "}
                    {row.targetEntityId.slice(-8)}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs max-w-[180px] truncate">
                  {row.streamKey ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && items.length === 0 && (
          <p className="p-6 text-muted-foreground text-sm">Loading…</p>
        )}
        {!loading && items.length === 0 && !error && (
          <p className="p-6 text-muted-foreground text-sm">No events match.</p>
        )}
      </div>

      {nextCursor && (
        <button
          type="button"
          className="text-sm text-emerald-400 hover:underline disabled:opacity-50"
          disabled={loading}
          onClick={() => void load(nextCursor, true)}
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

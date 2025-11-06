"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

import { ApplicationDetailDrawer, type AppItem } from "./detail-drawer.client";
import { useBusyToast } from "@/hooks/useBusyToast";

type ApiResp = {
  items: AppItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export function ApplicationsTable() {
  const sp = useSearchParams();
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AppItem | null>(null);

  const { promise } = useBusyToast();

  const qs = useMemo(() => sp.toString(), [sp]);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/applications?${qs}`, {
        cache: "no-store",
      });
      const json: ApiResp = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const approveInline = (id: string) => {
    const req = fetch(`/api/platform/applications/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).then(async (res) => {
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.details || res.statusText);
      }
      return res.json();
    });

    promise(req, {
      loading: "Approving application…",
      success: "Application approved and invite sent",
      error: "Failed to approve application",
    }).then(fetchItems);
  };

  if (loading) return <div className="text-gray-600">Loading…</div>;
  if (!data || data.items.length === 0)
    return <div className="text-gray-600">No applications found.</div>;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              <th className="py-2 pr-2">School</th>
              <th className="py-2 pr-2">Type</th>
              <th className="py-2 pr-2">Admin</th>
              <th className="py-2 pr-2">Contact</th>
              <th className="py-2 pr-2">Location</th>
              <th className="py-2 pr-2 w-56">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((i) => (
              <tr key={i._id} className="border-b last:border-b-0">
                <td className="py-2 pr-2">
                  <button
                    onClick={() => {
                      setSelected(i);
                      setOpen(true);
                    }}
                    className="text-blue-700 hover:underline cursor-pointer"
                    title="Open details"
                  >
                    {i.schoolName}
                  </button>
                </td>
                <td className="py-2 pr-2">{i.schoolType}</td>
                <td className="py-2 pr-2">
                  {i.adminFirstName} {i.adminLastName}
                </td>
                <td className="py-2 pr-2">
                  <div className="text-gray-900">{i.adminEmail}</div>
                  {i.adminPhone && (
                    <div className="text-gray-500">{i.adminPhone}</div>
                  )}
                </td>
                <td className="py-2 pr-2">
                  {[i.city, i.region].filter(Boolean).join(", ")}
                </td>
                <td className="py-2 pr-2">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => approveInline(i._id)}
                      className="cursor-pointer"
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelected(i);
                        setOpen(true);
                      }}
                      className="cursor-pointer"
                    >
                      Details
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* simple footer */}
        <div className="flex items-center justify-between pt-4 text-sm text-gray-600">
          <div>Total: {data.total}</div>
          {/* Add paging controls later if needed; params already support page/limit */}
        </div>
      </div>

      <ApplicationDetailDrawer
        open={open}
        onOpenChange={setOpen}
        item={selected}
        onApproved={fetchItems}
        onRejected={fetchItems}
      />
    </>
  );
}

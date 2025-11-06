"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useBusyToast } from "@/hooks/useBusyToast";

export type AppItem = {
  _id: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone?: string;
  schoolName: string;
  schoolType: "Basic" | "Secondary";
  city?: string;
  region?: string;
  message?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export function ApplicationDetailDrawer({
  open,
  onOpenChange,
  item,
  onApproved,
  onRejected,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: AppItem | null;
  onApproved: () => void;
  onRejected: () => void;
}) {
  const { promise } = useBusyToast();
  const [reason, setReason] = useState("");

  if (!item) return null;

  const approve = () => {
    const req = fetch(`/api/platform/applications/${item._id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).then(async (res) => {
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.details || res.statusText);
      }
      return res.json();
    });

    promise(req, {
      loading: "Approving…",
      success: "Approved & invite sent",
      error: "Approval failed",
    }).then(() => {
      onApproved();
      onOpenChange(false);
    });
  };

  const reject = () => {
    const req = fetch(`/api/platform/applications/${item._id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).then(async (res) => {
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.details || res.statusText);
      }
      return res.json();
    });

    promise(req, {
      loading: "Rejecting…",
      success: "Rejected",
      error: "Rejection failed",
    }).then(() => {
      setReason("");
      onRejected();
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Application details</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <div className="text-gray-900 font-medium">{item.schoolName}</div>
            <Badge variant="secondary">{item.schoolType}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500">Admin</div>
              <div className="text-gray-900">
                {item.adminFirstName} {item.adminLastName}
              </div>
              <div className="text-gray-700">{item.adminEmail}</div>
              {item.adminPhone && (
                <div className="text-gray-500">{item.adminPhone}</div>
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500">Location</div>
              <div className="text-gray-900">
                {[item.city, item.region].filter(Boolean).join(", ") || "—"}
              </div>
            </div>
          </div>

          {item.message && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Message</div>
              <div className="rounded-md border p-3 bg-gray-50 text-gray-800 whitespace-pre-wrap">
                {item.message}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Submitted: {new Date(item.createdAt).toLocaleString()}
            </div>
            <Badge
              className={
                item.status === "pending"
                  ? ""
                  : item.status === "approved"
                  ? "bg-green-600"
                  : "bg-rose-600"
              }
            >
              {item.status}
            </Badge>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="text-xs text-gray-600">
              Rejection reason (optional)
            </div>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this application is rejected…"
            />
            <div className="flex gap-2">
              <Button onClick={approve} className="cursor-pointer">
                Approve
              </Button>
              <Button
                variant="outline"
                disabled={!reason.trim()}
                onClick={reject}
                className="cursor-pointer"
              >
                Reject
              </Button>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="ml-auto cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// src/components/admin/fees/InvoiceEventTimeline.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  FileText,
  DollarSign,
  XCircle,
  Edit,
  Clock,
  AlertCircle,
} from "lucide-react";
import { formatMoney } from "@/lib/fees/money";

type Event = {
  _id: string;
  eventType: string;
  description: string;
  createdAt: string | Date;
  performedBy?: {
    name: string;
    email: string;
  };
};

type Props = {
  events: Event[];
};

export function InvoiceEventTimeline({ events }: Props) {
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "created":
        return <FileText className="h-4 w-4 text-blue-300" />;
      case "issued":
        return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
      case "payment_recorded":
        return <DollarSign className="h-4 w-4 text-green-300" />;
      case "adjusted":
        return <Edit className="h-4 w-4 text-orange-300" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-rose-300" />;
      case "overdue_marked":
        return <AlertCircle className="h-4 w-4 text-red-300" />;
      default:
        return <Clock className="h-4 w-4 text-white/40" />;
    }
  };

  const getEventBadge = (eventType: string) => {
    const colors: Record<string, string> = {
      created: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      issued: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      payment_recorded: "bg-green-500/20 text-green-300 border-green-500/30",
      adjusted: "bg-orange-500/20 text-orange-300 border-orange-500/30",
      cancelled: "bg-rose-500/20 text-rose-300 border-rose-500/30",
      overdue_marked: "bg-red-500/20 text-red-300 border-red-500/30",
      allocation_updated: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    };
    return (
      <Badge className={colors[eventType] || "bg-gray-500/20 text-gray-300 border-gray-500/30"}>
        {eventType.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  if (!events || events.length === 0) {
    return (
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-slate-500/5 via-slate-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10">
          <CardTitle className="text-white">Event Timeline</CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <p className="text-sm text-white/60 text-center py-4">
            No events recorded yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-slate-500/5 via-slate-500/2 to-transparent"
        aria-hidden="true"
      />
      <CardHeader className="relative z-10">
        <CardTitle className="text-white">Event Timeline</CardTitle>
        <p className="text-sm text-white/60">
          Complete audit trail of invoice activities
        </p>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-white/10" />

          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={event._id} className="relative flex items-start gap-4">
                {/* Icon */}
                <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/20 bg-card">
                  {getEventIcon(event.eventType)}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getEventBadge(event.eventType)}
                      <p className="text-sm font-medium text-white">
                        {event.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Clock className="h-3 w-3" />
                    <span>
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                    {event.performedBy && (
                      <>
                        <span>•</span>
                        <span>By {event.performedBy.name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

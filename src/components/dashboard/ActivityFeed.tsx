"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useActivity } from "@/hooks/admin/useActivity";
import {
  Users,
  School,
  BookOpen,
  Mail,
  Calendar,
  DollarSign,
  FileText,
  Settings,
  Clock,
  GraduationCap,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { motion } from "framer-motion";
import { ActivityViewAllModal } from "./ActivityViewAllModal";
import {
  formatActivityActorPrimary,
  formatActivityDelegateStaffSummary,
} from "@/lib/audit/activityActorPresentation";

function getActivityIcon(type: string) {
  if (type.includes("student")) return GraduationCap;
  if (type.includes("teacher")) return Users;
  if (type.includes("class_group")) return School;
  if (type.includes("subject")) return BookOpen;
  if (type.includes("invitation")) return Mail;
  if (type.includes("academic_period")) return Calendar;
  if (type.includes("fee") || type.includes("payment")) return DollarSign;
  if (type.includes("report")) return FileText;
  if (type.includes("settings")) return Settings;
  return Clock;
}

function getActivityColor(type: string) {
  if (type.includes("student")) return "text-blue-300";
  if (type.includes("teacher")) return "text-purple-300";
  if (type.includes("class_group")) return "text-emerald-300";
  if (type.includes("invitation")) return "text-amber-300";
  if (type.includes("academic_period")) return "text-fuchsia-300";
  return "text-white/60";
}

export function ActivityFeed({ limit = 5 }: { limit?: number }) {
  const [viewAllOpen, setViewAllOpen] = React.useState(false);
  const { data: activityData, isLoading } = useActivity({ limit });

  const activities = activityData?.data || [];

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-indigo-500/15 via-indigo-500/5 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
              <Clock className="h-4 w-4 text-indigo-300" />
            </div>
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-center py-8 text-white/60">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-indigo-500/15 via-indigo-500/5 to-transparent"
        aria-hidden="true"
      />
      <CardHeader className="relative z-10 flex items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
            <Clock className="h-4 w-4 text-indigo-300" />
          </div>
          Recent Activity
        </CardTitle>
        {activities.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setViewAllOpen(true)}
            className="text-xs text-brand hover:text-brand/80 h-auto py-1 px-2"
          >
            View All
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="relative z-10">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-white/60">
            <Clock className="h-12 w-12 mx-auto mb-4 text-white/20" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.type);
              const colorClass = getActivityColor(activity.type);
              const performerName = formatActivityActorPrimary(
                activity.performedBy,
                activity.metadata
              );
              const delegateStaff = formatActivityDelegateStaffSummary(activity.metadata);

              return (
                <motion.div
                  key={activity._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors"
                >
                  <div
                    className={`p-2 rounded-lg bg-white/5 border border-white/10 ${colorClass}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/90 font-medium">
                      {activity.description}
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs text-white/50">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{performerName}</span>
                        <span>•</span>
                        <span>
                          {formatDistanceToNow(new Date(activity.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      {delegateStaff ? (
                        <div className="text-[11px] text-white/40">Staff: {delegateStaff}</div>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
      <ActivityViewAllModal open={viewAllOpen} onOpenChange={setViewAllOpen} />
    </Card>
  );
}

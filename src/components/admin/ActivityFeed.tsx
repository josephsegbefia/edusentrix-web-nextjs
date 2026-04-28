"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  UserPlus,
  Users,
  School,
  Mail,
  BookOpen,
  Calendar,
  DollarSign,
  FileText,
  Settings,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Ban,
  type LucideIcon,
} from "lucide-react";
import { useActivities } from "@/hooks/admin/useActivities";
import {
  formatActivityActorPrimary,
  formatActivityDelegateStaffSummary,
} from "@/lib/audit/activityActorPresentation";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { ActivityType } from "@/models/Activity";

function getActivityIcon(type: ActivityType): LucideIcon {
  if (type.startsWith("student.")) return UserPlus;
  if (type.startsWith("teacher.")) return Users;
  if (type.startsWith("class_group.")) return School;
  if (type.startsWith("invitation.")) return Mail;
  if (type.startsWith("subject.")) return BookOpen;
  if (type.startsWith("academic_period.")) return Calendar;
  if (type.startsWith("fee.") || type.startsWith("payment.")) return DollarSign;
  if (type.startsWith("report.")) return FileText;
  if (type.startsWith("settings.")) return Settings;
  return CheckCircle2;
}

function getActivityColor(type: ActivityType): string {
  if (type.startsWith("student.")) return "text-blue-300";
  if (type.startsWith("teacher.")) return "text-purple-300";
  if (type.startsWith("class_group.")) return "text-indigo-300";
  if (type.startsWith("invitation.")) return "text-violet-300";
  if (type.startsWith("subject.")) return "text-emerald-300";
  if (type.startsWith("academic_period.")) return "text-amber-300";
  if (type.startsWith("fee.") || type.startsWith("payment.")) return "text-green-300";
  if (type.startsWith("report.")) return "text-cyan-300";
  if (type.startsWith("settings.")) return "text-gray-300";
  return "text-white/60";
}

type ActivityFeedProps = {
  limit?: number;
  entityType?: string;
  showHeader?: boolean;
};

export function ActivityFeed({
  limit = 10,
  entityType,
  showHeader = true,
}: ActivityFeedProps) {
  const { data: activities = [], isLoading } = useActivities({
    entityType,
    limit,
  });

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardContent className="p-6">
          <div className="text-center text-white/60">Loading activities...</div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        {showHeader && (
          <CardHeader className="relative z-10">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                <Clock className="h-4 w-4 text-indigo-300" />
              </div>
              Recent Activity
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="relative z-10">
          <div className="text-center py-8 text-white/60">
            <Clock className="h-12 w-12 mx-auto mb-4 text-white/20" />
            <p>No recent activity</p>
          </div>
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
      {showHeader && (
        <CardHeader className="relative z-10">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
              <Clock className="h-4 w-4 text-indigo-300" />
            </div>
            Recent Activity
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="relative z-10">
        <div className="space-y-3">
          {activities.map((activity) => {
            const Icon = getActivityIcon(activity.type);
            const colorClass = getActivityColor(activity.type);
            const userName = formatActivityActorPrimary(activity.user, activity.metadata);
            const delegateStaff = formatActivityDelegateStaffSummary(activity.metadata);

            return (
              <div
                key={activity._id}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors"
              >
                <div className={`p-2 rounded-lg bg-white/5 border border-white/10 ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/90">{activity.description}</div>
                  <div className="mt-1 space-y-0.5 text-xs text-white/50">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{userName}</span>
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
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

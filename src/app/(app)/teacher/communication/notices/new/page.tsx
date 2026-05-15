"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Megaphone, Send, Smartphone, Users } from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuCheckboxItem,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuLabel,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { cn } from "@/lib/utils";

type NoticeForm = {
  title: string;
  message: string;
  classGroupIds: string[];
  priority: "normal" | "high";
  sendEmail: boolean;
};

function toggleSelection(ids: string[], id: string) {
  if (ids.includes(id)) {
    return ids.filter((value) => value !== id);
  }
  return [...ids, id];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toBodyHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

export default function NewTeacherNoticePage() {
  const router = useRouter();
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canPublish = can(permissions, PERMISSIONS.noticesPublish);

  const { data: classesData } = useTeacherClasses();
  const classes = React.useMemo(
    () => classesData?.data.classes || [],
    [classesData?.data.classes]
  );

  const [form, setForm] = React.useState<NoticeForm>({
    title: "",
    message: "",
    classGroupIds: [],
    priority: "normal",
    sendEmail: true,
  });

  const classOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((cls) => {
      if (cls._id && cls.name) map.set(cls._id, cls.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [classes]);

  const update = (patch: Partial<NoticeForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      busyToast.error("Title and message are required");
      return;
    }

    if (form.classGroupIds.length === 0) {
      busyToast.error("Select at least one class group");
      return;
    }

    const created = await busyToast.promise(
      fetch("/api/teacher/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          bodyText: form.message.trim(),
          bodyHtml: toBodyHtml(form.message.trim()),
          type: "notice",
          priority: form.priority,
          channels: form.sendEmail ? ["in_app", "email"] : ["in_app"],
          classGroupIds: form.classGroupIds,
        }),
      }).then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to create notice");
        }
        return payload;
      }),
      {
        loading: "Creating notice...",
        success: "Notice saved",
        error: "Failed to create notice",
      }
    );

    if (created?.data?.id) {
      await busyToast.promise(
        fetch(`/api/teacher/communications/${created.data.id}/send`, { method: "POST" }).then(async (res) => {
          const payload = await res.json().catch(() => null);
          if (!res.ok) throw new Error(payload?.error || "Failed to send notice");
          return payload;
        }),
        {
          loading: "Sending notice...",
          success: "Notice sent",
          error: "Failed to send notice",
        },
      );
    }

    router.push("/teacher/communication/notices");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/teacher/communication/notices" className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to notices
        </Link>
        <h1 className="text-2xl font-semibold text-white">New Notice</h1>
        <p className="text-sm text-white/60">Send a class notice through the app inbox, with optional email delivery.</p>
      </div>

      {!canPublish && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          You can draft notices, but publishing is disabled for your role.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-emerald-500/20 text-emerald-200">
                <Megaphone className="h-4 w-4" />
              </span>
              Notice details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Title</label>
              <Input
                value={form.title}
                onChange={(event) => update({ title: event.target.value })}
                placeholder="e.g. Homework reminder"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Message</label>
              <Textarea
                value={form.message}
                onChange={(event) => update({ message: event.target.value })}
                placeholder="Write the announcement details..."
                className="min-h-[140px] border-white/10 bg-white/5 text-white"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Class groups</label>
                <PremiumDropdownMenu>
                  <PremiumDropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full border-white/10 bg-white/5 text-white/70 hover:bg-white/10">
                      Select class groups
                    </Button>
                  </PremiumDropdownMenuTrigger>
                  <PremiumDropdownMenuContent align="start" className="min-w-[260px]">
                    <PremiumDropdownMenuLabel>Homeroom classes</PremiumDropdownMenuLabel>
                    {classOptions.map((cls) => (
                      <PremiumDropdownMenuCheckboxItem
                        key={cls.id}
                        checked={form.classGroupIds.includes(cls.id)}
                        onCheckedChange={() => update({ classGroupIds: toggleSelection(form.classGroupIds, cls.id) })}
                      >
                        {cls.name}
                      </PremiumDropdownMenuCheckboxItem>
                    ))}
                    {classOptions.length === 0 && (
                      <div className="px-3 py-2 text-xs text-white/50">No class groups available.</div>
                    )}
                  </PremiumDropdownMenuContent>
                </PremiumDropdownMenu>
                <div className="flex flex-wrap gap-2">
                  {form.classGroupIds.map((id) => {
                    const name = classOptions.find((item) => item.id === id)?.name;
                    return name ? (
                      <Badge key={id} className="bg-white/10 text-white/70">
                        {name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-3 text-sm text-white/70">
                  <span className="inline-flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-indigo-200" />
                    App inbox
                  </span>
                  <Badge className="bg-emerald-500/20 text-emerald-100">Always on</Badge>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm text-white/70">
                  <span className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4 text-sky-200" />
                    Email parents
                  </span>
                  <Switch checked={form.sendEmail} onCheckedChange={(checked) => update({ sendEmail: checked })} />
                </div>
                <div className="flex items-center justify-between gap-3 text-sm text-white/70">
                  <span>Mark as important</span>
                  <Switch
                    checked={form.priority === "high"}
                    onCheckedChange={(checked) => update({ priority: checked ? "high" : "normal" })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardContent className="space-y-2 p-4 text-sm text-white/60">
              <div className="font-semibold text-white">Delivery</div>
              <p>
                Teacher notices send immediately through the app inbox and optional email. Scheduled school-wide
                campaigns remain in the admin communications center.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className={cn("flex flex-wrap items-center gap-3", !canPublish && "opacity-70")}>        
        <Button
          onClick={handleSubmit}
          disabled={!canPublish}
          className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
        >
          <Send className="h-4 w-4" />
          Send notice
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/teacher/communication/notices")}
          className="border-white/10 text-white/60"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

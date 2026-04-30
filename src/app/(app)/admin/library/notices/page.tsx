"use client";

import * as React from "react";
import { format } from "date-fns";
import { Loader2, Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  LibraryBackLink,
  libraryGlassPanel,
  LibraryPageHeader,
  LibraryPageShell,
} from "@/components/admin/library/LibraryAdminChrome";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useLibraryCapabilitiesQuery,
  useLibraryNoticeCreateMutation,
  useLibraryNoticeUpdateMutation,
  useLibraryNoticesAdminQuery,
} from "@/hooks/admin/useLibraryAdmin";

const AUDIENCES = [
  "all",
  "students",
  "teachers",
  "parents",
  "class_group",
  "grade",
] as const;

export default function AdminLibraryNoticesPage() {
  const { data: capsRes } = useLibraryCapabilitiesQuery();
  const caps = capsRes?.data;
  const canManage = caps?.noticesManage ?? false;

  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const listQ = useLibraryNoticesAdminQuery(page, 15, statusFilter, canManage);

  const createM = useLibraryNoticeCreateMutation();
  const updateM = useLibraryNoticeUpdateMutation();

  const [title, setTitle] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [audience, setAudience] = React.useState<(typeof AUDIENCES)[number]>("all");
  const [audienceRefId, setAudienceRefId] = React.useState("");
  const [publishNow, setPublishNow] = React.useState(false);
  const [expiresAt, setExpiresAt] = React.useState("");

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    try {
      await createM.mutateAsync({
        title: title.trim(),
        message: message.trim(),
        audience,
        audienceRefId:
          audience === "class_group" || audience === "grade"
            ? audienceRefId.trim()
            : undefined,
        status: publishNow ? "published" : "draft",
        expiresAt: expiresAt.trim() ? new Date(`${expiresAt}T23:59:59.000Z`).toISOString() : null,
      });
      toast.success(publishNow ? "Notice published" : "Draft saved");
      setTitle("");
      setMessage("");
      setAudienceRefId("");
      setExpiresAt("");
      setPublishNow(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function setPublished(id: string) {
    try {
      await updateM.mutateAsync({ noticeId: id, body: { status: "published" } });
      toast.success("Published");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function setArchived(id: string) {
    try {
      await updateM.mutateAsync({ noticeId: id, body: { status: "archived" } });
      toast.success("Archived");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const items = listQ.data?.data?.items ?? [];
  const pag = listQ.data?.data?.pagination;

  return (
    <LibraryPageShell>
      <LibraryBackLink href="/admin/library" label="Library home" />
      <LibraryPageHeader
        icon={Megaphone}
        title="Patron notices"
        description="Messages for students, teachers, and parents in the library area of their apps."
      />

      {!canManage ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
          You do not have permission to manage library notices.
        </p>
      ) : null}

      {canManage ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className={`${libraryGlassPanel} space-y-4 p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-white">All notices</h2>
              <PremiumSelect
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <PremiumSelectTrigger className="w-[160px] border-white/15 bg-white/5 text-white">
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="all">All statuses</PremiumSelectItem>
                  <PremiumSelectItem value="draft">Draft</PremiumSelectItem>
                  <PremiumSelectItem value="published">Published</PremiumSelectItem>
                  <PremiumSelectItem value="archived">Archived</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
            </div>

            {listQ.isFetching ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-white/40" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-white/60">No notices yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/80">Title</TableHead>
                    <TableHead className="text-white/80">Audience</TableHead>
                    <TableHead className="text-white/80">Status</TableHead>
                    <TableHead className="text-white/80">Published</TableHead>
                    <TableHead className="text-right text-white/80">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((n) => (
                    <TableRow key={n.id} className="border-white/10">
                      <TableCell className="font-medium text-white">{n.title}</TableCell>
                      <TableCell className="text-white/70">{n.audience}</TableCell>
                      <TableCell className="text-white/70">{n.status}</TableCell>
                      <TableCell className="text-white/60">
                        {n.publishedAt ? format(new Date(n.publishedAt), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {n.status === "draft" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-white/20 text-white"
                            onClick={() => void setPublished(n.id)}
                            disabled={updateM.isPending}
                          >
                            Publish
                          </Button>
                        ) : null}
                        {n.status !== "archived" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-white/70 hover:text-white"
                            onClick={() => void setArchived(n.id)}
                            disabled={updateM.isPending}
                          >
                            Archive
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {pag && pag.totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3 text-sm text-white/70">
                <span>
                  Page {pag.page} of {pag.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-white"
                    disabled={!pag.hasPreviousPage}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-white"
                    disabled={!pag.hasNextPage}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={onCreate}
            className={`${libraryGlassPanel} h-fit space-y-4 p-5`}
          >
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <Plus className="h-4 w-4" />
              New notice
            </h2>
            <div className="space-y-2">
              <Label className="text-white/80">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-white/15 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="border-white/15 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Audience</Label>
              <PremiumSelect
                value={audience}
                onValueChange={(v) => setAudience(v as (typeof AUDIENCES)[number])}
              >
                <PremiumSelectTrigger className="border-white/15 bg-white/5 text-white">
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {AUDIENCES.map((a) => (
                    <PremiumSelectItem key={a} value={a}>
                      {a.replace(/_/g, " ")}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            {audience === "class_group" || audience === "grade" ? (
              <div className="space-y-2">
                <Label className="text-white/80">Class group or grade ID</Label>
                <Input
                  value={audienceRefId}
                  onChange={(e) => setAudienceRefId(e.target.value)}
                  placeholder="Mongo ObjectId"
                  className="border-white/15 bg-white/5 text-white"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label className="text-white/80">Expires (optional)</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="border-white/15 bg-white/5 text-white"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={publishNow}
                onChange={(e) => setPublishNow(e.target.checked)}
                className="rounded border-white/30"
              />
              Publish immediately
            </label>
            <Button
              type="submit"
              className="w-full bg-linear-to-r from-teal-500 to-cyan-600 text-white"
              disabled={createM.isPending}
            >
              {createM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save notice"}
            </Button>
          </form>
        </div>
      ) : null}
    </LibraryPageShell>
  );
}

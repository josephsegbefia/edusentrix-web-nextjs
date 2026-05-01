"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  useTeacherLessonResources,
  useTeacherCreateLessonResource,
  useTeacherUpdateLessonResource,
  useTeacherDeleteLessonResource,
} from "@/hooks/teacher/useTeacherLessonResources";
import type { LessonResourceDto } from "@/types/lesson-resources";
import type { LessonResourceVisibility } from "@/models/LessonResource";

const VISIBILITY_LABEL: Record<LessonResourceVisibility, string> = {
  teacher_only: "Teachers only",
  students: "Students",
  students_and_parents: "Students & parents",
};

type LibrarySearchHit = {
  id: string;
  title: string;
  author?: string;
};

type Props = {
  lessonId: string;
  canWrite: boolean;
  lessonStatus: string;
};

export function TeacherLessonResourcesPanel({ lessonId, canWrite, lessonStatus }: Props) {
  const busyToast = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { data, isLoading, error } = useTeacherLessonResources(lessonId, true);
  const createMut = useTeacherCreateLessonResource(lessonId);
  const updateMut = useTeacherUpdateLessonResource(lessonId);
  const deleteMut = useTeacherDeleteLessonResource(lessonId);

  const [showAddLink, setShowAddLink] = React.useState(false);
  const [linkTitle, setLinkTitle] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkDescription, setLinkDescription] = React.useState("");
  const [linkVisibility, setLinkVisibility] = React.useState<LessonResourceVisibility>("students");

  const [showAddBook, setShowAddBook] = React.useState(false);
  const [bookSearch, setBookSearch] = React.useState("");
  const [bookHits, setBookHits] = React.useState<LibrarySearchHit[]>([]);
  const [bookSearchLoading, setBookSearchLoading] = React.useState(false);
  const [selectedBook, setSelectedBook] = React.useState<LibrarySearchHit | null>(null);
  const [bookTitleOverride, setBookTitleOverride] = React.useState("");
  const [bookDescription, setBookDescription] = React.useState("");
  const [bookVisibility, setBookVisibility] = React.useState<LessonResourceVisibility>("students");

  const [editing, setEditing] = React.useState<LessonResourceDto | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editUrl, setEditUrl] = React.useState("");
  const [editVisibility, setEditVisibility] = React.useState<LessonResourceVisibility>("students");

  const items = data?.data.items || [];

  const publishedHint =
    lessonStatus !== "published"
      ? "Student-visible resources appear after you publish this lesson."
      : null;

  const runBookSearch = React.useCallback(async (q: string) => {
    const term = q.trim();
    if (term.length < 2) {
      setBookHits([]);
      return;
    }
    setBookSearchLoading(true);
    try {
      const sp = new URLSearchParams({ search: term, limit: "15", page: "1" });
      const res = await fetch(`/api/teacher/library/books?${sp}`, { cache: "no-store" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { items?: Array<{ id: string; title: string; author?: string }> };
      };
      if (res.ok && json.success && json.data?.items) {
        setBookHits(
          json.data.items.map((b) => ({
            id: b.id,
            title: b.title,
            author: b.author,
          }))
        );
      } else {
        setBookHits([]);
      }
    } finally {
      setBookSearchLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!showAddBook) return;
    const t = window.setTimeout(() => {
      void runBookSearch(bookSearch);
    }, 320);
    return () => window.clearTimeout(t);
  }, [bookSearch, showAddBook, runBookSearch]);

  const closeAddBook = () => {
    setShowAddBook(false);
    setBookSearch("");
    setBookHits([]);
    setSelectedBook(null);
    setBookTitleOverride("");
    setBookDescription("");
    setBookVisibility("students");
  };

  const submitLink = async () => {
    await busyToast.promise(
      createMut.mutateAsync({
        kind: "link",
        title: linkTitle.trim(),
        url: linkUrl.trim(),
        description: linkDescription.trim() || null,
        visibility: linkVisibility,
      }),
      {
        loading: "Adding link…",
        success: "Resource added",
        error: (e) => (e instanceof Error ? e.message : "Failed"),
      }
    );
    setShowAddLink(false);
    setLinkTitle("");
    setLinkUrl("");
    setLinkDescription("");
    setLinkVisibility("students");
  };

  const submitBook = async () => {
    if (!selectedBook) return;
    await busyToast.promise(
      createMut.mutateAsync({
        kind: "library_book",
        libraryBookId: selectedBook.id,
        title: bookTitleOverride.trim() || undefined,
        description: bookDescription.trim() || null,
        visibility: bookVisibility,
      }),
      {
        loading: "Attaching book…",
        success: "Library book linked",
        error: (e) => (e instanceof Error ? e.message : "Failed"),
      }
    );
    closeAddBook();
  };

  const openEdit = (r: LessonResourceDto) => {
    setEditing(r);
    setEditTitle(r.title);
    setEditDescription(r.description ?? "");
    setEditUrl(r.url ?? "");
    setEditVisibility(r.visibility);
  };

  const closeEdit = () => setEditing(null);

  const submitEdit = async () => {
    if (!editing) return;
    await busyToast.promise(
      updateMut.mutateAsync({
        resourceId: editing.id,
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        url: editing.kind === "link" ? editUrl.trim() : undefined,
        visibility: editVisibility,
      }),
      {
        loading: "Saving…",
        success: "Updated",
        error: (e) => (e instanceof Error ? e.message : "Failed"),
      }
    );
    closeEdit();
  };

  const handleDelete = async (r: LessonResourceDto) => {
    const r2 = await confirm({
      title: "Remove resource?",
      description:
        r.kind === "library_book"
          ? "Students will no longer see this linked book on the lesson."
          : "Students will no longer see this link.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      intent: "destructive",
    });
    if (r2 !== "confirm") return;
    await busyToast.promise(deleteMut.mutateAsync(r.id), {
      loading: "Removing…",
      success: "Removed",
      error: (e) => (e instanceof Error ? e.message : "Failed"),
    });
  };

  return (
    <>
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-200">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">Resources</CardTitle>
              <p className="text-xs text-white/50">Links and library catalogue</p>
            </div>
          </div>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowAddLink(true)}
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add link
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowAddBook(true)}
                className="bg-sky-500/20 text-sky-100 hover:bg-sky-500/30"
              >
                <BookOpen className="mr-1 h-4 w-4" />
                From library
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {publishedHint && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
              {publishedHint}
            </div>
          )}
          {error && <p className="text-sm text-rose-300">{error.message}</p>}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 py-10 text-center text-sm text-white/50">
              <Link2 className="mx-auto mb-2 h-8 w-8 text-white/25" />
              No resources yet. Add a web link or pick a book from your school library.
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {r.kind === "library_book" ? (
                          <BookOpen className="h-4 w-4 shrink-0 text-sky-300" />
                        ) : (
                          <ExternalLink className="h-4 w-4 shrink-0 text-sky-300" />
                        )}
                        <span className="font-medium text-white/95">{r.title}</span>
                        <Badge variant="outline" className="border-white/20 text-[10px] text-white/60">
                          {VISIBILITY_LABEL[r.visibility]}
                        </Badge>
                      </div>
                      {r.description && (
                        <p className="text-sm text-white/55">{r.description}</p>
                      )}
                      {r.kind === "link" && r.url && (
                        <p className="truncate text-xs text-sky-300/90">{r.url}</p>
                      )}
                      {r.kind === "library_book" && r.libraryBookId && (
                        <Link
                          href={`/teacher/library/${r.libraryBookId}`}
                          className="inline-flex items-center gap-1 text-xs text-sky-300 hover:underline"
                        >
                          Open in library
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    {canWrite && (
                      <PremiumDropdownMenu>
                        <PremiumDropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0 border border-white/10 text-white/70"
                          >
                            <span className="sr-only">Actions</span>
                            <Link2 className="h-4 w-4" />
                          </Button>
                        </PremiumDropdownMenuTrigger>
                        <PremiumDropdownMenuContent align="end">
                          <PremiumDropdownMenuItem
                            icon={<Pencil className="h-4 w-4" />}
                            onClick={() => openEdit(r)}
                          >
                            Edit
                          </PremiumDropdownMenuItem>
                          <PremiumDropdownMenuItem
                            icon={<Trash2 className="h-4 w-4" />}
                            variant="destructive"
                            onClick={() => void handleDelete(r)}
                          >
                            Delete
                          </PremiumDropdownMenuItem>
                        </PremiumDropdownMenuContent>
                      </PremiumDropdownMenu>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ResponsiveModal
        open={showAddLink}
        onClose={() => setShowAddLink(false)}
        title="Add link"
        widthClass="max-w-lg"
      >
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label className="text-white/80">Title</Label>
            <Input
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              className="border-white/10 bg-white/5 text-white"
              placeholder="e.g. Chapter 3 reading"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">URL</Label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="border-white/10 bg-white/5 text-white"
              placeholder="https://…"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Description (optional)</Label>
            <Textarea
              value={linkDescription}
              onChange={(e) => setLinkDescription(e.target.value)}
              className="min-h-[72px] border-white/10 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Visibility</Label>
            <PremiumSelect
              value={linkVisibility}
              onValueChange={(v) => setLinkVisibility(v as LessonResourceVisibility)}
            >
              <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                <PremiumSelectValue />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {(Object.keys(VISIBILITY_LABEL) as LessonResourceVisibility[]).map((k) => (
                  <PremiumSelectItem key={k} value={k}>
                    {VISIBILITY_LABEL[k]}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAddLink(false)}
              className="text-white/70"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitLink()}
              disabled={createMut.isPending || !linkTitle.trim() || !linkUrl.trim()}
              className="bg-sky-500/25 text-sky-100 hover:bg-sky-500/35"
            >
              Add
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={showAddBook}
        onClose={closeAddBook}
        title="Link library book"
        widthClass="max-w-lg"
      >
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label className="text-white/80">Search catalogue</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                className="border-white/10 bg-white/5 pl-9 text-white"
                placeholder="Type title or author…"
              />
              {bookSearchLoading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/40" />
              )}
            </div>
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2">
            {bookHits.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-white/45">
                {bookSearch.trim().length < 2
                  ? "Enter at least 2 characters."
                  : "No matches."}
              </p>
            ) : (
              bookHits.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setSelectedBook(b);
                    setBookTitleOverride("");
                  }}
                  className={`flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selectedBook?.id === b.id
                      ? "bg-sky-500/20 text-white"
                      : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  <span className="font-medium">{b.title}</span>
                  {b.author && <span className="text-xs text-white/50">{b.author}</span>}
                </button>
              ))
            )}
          </div>
          {selectedBook && (
            <>
              <div className="space-y-2">
                <Label className="text-white/80">Display title (optional override)</Label>
                <Input
                  value={bookTitleOverride}
                  onChange={(e) => setBookTitleOverride(e.target.value)}
                  placeholder={selectedBook.title}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Note for students (optional)</Label>
                <Textarea
                  value={bookDescription}
                  onChange={(e) => setBookDescription(e.target.value)}
                  className="min-h-[72px] border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Visibility</Label>
                <PremiumSelect
                  value={bookVisibility}
                  onValueChange={(v) => setBookVisibility(v as LessonResourceVisibility)}
                >
                  <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {(Object.keys(VISIBILITY_LABEL) as LessonResourceVisibility[]).map((k) => (
                      <PremiumSelectItem key={k} value={k}>
                        {VISIBILITY_LABEL[k]}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={closeAddBook} className="text-white/70">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitBook()}
              disabled={createMut.isPending || !selectedBook}
              className="bg-sky-500/25 text-sky-100 hover:bg-sky-500/35"
            >
              Attach
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      <ResponsiveModal open={!!editing} onClose={closeEdit} title="Edit resource" widthClass="max-w-lg">
        {editing && (
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-2">
              <Label className="text-white/80">Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="min-h-[72px] border-white/10 bg-white/5 text-white"
              />
            </div>
            {editing.kind === "link" && (
              <div className="space-y-2">
                <Label className="text-white/80">URL</Label>
                <Input
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            )}
            {editing.kind === "library_book" && (
              <p className="text-xs text-white/45">
                To change the catalogue entry, remove this resource and add another book.
              </p>
            )}
            <div className="space-y-2">
              <Label className="text-white/80">Visibility</Label>
              <PremiumSelect
                value={editVisibility}
                onValueChange={(v) => setEditVisibility(v as LessonResourceVisibility)}
              >
                <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {(Object.keys(VISIBILITY_LABEL) as LessonResourceVisibility[]).map((k) => (
                    <PremiumSelectItem key={k} value={k}>
                      {VISIBILITY_LABEL[k]}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeEdit} className="text-white/70">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void submitEdit()}
                disabled={updateMut.isPending || !editTitle.trim() || (editing.kind === "link" && !editUrl.trim())}
                className="bg-sky-500/25 text-sky-100 hover:bg-sky-500/35"
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {confirmationDialog}
    </>
  );
}

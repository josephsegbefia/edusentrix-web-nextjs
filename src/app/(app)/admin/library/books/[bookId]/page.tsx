"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  Archive,
  BookOpenCheck,
  CheckCircle2,
  Loader2,
  Package,
  PackageCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Checkbox } from "@/components/ui/checkbox";
import { LibraryBookCoverUpload } from "@/components/admin/library/LibraryBookCoverUpload";
import {
  useLibraryBookQuery,
  useLibraryCopiesQuery,
  useLibraryBookMutations,
  useLibraryCapabilitiesQuery,
} from "@/hooks/admin/useLibraryAdmin";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { useSchool } from "@/hooks/admin/useSchool";
import {
  LibraryBackLink,
  LibraryEmptyState,
  libraryGlassPanel,
  LibraryPageHeader,
  LibraryPageShell,
  LibraryStatCard,
} from "@/components/admin/library/LibraryAdminChrome";
import { LibraryCopyLabelButton } from "@/components/admin/library/LibraryCopyLabelButton";

export default function AdminLibraryBookDetailPage() {
  const params = useParams();
  const bookId = typeof params.bookId === "string" ? params.bookId : "";
  const { data: schoolRes } = useSchool();
  const schoolId = schoolRes?.data?.id ?? "";
  const { data: grades = [] } = useGradeOptions();

  const { data: bookRes, isLoading: bookLoading } = useLibraryBookQuery(bookId);
  const book = bookRes?.data;

  const [includeArchived, setIncludeArchived] = React.useState(false);
  const { data: copiesRes, isLoading: copiesLoading } = useLibraryCopiesQuery(
    bookId,
    includeArchived
  );
  const copies = copiesRes?.data?.items ?? [];

  const { updateBook, createCopy, updateCopy, generateCopyCodes } = useLibraryBookMutations();
  const { data: capsRes } = useLibraryCapabilitiesQuery();
  const canUpdateBook = capsRes?.data?.booksUpdate ?? false;
  const canArchiveBook = capsRes?.data?.booksArchive ?? false;
  const canCreateCopy = capsRes?.data?.copiesCreate ?? false;
  const canUpdateCopy = capsRes?.data?.copiesUpdate ?? false;

  const [title, setTitle] = React.useState("");
  const [author, setAuthor] = React.useState("");
  const [isbn, setIsbn] = React.useState("");
  const [publisher, setPublisher] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [language, setLanguage] = React.useState("English");
  const [description, setDescription] = React.useState("");
  const [shelfLocation, setShelfLocation] = React.useState("");
  const [tagsRaw, setTagsRaw] = React.useState("");
  const [gradeLevelIds, setGradeLevelIds] = React.useState<string[]>([]);
  const [coverImageUrl, setCoverImageUrl] = React.useState<string | undefined>();
  const [coverImageKey, setCoverImageKey] = React.useState<string | undefined>();

  const [newCopyCode, setNewCopyCode] = React.useState("");
  const [newCondition, setNewCondition] = React.useState<"new" | "good" | "fair" | "damaged" | "lost">(
    "good"
  );

  React.useEffect(() => {
    if (!book) return;
    setTitle(book.title ?? "");
    setAuthor((book.author as string) ?? "");
    setIsbn((book.isbn as string) ?? "");
    setPublisher((book.publisher as string) ?? "");
    setCategory((book.category as string) ?? "");
    setSubject((book.subject as string) ?? "");
    setLanguage((book.language as string) ?? "English");
    setDescription((book.description as string) ?? "");
    setShelfLocation((book.shelfLocation as string) ?? "");
    setTagsRaw(Array.isArray(book.tags) ? (book.tags as string[]).join(", ") : "");
    setGradeLevelIds(
      Array.isArray(book.gradeLevelIds)
        ? (book.gradeLevelIds as string[]).map(String)
        : []
    );
    setCoverImageUrl(book.coverImageUrl as string | undefined);
    setCoverImageKey(book.coverImageKey as string | undefined);
  }, [book]);

  function toggleGrade(id: string) {
    setGradeLevelIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  async function saveBook() {
    if (!bookId || !title.trim()) {
      toast.error("Title is required");
      return;
    }
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      await updateBook.mutateAsync({
        bookId,
        body: {
          title: title.trim(),
          author: author.trim() || undefined,
          isbn: isbn.trim() || undefined,
          publisher: publisher.trim() || undefined,
          category: category.trim() || undefined,
          subject: subject.trim() || undefined,
          language: language.trim() || "English",
          description: description.trim() || undefined,
          shelfLocation: shelfLocation.trim() || undefined,
          tags,
          gradeLevelIds,
          coverImageUrl: coverImageUrl || undefined,
          coverImageKey: coverImageKey || undefined,
        },
      });
      toast.success("Book saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function archiveBook() {
    if (!bookId) return;
    try {
      await updateBook.mutateAsync({
        bookId,
        body: { status: "archived" },
      });
      toast.success("Book archived");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not archive");
    }
  }

  async function restoreBook() {
    if (!bookId) return;
    try {
      await updateBook.mutateAsync({
        bookId,
        body: { status: "active" },
      });
      toast.success("Book restored");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restore");
    }
  }

  async function addCopy() {
    if (!bookId || !newCopyCode.trim()) {
      toast.error("Copy code is required");
      return;
    }
    try {
      await createCopy.mutateAsync({
        bookId,
        body: {
          copyCode: newCopyCode.trim(),
          condition: newCondition,
          status: "available",
          source: "purchase",
        },
      });
      toast.success("Copy added");
      setNewCopyCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add copy");
    }
  }

  if (!bookId) {
    return (
      <LibraryPageShell>
        <LibraryEmptyState
          title="Missing book id"
          description="The selected catalogue record could not be opened."
        />
      </LibraryPageShell>
    );
  }

  if (bookLoading || !book) {
    return (
      <LibraryPageShell>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-white/40" />
        </div>
      </LibraryPageShell>
    );
  }

  const isArchived = book.status === "archived";

  return (
    <LibraryPageShell>
      <LibraryBackLink href="/admin/library/books" label="Books" />
      <LibraryPageHeader
        icon={BookOpenCheck}
        title={book.title}
        description={`${String(book.author || "Unknown author")} · Manage metadata, cover image, reading levels, and physical copies.`}
        actions={
          <>
            {canArchiveBook ? (
              isArchived ? (
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10 hover:text-white"
                  onClick={() => void restoreBook()}
                  disabled={updateBook.isPending}
                >
                  Restore to catalogue
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                  onClick={() => void archiveBook()}
                  disabled={updateBook.isPending}
                >
                  Archive book
                </Button>
              )
            ) : null}
            {canUpdateBook ? (
              <Button
                onClick={() => void saveBook()}
                disabled={updateBook.isPending}
                className="bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700"
              >
                {updateBook.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <LibraryStatCard
          icon={Package}
          label="Total copies"
          value={book.totalCopies}
          helper="Physical copies attached to this title."
          tone="cyan"
        />
        <LibraryStatCard
          icon={PackageCheck}
          label="Available"
          value={book.availableCopies}
          helper="Copies currently ready for circulation."
          tone="emerald"
        />
        <LibraryStatCard
          icon={isArchived ? Archive : CheckCircle2}
          label="Catalogue status"
          value={
            <span className={isArchived ? "text-amber-100" : "text-emerald-100"}>
              {isArchived ? "Archived" : "Active"}
            </span>
          }
          helper={isArchived ? "Hidden from the default catalogue list." : "Shown in the active catalogue."}
          tone={isArchived ? "amber" : "violet"}
        />
      </div>

      {isArchived ? (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          This title is archived. Copies remain on file, but it won’t appear in the default active list.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className={`${libraryGlassPanel} space-y-5 p-5`}>
          <div>
            <h2 className="text-base font-semibold text-white">Book details</h2>
            <p className="mt-1 text-sm text-white/50">Catalogue metadata for this title.</p>
          </div>
          <fieldset
            disabled={!canUpdateBook}
            className="grid gap-3 border-0 p-0 disabled:opacity-70 min-w-0"
          >
            <div className="space-y-2">
              <Label className="text-white/80">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-white/15 bg-white/[0.05] text-white"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/80">Author</Label>
                <Input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="border-white/15 bg-white/[0.05] text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">ISBN</Label>
                <Input
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  className="border-white/15 bg-white/[0.05] text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Publisher</Label>
                <Input
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  className="border-white/15 bg-white/[0.05] text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Language</Label>
                <Input
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="border-white/15 bg-white/[0.05] text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="border-white/15 bg-white/[0.05] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Tags</Label>
              <Input
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                className="border-white/15 bg-white/[0.05] text-white"
              />
            </div>
          </fieldset>
        </section>

        <aside className="space-y-6">
        <section className={`${libraryGlassPanel} space-y-4 p-5`}>
          <h2 className="text-base font-semibold text-white">Cover image</h2>
          {schoolId ? (
            <LibraryBookCoverUpload
              schoolId={schoolId}
              readOnly={!canUpdateBook}
              previewUrl={coverImageUrl ?? null}
              onUploaded={({ url, key }) => {
                setCoverImageUrl(url);
                setCoverImageKey(key);
              }}
            />
          ) : null}
        </section>

        <section className={`${libraryGlassPanel} space-y-4 p-5`}>
          <div>
            <h2 className="text-base font-semibold text-white">Reading levels</h2>
            <p className="mt-1 text-sm text-white/50">Optional grade links for library discovery.</p>
          </div>
          <fieldset
            disabled={!canUpdateBook}
            className="grid max-h-48 gap-2 overflow-y-auto border-0 p-0 disabled:opacity-70 min-w-0"
          >
            {grades.map((g) => (
              <label
                key={g._id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
              >
                <Checkbox
                  checked={gradeLevelIds.includes(g._id)}
                  onCheckedChange={() => toggleGrade(g._id)}
                />
                {g.name}
              </label>
            ))}
          </fieldset>
        </section>
        </aside>
      </div>

      <section className={`${libraryGlassPanel} space-y-4 p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Copies</h2>
            <p className="mt-1 text-sm text-white/50">Manage copy status and condition.</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-white/60">
            <Checkbox
              checked={includeArchived}
              onCheckedChange={(c) => setIncludeArchived(Boolean(c))}
            />
            Show archived copies
          </label>
        </div>
        {copiesLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-linear-to-br from-white/5 to-transparent">
            <Table>
              <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/70">Code</TableHead>
                      <TableHead className="text-white/70">Status</TableHead>
                      <TableHead className="text-white/70">Condition</TableHead>
                      <TableHead className="text-white/70 text-center">Label</TableHead>
                      <TableHead className="text-white/70">Actions</TableHead>
                    </TableRow>
              </TableHeader>
              <TableBody>
                {copies.length === 0 ? (
                    <TableRow className="border-white/10 hover:bg-transparent">
                    <TableCell colSpan={5} className="p-6">
                      <LibraryEmptyState
                        title="No copies yet"
                        description="Add the first physical copy below to start tracking inventory for this title."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  copies.map((c) => (
                    <CopyRow
                      key={c.id}
                      copy={c}
                      bookId={bookId}
                      updateCopy={updateCopy}
                      generateCopyCodes={generateCopyCodes}
                      canEdit={canUpdateCopy}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3 border-t border-white/10 pt-4">
          <div className="space-y-2">
            <Label className="text-white/80">New copy code</Label>
            <Input
              value={newCopyCode}
              onChange={(e) => setNewCopyCode(e.target.value)}
              placeholder="e.g. B-1042"
              className="w-[200px] border-white/15 bg-white/[0.05] text-white"
              disabled={!canCreateCopy}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Condition</Label>
            <PremiumSelect
              value={newCondition}
              onValueChange={(v) => setNewCondition(v as typeof newCondition)}
            >
              <PremiumSelectTrigger
                className="w-[160px] border-white/15 bg-white/[0.05] text-white"
                disabled={!canCreateCopy}
              >
                <PremiumSelectValue />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="new">New</PremiumSelectItem>
                <PremiumSelectItem value="good">Good</PremiumSelectItem>
                <PremiumSelectItem value="fair">Fair</PremiumSelectItem>
                <PremiumSelectItem value="damaged">Damaged</PremiumSelectItem>
                <PremiumSelectItem value="lost">Lost</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
          <Button
            type="button"
            onClick={() => void addCopy()}
            disabled={!canCreateCopy || createCopy.isPending}
            className="bg-white/10 text-white hover:bg-white/15"
          >
            {createCopy.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Package className="mr-2 h-4 w-4" />
                Add copy
              </>
            )}
          </Button>
        </div>
      </section>
    </LibraryPageShell>
  );
}

function CopyRow({
  copy,
  bookId,
  updateCopy,
  generateCopyCodes,
  canEdit,
}: {
  copy: {
    id: string;
    copyCode: string;
    barcode?: string;
    qrCode?: string;
    status: string;
    condition: string;
  };
  bookId: string;
  updateCopy: ReturnType<typeof useLibraryBookMutations>["updateCopy"];
  generateCopyCodes: ReturnType<typeof useLibraryBookMutations>["generateCopyCodes"];
  canEdit: boolean;
}) {
  const [status, setStatus] = React.useState(copy.status);
  const [condition, setCondition] = React.useState(copy.condition);

  React.useEffect(() => {
    setStatus(copy.status);
    setCondition(copy.condition);
  }, [copy.status, copy.condition]);

  async function save() {
    try {
      await updateCopy.mutateAsync({
        copyId: copy.id,
        bookId,
        body: { status: status as never, condition: condition as never },
      });
      toast.success("Copy updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <TableRow className="border-white/10">
      <TableCell className="font-medium text-white">
        <div>{copy.copyCode}</div>
        {copy.barcode ? (
          <div className="mt-0.5 font-mono text-[10px] text-white/45">{copy.barcode}</div>
        ) : null}
      </TableCell>
      <TableCell>
        <PremiumSelect value={status} onValueChange={setStatus}>
          <PremiumSelectTrigger
            className="h-9 w-[140px] border-white/15 bg-white/[0.05] text-white text-xs"
            disabled={!canEdit}
          >
            <PremiumSelectValue />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="available">Available</PremiumSelectItem>
            <PremiumSelectItem value="borrowed">Borrowed</PremiumSelectItem>
            <PremiumSelectItem value="reserved">Reserved</PremiumSelectItem>
            <PremiumSelectItem value="maintenance">Maintenance</PremiumSelectItem>
            <PremiumSelectItem value="lost">Lost</PremiumSelectItem>
            <PremiumSelectItem value="damaged">Damaged</PremiumSelectItem>
            <PremiumSelectItem value="archived">Archived</PremiumSelectItem>
          </PremiumSelectContent>
        </PremiumSelect>
      </TableCell>
      <TableCell>
        <PremiumSelect value={condition} onValueChange={setCondition}>
          <PremiumSelectTrigger
            className="h-9 w-[120px] border-white/15 bg-white/[0.05] text-white text-xs"
            disabled={!canEdit}
          >
            <PremiumSelectValue />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="new">New</PremiumSelectItem>
            <PremiumSelectItem value="good">Good</PremiumSelectItem>
            <PremiumSelectItem value="fair">Fair</PremiumSelectItem>
            <PremiumSelectItem value="damaged">Damaged</PremiumSelectItem>
            <PremiumSelectItem value="lost">Lost</PremiumSelectItem>
          </PremiumSelectContent>
        </PremiumSelect>
      </TableCell>
      <TableCell className="text-center">
        <LibraryCopyLabelButton
          bookId={bookId}
          copy={copy}
          canManage={canEdit}
          generateCopyCodes={generateCopyCodes}
        />
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="outline"
          className="border-white/20 text-white text-xs h-8"
          onClick={() => void save()}
          disabled={!canEdit || updateCopy.isPending}
        >
          Apply
        </Button>
      </TableCell>
    </TableRow>
  );
}

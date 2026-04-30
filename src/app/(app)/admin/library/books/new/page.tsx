"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookPlus, ImagePlus, Layers3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { LibraryBookCoverUpload } from "@/components/admin/library/LibraryBookCoverUpload";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { useSchool } from "@/hooks/admin/useSchool";
import { useLibraryBookMutations, useLibraryCapabilitiesQuery } from "@/hooks/admin/useLibraryAdmin";
import {
  LibraryBackLink,
  libraryGlassPanel,
  LibraryPageHeader,
  LibraryPageShell,
} from "@/components/admin/library/LibraryAdminChrome";

export default function AdminLibraryNewBookPage() {
  const router = useRouter();
  const { data: schoolRes } = useSchool();
  const schoolId = schoolRes?.data?.id ?? "";
  const { data: grades = [] } = useGradeOptions();
  const { createBook } = useLibraryBookMutations();
  const { data: capsRes, isLoading: capsLoading } = useLibraryCapabilitiesQuery();
  const canCreate = capsRes?.data?.booksCreate ?? false;

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
  const [initialCopies, setInitialCopies] = React.useState("0");
  const [coverImageUrl, setCoverImageUrl] = React.useState<string | undefined>();
  const [coverImageKey, setCoverImageKey] = React.useState<string | undefined>();

  function toggleGrade(id: string) {
    setGradeLevelIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const nCopies = Math.max(0, parseInt(initialCopies, 10) || 0);
    try {
      await createBook.mutateAsync({
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
        initialCopies: nCopies,
        coverImageUrl: coverImageUrl || undefined,
        coverImageKey: coverImageKey || undefined,
      });
      toast.success("Book created");
      router.push("/admin/library/books");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create book");
    }
  }

  if (capsLoading) {
    return (
      <LibraryPageShell>
        <LibraryBackLink href="/admin/library/books" label="Back to books" />
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-white/40" />
        </div>
      </LibraryPageShell>
    );
  }

  if (!canCreate) {
    return (
      <LibraryPageShell>
        <LibraryBackLink href="/admin/library/books" label="Back to books" />
        <LibraryPageHeader
          icon={BookPlus}
          title="New book"
          description="Your library delegation does not include creating catalogue records."
        />
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
          Ask a school admin for the “create books” library permission or use the librarian preset.
        </p>
        <Button asChild variant="outline" className="border-white/20 text-white">
          <Link href="/admin/library/books">Back to books</Link>
        </Button>
      </LibraryPageShell>
    );
  }

  return (
    <LibraryPageShell>
      <LibraryBackLink href="/admin/library/books" label="Back to books" />
      <LibraryPageHeader
        icon={BookPlus}
        title="New book"
        description="Add catalogue metadata, reading levels, cover art, and optional opening copies in one place."
      />

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
        <section className={`${libraryGlassPanel} space-y-5 p-5`}>
          <div>
            <h2 className="text-base font-semibold text-white">Book details</h2>
            <p className="mt-1 text-sm text-white/50">Core metadata shown across the library catalogue.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-white/80">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-white/15 bg-white/[0.05] text-white"
                required
              />
            </div>
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
            <div className="space-y-2">
              <Label className="text-white/80">Shelf / stack</Label>
              <Input
                value={shelfLocation}
                onChange={(e) => setShelfLocation(e.target.value)}
                className="border-white/15 bg-white/[0.05] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Category</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border-white/15 bg-white/[0.05] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/80">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="border-white/15 bg-white/[0.05] text-white"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="border-white/15 bg-white/[0.05] text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Tags (comma-separated)</Label>
            <Input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="fiction, jhs, reading-list"
              className="border-white/15 bg-white/[0.05] text-white"
            />
          </div>
        </section>

        <section className={`${libraryGlassPanel} space-y-4 p-5`}>
          <div>
            <h2 className="text-base font-semibold text-white">Reading level</h2>
            <p className="mt-1 text-sm text-white/50">Optional. Link this title to the grades that should see it.</p>
          </div>
          <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
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
          </div>
        </section>
        </div>

        <aside className="space-y-6">
        <section className={`${libraryGlassPanel} space-y-4 p-5`}>
          <div className="flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-cyan-200" />
            <h2 className="text-base font-semibold text-white">Cover image</h2>
          </div>
          {schoolId ? (
            <LibraryBookCoverUpload
              schoolId={schoolId}
              previewUrl={coverImageUrl ?? null}
              onUploaded={({ url, key }) => {
                setCoverImageUrl(url);
                setCoverImageKey(key);
              }}
            />
          ) : (
            <p className="text-sm text-white/50">Loading school context…</p>
          )}
        </section>

        <section className={`${libraryGlassPanel} space-y-4 p-5`}>
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-emerald-200" />
            <h2 className="text-base font-semibold text-white">Initial copies</h2>
          </div>
          <p className="text-sm text-white/50">
            Creates numbered copies automatically. You can add more from the book detail page.
          </p>
          <Input
            type="number"
            min={0}
            max={500}
            value={initialCopies}
            onChange={(e) => setInitialCopies(e.target.value)}
            className="max-w-[200px] border-white/15 bg-white/[0.05] text-white"
          />
        </section>

        <div className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-linear-to-r from-white/5 to-transparent p-4 shadow-lg shadow-black/20 backdrop-blur-xl">
          <Button
            type="submit"
            disabled={createBook.isPending}
            className="bg-linear-to-r from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/25 hover:from-teal-600 hover:to-cyan-700"
          >
            {createBook.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Create book"
            )}
          </Button>
          <Button type="button" variant="outline" asChild className="border-white/20 text-white">
            <Link href="/admin/library/books">Cancel</Link>
          </Button>
        </div>
        </aside>
      </form>
    </LibraryPageShell>
  );
}

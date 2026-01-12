// src/components/modals/AddNoteModal.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import {
  useCreateNote,
  useUpdateNote,
  type CreateNoteInput,
  type UpdateNoteInput,
  type TeacherNoteDTO,
  type TeacherNoteCategory,
  type TeacherNoteVisibility,
} from "@/hooks/admin/useTeacherNotes";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";

const NoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required").max(5000),
  category: z.enum(["general", "performance", "behavior", "professional_development", "disciplinary", "other"]).optional(),
  visibility: z.enum(["internal", "private"]),
  tags: z.string().optional(), // Comma-separated tags
});

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  teacherName: string;
  mode?: "add" | "edit";
  note?: TeacherNoteDTO | null;
};

export function AddNoteModal({
  open,
  onOpenChange,
  teacherId,
  teacherName,
  mode = "add",
  note = null,
}: Props) {
  const createNoteMutation = useCreateNote();
  const updateNoteMutation = useUpdateNote();

  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateNoteInput & { tags?: string }>({
    resolver: zodResolver(NoteSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "general",
      visibility: "internal",
      tags: "",
    },
  });

  const visibility = watch("visibility");

  // Reset form when modal opens or note changes
  React.useEffect(() => {
    if (open) {
      if (mode === "edit" && note) {
        reset({
          title: note.title,
          content: note.content,
          category: note.category || "general",
          visibility: note.visibility,
          tags: note.tags.join(", "),
        });
        setTags(note.tags);
      } else {
        reset({
          title: "",
          content: "",
          category: "general",
          visibility: "internal",
          tags: "",
        });
        setTags([]);
      }
      setTagInput("");
    }
  }, [open, mode, note, reset]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      const newTags = [...tags, trimmed];
      setTags(newTags);
      setValue("tags", newTags.join(", "));
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((t) => t !== tagToRemove);
    setTags(newTags);
    setValue("tags", newTags.join(", "));
  };

  const onSubmit = async (data: CreateNoteInput & { tags?: string }) => {
    try {
      const payload: CreateNoteInput | UpdateNoteInput = {
        title: data.title,
        content: data.content,
        category: data.category,
        visibility: data.visibility,
        tags: tags,
      };

      if (mode === "edit" && note) {
        await updateNoteMutation.mutateAsync({
          teacherId,
          noteId: note.id,
          payload: payload as UpdateNoteInput,
        });
        toast.success("Note updated successfully");
      } else {
        await createNoteMutation.mutateAsync({
          teacherId,
          payload: payload as CreateNoteInput,
        });
        toast.success("Note created successfully");
      }

      onOpenChange(false);
    } catch (e: unknown) {
      const error = e as { message?: string };
      toast.error(error.message || `Failed to ${mode === "edit" ? "update" : "create"} note`);
    }
  };

  const isPending = createNoteMutation.isPending || updateNoteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] border border-white/10 bg-linear-to-br from-white/10 to-transparent shadow-2xl shadow-black/30 backdrop-blur max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {mode === "edit" ? "Edit Note" : "Add Note"}
          </DialogTitle>
          <DialogDescription className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            {mode === "edit"
              ? "Update the note for this teacher"
              : `Add an internal note for ${teacherName}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                Title *
              </Label>
              <Input
                id="title"
                {...register("title")}
                placeholder="e.g., Performance review"
                className="border-white/10 bg-white/5"
              />
              {errors.title && (
                <p className="text-xs text-red-300/80">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category" className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                Category
              </Label>
              <Select
                value={watch("category") || "general"}
                onValueChange={(value) => setValue("category", value as TeacherNoteCategory)}
              >
                <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/8">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className={premiumSelectContent}>
                  <SelectItem value="general" className={premiumMenuItem}>
                    General
                  </SelectItem>
                  <SelectItem value="performance" className={premiumMenuItem}>
                    Performance
                  </SelectItem>
                  <SelectItem value="behavior" className={premiumMenuItem}>
                    Behavior
                  </SelectItem>
                  <SelectItem value="professional_development" className={premiumMenuItem}>
                    Professional Development
                  </SelectItem>
                  <SelectItem value="disciplinary" className={premiumMenuItem}>
                    Disciplinary
                  </SelectItem>
                  <SelectItem value="other" className={premiumMenuItem}>
                    Other
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content" className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Content *
            </Label>
            <Textarea
              id="content"
              {...register("content")}
              placeholder="Enter note content..."
              className="min-h-[150px] border-white/10 bg-white/5"
              maxLength={5000}
            />
            {errors.content && (
              <p className="text-xs text-red-300/80">{errors.content.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility" className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Visibility *
            </Label>
            <Select
              value={visibility}
              onValueChange={(value) => setValue("visibility", value as TeacherNoteVisibility)}
            >
              <SelectTrigger className="border-white/10 bg-white/5">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent className={premiumSelectContent}>
                <SelectItem value="internal" className={premiumMenuItem}>
                  <div className="flex items-center gap-2">
                    <span>Internal</span>
                    <span className="text-xs text-muted-foreground">(Visible to all admins)</span>
                  </div>
                </SelectItem>
                <SelectItem value="private" className={premiumMenuItem}>
                  <div className="flex items-center gap-2">
                    <span>Private</span>
                    <span className="text-xs text-muted-foreground">(Confidential - admin only)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {visibility === "private" && (
              <p className="text-xs text-amber-200/80">
                This note will be marked as confidential and only visible to administrators.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagInput" className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Tags (optional)
            </Label>
            <div className="flex gap-2">
              <Input
                id="tagInput"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Type a tag and press Enter"
                className="border-white/10 bg-white/5"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
              >
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="border-white/10 bg-white/5 gap-1 pr-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 rounded-full hover:bg-white/10 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 border-t border-white/10 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isPending}
              className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isPending}
              className="gap-2 bg-brand text-black hover:opacity-90"
            >
              {isSubmitting || isPending
                ? `${mode === "edit" ? "Updating" : "Creating"}…`
                : mode === "edit"
                ? "Update Note"
                : "Create Note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

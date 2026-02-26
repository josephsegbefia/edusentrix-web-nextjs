"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Check, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  useCreateClassRole,
  type ClassRoleCategory,
} from "@/hooks/admin/useClassRoles";
import { toast } from "sonner";

interface CreateClassRoleModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

const CATEGORIES: Array<{
  value: ClassRoleCategory;
  label: string;
  description: string;
}> = [
  {
    value: "leadership",
    label: "Leadership",
    description: "Class captain and leadership roles",
  },
  {
    value: "academic",
    label: "Academic",
    description: "Library, subject, and study-focused roles",
  },
  {
    value: "service",
    label: "Service",
    description: "Attendance, cleanliness, and support roles",
  },
  {
    value: "social",
    label: "Social Welfare",
    description: "Welfare, sports, and social wellbeing roles",
  },
  {
    value: "custom",
    label: "Custom",
    description: "School-specific class role",
  },
];

export function CreateClassRoleModal({
  open,
  onOpenChange,
}: CreateClassRoleModalProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState<ClassRoleCategory>("custom");
  const [description, setDescription] = useState("");
  const [maxPerClass, setMaxPerClass] = useState("");

  const createMutation = useCreateClassRole();

  useEffect(() => {
    if (!open) return;
    setName("");
    setCode("");
    setCategory("custom");
    setDescription("");
    setMaxPerClass("");
  }, [open]);

  useEffect(() => {
    if (!name) {
      setCode("");
      return;
    }
    const generated = name
      .toUpperCase()
      .replaceAll(/[^A-Z0-9\s]/g, "")
      .replaceAll(/\s+/g, "_")
      .slice(0, 40);
    setCode(generated);
  }, [name]);

  const isValid = name.trim().length > 0 && code.trim().length > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      toast.error("Please enter a role name and code");
      return;
    }

    const maxValue = maxPerClass.trim()
      ? Math.max(1, parseInt(maxPerClass.trim(), 10))
      : null;

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        category,
        description: description.trim() || undefined,
        maxPerClass: Number.isNaN(maxValue as number) ? null : maxValue,
      });
      toast.success("Custom class role created");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create class role");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <div
            className="hidden h-full place-items-center p-4 sm:grid"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-card/95 shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-brand" />
                  <span className="text-base font-semibold">Create Class Role</span>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="text-white/60 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-5 overflow-y-auto p-5">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      Role Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Cupboard Steward"
                      maxLength={100}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      Role Code *
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) =>
                        setCode(
                          e.target.value.toUpperCase().replaceAll(/[^A-Z0-9_]/g, "")
                        )
                      }
                      placeholder="e.g., CUPBOARD_STEWARD"
                      maxLength={50}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      Category *
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setCategory(cat.value)}
                          className={cn(
                            "rounded-lg border p-3 text-left transition-all",
                            category === cat.value
                              ? "border-brand bg-brand/10"
                              : "border-white/10 bg-white/5 hover:border-white/20"
                          )}
                        >
                          <p className="text-sm font-medium text-white">{cat.label}</p>
                          <p className="text-xs text-white/50">{cat.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      Description (Optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what this role does..."
                      rows={3}
                      maxLength={500}
                      className="w-full resize-none rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                      Maximum Per Class (Optional)
                    </label>
                    <input
                      type="number"
                      value={maxPerClass}
                      onChange={(e) => setMaxPerClass(e.target.value)}
                      placeholder="Leave empty for unlimited"
                      min={1}
                      max={50}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-3 border-t border-white/10 p-5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isValid || createMutation.isPending}
                    className="gap-2 bg-brand text-black hover:opacity-90 disabled:opacity-50"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Create Role
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>

          <div
            className="fixed inset-x-0 bottom-0 sm:hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 250, damping: 28 }}
              className="max-h-[90vh] rounded-t-2xl border border-white/10 bg-card/95 shadow-2xl"
            >
              <div className="shrink-0 py-2">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
              </div>
              <div className="flex items-center justify-between px-5 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-brand" />
                  <span className="text-base font-semibold">Create Class Role</span>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="text-white/60 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={onSubmit} className="max-h-[72vh] overflow-y-auto px-5 pb-5">
                <div className="space-y-4">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Role name"
                    maxLength={100}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none"
                  />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) =>
                      setCode(
                        e.target.value.toUpperCase().replaceAll(/[^A-Z0-9_]/g, "")
                      )
                    }
                    placeholder="Role code"
                    maxLength={50}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none"
                  />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ClassRoleCategory)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-brand focus:outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={3}
                    maxLength={500}
                    className="w-full resize-none rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none"
                  />
                  <input
                    type="number"
                    value={maxPerClass}
                    onChange={(e) => setMaxPerClass(e.target.value)}
                    placeholder="Max per class (optional)"
                    min={1}
                    max={50}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none"
                  />
                  <div className="flex items-center justify-end gap-3 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!isValid || createMutation.isPending}
                      className="gap-2 bg-brand text-black hover:opacity-90 disabled:opacity-50"
                    >
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Create
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

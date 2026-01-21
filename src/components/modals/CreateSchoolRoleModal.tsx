"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Loader2,
  Check,
  X,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCreateSchoolRoleDefinition } from "@/hooks/admin/useSchoolRoles";
import { toast } from "sonner";

interface CreateSchoolRoleModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  { value: "prefect", label: "Prefect", description: "Head Boy/Girl, Senior Prefects, etc." },
  { value: "council", label: "Student Council", description: "Student government positions" },
  { value: "club", label: "Club Leaders", description: "Club presidents and leaders" },
  { value: "sports", label: "Sports", description: "Sports captains and house captains" },
  { value: "cultural", label: "Cultural", description: "Cultural and arts leadership" },
  { value: "service", label: "Service", description: "Community service leaders" },
  { value: "custom", label: "Custom", description: "Other school-specific roles" },
] as const;

const PRESET_COLORS = [
  "#FFD700", // Gold
  "#C0C0C0", // Silver
  "#CD7F32", // Bronze
  "#FF4500", // Orange Red
  "#4169E1", // Royal Blue
  "#9932CC", // Dark Orchid
  "#228B22", // Forest Green
  "#DC143C", // Crimson
  "#00CED1", // Dark Turquoise
  "#8B4513", // Saddle Brown
];

export function CreateSchoolRoleModal({
  open,
  onOpenChange,
}: CreateSchoolRoleModalProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState<string>("prefect");
  const [description, setDescription] = useState("");
  const [maxPerSchool, setMaxPerSchool] = useState<string>("");
  const [badgeColor, setBadgeColor] = useState(PRESET_COLORS[0]);

  const createMutation = useCreateSchoolRoleDefinition();

  // Reset form on open
  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setCategory("prefect");
      setDescription("");
      setMaxPerSchool("");
      setBadgeColor(PRESET_COLORS[0]);
    }
  }, [open]);

  // Auto-generate code from name
  useEffect(() => {
    if (name) {
      const generatedCode = name
        .toUpperCase()
        .replaceAll(/[^A-Z0-9\s]/g, "")
        .replaceAll(/\s+/g, "_")
        .slice(0, 30);
      setCode(generatedCode);
    }
  }, [name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !code.trim() || !category) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        category,
        description: description.trim() || undefined,
        maxPerSchool: maxPerSchool ? parseInt(maxPerSchool, 10) : undefined,
        badgeColor,
      });
      toast.success(`${name} role created successfully`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create role");
    }
  };

  const isValid = name.trim() && code.trim() && category;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          {/* Desktop dialog */}
          <div
            className="hidden sm:grid h-full place-items-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="w-full max-w-lg max-h-[90vh] rounded-2xl border border-white/10 bg-card/95 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-brand" />
                  <span className="text-base font-semibold">Create School Role</span>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="text-white/60 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="p-5 overflow-y-auto flex-1 space-y-5">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                      Role Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Library Prefect"
                      maxLength={100}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>

                  {/* Code */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                      Role Code *
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().replaceAll(/[^A-Z0-9_]/g, ""))}
                      placeholder="e.g., LIBRARY_PREFECT"
                      maxLength={50}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                    />
                    <p className="mt-1 text-xs text-white/40">
                      Unique identifier (auto-generated from name)
                    </p>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
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

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the responsibilities of this role..."
                      rows={3}
                      maxLength={500}
                      className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                    />
                  </div>

                  {/* Max Per School */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                      Maximum Per School (Optional)
                    </label>
                    <input
                      type="number"
                      value={maxPerSchool}
                      onChange={(e) => setMaxPerSchool(e.target.value)}
                      placeholder="Leave empty for unlimited"
                      min={1}
                      max={100}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                    <p className="mt-1 text-xs text-white/40">
                      How many students can hold this role at once
                    </p>
                  </div>

                  {/* Badge Color */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                      Badge Color
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setBadgeColor(color)}
                            className={cn(
                              "h-8 w-8 rounded-full transition-all",
                              badgeColor === color
                                ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900"
                                : "hover:scale-110"
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-white/40" />
                        <input
                          type="color"
                          value={badgeColor}
                          onChange={(e) => setBadgeColor(e.target.value)}
                          className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                      Preview
                    </label>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${badgeColor}30` }}
                        >
                          <Crown className="h-5 w-5" style={{ color: badgeColor }} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {name || "Role Name"}
                          </p>
                          <p className="text-xs text-white/50 capitalize">
                            {CATEGORIES.find((c) => c.value === category)?.label || "Category"}
                          </p>
                        </div>
                        <span
                          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{
                            backgroundColor: `${badgeColor}20`,
                            color: badgeColor,
                          }}
                        >
                          <Crown className="h-3 w-3" />
                          {name || "Role"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-white/10 p-5 shrink-0">
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

          {/* Mobile bottom sheet */}
          <div
            className="sm:hidden fixed inset-x-0 bottom-0"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 250, damping: 28 }}
              className="rounded-t-2xl border border-white/10 bg-card/95 shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="py-2 shrink-0">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="px-5 pb-4 overflow-y-auto flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <Crown className="h-5 w-5 text-brand" />
                    <span className="text-base font-semibold">Create School Role</span>
                  </div>

                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-medium text-white/70 mb-1">
                        Role Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Library Prefect"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none"
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-xs font-medium text-white/70 mb-1">
                        Category *
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Max Per School */}
                    <div>
                      <label className="block text-xs font-medium text-white/70 mb-1">
                        Max Per School
                      </label>
                      <input
                        type="number"
                        value={maxPerSchool}
                        onChange={(e) => setMaxPerSchool(e.target.value)}
                        placeholder="Leave empty for unlimited"
                        min={1}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none"
                      />
                    </div>

                    {/* Color */}
                    <div>
                      <label className="block text-xs font-medium text-white/70 mb-1">
                        Badge Color
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.slice(0, 5).map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setBadgeColor(color)}
                            className={cn(
                              "h-8 w-8 rounded-full",
                              badgeColor === color && "ring-2 ring-white ring-offset-2 ring-offset-slate-900"
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenChange(false)}
                      className="border-white/10 bg-white/5 text-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!isValid || createMutation.isPending}
                      className="gap-1 bg-brand text-black"
                    >
                      {createMutation.isPending ? "Creating..." : "Create Role"}
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

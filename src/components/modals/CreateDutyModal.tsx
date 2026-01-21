"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Loader2,
  Check,
  X,
  Palette,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCreateDutyDefinition, DAY_NAMES } from "@/hooks/admin/useTeacherDuties";
import { toast } from "sonner";

interface CreateDutyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  { value: "supervision", label: "Supervision", description: "General student supervision" },
  { value: "assembly", label: "Assembly", description: "Assembly-related duties" },
  { value: "break", label: "Break Time", description: "Break time supervision" },
  { value: "gate", label: "Gate Duty", description: "Arrival/departure duties" },
  { value: "dining", label: "Dining", description: "Dining hall supervision" },
  { value: "sports", label: "Sports", description: "Sports/PE supervision" },
  { value: "exam", label: "Examination", description: "Exam invigilation" },
  { value: "event", label: "Event", description: "Special event duties" },
  { value: "custom", label: "Custom", description: "Other school-specific duties" },
] as const;

const FREQUENCIES = [
  { value: "daily", label: "Daily", description: "Every day" },
  { value: "weekly", label: "Weekly", description: "Specific days of the week" },
  { value: "rotational", label: "Rotational", description: "Rotating schedule" },
  { value: "one_time", label: "One-Time", description: "Single occurrence" },
] as const;

const PRESET_COLORS = [
  "#FF6B6B", // Coral Red
  "#4ECDC4", // Turquoise
  "#45B7D1", // Sky Blue
  "#96CEB4", // Sage Green
  "#FFEAA7", // Pale Yellow
  "#DDA0DD", // Plum
  "#B8860B", // Dark Goldenrod
  "#9B59B6", // Purple
  "#E74C3C", // Red
  "#3498DB", // Blue
];

export function CreateDutyModal({
  open,
  onOpenChange,
}: CreateDutyModalProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState<string>("supervision");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<string>("weekly");
  const [defaultDays, setDefaultDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [defaultStartTime, setDefaultStartTime] = useState("");
  const [defaultEndTime, setDefaultEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [minTeachersRequired, setMinTeachersRequired] = useState<string>("1");
  const [maxTeachersAllowed, setMaxTeachersAllowed] = useState<string>("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const createMutation = useCreateDutyDefinition();

  // Reset form on open
  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setCategory("supervision");
      setDescription("");
      setFrequency("weekly");
      setDefaultDays([1, 2, 3, 4, 5]);
      setDefaultStartTime("");
      setDefaultEndTime("");
      setLocation("");
      setMinTeachersRequired("1");
      setMaxTeachersAllowed("");
      setColor(PRESET_COLORS[0]);
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

  const toggleDay = (day: number) => {
    setDefaultDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !code.trim() || !category || !frequency) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        category,
        description: description.trim() || undefined,
        frequency,
        defaultDays: frequency === "weekly" ? defaultDays : undefined,
        defaultStartTime: defaultStartTime || undefined,
        defaultEndTime: defaultEndTime || undefined,
        location: location.trim() || undefined,
        minTeachersRequired: minTeachersRequired ? parseInt(minTeachersRequired, 10) : undefined,
        maxTeachersAllowed: maxTeachersAllowed ? parseInt(maxTeachersAllowed, 10) : undefined,
        color,
      });
      toast.success(`${name} duty created successfully`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create duty");
    }
  };

  const isValid = name.trim() && code.trim() && category && frequency;

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
              className="w-full max-w-2xl max-h-[90vh] rounded-2xl border border-white/10 bg-card/95 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-brand" />
                  <span className="text-base font-semibold">Create Teacher Duty</span>
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
                  {/* Name & Code */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                        Duty Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Library Duty"
                        maxLength={100}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                        Duty Code *
                      </label>
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase().replaceAll(/[^A-Z0-9_]/g, ""))}
                        placeholder="e.g., LIBRARY_DUTY"
                        maxLength={50}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                      Category *
                    </label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setCategory(cat.value)}
                          className={cn(
                            "rounded-lg border p-2.5 text-left transition-all",
                            category === cat.value
                              ? "border-brand bg-brand/10"
                              : "border-white/10 bg-white/5 hover:border-white/20"
                          )}
                        >
                          <p className="text-sm font-medium text-white">{cat.label}</p>
                          <p className="text-xs text-white/50 truncate">{cat.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Frequency */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                      Frequency *
                    </label>
                    <div className="grid gap-2 sm:grid-cols-4">
                      {FREQUENCIES.map((freq) => (
                        <button
                          key={freq.value}
                          type="button"
                          onClick={() => setFrequency(freq.value)}
                          className={cn(
                            "rounded-lg border p-2.5 text-center transition-all",
                            frequency === freq.value
                              ? "border-brand bg-brand/10"
                              : "border-white/10 bg-white/5 hover:border-white/20"
                          )}
                        >
                          <p className="text-sm font-medium text-white">{freq.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Days of Week (only for weekly) */}
                  {frequency === "weekly" && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                        Default Days
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {DAY_NAMES.map((day, index) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(index)}
                            className={cn(
                              "rounded-lg px-3 py-2 text-sm font-medium transition-all",
                              defaultDays.includes(index)
                                ? "bg-brand text-black"
                                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                            )}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Time & Location */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={defaultStartTime}
                        onChange={(e) => setDefaultStartTime(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={defaultEndTime}
                        onChange={(e) => setDefaultEndTime(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                        Location
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g., Main Gate"
                          maxLength={100}
                          className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Teachers Required */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                        Minimum Teachers Required
                      </label>
                      <input
                        type="number"
                        value={minTeachersRequired}
                        onChange={(e) => setMinTeachersRequired(e.target.value)}
                        min={1}
                        max={20}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                        Maximum Teachers Allowed
                      </label>
                      <input
                        type="number"
                        value={maxTeachersAllowed}
                        onChange={(e) => setMaxTeachersAllowed(e.target.value)}
                        placeholder="Leave empty for unlimited"
                        min={1}
                        max={50}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />
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
                      placeholder="Describe the responsibilities of this duty..."
                      rows={2}
                      maxLength={500}
                      className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                    />
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
                      Display Color
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            className={cn(
                              "h-8 w-8 rounded-full transition-all",
                              color === c
                                ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900"
                                : "hover:scale-110"
                            )}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-white/40" />
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
                        />
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
                        Create Duty
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
                    <Clock className="h-5 w-5 text-brand" />
                    <span className="text-base font-semibold">Create Teacher Duty</span>
                  </div>

                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-medium text-white/70 mb-1">
                        Duty Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Library Duty"
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

                    {/* Frequency */}
                    <div>
                      <label className="block text-xs font-medium text-white/70 mb-1">
                        Frequency *
                      </label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                      >
                        {FREQUENCIES.map((freq) => (
                          <option key={freq.value} value={freq.value}>
                            {freq.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-white/70 mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={defaultStartTime}
                          onChange={(e) => setDefaultStartTime(e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/70 mb-1">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={defaultEndTime}
                          onChange={(e) => setDefaultEndTime(e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Color */}
                    <div>
                      <label className="block text-xs font-medium text-white/70 mb-1">
                        Color
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.slice(0, 5).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            className={cn(
                              "h-8 w-8 rounded-full",
                              color === c && "ring-2 ring-white ring-offset-2 ring-offset-slate-900"
                            )}
                            style={{ backgroundColor: c }}
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
                      {createMutation.isPending ? "Creating..." : "Create Duty"}
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

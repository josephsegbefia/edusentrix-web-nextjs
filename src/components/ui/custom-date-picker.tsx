"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { isSameDay } from "date-fns/isSameDay";

interface CustomDatePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
  label?: string;
  /** When `label` is omitted, set this for the trigger (accessibility). */
  triggerAriaLabel?: string;
  error?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function CustomDatePicker({
  value,
  onChange,
  placeholder = "Select date",
  minDate,
  maxDate,
  disabled = false,
  className,
  label,
  triggerAriaLabel,
  error,
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value || new Date());
  const [animationDirection, setAnimationDirection] = useState<"left" | "right">("right");
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setViewDate(value || new Date());
    }
  }, [isOpen, value]);

  /** Keep the calendar month in sync when the controlled value updates while closed. */
  useEffect(() => {
    if (!isOpen && value) {
      setViewDate(value);
    }
  }, [value, isOpen]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Get days in month
  const daysInMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  // Get first day of month (0 = Sunday)
  const firstDayOfMonth = useMemo(() => {
    return new Date(year, month, 1).getDay();
  }, [year, month]);

  // Get days from previous month to show
  const prevMonthDays = useMemo(() => {
    const prevMonth = new Date(year, month, 0);
    const daysInPrevMonth = prevMonth.getDate();
    const days: number[] = [];
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push(daysInPrevMonth - i);
    }
    return days;
  }, [year, month, firstDayOfMonth]);

  // Get days from next month to show
  const nextMonthDays = useMemo(() => {
    const totalCells = 42; // 6 rows x 7 days
    const usedCells = prevMonthDays.length + daysInMonth;
    const remaining = totalCells - usedCells;
    return Array.from({ length: remaining }, (_, i) => i + 1);
  }, [prevMonthDays.length, daysInMonth]);

  const isToday = useCallback(
    (day: number) => {
      const today = new Date();
      return (
        day === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear()
      );
    },
    [month, year]
  );

  const isSelected = useCallback(
    (day: number) => {
      if (!value) return false;
      const cell = new Date(year, month, day);
      return isSameDay(cell, value);
    },
    [value, month, year]
  );

  const isDisabled = useCallback(
    (day: number) => {
      const date = new Date(year, month, day);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      if (minDate) {
        const minDay = new Date(
          minDate.getFullYear(),
          minDate.getMonth(),
          minDate.getDate()
        ).getTime();
        if (dayStart < minDay) return true;
      }
      if (maxDate) {
        const maxDay = new Date(
          maxDate.getFullYear(),
          maxDate.getMonth(),
          maxDate.getDate()
        ).getTime();
        if (dayStart > maxDay) return true;
      }
      return false;
    },
    [year, month, minDate, maxDate]
  );

  const handlePrevMonth = () => {
    setAnimationDirection("left");
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setAnimationDirection("right");
    setViewDate(new Date(year, month + 1, 1));
  };

  const handlePrevYear = () => {
    setAnimationDirection("left");
    setViewDate(new Date(year - 1, month, 1));
  };

  const handleNextYear = () => {
    setAnimationDirection("right");
    setViewDate(new Date(year + 1, month, 1));
  };

  const handleSelectDay = (day: number) => {
    if (isDisabled(day)) return;
    const selectedDate = new Date(year, month, day);
    onChange(selectedDate);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className={cn("relative", className)}>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted mb-2">
          {label}
        </label>
      )}

      {/* Trigger Container */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={triggerAriaLabel ?? label ?? placeholder}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all",
          isOpen
            ? "border-brand ring-1 ring-brand"
            : "border-white/10 hover:border-white/20",
          disabled
            ? "cursor-not-allowed bg-white/5 text-white/30"
            : "bg-white/5 text-white cursor-pointer",
          error && "border-rose-500/50"
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-white/40" />
          <span className={cn(!value && "text-white/40")}>
            {value ? formatDate(value) : placeholder}
          </span>
        </div>
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}

      {/* Calendar Mini Modal - Rendered via Portal */}
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop with blur */}
              <motion.div
                data-custom-date-picker-popover
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-auto fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
              />

              {/* Centered Calendar Modal — must be inside [data-custom-date-picker-popover] so Radix Dialog does not treat clicks as "outside" and steal the event. */}
              <motion.div
                data-custom-date-picker-popover
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="pointer-events-auto fixed left-1/2 top-1/2 z-[9999] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-card p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
              {/* Header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevYear}
                    className="h-7 w-7 text-white/40 hover:bg-white/10 hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <ChevronLeft className="h-4 w-4 -ml-2.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevMonth}
                    className="h-7 w-7 text-white/40 hover:bg-white/10 hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>

                <div className="text-center">
                  <span className="text-sm font-semibold text-white">
                    {MONTH_NAMES[month]} {year}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleNextMonth}
                    className="h-7 w-7 text-white/40 hover:bg-white/10 hover:text-white"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleNextYear}
                    className="h-7 w-7 text-white/40 hover:bg-white/10 hover:text-white"
                  >
                    <ChevronRight className="h-4 w-4 -mr-2.5" />
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Day names */}
              <div className="mb-2 grid grid-cols-7 gap-1">
                {DAY_NAMES.map((day) => (
                  <div
                    key={day}
                    className="flex h-8 items-center justify-center text-xs font-medium text-white/40"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${year}-${month}`}
                  initial={{ opacity: 0, x: animationDirection === "right" ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: animationDirection === "right" ? -20 : 20 }}
                  transition={{ duration: 0.15 }}
                  className="grid grid-cols-7 gap-1"
                >
                  {/* Previous month days */}
                  {prevMonthDays.map((day, i) => (
                    <div
                      key={`prev-${i}`}
                      className="flex h-9 items-center justify-center text-sm text-white/20"
                    >
                      {day}
                    </div>
                  ))}

                  {/* Current month days */}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const today = isToday(day);
                    const selected = isSelected(day);
                    const dayDisabled = isDisabled(day);

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectDay(day);
                        }}
                        disabled={dayDisabled}
                        className={cn(
                          "relative flex h-9 items-center justify-center rounded-lg text-sm font-medium transition-all",
                          dayDisabled
                            ? "cursor-not-allowed text-white/20"
                            : "hover:bg-white/10",
                          selected
                            ? "bg-brand text-black shadow-lg shadow-brand/30"
                            : today
                            ? "border border-brand/50 text-brand"
                            : "text-white"
                        )}
                      >
                        {day}
                        {today && !selected && (
                          <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand" />
                        )}
                      </button>
                    );
                  })}

                  {/* Next month days */}
                  {nextMonthDays.map((day, i) => (
                    <div
                      key={`next-${i}`}
                      className="flex h-9 items-center justify-center text-sm text-white/20"
                    >
                      {day}
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>

              {/* Footer */}
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    const today = new Date();
                    setViewDate(today);
                    onChange(today);
                    setIsOpen(false);
                  }}
                  className="text-xs text-brand hover:bg-brand/10 hover:text-brand"
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  className="text-xs text-white/60 hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

// Date Range Picker Component
interface DateRangePickerProps {
  startDate?: Date | null;
  endDate?: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  startLabel?: string;
  endLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startLabel = "Start Date",
  endLabel = "End Date",
  disabled = false,
  className,
}: DateRangePickerProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <CustomDatePicker
        value={startDate}
        onChange={onStartDateChange}
        label={startLabel}
        placeholder="Select start date"
        maxDate={endDate || undefined}
        disabled={disabled}
      />
      <CustomDatePicker
        value={endDate}
        onChange={onEndDateChange}
        label={endLabel}
        placeholder="Select end date"
        minDate={startDate || undefined}
        disabled={disabled}
      />
    </div>
  );
}

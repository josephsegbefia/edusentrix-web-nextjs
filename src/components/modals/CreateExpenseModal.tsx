"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns/format";
import { CalendarIcon, Loader2, Plus, Building2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  useExpenseCategories,
  useVendors,
  useCreateExpense,
  useUpdateExpense,
  useCreateVendor,
  ExpenseDTO,
  ExpenseCostCenter,
} from "@/hooks/admin/useExpenses";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ========================
// Form Schema
// ========================

const expenseFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  categoryId: z.string().min(1, "Category is required"),
  vendorId: z.string().optional(),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  currency: z.string(),
  expenseDate: z.date(),
  costCenter: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

// ========================
// Props
// ========================

interface CreateExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseDTO | null;
  onSuccess?: () => void;
}

// ========================
// Component
// ========================

export function CreateExpenseModal({
  open,
  onOpenChange,
  expense,
  onSuccess,
}: CreateExpenseModalProps) {
  const isEditing = !!expense;

  // Data fetching
  const { data: categories = [] } = useExpenseCategories();
  const { data: vendors = [] } = useVendors();

  // Mutations
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const createVendor = useCreateVendor();

  // Quick vendor creation
  const [showQuickVendor, setShowQuickVendor] = React.useState(false);
  const [quickVendorName, setQuickVendorName] = React.useState("");

  // Form
  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      title: "",
      description: "",
      categoryId: "",
      vendorId: "",
      amount: 0,
      currency: "GHS",
      expenseDate: new Date(),
      costCenter: "",
      notes: "",
    },
  });

  // Reset form when modal opens/closes or expense changes
  React.useEffect(() => {
    if (open) {
      if (expense) {
        const categoryId = typeof expense.categoryId === "object" ? expense.categoryId._id : expense.categoryId;
        const vendorId = typeof expense.vendorId === "object" && expense.vendorId ? expense.vendorId._id : expense.vendorId || "";
        
        form.reset({
          title: expense.title,
          description: expense.description || "",
          categoryId: categoryId || "",
          vendorId: vendorId,
          amount: expense.amountMinor / 100,
          currency: expense.currency,
          expenseDate: new Date(expense.expenseDate),
          costCenter: expense.costCenter || "",
          notes: expense.notes || "",
        });
      } else {
        form.reset({
          title: "",
          description: "",
          categoryId: "",
          vendorId: "",
          amount: 0,
          currency: "GHS",
          expenseDate: new Date(),
          costCenter: "",
          notes: "",
        });
      }
    }
  }, [open, expense, form]);

  const onSubmit = async (data: ExpenseFormData) => {
    try {
      const payload = {
        title: data.title,
        description: data.description || undefined,
        categoryId: data.categoryId,
        vendorId: data.vendorId || undefined,
        amountMinor: Math.round(data.amount * 100),
        currency: data.currency,
        expenseDate: data.expenseDate.toISOString(),
        costCenter: (data.costCenter as ExpenseCostCenter) || undefined,
        notes: data.notes || undefined,
      };

      if (isEditing && expense) {
        await updateExpense.mutateAsync({
          id: expense._id,
          ...payload,
        });
        toast.success("Expense updated successfully");
      } else {
        await createExpense.mutateAsync(payload);
        toast.success("Expense created successfully");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save expense");
    }
  };

  const handleQuickVendorCreate = async () => {
    if (!quickVendorName.trim()) return;

    try {
      const result = await createVendor.mutateAsync({ name: quickVendorName.trim() });
      form.setValue("vendorId", result.data._id);
      setQuickVendorName("");
      setShowQuickVendor(false);
      toast.success("Vendor created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create vendor");
    }
  };

  const isSubmitting = createExpense.isPending || updateExpense.isPending;

  const costCenters: { value: ExpenseCostCenter; label: string }[] = [
    { value: "admin", label: "Administration" },
    { value: "academics", label: "Academics" },
    { value: "maintenance", label: "Maintenance" },
    { value: "transport", label: "Transport" },
    { value: "ict", label: "ICT" },
    { value: "events", label: "Events" },
    { value: "welfare", label: "Staff Welfare" },
    { value: "other", label: "Other" },
  ];

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit Expense" : "Create Expense"}
      description={isEditing ? "Update expense details" : "Record a new expense"}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-1">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-white/80">
            Title <span className="text-red-400">*</span>
          </Label>
          <Input
            id="title"
            placeholder="e.g., Electricity bill - January"
            {...form.register("title")}
            className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
          />
          {form.formState.errors.title && (
            <p className="text-xs text-red-400">{form.formState.errors.title.message}</p>
          )}
        </div>

        {/* Category and Amount Row */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Category */}
          <div className="space-y-2">
            <Label className="text-white/80">
              Category <span className="text-red-400">*</span>
            </Label>
            <PremiumSelect
              value={form.watch("categoryId")}
              onValueChange={(v) => form.setValue("categoryId", v)}
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Select category" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {categories.map((cat) => (
                  <PremiumSelectItem key={cat._id} value={cat._id}>
                    {cat.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
            {form.formState.errors.categoryId && (
              <p className="text-xs text-red-400">{form.formState.errors.categoryId.message}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-white/80">
              Amount <span className="text-red-400">*</span>
            </Label>
            <div className="flex gap-2">
              <PremiumSelect
                value={form.watch("currency")}
                onValueChange={(v) => form.setValue("currency", v)}
              >
                <PremiumSelectTrigger className="w-24">
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="GHS">GHS</PremiumSelectItem>
                  <PremiumSelectItem value="USD">USD</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...form.register("amount", { valueAsNumber: true })}
                className="flex-1 border-white/10 bg-white/5 text-white placeholder:text-white/40"
              />
            </div>
            {form.formState.errors.amount && (
              <p className="text-xs text-red-400">{form.formState.errors.amount.message}</p>
            )}
          </div>
        </div>

        {/* Vendor and Date Row */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Vendor */}
          <div className="space-y-2">
            <Label className="text-white/80">Vendor (Optional)</Label>
            {showQuickVendor ? (
              <div className="flex gap-2">
                <Input
                  value={quickVendorName}
                  onChange={(e) => setQuickVendorName(e.target.value)}
                  placeholder="Vendor name"
                  className="flex-1 border-white/10 bg-white/5 text-white placeholder:text-white/40"
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleQuickVendorCreate}
                  disabled={createVendor.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {createVendor.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowQuickVendor(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <PremiumSelect
                  value={form.watch("vendorId") || "none"}
                  onValueChange={(v) => form.setValue("vendorId", v === "none" ? "" : v)}
                >
                  <PremiumSelectTrigger className="flex-1">
                    <PremiumSelectValue placeholder="Select vendor" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="none">No vendor</PremiumSelectItem>
                    {vendors.map((v) => (
                      <PremiumSelectItem key={v._id} value={v._id}>
                        {v.name}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setShowQuickVendor(true)}
                  className="border-white/10 bg-white/5 hover:bg-white/10"
                >
                  <Building2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Expense Date */}
          <div className="space-y-2">
            <Label className="text-white/80">
              Expense Date <span className="text-red-400">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal border-white/10 bg-white/5 hover:bg-white/10",
                    !form.watch("expenseDate") && "text-white/40"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.watch("expenseDate") ? (
                    format(form.watch("expenseDate"), "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-white/10 bg-slate-900" align="start">
                <Calendar
                  mode="single"
                  selected={form.watch("expenseDate")}
                  onSelect={(date) => date && form.setValue("expenseDate", date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Cost Center */}
        <div className="space-y-2">
          <Label className="text-white/80">Cost Center (Optional)</Label>
          <PremiumSelect
            value={form.watch("costCenter") || "none"}
            onValueChange={(v) => form.setValue("costCenter", v === "none" ? "" : v)}
          >
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Select cost center" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="none">No cost center</PremiumSelectItem>
              {costCenters.map((cc) => (
                <PremiumSelectItem key={cc.value} value={cc.value}>
                  {cc.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-white/80">
            Description (Optional)
          </Label>
          <Textarea
            id="description"
            placeholder="Additional details about this expense..."
            {...form.register("description")}
            className="min-h-[80px] border-white/10 bg-white/5 text-white placeholder:text-white/40"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-white/80">
            Internal Notes (Optional)
          </Label>
          <Textarea
            id="notes"
            placeholder="Notes for internal reference..."
            {...form.register("notes")}
            className="min-h-[60px] border-white/10 bg-white/5 text-white placeholder:text-white/40"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-white/5 hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-linear-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Update Expense" : "Create Expense"}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}

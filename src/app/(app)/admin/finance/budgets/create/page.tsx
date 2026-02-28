"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns/format";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CalendarIcon,
  Loader2,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useCreateBudget, BudgetPeriodType } from "@/hooks/admin/useBudgets";
import { useExpenseCategories } from "@/hooks/admin/useExpenses";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCurrencyFromMajor } from "@/lib/fees/money";

// ========================
// Form Schema
// ========================

const budgetFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  periodType: z.enum(["monthly", "quarterly", "termly", "yearly"]),
  startDate: z.date({ message: "Start date is required" }),
  endDate: z.date({ message: "End date is required" }),
  currency: z.string(),
  notes: z.string().max(1000).optional(),
});

type BudgetFormData = z.infer<typeof budgetFormSchema>;

interface LineItemInput {
  categoryId: string;
  budgetedAmount: number;
  notes: string;
}

// ========================
// Main Page Component
// ========================

export default function CreateBudgetPage() {
  const router = useRouter();
  const createBudget = useCreateBudget();
  const { data: categoriesData } = useExpenseCategories();

  const categories = categoriesData || [];

  const [lineItems, setLineItems] = React.useState<LineItemInput[]>([
    { categoryId: "", budgetedAmount: 0, notes: "" },
  ]);

  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      name: "",
      periodType: "monthly",
      currency: "GHS",
      notes: "",
    },
  });

  const addLineItem = () => {
    setLineItems([...lineItems, { categoryId: "", budgetedAmount: 0, notes: "" }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: keyof LineItemInput, value: string | number) => {
    const updated = [...lineItems];
    if (field === "budgetedAmount") {
      updated[index][field] = Number(value) || 0;
    } else {
      updated[index][field] = value as string;
    }
    setLineItems(updated);
  };

  const totalBudgeted = lineItems.reduce((sum, item) => sum + item.budgetedAmount, 0);

  const onSubmit = async (data: BudgetFormData) => {
    // Validate line items
    const validLineItems = lineItems.filter((item) => item.categoryId && item.budgetedAmount > 0);
    if (validLineItems.length === 0) {
      toast.error("Please add at least one budget category with an amount");
      return;
    }

    try {
      await createBudget.mutateAsync({
        name: data.name,
        periodType: data.periodType as BudgetPeriodType,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
        currency: data.currency,
        notes: data.notes,
        lineItems: validLineItems.map((item) => ({
          categoryId: item.categoryId,
          budgetedAmountMinor: Math.round(item.budgetedAmount * 100),
          notes: item.notes || undefined,
        })),
        status: "draft",
      });

      toast.success("Budget created successfully");
      router.push("/admin/finance/budgets");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create budget");
    }
  };

  const periodTypes = [
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "termly", label: "Per Term" },
    { value: "yearly", label: "Yearly" },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/finance/budgets")}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">Create Budget</h1>
          <p className="mt-1 text-sm text-white/50">
            Set up a new expense budget
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-4xl space-y-6">
        {/* Basic Info */}
        <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
          <CardHeader className="border-b border-white/10 p-5">
            <CardTitle className="text-lg text-white">Budget Details</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name" className="text-white/80">
                  Budget Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Q1 2026 Operating Budget"
                  {...form.register("name")}
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-400">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">
                  Period Type <span className="text-red-400">*</span>
                </Label>
                <PremiumSelect
                  value={form.watch("periodType")}
                  onValueChange={(v) => form.setValue("periodType", v as BudgetPeriodType)}
                >
                  <PremiumSelectTrigger>
                    <PremiumSelectValue placeholder="Select period" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {periodTypes.map((pt) => (
                      <PremiumSelectItem key={pt.value} value={pt.value}>
                        {pt.label}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">Currency</Label>
                <PremiumSelect
                  value={form.watch("currency") || "GHS"}
                  onValueChange={(v) => form.setValue("currency", v)}
                >
                  <PremiumSelectTrigger>
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="GHS">GHS (Cedi)</PremiumSelectItem>
                    <PremiumSelectItem value="USD">USD (Dollar)</PremiumSelectItem>
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">
                  Start Date <span className="text-red-400">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-white/10 bg-white/5 hover:bg-white/10",
                        !form.watch("startDate") && "text-white/40"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.watch("startDate") ? (
                        format(form.watch("startDate"), "PPP")
                      ) : (
                        <span>Pick start date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-white/10 bg-slate-900" align="start">
                    <Calendar
                      mode="single"
                      selected={form.watch("startDate")}
                      onSelect={(date) => date && form.setValue("startDate", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {form.formState.errors.startDate && (
                  <p className="text-xs text-red-400">{form.formState.errors.startDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">
                  End Date <span className="text-red-400">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-white/10 bg-white/5 hover:bg-white/10",
                        !form.watch("endDate") && "text-white/40"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.watch("endDate") ? (
                        format(form.watch("endDate"), "PPP")
                      ) : (
                        <span>Pick end date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-white/10 bg-slate-900" align="start">
                    <Calendar
                      mode="single"
                      selected={form.watch("endDate")}
                      onSelect={(date) => date && form.setValue("endDate", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {form.formState.errors.endDate && (
                  <p className="text-xs text-red-400">{form.formState.errors.endDate.message}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes" className="text-white/80">
                  Notes (Optional)
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes about this budget..."
                  {...form.register("notes")}
                  className="min-h-[80px] border-white/10 bg-white/5 text-white placeholder:text-white/40"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Categories */}
        <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
          <CardHeader className="border-b border-white/10 p-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white">Budget Categories</CardTitle>
              <div className="text-right">
                <p className="text-xs text-white/50">Total Budgeted</p>
                <p className="text-lg font-bold text-white">
                  {formatCurrencyFromMajor(totalBudgeted, { currency: form.watch("currency") || "GHS", maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {lineItems.map((item, index) => (
              <div
                key={index}
                className="flex gap-3 items-start p-4 rounded-xl border border-white/10 bg-white/5"
              >
                <div className="flex-1 grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs text-white/50">Category</Label>
                    <PremiumSelect
                      value={item.categoryId}
                      onValueChange={(v) => updateLineItem(index, "categoryId", v)}
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
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-white/50">Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.budgetedAmount || ""}
                      onChange={(e) => updateLineItem(index, "budgetedAmount", e.target.value)}
                      placeholder="0.00"
                      className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLineItem(index)}
                  disabled={lineItems.length === 1}
                  className="shrink-0 text-white/40 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addLineItem}
              className="w-full border-dashed border-white/20 hover:border-white/40 hover:bg-white/5"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/finance/budgets")}
            className="border-white/10 bg-white/5 hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createBudget.isPending}
            className="bg-linear-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700"
          >
            {createBudget.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Calculator className="mr-2 h-4 w-4" />
            Create Budget
          </Button>
        </div>
      </form>
    </div>
  );
}

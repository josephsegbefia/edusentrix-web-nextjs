"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { WorkspaceScope } from "@/components/theme/workspace-scope";
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
  const [isRedirecting, setIsRedirecting] = React.useState(false);

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
      setIsRedirecting(true);
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
    <WorkspaceScope className="min-h-screen p-6 md:p-8">
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
          <h1 className="text-2xl font-bold text-(--ws-fg) md:text-3xl">Create Budget</h1>
          <p className="mt-1 text-sm text-(--ws-fg-70)">
            Set up a new expense budget
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-4xl space-y-6">
        {/* Basic Info */}
        <Card className="overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to)">
          <CardHeader className="border-b border-(--ws-line) p-5">
            <CardTitle className="text-lg text-(--ws-fg)">Budget Details</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name" className="text-(--ws-fg-70)">
                  Budget Name <span className="text-(--ws-rose)">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Q1 2026 Operating Budget"
                  {...form.register("name")}
                  className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) placeholder:text-(--ws-fg-50)"
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-(--ws-rose)">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-(--ws-fg-70)">
                  Period Type <span className="text-(--ws-rose)">*</span>
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
                <Label className="text-(--ws-fg-70)">Currency</Label>
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
                <Label className="text-(--ws-fg-70)">
                  Start Date <span className="text-(--ws-rose)">*</span>
                </Label>
                <CustomDatePicker
                  surface="theme"
                  value={form.watch("startDate") ?? null}
                  onChange={(date) => {
                    if (date) form.setValue("startDate", date);
                  }}
                />
                {form.formState.errors.startDate && (
                  <p className="text-xs text-(--ws-rose)">{form.formState.errors.startDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-(--ws-fg-70)">
                  End Date <span className="text-(--ws-rose)">*</span>
                </Label>
                <CustomDatePicker
                  surface="theme"
                  value={form.watch("endDate") ?? null}
                  onChange={(date) => {
                    if (date) form.setValue("endDate", date);
                  }}
                />
                {form.formState.errors.endDate && (
                  <p className="text-xs text-(--ws-rose)">{form.formState.errors.endDate.message}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes" className="text-(--ws-fg-70)">
                  Notes (Optional)
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes about this budget..."
                  {...form.register("notes")}
                  className="min-h-[80px] border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) placeholder:text-(--ws-fg-50)"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Categories */}
        <Card className="overflow-hidden rounded-2xl border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to)">
          <CardHeader className="border-b border-(--ws-line) p-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-(--ws-fg)">Budget Categories</CardTitle>
              <div className="text-right">
                <p className="text-xs text-(--ws-fg-70)">Total Budgeted</p>
                <p className="text-lg font-bold text-(--ws-fg)">
                  {formatCurrencyFromMajor(totalBudgeted, { currency: form.watch("currency") || "GHS", maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {lineItems.map((item, index) => (
              <div
                key={index}
                className="flex gap-3 items-start p-4 rounded-xl border border-(--ws-line) bg-(--ws-fill)"
              >
                <div className="flex-1 grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs text-(--ws-fg-70)">Category</Label>
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
                    <Label className="text-xs text-(--ws-fg-70)">Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.budgetedAmount || ""}
                      onChange={(e) => updateLineItem(index, "budgetedAmount", e.target.value)}
                      placeholder="0.00"
                      className="border-(--ws-line) bg-(--ws-fill) text-(--ws-fg) placeholder:text-(--ws-fg-50)"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLineItem(index)}
                  disabled={lineItems.length === 1}
                  className="shrink-0 text-(--ws-fg-70) hover:text-(--ws-rose)"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addLineItem}
              className="w-full border-dashed border-(--ws-line) hover:border-(--ws-line) hover:bg-(--ws-fill-strong)"
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
            className="border-(--ws-line) bg-(--ws-fill) hover:bg-(--ws-fill-strong)"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createBudget.isPending || isRedirecting}
            className="bg-linear-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 hover:text-white"
          >
            {(createBudget.isPending || isRedirecting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Calculator className="mr-2 h-4 w-4" />
            {isRedirecting ? "Opening budgets..." : "Create Budget"}
          </Button>
        </div>
      </form>
    </WorkspaceScope>
  );
}

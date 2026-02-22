"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuSeparator,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import {
  MoreHorizontal,
  Mail,
  Pencil,
  UserPlus,
  CreditCard,
  Eye,
} from "lucide-react";

type StudentRowActionsProps = {
  id: string;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAssignClass?: (id: string) => void;
  onSendMessage?: (id: string) => void;
  onRecordPayment?: (id: string) => void;
};

export function StudentRowActions({
  id,
  onView,
  onEdit,
  onAssignClass,
  onSendMessage,
  onRecordPayment,
}: StudentRowActionsProps) {
  const handle =
    (fn?: (id: string) => void) =>
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      fn?.(id);
    };

  return (
    <PremiumDropdownMenu>
      <PremiumDropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </PremiumDropdownMenuTrigger>
      <PremiumDropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <PremiumDropdownMenuItem
          onClick={handle(onView)}
          icon={<Eye className="h-4 w-4" />}
        >
          View Profile
        </PremiumDropdownMenuItem>
        <PremiumDropdownMenuItem
          onClick={handle(onEdit)}
          icon={<Pencil className="h-3.5 w-3.5" />}
        >
          Edit details
        </PremiumDropdownMenuItem>
        <PremiumDropdownMenuSeparator />
        <PremiumDropdownMenuItem
          onClick={handle(onAssignClass)}
          icon={<UserPlus className="h-3.5 w-3.5" />}
        >
          Assign / Change Class
        </PremiumDropdownMenuItem>
        <PremiumDropdownMenuItem
          onClick={handle(onRecordPayment)}
          icon={<CreditCard className="h-3.5 w-3.5" />}
        >
          Record Payment
        </PremiumDropdownMenuItem>
        <PremiumDropdownMenuItem
          onClick={handle(onSendMessage)}
          icon={<Mail className="h-3.5 w-3.5" />}
        >
          Message Parent
        </PremiumDropdownMenuItem>
      </PremiumDropdownMenuContent>
    </PremiumDropdownMenu>
  );
}

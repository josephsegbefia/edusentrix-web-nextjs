"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import { MoreHorizontal, ExternalLink, Pencil } from "lucide-react";

type GradeRowActionsProps = {
  id: string;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
};

export function GradeRowActions({
  id,
  onView,
  onEdit,
}: GradeRowActionsProps) {
  return (
    <PremiumDropdownMenu>
      <PremiumDropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </PremiumDropdownMenuTrigger>
      <PremiumDropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <PremiumDropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onView?.(id);
          }}
          icon={<ExternalLink className="h-3.5 w-3.5" />}
        >
          View grade
        </PremiumDropdownMenuItem>
        <PremiumDropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(id);
          }}
          icon={<Pencil className="h-3.5 w-3.5" />}
        >
          Edit details
        </PremiumDropdownMenuItem>
      </PremiumDropdownMenuContent>
    </PremiumDropdownMenu>
  );
}

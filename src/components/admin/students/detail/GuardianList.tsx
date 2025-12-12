"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  UserCheck,
  Mail,
  Phone,
  Briefcase,
  Edit,
  Trash2,
  Star,
  StarOff,
} from "lucide-react";
import { motion } from "framer-motion";
import type { GuardianData } from "@/hooks/admin/useGuardians";
import { cn } from "@/lib/utils";

type Props = {
  guardians: GuardianData[];
  onEdit: (guardian: GuardianData) => void;
  onDelete: (guardianId: string) => void;
  onSetPrimary: (guardianId: string) => void;
  isLoading?: boolean;
};

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(" ");
  const first = parts[0]?.charAt(0)?.toUpperCase() || "";
  const last = parts[parts.length - 1]?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
}

function getRelationshipLabel(relationship: string): string {
  const labels: Record<string, string> = {
    mother: "Mother",
    father: "Father",
    guardian: "Guardian",
    step_mother: "Step Mother",
    step_father: "Step Father",
    grandmother: "Grandmother",
    grandfather: "Grandfather",
    aunt: "Aunt",
    uncle: "Uncle",
    other: "Other",
  };
  return labels[relationship] || relationship;
}

export function GuardianList({
  guardians,
  onEdit,
  onDelete,
  onSetPrimary,
  isLoading,
}: Props) {
  if (guardians.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
        <UserCheck className="mb-3 h-8 w-8 text-muted-foreground/70" />
        <p className="text-sm font-medium text-white/80">
          No guardians added yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Add a guardian to link them to this student
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {guardians.map((guardian) => (
        <motion.div
          key={guardian.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="group relative rounded-lg border border-white/10 bg-black/30 p-4 transition-all hover:border-white/20 hover:bg-black/40"
        >
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <Avatar className="h-12 w-12 border-2 border-white/20 ring-2 ring-primary/20 shadow-lg shadow-black/50">
              {guardian.photoUrl ? (
                <AvatarImage src={guardian.photoUrl} alt={guardian.fullName} />
              ) : (
                <AvatarFallback className="bg-linear-to-br from-primary/30 to-primary/20 text-sm font-semibold text-primary-50">
                  {getInitials(guardian.fullName)}
                </AvatarFallback>
              )}
            </Avatar>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white/90 truncate">
                  {guardian.fullName}
                </span>
                {guardian.isPrimary && (
                  <Badge className="bg-primary/20 border border-primary/30 text-primary-100 text-[10px] font-medium">
                    <Star className="mr-1 h-2.5 w-2.5 fill-primary" />
                    Primary
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="border-white/20 bg-white/5 text-[10px]"
                >
                  {getRelationshipLabel(guardian.relationship)}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground/80">
                {guardian.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{guardian.email}</span>
                  </div>
                )}
                {guardian.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    <span>{guardian.phone}</span>
                  </div>
                )}
                {guardian.occupation && (
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="h-3 w-3" />
                    <span>{guardian.occupation}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {!guardian.isPrimary && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onSetPrimary(guardian.id)}
                  disabled={isLoading}
                  className="h-8 w-8 cursor-pointer border border-white/10 bg-white/5 text-white/70 transition-all duration-200 hover:scale-105 hover:border-amber-400/50 hover:bg-amber-500/20 hover:text-amber-200 hover:shadow-md hover:shadow-amber-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Set as primary"
                >
                  <StarOff className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onEdit(guardian)}
                disabled={isLoading}
                className="h-8 w-8 cursor-pointer border border-white/10 bg-white/5 text-white/70 transition-all duration-200 hover:scale-105 hover:border-blue-400/50 hover:bg-blue-500/20 hover:text-blue-200 hover:shadow-md hover:shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Edit guardian"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onDelete(guardian.id)}
                disabled={isLoading}
                className="h-8 w-8 cursor-pointer border border-white/10 bg-white/5 text-white/70 transition-all duration-200 hover:scale-105 hover:border-red-400/50 hover:bg-red-500/20 hover:text-red-200 hover:shadow-md hover:shadow-red-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Remove guardian"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

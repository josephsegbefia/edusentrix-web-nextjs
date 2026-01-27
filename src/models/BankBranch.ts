// src/models/BankBranch.ts
import mongoose, { Schema, InferSchemaType } from "mongoose";

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)+/g, "");
}

function normalize(input: string) {
  return input
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[‘’'"]/g, "") // strip quotes variations
    .replace(/\s*-\s*/g, " - ")
    .trim();
}

const BankBranchSchema = new Schema(
  {
    sortCode: {
      type: String,
      required: true,
      match: [/^\d{6}$/, "sortCode must be 6 digits"],
      unique: true,
      index: true,
    },
    bankName: { type: String, required: true },
    branchName: { type: String, required: true },

    // Derived / helper fields
    bankSlug: { type: String, index: true },
    bankNameNormalized: { type: String, index: true },
    branchNameNormalized: { type: String, index: true },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Text search (autocomplete-friendly when paired with regex)
BankBranchSchema.index({ bankName: "text", branchName: "text" });

// Normalize + slug on save
BankBranchSchema.pre("validate", function (next) {
  this.bankName = normalize(this.bankName);

  this.branchName = normalize(this.branchName);

  this.bankNameNormalized = normalize(this.bankName);

  this.branchNameNormalized = normalize(this.branchName);

  this.bankSlug = slugify(this.bankName);
  next();
});

export type BankBranchDoc = InferSchemaType<typeof BankBranchSchema>;
export const BankBranch =
  mongoose.models.BankBranch ||
  mongoose.model<BankBranchDoc>("BankBranch", BankBranchSchema);

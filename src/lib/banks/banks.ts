import { BankBranch, type BankBranchDoc } from "@/models/BankBranch";

/** Trust DB only; never trust client for bank codes */
export async function resolveBankCode(bankName?: string, branchName?: string) {
  if (!bankName || !branchName) return null;
  const branch = (await BankBranch.findOne({
    bankName: new RegExp(`^${escapeRegExp(bankName)}$`, "i"),
    branchName: new RegExp(`^${escapeRegExp(branchName)}$`, "i"),
  })
    .select("sortCode")
    .lean()) as Pick<BankBranchDoc, "sortCode"> | null;

  if (!branch?.sortCode) return null;
  return String(branch.sortCode).padStart(6, "0");
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

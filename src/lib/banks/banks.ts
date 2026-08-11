import { BankBranch, type BankBranchDoc } from "@/models/BankBranch";
import { resolvePaystackSettlementBankCode } from "@/lib/paystack";

/** Trust server-side sources only; never trust client-submitted bank codes. */
export async function resolveBankCode(bankName?: string, branchName?: string) {
  if (!bankName || !branchName) return null;
  const branch = (await BankBranch.findOne({
    bankName: new RegExp(`^${escapeRegExp(bankName)}$`, "i"),
    branchName: new RegExp(`^${escapeRegExp(branchName)}$`, "i"),
  })
    .select("sortCode")
    .lean()) as Pick<BankBranchDoc, "sortCode"> | null;

  if (branch?.sortCode) {
    return String(branch.sortCode).padStart(6, "0");
  }

  try {
    return await resolvePaystackSettlementBankCode(bankName);
  } catch {
    return null;
  }
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

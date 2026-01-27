/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

const PAYSTACK_BASE = "https://api.paystack.co";

const { PAYSTACK_SECRET_KEY } = process.env;
function headers() {
  if (!PAYSTACK_SECRET_KEY) throw new Error("Missing PAYSTACK_SECRET_KEY");

  return {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

/** GET /bank?country=ghana to retrieve bank list and codes (Paystack docs) */

export async function listGhanaBanks() {
  const res = await fetch(`${PAYSTACK_BASE}/bank?country=ghana`, {
    method: "GET",
    headers: headers(),
    cache: "no-store",
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.message || "Failed to list banks");
  return j?.data as Array<{ name: string; code: string }>;
}

/**
 * Create subaccount for a school (GHS).
 * Paystack docs show POST /subaccount with fields like:
 *  - business_name
 *  - settlement_bank (a bank "code" from  /bank)
 *  - account_number
 *  - percentage_charge
 *  - currency
 * (Fields naming varies in examples: "bank_code" and "settlement_bank" are used interchangeably)
 */

type CreateSubaccountInput = {
  businessName: string;
  bankCode: string; // our seeded "sortCode"
  accountNumber: string;
  percentageCharge?: number; // defaults to 0
  contactEmail?: string;
  description?: string;
};

type PaystackSubaccount = {
  id: number;
  subaccount_code: string;
};

export async function createSubaccount(
  input: CreateSubaccountInput
): Promise<PaystackSubaccount> {
  // Paystack NG uses settlement_bank; GH integrations often accept bank_code.
  // We safely send both.
  const payload: Record<string, any> = {
    business_name: input.businessName,
    bank_code: input.bankCode,
    settlement_bank: input.bankCode, // tolerate either
    account_number: input.accountNumber,
    percentage_charge: input.percentageCharge ?? 0,
    description: input.description ?? "EduSentrix school settlement subaccount",
  };
  if (input.contactEmail) payload.settlement_email = input.contactEmail;

  const res = await fetch(`${PAYSTACK_BASE}/subaccount`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Paystack error (${res.status}): ${text || res.statusText}`
    );
  }

  const json = await res.json();
  if (!json?.status || !json?.data) {
    throw new Error(`Unexpected Paystack response: ${JSON.stringify(json)}`);
  }
  return json.data as PaystackSubaccount;
}

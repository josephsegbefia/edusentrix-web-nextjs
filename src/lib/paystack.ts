import "server-only";

const PAYSTACK_BASE = "https://api.paystack.co";

const { PAYSTACK_SECRET_KEY, APP_URL } = process.env;
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

export async function createSubaccount(params: {
  businessName: string;
  bankCode: string;
  accountNumber: string;
  percentageCharge?: number;
  contactEmail?: string;
}) {
  const body = {
    business_name: params.businessName,
    settlement_bank: params.bankCode,
    account_number: params.accountNumber,
    percentage_charge: params.percentageCharge,
    currency: "GHS",
    primary_contact_email: params.contactEmail,
  };

  const res = await fetch(`{PAYSTACK_BASE}/subaccount`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  const j = await res.json();
  if (!res.ok) throw new Error(j?.message || "Failed to create subaccount");
  return j?.data as { subaccount_code: string; id: number };
}

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

type InitializeTransactionInput = {
  email: string;
  amountMinor: number;
  reference: string;
  callbackUrl?: string;
  currency?: string;
  metadata?: Record<string, any>;
  subaccountCode?: string | null;
  transactionChargeMinor?: number | null;
  bearer?: "account" | "subaccount";
};

type PaystackTransactionInit = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

type CreateTransferRecipientInput = {
  method: "bank" | "mobile_money";
  name: string;
  accountNumber: string;
  bankCode: string;
  currency?: string;
  description?: string;
};

type PaystackTransferRecipient = {
  recipient_code: string;
  type?: string;
  name?: string;
};

type InitiateTransferInput = {
  amountMinor: number;
  recipientCode: string;
  reason: string;
  reference: string;
  currency?: string;
  source?: "balance";
};

type PaystackTransfer = {
  id?: number;
  transfer_code?: string;
  status?: string;
};

type PaystackTransferVerification = {
  id?: number;
  transfer_code?: string;
  reference?: string;
  status?: string;
  reason?: string | null;
  amount?: number;
  currency?: string;
  fee_charged?: number;
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

export async function initializeTransaction(
  input: InitializeTransactionInput
): Promise<PaystackTransactionInit> {
  const payload: Record<string, any> = {
    email: input.email,
    amount: Math.round(input.amountMinor),
    reference: input.reference,
    currency: input.currency ?? "GHS",
  };

  if (input.callbackUrl) payload.callback_url = input.callbackUrl;
  if (input.metadata) payload.metadata = input.metadata;
  if (input.subaccountCode) payload.subaccount = input.subaccountCode;
  if (
    typeof input.transactionChargeMinor === "number" &&
    Number.isFinite(input.transactionChargeMinor) &&
    input.transactionChargeMinor > 0
  ) {
    payload.transaction_charge = Math.round(input.transactionChargeMinor);
  }
  if (input.bearer) payload.bearer = input.bearer;

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Paystack initialize error (${res.status}): ${text || res.statusText}`
    );
  }

  const json = await res.json();
  if (!json?.status || !json?.data?.authorization_url) {
    throw new Error(`Unexpected Paystack response: ${JSON.stringify(json)}`);
  }

  return json.data as PaystackTransactionInit;
}

export async function createTransferRecipient(
  input: CreateTransferRecipientInput
): Promise<PaystackTransferRecipient> {
  const payload: Record<string, any> = {
    type: input.method === "bank" ? "nuban" : "mobile_money",
    name: input.name,
    account_number: input.accountNumber,
    bank_code: input.bankCode,
    currency: input.currency ?? "GHS",
  };

  if (input.description) {
    payload.description = input.description;
  }

  const res = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Paystack transfer recipient error (${res.status}): ${text || res.statusText}`
    );
  }

  const json = await res.json();
  if (!json?.status || !json?.data?.recipient_code) {
    throw new Error(`Unexpected Paystack response: ${JSON.stringify(json)}`);
  }

  return json.data as PaystackTransferRecipient;
}

export async function initiateTransfer(
  input: InitiateTransferInput
): Promise<PaystackTransfer> {
  const payload: Record<string, any> = {
    source: input.source ?? "balance",
    amount: Math.round(input.amountMinor),
    recipient: input.recipientCode,
    reason: input.reason,
    reference: input.reference,
    currency: input.currency ?? "GHS",
  };

  const res = await fetch(`${PAYSTACK_BASE}/transfer`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Paystack transfer error (${res.status}): ${text || res.statusText}`
    );
  }

  const json = await res.json();
  if (!json?.status || !json?.data) {
    throw new Error(`Unexpected Paystack response: ${JSON.stringify(json)}`);
  }

  return json.data as PaystackTransfer;
}

export async function verifyTransfer(
  reference: string
): Promise<PaystackTransferVerification> {
  const safeReference = encodeURIComponent(reference.trim());
  const res = await fetch(`${PAYSTACK_BASE}/transfer/verify/${safeReference}`, {
    method: "GET",
    headers: headers(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Paystack transfer verify error (${res.status}): ${text || res.statusText}`
    );
  }

  const json = await res.json();
  if (!json?.status || !json?.data) {
    throw new Error(`Unexpected Paystack response: ${JSON.stringify(json)}`);
  }

  return json.data as PaystackTransferVerification;
}

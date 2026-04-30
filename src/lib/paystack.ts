/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { isLikelyPaystackSubaccountCode } from "@/lib/school-payments/paystack-subaccount-code";
import { enforceDemoPolicy } from "@/lib/demo/action-policy";

const PAYSTACK_BASE = "https://api.paystack.co";

const PAYSTACK_FETCH_TIMEOUT_MS = 25_000;

function paystackFetchSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(PAYSTACK_FETCH_TIMEOUT_MS);
  }
  return undefined;
}

async function paystackRequest(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      throw new Error(
        `Paystack request timed out after ${PAYSTACK_FETCH_TIMEOUT_MS / 1000}s. Background provisioning may still complete; check the readiness card or platform diagnostics.`
      );
    }
    throw err;
  }
}

const { PAYSTACK_SECRET_KEY } = process.env;
function headers() {
  const key = (PAYSTACK_SECRET_KEY || "").trim();
  if (!key) throw new Error("Missing PAYSTACK_SECRET_KEY");

  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export type PaystackKeyMode = "test" | "live" | "unset";

/** Inferred from secret key prefix — subaccounts only appear in the matching Paystack dashboard mode. */
export function getPaystackKeyMode(): PaystackKeyMode {
  const k = process.env.PAYSTACK_SECRET_KEY || "";
  if (k.startsWith("sk_test_")) return "test";
  if (k.startsWith("sk_live_")) return "live";
  return "unset";
}

/** GET /bank?country=ghana to retrieve bank list and codes (Paystack docs) */

export async function listGhanaBanks(): Promise<
  Array<{ name: string; code: string }>
> {
  if (!(PAYSTACK_SECRET_KEY || "").trim()) {
    return [];
  }

  const res = await paystackRequest(`${PAYSTACK_BASE}/bank?country=ghana`, {
    method: "GET",
    headers: headers(),
    cache: "no-store",
    signal: paystackFetchSignal(),
  });
  const j = await res.json();
  if (!res.ok || j?.status !== true) {
    throw new Error(j?.message || "Failed to list banks");
  }
  const data = j?.data;
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .map((b: { name?: string; code?: string }) => ({
      name: String(b?.name ?? "").trim(),
      code: String(b?.code ?? "").trim(),
    }))
    .filter((b) => b.name.length > 0 && b.code.length > 0);
}

let ghanaBanksCache: {
  fetchedAt: number;
  banks: Array<{ name: string; code: string }>;
} | null = null;
const GHANA_BANKS_TTL_MS = 60 * 60 * 1000;

/** Cached Paystack Ghana bank list (codes are settlement_bank values, not domestic sort codes). */
export async function listGhanaBanksCached() {
  const now = Date.now();
  if (
    ghanaBanksCache &&
    now - ghanaBanksCache.fetchedAt < GHANA_BANKS_TTL_MS
  ) {
    return ghanaBanksCache.banks;
  }
  const banks = await listGhanaBanks();
  if ((PAYSTACK_SECRET_KEY || "").trim()) {
    ghanaBanksCache = { fetchedAt: now, banks };
  }
  return banks;
}

function normalizeBankLabel(s: string) {
  return s
    .toUpperCase()
    .replace(/[.,'"]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\b(LIMITED|LTD|PLC|GHANA|G\.H\.)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Maps a school bank display name to Paystack's `settlement_bank` code.
 * Do not use Ghana 6-digit sort codes here — Paystack validates against GET /bank?country=ghana.
 */
export async function resolvePaystackSettlementBankCode(
  bankName: string | null | undefined
): Promise<string> {
  const raw = (bankName || "").trim();
  if (!raw) {
    throw new Error("Bank name is required to resolve Paystack settlement bank");
  }

  const banks = await listGhanaBanksCached();
  const norm = normalizeBankLabel(raw);

  const exact = banks.find((b) => normalizeBankLabel(b.name) === norm);
  if (exact) return String(exact.code);

  const loose = banks.find((b) => {
    const bn = normalizeBankLabel(b.name);
    return bn === norm || bn.includes(norm) || norm.includes(bn);
  });
  if (loose) return String(loose.code);

  const words = norm.split(/\s+/).filter((w) => w.length >= 4);
  for (const w of words) {
    const hit = banks.find((b) => normalizeBankLabel(b.name).includes(w));
    if (hit) return String(hit.code);
  }

  const shortWords = norm.split(/\s+/).filter((w) => w.length >= 3);
  for (const w of shortWords) {
    const hits = banks.filter((b) => normalizeBankLabel(b.name).includes(w));
    if (hits.length === 1) return String(hits[0].code);
  }

  throw new Error(
    `Could not match "${raw}" to Paystack's Ghana bank list. Re-open payout details, pick the bank from search again, save, and retry.`
  );
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
  /** Paystack settlement bank code from GET /bank?country=ghana — not Ghana domestic sort code */
  bankCode: string;
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
  const sim = enforceDemoPolicy<PaystackSubaccount>("paystack", "createSubaccount");
  if (sim) return sim;

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

  const res = await paystackRequest(`${PAYSTACK_BASE}/subaccount`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: paystackFetchSignal(),
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
  const data = json.data as Record<string, unknown>;
  const rawCode =
    (typeof data.subaccount_code === "string" && data.subaccount_code) ||
    (typeof data.subaccountCode === "string" && data.subaccountCode) ||
    "";
  const trimmed = rawCode.trim();
  if (!isLikelyPaystackSubaccountCode(trimmed)) {
    throw new Error(
      `Paystack returned success but no usable subaccount_code in data: ${JSON.stringify(json)}`
    );
  }
  const rawId = data.id;
  const idNum =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
        ? Number(rawId)
        : NaN;
  return {
    subaccount_code: trimmed,
    id: Number.isFinite(idNum) ? idNum : 0,
  };
}

export async function initializeTransaction(
  input: InitializeTransactionInput
): Promise<PaystackTransactionInit> {
  const sim = enforceDemoPolicy<PaystackTransactionInit>("paystack", "initializeTransaction");
  if (sim) return sim;

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
  const sim = enforceDemoPolicy<PaystackTransferRecipient>("paystack", "createTransferRecipient");
  if (sim) return sim;

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
  enforceDemoPolicy("paystack", "initiateTransfer");

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

export type PaystackTransactionVerification = {
  id?: number;
  reference?: string;
  status?: string;
  amount?: number;
  currency?: string;
  channel?: string;
  paid_at?: string | null;
  customer?: { email?: string };
  metadata?: Record<string, any> | null;
};

export async function verifyTransaction(
  reference: string
): Promise<PaystackTransactionVerification> {
  const safeReference = encodeURIComponent(reference.trim());
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${safeReference}`,
    {
      method: "GET",
      headers: headers(),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Paystack transaction verify error (${res.status}): ${text || res.statusText}`
    );
  }

  const json = await res.json();
  if (!json?.status || !json?.data) {
    throw new Error(`Unexpected Paystack response: ${JSON.stringify(json)}`);
  }

  return json.data as PaystackTransactionVerification;
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

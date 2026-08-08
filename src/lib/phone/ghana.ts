export function stripToPhoneChars(value: string | null | undefined): string {
  return (value ?? "").replace(/[^\d+]/g, "");
}

type GhanaPhoneDraft = {
  localDigits: string;
  hasLeadingZero: boolean;
};

function toGhanaPhoneDraft(value: string | null | undefined): GhanaPhoneDraft {
  const raw = stripToPhoneChars(value);
  if (!raw) {
    return { localDigits: "", hasLeadingZero: false };
  }

  let digits = raw.startsWith("+") ? raw.slice(1) : raw;

  if (digits.startsWith("233")) {
    digits = digits.slice(3);
    return {
      localDigits: digits.replace(/\D/g, "").slice(0, 9),
      hasLeadingZero: false,
    };
  }

  const sanitized = digits.replace(/\D/g, "");
  if (sanitized.startsWith("0")) {
    return {
      localDigits: sanitized.slice(0, 10),
      hasLeadingZero: true,
    };
  }

  return {
    localDigits: sanitized.slice(0, 9),
    hasLeadingZero: false,
  };
}

export function toGhanaMobileLocalDigits(value: string | null | undefined): string {
  const draft = toGhanaPhoneDraft(value);
  if (!draft.localDigits) return "";
  return draft.hasLeadingZero ? draft.localDigits.slice(1, 10) : draft.localDigits;
}

export function formatGhanaLocalPhoneInput(value: string | null | undefined): string {
  const draft = toGhanaPhoneDraft(value);
  if (!draft.localDigits) return "";

  if (draft.hasLeadingZero) {
    const first = draft.localDigits.slice(0, 3);
    const second = draft.localDigits.slice(3, 6);
    const third = draft.localDigits.slice(6, 10);

    return [first, second, third].filter(Boolean).join(" ");
  }

  const first = draft.localDigits.slice(0, 2);
  const second = draft.localDigits.slice(2, 5);
  const third = draft.localDigits.slice(5, 9);

  return [first, second, third].filter(Boolean).join(" ");
}

export function formatGhanaPhoneInput(value: string | null | undefined): string {
  if (!value) return "";

  const draft = toGhanaPhoneDraft(value);
  if (!draft.localDigits) return "";
  if (draft.hasLeadingZero && draft.localDigits.length === 1) return "0";

  const local = draft.hasLeadingZero
    ? draft.localDigits.slice(1, 10)
    : draft.localDigits;
  if (!local) return "+233";

  const first = local.slice(0, 2);
  const second = local.slice(2, 5);
  const third = local.slice(5, 9);

  const parts = ["+233"];
  if (first) parts.push(first);
  if (second) parts.push(second);
  if (third) parts.push(third);
  return parts.join(" ");
}

export function normalizeGhanaPhoneForStorage(value: string | null | undefined): string {
  const formatted = formatGhanaPhoneInput(value);
  return formatted === "+233" ? "" : formatted;
}

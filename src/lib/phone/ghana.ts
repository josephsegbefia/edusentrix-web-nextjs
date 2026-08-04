export function stripToPhoneChars(value: string | null | undefined): string {
  return (value ?? "").replace(/[^\d+]/g, "");
}

export function toGhanaMobileLocalDigits(value: string | null | undefined): string {
  const raw = stripToPhoneChars(value);
  if (!raw) return "";

  let digits = raw.startsWith("+") ? raw.slice(1) : raw;

  if (digits.startsWith("233")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.replace(/\D/g, "").slice(0, 9);
}

export function formatGhanaPhoneInput(value: string | null | undefined): string {
  if (!value) return "";

  const local = toGhanaMobileLocalDigits(value);
  if (!local) return "";

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
  return formatGhanaPhoneInput(value);
}

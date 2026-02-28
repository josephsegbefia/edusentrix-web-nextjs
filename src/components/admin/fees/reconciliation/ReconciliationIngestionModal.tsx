"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  useIngestReconciliationData,
  type ReconciliationSourceType,
} from "@/hooks/admin/useReconciliation";
import { formatCurrency } from "@/lib/fees/money";

type ParsedEntry = {
  externalTxnId: string;
  amountMinor: number;
  transactionDate: string;
  reference?: string;
  currency?: string;
  payerName?: string;
  payerPhone?: string;
  payerEmail?: string;
  bankAccountName?: string;
  channel?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

type ParsedResult = {
  entries: ParsedEntry[];
  errors: string[];
  delimiter: "comma" | "tab";
  mappingConfidence: HeaderMappingConfidence;
  detectedHeaders: string[];
};

type HeaderMappingDetail = {
  key: string;
  label: string;
  required: boolean;
  matched: boolean;
  matchedHeader: string | null;
  matchedAlias: string | null;
  exactCanonical: boolean;
};

type HeaderMappingConfidence = {
  score: number;
  level: "high" | "medium" | "low";
  matchedRequired: number;
  totalRequired: number;
  matchedOptional: number;
  totalOptional: number;
  summary: string;
  details: HeaderMappingDetail[];
};

type HeaderMatchResult = {
  index: number;
  alias: string;
  originalHeader: string;
};

type IngestionMode = "upload" | "paste";

const CSV_TEMPLATE = `externalTxnId,reference,amount,transactionDate,currency,payerName,payerPhone,payerEmail,channel,notes
MOMO-20260222-001,MM-88470021,120.00,2026-02-22T10:05:00Z,GHS,Kojo Mensah,0240000000,kojo@example.com,mobile_money,February collection
BANK-DEP-002,DEP-90122,450.50,2026-02-22T12:30:00Z,GHS,Ama Sarpong,0260000000,ama@example.com,bank_transfer,Counter deposit`;

const COLUMN_HINTS = [
  "Required: externalTxnId, amount (or amountMinor), transactionDate",
  "Optional: reference, payerName, payerPhone, payerEmail, currency, channel, notes",
  "You can paste CSV or tab-separated rows from Excel/Google Sheets.",
];
const MIN_MAPPING_CONFIDENCE_SCORE = 60;

const HEADER_ALIASES = {
  externalTxnId: [
    "externaltxnid",
    "externalid",
    "externaltransactionid",
    "externaltransactionreference",
    "transactionid",
    "transactionreference",
    "txnreference",
    "txnid",
    "sessionid",
    "rrn",
    "stan",
  ],
  reference: [
    "reference",
    "ref",
    "rawreference",
    "paymentreference",
    "customerreference",
    "bankreference",
    "narration",
    "description",
    "remarks",
    "details",
  ],
  amountMinor: ["amountminor"],
  amount: [
    "amount",
    "amountghs",
    "amountmajor",
    "credit",
    "creditamount",
    "amountpaid",
    "paidamount",
    "depositamount",
  ],
  transactionDate: [
    "transactiondate",
    "date",
    "occurredat",
    "valuedate",
    "postingdate",
    "transactiontime",
    "datetime",
    "createdat",
    "timestamp",
  ],
  currency: ["currency"],
  payerName: [
    "payername",
    "name",
    "sendername",
    "depositorname",
    "customername",
    "accountname",
  ],
  payerPhone: ["payerphone", "phone", "msisdn", "senderphone", "mobilenumber"],
  payerEmail: ["payeremail", "email"],
  bankAccountName: ["bankaccountname", "accountname"],
  channel: ["channel", "method", "paymentmethod", "source", "provider"],
  notes: ["notes", "note", "comment"],
} as const;

const BANK_MAPPING_GUIDE_ROWS: Array<{
  field: string;
  required: "Yes" | "No";
  example: string;
  notes: string;
  aliases: readonly string[];
}> = [
  {
    field: "externalTxnId",
    required: "Yes",
    example: "MOMO-20260222-001",
    notes: "Must uniquely identify a transaction in source statement.",
    aliases: HEADER_ALIASES.externalTxnId,
  },
  {
    field: "reference",
    required: "No",
    example: "MM-88470021",
    notes: "Used for deterministic matching before amount/date fallback.",
    aliases: HEADER_ALIASES.reference,
  },
  {
    field: "amount or amountMinor",
    required: "Yes",
    example: "120.00 (amount) or 12000 (amountMinor)",
    notes: "`amount` is major units, `amountMinor` is minor units.",
    aliases: [...HEADER_ALIASES.amount, ...HEADER_ALIASES.amountMinor],
  },
  {
    field: "transactionDate",
    required: "Yes",
    example: "2026-02-22T10:05:00Z",
    notes: "ISO preferred. YYYY-MM-DD is also accepted.",
    aliases: HEADER_ALIASES.transactionDate,
  },
  {
    field: "payerName",
    required: "No",
    example: "Ama Sarpong",
    notes: "Useful for manual reconciliation review context.",
    aliases: HEADER_ALIASES.payerName,
  },
  {
    field: "payerPhone",
    required: "No",
    example: "0240000000",
    notes: "Supports MoMo statement formats.",
    aliases: HEADER_ALIASES.payerPhone,
  },
  {
    field: "channel",
    required: "No",
    example: "mobile_money",
    notes: "Optional metadata only; does not block ingestion.",
    aliases: HEADER_ALIASES.channel,
  },
  {
    field: "notes",
    required: "No",
    example: "Counter deposit",
    notes: "Internal remarks for finance team.",
    aliases: HEADER_ALIASES.notes,
  },
];

function confidenceBadgeClass(level: HeaderMappingConfidence["level"]) {
  if (level === "high") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (level === "medium") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  return "border-rose-500/30 bg-rose-500/10 text-rose-300";
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function parseLine(line: string, delimiter: "," | "\t") {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseAmountFromMinorField(value: string) {
  const cleaned = String(value || "").trim();
  if (!cleaned) return null;
  const minor = Number(cleaned.replace(/,/g, ""));
  if (!Number.isFinite(minor) || minor < 0) return null;
  return Math.round(minor);
}

function parseAmountFromMajorField(value: string) {
  const cleaned = String(value || "").trim();
  if (!cleaned) return null;
  const major = Number(cleaned.replace(/,/g, ""));
  if (!Number.isFinite(major) || major < 0) return null;
  return Math.round(major * 100);
}

function parseDate(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T00:00:00.000Z`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function findHeaderMatch(
  headerMap: Map<string, number>,
  aliases: readonly string[],
  headersOriginal: string[]
): HeaderMatchResult | null {
  for (const alias of aliases) {
    const index = headerMap.get(alias);
    if (typeof index === "number") {
      return {
        index,
        alias,
        originalHeader: headersOriginal[index] || alias,
      };
    }
  }
  return null;
}

function buildMappingConfidence(details: HeaderMappingDetail[]): HeaderMappingConfidence {
  const required = details.filter((detail) => detail.required);
  const optional = details.filter((detail) => !detail.required);
  const matchedRequired = required.filter((detail) => detail.matched).length;
  const matchedOptional = optional.filter((detail) => detail.matched).length;

  let score = 0;
  for (const detail of details) {
    if (!detail.matched) continue;
    score += detail.required ? 20 : 3;
    if (detail.exactCanonical) score += detail.required ? 2 : 1;
  }
  if (required.length > 0 && matchedRequired === required.length) {
    score += 2;
  }
  score = Math.max(0, Math.min(100, score));

  const level: HeaderMappingConfidence["level"] =
    score >= 85 ? "high" : score >= 60 ? "medium" : "low";

  const summary =
    level === "high"
      ? "Header mapping is strong. Safe to ingest after preview."
      : level === "medium"
      ? "Header mapping is acceptable. Review unmatched optional fields."
      : "Header mapping is weak. Fix headers before ingesting.";

  return {
    score,
    level,
    matchedRequired,
    totalRequired: required.length,
    matchedOptional,
    totalOptional: optional.length,
    summary,
    details,
  };
}

function emptyMappingConfidence(summary = "No headers parsed yet."): HeaderMappingConfidence {
  return {
    score: 0,
    level: "low",
    matchedRequired: 0,
    totalRequired: 0,
    matchedOptional: 0,
    totalOptional: 0,
    summary,
    details: [],
  };
}

function parseSpreadsheetText(rawText: string): ParsedResult {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) {
    return {
      entries: [],
      errors: ["No data provided. Paste rows or upload a file first."],
      delimiter: "comma",
      mappingConfidence: emptyMappingConfidence(),
      detectedHeaders: [],
    };
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      entries: [],
      errors: ["At least one header row and one data row are required."],
      delimiter: "comma",
      mappingConfidence: emptyMappingConfidence(),
      detectedHeaders: [],
    };
  }

  const headerLine = lines[0];
  const delimiter: "," | "\t" =
    headerLine.split("\t").length > headerLine.split(",").length ? "\t" : ",";

  const headersOriginal = parseLine(headerLine, delimiter).map((header) =>
    header.trim()
  );
  const headers = headersOriginal.map(normalizeHeader);
  const headerMap = new Map<string, number>();
  headers.forEach((header, index) => {
    headerMap.set(header, index);
  });

  const externalTxnIdMatch = findHeaderMatch(
    headerMap,
    HEADER_ALIASES.externalTxnId,
    headersOriginal
  );
  const referenceMatch = findHeaderMatch(
    headerMap,
    HEADER_ALIASES.reference,
    headersOriginal
  );
  const amountMinorMatch = findHeaderMatch(
    headerMap,
    HEADER_ALIASES.amountMinor,
    headersOriginal
  );
  const amountMatch = findHeaderMatch(
    headerMap,
    HEADER_ALIASES.amount,
    headersOriginal
  );
  const transactionDateMatch = findHeaderMatch(
    headerMap,
    HEADER_ALIASES.transactionDate,
    headersOriginal
  );
  const currencyMatch = findHeaderMatch(
    headerMap,
    HEADER_ALIASES.currency,
    headersOriginal
  );
  const payerNameMatch = findHeaderMatch(
    headerMap,
    HEADER_ALIASES.payerName,
    headersOriginal
  );
  const payerPhoneMatch = findHeaderMatch(
    headerMap,
    HEADER_ALIASES.payerPhone,
    headersOriginal
  );
  const payerEmailMatch = findHeaderMatch(
    headerMap,
    HEADER_ALIASES.payerEmail,
    headersOriginal
  );
  const bankAccountNameMatch = findHeaderMatch(
    headerMap,
    HEADER_ALIASES.bankAccountName,
    headersOriginal
  );
  const channelMatch = findHeaderMatch(
    headerMap,
    HEADER_ALIASES.channel,
    headersOriginal
  );
  const notesMatch = findHeaderMatch(
    headerMap,
    HEADER_ALIASES.notes,
    headersOriginal
  );

  const amountPrimaryMatch = amountMinorMatch || amountMatch;
  const mappingDetails: HeaderMappingDetail[] = [
    {
      key: "externalTxnId",
      label: "externalTxnId",
      required: true,
      matched: Boolean(externalTxnIdMatch),
      matchedHeader: externalTxnIdMatch?.originalHeader || null,
      matchedAlias: externalTxnIdMatch?.alias || null,
      exactCanonical: externalTxnIdMatch?.alias === HEADER_ALIASES.externalTxnId[0],
    },
    {
      key: "amount",
      label: "amount / amountMinor",
      required: true,
      matched: Boolean(amountPrimaryMatch),
      matchedHeader: amountPrimaryMatch?.originalHeader || null,
      matchedAlias: amountPrimaryMatch?.alias || null,
      exactCanonical: Boolean(
        amountPrimaryMatch?.alias === "amount" ||
          amountPrimaryMatch?.alias === "amountminor"
      ),
    },
    {
      key: "transactionDate",
      label: "transactionDate",
      required: true,
      matched: Boolean(transactionDateMatch),
      matchedHeader: transactionDateMatch?.originalHeader || null,
      matchedAlias: transactionDateMatch?.alias || null,
      exactCanonical: transactionDateMatch?.alias === HEADER_ALIASES.transactionDate[0],
    },
    {
      key: "reference",
      label: "reference",
      required: false,
      matched: Boolean(referenceMatch),
      matchedHeader: referenceMatch?.originalHeader || null,
      matchedAlias: referenceMatch?.alias || null,
      exactCanonical: referenceMatch?.alias === HEADER_ALIASES.reference[0],
    },
    {
      key: "payerName",
      label: "payerName",
      required: false,
      matched: Boolean(payerNameMatch),
      matchedHeader: payerNameMatch?.originalHeader || null,
      matchedAlias: payerNameMatch?.alias || null,
      exactCanonical: payerNameMatch?.alias === HEADER_ALIASES.payerName[0],
    },
    {
      key: "payerPhone",
      label: "payerPhone",
      required: false,
      matched: Boolean(payerPhoneMatch),
      matchedHeader: payerPhoneMatch?.originalHeader || null,
      matchedAlias: payerPhoneMatch?.alias || null,
      exactCanonical: payerPhoneMatch?.alias === HEADER_ALIASES.payerPhone[0],
    },
    {
      key: "payerEmail",
      label: "payerEmail",
      required: false,
      matched: Boolean(payerEmailMatch),
      matchedHeader: payerEmailMatch?.originalHeader || null,
      matchedAlias: payerEmailMatch?.alias || null,
      exactCanonical: payerEmailMatch?.alias === HEADER_ALIASES.payerEmail[0],
    },
    {
      key: "currency",
      label: "currency",
      required: false,
      matched: Boolean(currencyMatch),
      matchedHeader: currencyMatch?.originalHeader || null,
      matchedAlias: currencyMatch?.alias || null,
      exactCanonical: currencyMatch?.alias === HEADER_ALIASES.currency[0],
    },
    {
      key: "channel",
      label: "channel",
      required: false,
      matched: Boolean(channelMatch),
      matchedHeader: channelMatch?.originalHeader || null,
      matchedAlias: channelMatch?.alias || null,
      exactCanonical: channelMatch?.alias === HEADER_ALIASES.channel[0],
    },
    {
      key: "notes",
      label: "notes",
      required: false,
      matched: Boolean(notesMatch),
      matchedHeader: notesMatch?.originalHeader || null,
      matchedAlias: notesMatch?.alias || null,
      exactCanonical: notesMatch?.alias === HEADER_ALIASES.notes[0],
    },
    {
      key: "bankAccountName",
      label: "bankAccountName",
      required: false,
      matched: Boolean(bankAccountNameMatch),
      matchedHeader: bankAccountNameMatch?.originalHeader || null,
      matchedAlias: bankAccountNameMatch?.alias || null,
      exactCanonical:
        bankAccountNameMatch?.alias === HEADER_ALIASES.bankAccountName[0],
    },
  ];
  const mappingConfidence = buildMappingConfidence(mappingDetails);

  const externalTxnIdIndex = externalTxnIdMatch?.index ?? -1;
  const referenceIndex = referenceMatch?.index ?? -1;
  const amountMinorIndex = amountMinorMatch?.index ?? -1;
  const amountIndex = amountMatch?.index ?? -1;
  const transactionDateIndex = transactionDateMatch?.index ?? -1;
  const currencyIndex = currencyMatch?.index ?? -1;
  const payerNameIndex = payerNameMatch?.index ?? -1;
  const payerPhoneIndex = payerPhoneMatch?.index ?? -1;
  const payerEmailIndex = payerEmailMatch?.index ?? -1;
  const bankAccountNameIndex = bankAccountNameMatch?.index ?? -1;
  const channelIndex = channelMatch?.index ?? -1;
  const notesIndex = notesMatch?.index ?? -1;

  const errors: string[] = [];
  if (externalTxnIdIndex < 0) {
    errors.push("Missing required column: externalTxnId");
  }
  if (transactionDateIndex < 0) {
    errors.push("Missing required column: transactionDate");
  }
  if (amountMinorIndex < 0 && amountIndex < 0) {
    errors.push("Missing required column: amountMinor or amount");
  }
  if (errors.length > 0) {
    return {
      entries: [],
      errors,
      delimiter: delimiter === "," ? "comma" : "tab",
      mappingConfidence,
      detectedHeaders: headersOriginal,
    };
  }

  const entries: ParsedEntry[] = [];

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const rowNumber = rowIndex + 1;
    const cells = parseLine(lines[rowIndex], delimiter);

    const externalTxnId = String(cells[externalTxnIdIndex] || "").trim();
    const transactionDate = parseDate(cells[transactionDateIndex] || "");

    const amountMinor =
      amountMinorIndex >= 0
        ? parseAmountFromMinorField(String(cells[amountMinorIndex] || ""))
        : parseAmountFromMajorField(String(cells[amountIndex] || ""));

    if (!externalTxnId) {
      errors.push(`Row ${rowNumber}: externalTxnId is required.`);
      continue;
    }
    if (!transactionDate) {
      errors.push(`Row ${rowNumber}: invalid transactionDate.`);
      continue;
    }
    if (amountMinor === null) {
      errors.push(
        `Row ${rowNumber}: invalid amount${amountMinorIndex >= 0 ? "Minor" : ""}.`
      );
      continue;
    }

    entries.push({
      externalTxnId,
      amountMinor,
      transactionDate,
      reference: referenceIndex >= 0 ? String(cells[referenceIndex] || "").trim() || undefined : undefined,
      currency: currencyIndex >= 0 ? String(cells[currencyIndex] || "").trim() || undefined : undefined,
      payerName: payerNameIndex >= 0 ? String(cells[payerNameIndex] || "").trim() || undefined : undefined,
      payerPhone: payerPhoneIndex >= 0 ? String(cells[payerPhoneIndex] || "").trim() || undefined : undefined,
      payerEmail: payerEmailIndex >= 0 ? String(cells[payerEmailIndex] || "").trim() || undefined : undefined,
      bankAccountName:
        bankAccountNameIndex >= 0
          ? String(cells[bankAccountNameIndex] || "").trim() || undefined
          : undefined,
      channel: channelIndex >= 0 ? String(cells[channelIndex] || "").trim() || undefined : undefined,
      notes: notesIndex >= 0 ? String(cells[notesIndex] || "").trim() || undefined : undefined,
    });
  }

  if (entries.length > 500) {
    errors.push("Only the first 500 rows can be ingested at once.");
  }

  return {
    entries: entries.slice(0, 500),
    errors,
    delimiter: delimiter === "," ? "comma" : "tab",
    mappingConfidence,
    detectedHeaders: headersOriginal,
  };
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "reconciliation-ingestion-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadBankMappingGuide() {
  const rows = [
    [
      "canonicalField",
      "required",
      "acceptedHeaderAliases",
      "example",
      "notes",
    ].join(","),
    ...BANK_MAPPING_GUIDE_ROWS.map((row) =>
      [
        row.field,
        row.required,
        `"${row.aliases.join("|")}"`,
        `"${row.example.replace(/"/g, '""')}"`,
        `"${row.notes.replace(/"/g, '""')}"`,
      ].join(",")
    ),
  ];
  const csv = rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "reconciliation-bank-header-mapping-guide.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ReconciliationIngestionModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}) {
  const { open, onOpenChange, onImported } = props;
  const ingestMutation = useIngestReconciliationData();

  const [mode, setMode] = React.useState<IngestionMode>("upload");
  const [sourceType, setSourceType] =
    React.useState<ReconciliationSourceType>("bank");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [rawInput, setRawInput] = React.useState("");
  const [parsed, setParsed] = React.useState<ParsedResult | null>(null);
  const [isReadingFile, setIsReadingFile] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const resetState = React.useCallback(() => {
    setMode("upload");
    setSourceType("bank");
    setFileName(null);
    setRawInput("");
    setParsed(null);
    setIsReadingFile(false);
  }, []);

  React.useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  const mappingConfidence = parsed?.mappingConfidence ?? null;
  const hasRequiredMappings = Boolean(
    mappingConfidence &&
      mappingConfidence.totalRequired > 0 &&
      mappingConfidence.matchedRequired === mappingConfidence.totalRequired
  );
  const meetsConfidenceThreshold = Boolean(
    mappingConfidence &&
      mappingConfidence.score >= MIN_MAPPING_CONFIDENCE_SCORE
  );
  const confidenceGatePassed = hasRequiredMappings && meetsConfidenceThreshold;
  const canSubmit =
    Boolean(parsed?.entries.length) &&
    confidenceGatePassed &&
    !ingestMutation.isPending;

  function handleParse() {
    const parsedData = parseSpreadsheetText(rawInput);
    setParsed(parsedData);

    if (parsedData.entries.length === 0) {
      toast.error("No valid rows found.");
      return;
    }

    const confidenceLabel = `${parsedData.mappingConfidence.level.toUpperCase()} ${parsedData.mappingConfidence.score}%`;
    if (parsedData.errors.length > 0) {
      toast.warning(
        `Parsed ${parsedData.entries.length} row(s), ${parsedData.errors.length} issue(s). Mapping confidence: ${confidenceLabel}.`
      );
    } else {
      toast.success(
        `Parsed ${parsedData.entries.length} row(s). Mapping confidence: ${confidenceLabel}.`
      );
    }
  }

  async function handleFilePicked(file: File | null) {
    if (!file) return;
    setIsReadingFile(true);
    setFileName(file.name);

    try {
      const text = await file.text();
      setRawInput(text);
      setParsed(null);
      toast.success("File loaded. Click Parse & Preview to validate.");
    } catch {
      toast.error("Failed to read file.");
    } finally {
      setIsReadingFile(false);
    }
  }

  async function handleIngest() {
    if (!parsed?.entries.length) {
      toast.error("Parse your rows before ingesting.");
      return;
    }
    if (!hasRequiredMappings) {
      toast.error(
        "Ingestion locked: map all required headers (externalTxnId, amount/amountMinor, transactionDate)."
      );
      return;
    }
    if (!meetsConfidenceThreshold) {
      toast.error(
        `Ingestion locked: mapping confidence must be at least ${MIN_MAPPING_CONFIDENCE_SCORE}%.`
      );
      return;
    }

    try {
      const result = await ingestMutation.mutateAsync({
        sourceType,
        entries: parsed.entries,
      });
      toast.success(
        `Ingestion complete: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged.`
      );
      onImported?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to ingest reconciliation rows.");
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Bulk Ingest Reconciliation Rows"
      description="Upload CSV or paste spreadsheet rows, preview, then ingest."
      className="sm:max-w-4xl"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-emerald-200">
              Reconciliation Ingestion Template
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={downloadTemplate}
                className="h-7 border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-200 hover:bg-emerald-500/20"
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Download CSV Template
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={downloadBankMappingGuide}
                className="h-7 border-sky-500/30 bg-sky-500/10 text-xs text-sky-200 hover:bg-sky-500/20"
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Download Bank Mapping Guide
              </Button>
            </div>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-white/65">
            {COLUMN_HINTS.map((hint) => (
              <li key={hint}>• {hint}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/60">
            Bank Header Quick Map
          </p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-left text-white/55">
                  <th className="px-2.5 py-2 font-medium">Canonical Field</th>
                  <th className="px-2.5 py-2 font-medium">Required</th>
                  <th className="px-2.5 py-2 font-medium">Common Header Aliases</th>
                </tr>
              </thead>
              <tbody>
                {BANK_MAPPING_GUIDE_ROWS.map((row) => (
                  <tr
                    key={row.field}
                    className="border-b border-white/5 align-top last:border-b-0"
                  >
                    <td className="px-2.5 py-2 font-mono text-white/80">{row.field}</td>
                    <td className="px-2.5 py-2 text-white/70">{row.required}</td>
                    <td className="px-2.5 py-2 text-white/55">{row.aliases.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <Label className="text-xs text-white/65">Source Type</Label>
            <PremiumSelect
              value={sourceType}
              onValueChange={(value) =>
                setSourceType(value as ReconciliationSourceType)
              }
            >
              <PremiumSelectTrigger className="h-9">
                <PremiumSelectValue />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="bank">Bank statement</PremiumSelectItem>
                <PremiumSelectItem value="gateway">Gateway settlement</PremiumSelectItem>
                <PremiumSelectItem value="manual">Manual entry</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-white/65">Input Method</Label>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setMode("upload")}
                className={`h-8 flex-1 text-xs ${
                  mode === "upload" ? "bg-white/10 text-white" : "text-white/60"
                }`}
              >
                <Upload className="mr-1 h-3.5 w-3.5" />
                Upload CSV
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setMode("paste")}
                className={`h-8 flex-1 text-xs ${
                  mode === "paste" ? "bg-white/10 text-white" : "text-white/60"
                }`}
              >
                <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                Paste Rows
              </Button>
            </div>
          </div>
        </div>

        {mode === "upload" ? (
          <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,.txt,text/plain"
              className="hidden"
              onChange={(event) =>
                void handleFilePicked(event.target.files?.[0] || null)
              }
            />
            <div className="flex flex-col items-center gap-3 text-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                disabled={isReadingFile}
              >
                {isReadingFile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reading file…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Pick CSV/TXT File
                  </>
                )}
              </Button>
              <p className="text-xs text-white/55">
                {fileName
                  ? `Loaded file: ${fileName}`
                  : "Choose a file, then parse and preview before ingesting."}
              </p>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label className="text-xs text-white/65">
            Rows ({parsed?.delimiter === "tab" ? "tab-separated" : "comma-separated"})
          </Label>
          <Textarea
            rows={10}
            value={rawInput}
            onChange={(event) => {
              setRawInput(event.target.value);
              setParsed(null);
            }}
            placeholder="Paste CSV or tab-separated rows here..."
            className="border-white/10 bg-black/20 text-xs text-white placeholder:text-white/40"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleParse}
              disabled={rawInput.trim().length === 0 || isReadingFile}
              className="h-8 border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
            >
              Parse & Preview
            </Button>
            {parsed?.entries.length ? (
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              >
                {parsed.entries.length} valid row(s)
              </Badge>
            ) : null}
            {parsed?.errors.length ? (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-amber-300"
              >
                {parsed.errors.length} issue(s)
              </Badge>
            ) : null}
          </div>
        </div>

        {parsed ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-white/65">
                  Header Auto-Mapping Confidence
                </p>
                <Badge
                  variant="outline"
                  className={confidenceBadgeClass(parsed.mappingConfidence.level)}
                >
                  {parsed.mappingConfidence.level.toUpperCase()} •{" "}
                  {parsed.mappingConfidence.score}%
                </Badge>
              </div>
              <p className="mt-1 text-xs text-white/60">
                {parsed.mappingConfidence.summary}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
                <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-white/75">
                  Required: {parsed.mappingConfidence.matchedRequired}/
                  {parsed.mappingConfidence.totalRequired}
                </div>
                <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-white/75">
                  Optional: {parsed.mappingConfidence.matchedOptional}/
                  {parsed.mappingConfidence.totalOptional}
                </div>
                <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-white/75">
                  Headers detected: {parsed.detectedHeaders.length}
                </div>
                <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-white/75">
                  Delimiter: {parsed.delimiter}
                </div>
              </div>
              <div className="mt-2 max-h-36 overflow-y-auto rounded-md border border-white/10 bg-white/5">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-white/55">
                      <th className="px-2.5 py-1.5 font-medium">Field</th>
                      <th className="px-2.5 py-1.5 font-medium">Mapped Header</th>
                      <th className="px-2.5 py-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.mappingConfidence.details.map((detail) => (
                      <tr
                        key={detail.key}
                        className="border-b border-white/5 last:border-b-0"
                      >
                        <td className="px-2.5 py-1.5 text-white/70">
                          {detail.label}
                          {detail.required ? " *" : ""}
                        </td>
                        <td className="px-2.5 py-1.5 text-white/55">
                          {detail.matchedHeader || "—"}
                        </td>
                        <td className="px-2.5 py-1.5">
                          {detail.matched ? (
                            <span
                              className={
                                detail.exactCanonical
                                  ? "text-emerald-300"
                                  : "text-amber-300"
                              }
                            >
                              {detail.exactCanonical ? "Exact" : "Alias"}
                            </span>
                          ) : (
                            <span className="text-rose-300">Missing</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="mb-2 text-xs font-medium text-white/75">Preview (first 5)</p>
                {parsed.entries.length === 0 ? (
                  <p className="text-xs text-white/50">No valid rows parsed.</p>
                ) : (
                  <div className="space-y-2">
                    {parsed.entries.slice(0, 5).map((entry, index) => (
                      <div
                        key={`${entry.externalTxnId}-${index}`}
                        className="rounded-md border border-white/10 bg-white/5 p-2 text-xs text-white/75"
                      >
                        <p className="font-medium text-white">{entry.externalTxnId}</p>
                        <p className="mt-0.5 text-white/60">
                          {formatCurrency(entry.amountMinor)} •{" "}
                          {new Date(entry.transactionDate).toLocaleDateString("en-GH")}
                          {entry.reference ? ` • ${entry.reference}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="mb-2 text-xs font-medium text-white/75">Validation Notes</p>
                {parsed.errors.length === 0 ? (
                  <div className="flex items-start gap-2 text-xs text-emerald-300">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>No validation issues found.</span>
                  </div>
                ) : (
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {parsed.errors.map((error) => (
                      <div
                        key={error}
                        className="flex items-start gap-2 text-xs text-amber-300"
                      >
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
        {parsed && !confidenceGatePassed ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {hasRequiredMappings
              ? `Ingestion is locked until mapping confidence reaches at least ${MIN_MAPPING_CONFIDENCE_SCORE}%.`
              : "Ingestion is locked until all required headers are mapped."}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleIngest()}
            disabled={!canSubmit}
            className="bg-brand text-black hover:bg-brand/90"
          >
            {ingestMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ingesting…
              </>
            ) : (
              "Ingest Rows"
            )}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}

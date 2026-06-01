import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const root = process.cwd();
const outDir = path.join(root, "docs");
const pdfPath = path.join(outDir, "ENVIRONMENT_VARIABLES_USED_IN_APP.pdf");
const mdPath = path.join(outDir, "ENVIRONMENT_VARIABLES_USED_IN_APP.md");

const includeRoots = [
  "src",
  "scripts",
  "tests",
  "middleware.ts",
  "next.config.ts",
  "next.config.js",
  "instrumentation.ts",
  "instrumentation.js",
];
const skipDirs = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
]);
const allowedExts = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

function walk(entry, files = []) {
  if (!fs.existsSync(entry)) return files;
  const stat = fs.statSync(entry);
  if (stat.isDirectory()) {
    const base = path.basename(entry);
    if (skipDirs.has(base)) return files;
    for (const child of fs.readdirSync(entry)) {
      walk(path.join(entry, child), files);
    }
    return files;
  }
  if (stat.isFile() && allowedExts.has(path.extname(entry))) {
    files.push(entry);
  }
  return files;
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function classify(name) {
  if (name.startsWith("NEXT_PUBLIC_")) return "Client-exposed";
  if (/CLERK|AUTH|JWT|SVIX|WEBHOOK|SECRET|TOKEN|PASSWORD|KEY/.test(name)) {
    return "Secrets / Auth";
  }
  if (/MONGO|DATABASE|DB_/.test(name)) return "Database";
  if (/EMAIL|BREVO|SMTP|IMAP|SPACEMAIL|MAIL/.test(name)) return "Email";
  if (/PAYSTACK|PAYMENT|BILLING|SUBSCRIPTION/.test(name)) return "Payments / Billing";
  if (/OPENAI|GEMINI|LEO|AI_/.test(name)) return "AI";
  if (/LIVEKIT|MEETING/.test(name)) return "Meetings";
  if (/UPLOAD|CLOUDINARY|BLOB|STORAGE/.test(name)) return "Uploads / Storage";
  if (/DEMO/.test(name)) return "Demo";
  if (/CRON/.test(name)) return "Cron / Jobs";
  if (/FEATURE|FLAG|ENABLED|DISABLED/.test(name)) return "Feature Flags";
  if (/APP_URL|URL|DOMAIN|HOST|PORT|VERCEL|NODE_ENV/.test(name)) return "Runtime / URLs";
  return "Other";
}

function scopeForFile(relPath) {
  if (relPath.startsWith("tests/")) return "Tests";
  if (relPath.startsWith("scripts/")) return "Scripts";
  if (relPath.startsWith("src/app/api/")) return "API routes";
  if (relPath.startsWith("src/app/")) return "App routes";
  if (relPath.startsWith("src/lib/")) return "Server/shared libs";
  if (relPath.startsWith("src/components/")) return "Components";
  return "Runtime";
}

const files = uniqueSorted(
  includeRoots.flatMap((entry) => walk(path.join(root, entry)))
).filter((file) => !path.basename(file).startsWith(".env"));

const directDot = /process\.env\.([A-Z][A-Z0-9_]*)/g;
const bracket = /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g;
const destructuring = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*process\.env/gm;

const envs = new Map();

function addUse(name, relPath, lineNumber, lineText) {
  if (!envs.has(name)) {
    envs.set(name, {
      name,
      category: classify(name),
      scopes: new Set(),
      files: new Set(),
      uses: [],
    });
  }
  const record = envs.get(name);
  record.scopes.add(scopeForFile(relPath));
  record.files.add(relPath);
  if (record.uses.length < 12) {
    record.uses.push({
      file: relPath,
      line: lineNumber,
      text: lineText.trim().replace(/\s+/g, " ").slice(0, 220),
    });
  }
}

function lineNumberAt(source, index) {
  let count = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) count += 1;
  }
  return count;
}

for (const file of files) {
  const relPath = path.relative(root, file);
  const source = fs.readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);

  for (const regex of [directDot, bracket]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(source))) {
      const line = lineNumberAt(source, match.index);
      addUse(match[1], relPath, line, lines[line - 1] || "");
    }
  }

  destructuring.lastIndex = 0;
  let destructured;
  while ((destructured = destructuring.exec(source))) {
    const baseLine = lineNumberAt(source, destructured.index);
    const body = destructured[1];
    for (const part of body.split(",")) {
      const raw = part.trim();
      if (!raw) continue;
      const name = raw.split(":")[0].split("=")[0].trim();
      if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
        addUse(name, relPath, baseLine, destructured[0]);
      }
    }
  }
}

const records = Array.from(envs.values())
  .map((record) => ({
    ...record,
    scopes: uniqueSorted(record.scopes),
    files: uniqueSorted(record.files),
  }))
  .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

const byCategory = new Map();
for (const record of records) {
  if (!byCategory.has(record.category)) byCategory.set(record.category, []);
  byCategory.get(record.category).push(record);
}

const generatedAt = new Date().toISOString();
const markdown = [
  "# Environment Variables Used In App",
  "",
  `Generated: ${generatedAt}`,
  "",
  "Source: static scan of source/config/script files for `process.env.*`, `process.env[\"*\"]`, and `const { ... } = process.env`. `.env*` files are not scanned.",
  "",
  `Total variables: ${records.length}`,
  "",
  ...Array.from(byCategory.entries()).flatMap(([category, items]) => [
    `## ${category}`,
    "",
    "| Variable | Scopes | Files | Example locations |",
    "| --- | --- | ---: | --- |",
    ...items.map((item) => {
      const locations = item.uses
        .slice(0, 4)
        .map((use) => `\`${use.file}:${use.line}\``)
        .join("<br>");
      return `| \`${item.name}\` | ${item.scopes.join(", ")} | ${item.files.length} | ${locations} |`;
    }),
    "",
  ]),
  "## Detailed Locations",
  "",
  ...records.flatMap((item) => [
    `### ${item.name}`,
    "",
    `Category: ${item.category}`,
    "",
    `Scopes: ${item.scopes.join(", ")}`,
    "",
    ...item.uses.map((use) => `- \`${use.file}:${use.line}\` - ${use.text}`),
    item.uses.length < item.files.length
      ? `- Additional files using this variable: ${item.files.length - item.uses.length}`
      : "",
    "",
  ]),
].join("\n");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(mdPath, markdown);

function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const pdf = await PDFDocument.create();
pdf.setTitle("Environment Variables Used In App");
pdf.setAuthor("EduSentrix");
pdf.setSubject("Static inventory of environment variables referenced in source code");

const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const mono = await pdf.embedFont(StandardFonts.Courier);

const pageSize = [595.28, 841.89];
const margin = 42;
let page = pdf.addPage(pageSize);
let y = pageSize[1] - margin;

function addPage() {
  page = pdf.addPage(pageSize);
  y = pageSize[1] - margin;
}

function draw(text, opts = {}) {
  const size = opts.size || 9;
  const usedFont = opts.font || font;
  const color = opts.color || rgb(0.12, 0.16, 0.22);
  const lineHeight = opts.lineHeight || size + 4;
  const indent = opts.indent || 0;
  const maxWidth = pageSize[0] - margin * 2 - indent;
  const lines = wrapText(text, usedFont, size, maxWidth);
  for (const line of lines) {
    if (y < margin + lineHeight) addPage();
    page.drawText(line, {
      x: margin + indent,
      y,
      size,
      font: usedFont,
      color,
    });
    y -= lineHeight;
  }
}

function gap(amount = 8) {
  y -= amount;
  if (y < margin) addPage();
}

draw("Environment Variables Used In App", {
  font: bold,
  size: 22,
  lineHeight: 28,
  color: rgb(0.02, 0.2, 0.32),
});
draw(`Generated: ${generatedAt}`, { size: 9, color: rgb(0.38, 0.42, 0.48) });
gap(6);
draw(
  "This report is generated from source/config/script references only. It does not read .env, .env.local, or .env.example files.",
  { size: 10, lineHeight: 15 }
);
draw(`Total variables found: ${records.length}`, { font: bold, size: 11 });
gap(10);

for (const [category, items] of byCategory.entries()) {
  draw(category, { font: bold, size: 15, lineHeight: 21, color: rgb(0.02, 0.31, 0.38) });
  draw(`${items.length} variable${items.length === 1 ? "" : "s"}`, {
    size: 8,
    color: rgb(0.45, 0.48, 0.54),
  });
  gap(4);
  for (const item of items) {
    draw(item.name, { font: mono, size: 10.5, lineHeight: 15, color: rgb(0.03, 0.12, 0.2) });
    draw(`Scopes: ${item.scopes.join(", ")} | Files: ${item.files.length}`, {
      size: 8,
      color: rgb(0.35, 0.39, 0.45),
      indent: 12,
    });
    for (const use of item.uses.slice(0, 3)) {
      draw(`${use.file}:${use.line} - ${use.text}`, {
        font: mono,
        size: 7,
        lineHeight: 10,
        color: rgb(0.2, 0.24, 0.3),
        indent: 18,
      });
    }
    if (item.uses.length > 3) {
      draw(`+ ${item.uses.length - 3} more shown in Markdown companion`, {
        size: 7,
        color: rgb(0.42, 0.45, 0.5),
        indent: 18,
      });
    }
    gap(5);
  }
  gap(8);
}

const pages = pdf.getPages();
pages.forEach((pdfPage, index) => {
  pdfPage.drawText(`EduSentrix env inventory | ${index + 1}/${pages.length}`, {
    x: margin,
    y: 22,
    size: 7,
    font,
    color: rgb(0.5, 0.54, 0.6),
  });
});

fs.writeFileSync(pdfPath, await pdf.save());
console.log(JSON.stringify({ pdfPath, mdPath, total: records.length }, null, 2));

const XLSX = require("xlsx");

function normalizeHeader(t) {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const wb = XLSX.readFile("EXCEL_MAESTRO.xlsx", { cellDates: true });
let ws = null;
for (const name of wb.SheetNames) {
  const probe = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
  for (let i = 0; i < Math.min(probe.length, 15); i++) {
    if ((probe[i] ?? []).map(normalizeHeader).some((h) => h.includes("no avaluo"))) {
      ws = { name, rows: probe, hdr: i };
      break;
    }
  }
  if (ws) break;
}
const headers = ws.rows[ws.hdr].map(normalizeHeader);
const tipoIdx = headers.findIndex((h) => h === "tipo");
const noIdx = headers.findIndex((h) => h.includes("no avaluo"));
console.log("header 'tipo' en columna:", tipoIdx, "| 'no avaluo' en:", noIdx);
const values = {};
for (let r = ws.hdr + 1; r < ws.rows.length; r++) {
  const v = (ws.rows[r] ?? [])[tipoIdx];
  let raw = v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "");
  if (raw.trim() === "") raw = "(vacio)";
  values[raw] = (values[raw] || 0) + 1;
}
Object.entries(values).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(" ", k, "->", v));

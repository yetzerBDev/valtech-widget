// Modulo compartido de parseo Excel para sync-watch.cjs y sync-excel.js
// Incluye: normalizeHeader, NORM_MAP, toCleanDate, toCleanString, etc.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
const XLSX = require("xlsx");

function normalizeHeader(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NORM_MAP = {
  "fecha banco": "fecha_banco",
  "fecha que solicita el banco": "fecha_banco",
  "fec banco": "fecha_banco",
  "f banco": "fecha_banco",
  "fecha solicitud banco": "fecha_banco",
  recibe: "recibe",
  "fecha que recibe la solicitud digitador": "recibe",
  "fecha recibe solicitud": "recibe",
  "fec recibe": "recibe",
  "f recibe": "recibe",
  tipo: "tipo",
  "area de solicitud": "area_solicitud",
  "area solicitud": "area_solicitud",
  "estatus de peticion": "estatus",
  "estatus peticion": "estatus",
  estatus: "estatus",
  codigo: "codigo",
  "no avaluo": "no_avaluo",
  "no. avaluo": "no_avaluo",
  "num avaluo": "no_avaluo",
  correlativo: "no_avaluo",
  "perito de campo": "perito",
  perito: "perito",
  digitador: "digitador",
  "oficial de credito": "oficial_credito",
  solicitante: "solicitante",
  "identidad rtn": "identidad",
  "no telefono": "telefono",
  "no. telefono": "telefono",
  propietario: "propietario",
  direccion: "direccion",
  departamento: "departamento",
  depto: "departamento",
  "sucursal basa": "sucursal",
  sucursal: "sucursal",
  "sitio avaluo": "sitio_avaluo",
  categoria: "categoria",
  observaciones: "observaciones",
  obs: "observaciones",
  "tiempo de entrega dentro 12 24 48 horas": "tiempo_entrega",
  tiempo: "tiempo",
  "dias abierto": "dias_abierto",
  "encuesta a cliente de tiempo estimado de recibida solicitud": "encuesta",
  encuesta: "encuesta",
  "fecha envio solicitud a perito": "fecha_envio_perito",
  "fecha envio visita de campo": "fecha_envio_visita",
  "fecha envio a perito en campo": "fecha_envio_perito",
  "fecha que perito envia visita de campo": "fecha_envio_visita",
  "fecha envio perito": "fecha_envio_perito",
  "fecha envio visita": "fecha_envio_visita",
  "fecha perito": "fecha_envio_perito",
  "fecha visita": "fecha_envio_visita",
  "fec envio perito": "fecha_envio_perito",
  "fec envio visita": "fecha_envio_visita",
  "fec perito": "fecha_envio_perito",
  "fec visita": "fecha_envio_visita",
  "f envio perito": "fecha_envio_perito",
  "f envio visita": "fecha_envio_visita",
  "f perito": "fecha_envio_perito",
  "f visita": "fecha_envio_visita",
  "envio perito": "fecha_envio_perito",
  "envio visita": "fecha_envio_visita",
  "envia perito": "fecha_envio_perito",
  "envia visita": "fecha_envio_visita",
};

function excelSerialToDate(serial) {
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d) return null;
  return new Date(Date.UTC(d.y, d.m - 1, d.d));
}

// Defecto 1: usar getFullYear/getMonth/getDate en vez de toISOString
// para evitar el desfase de zona horaria (Honduras UTC-6).
function isoLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function toCleanString(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return null;
  if (typeof v === "number" && isFinite(v) && v < 100000) {
    const d = excelSerialToDate(v);
    if (d && d.getUTCFullYear() < 2000) return null;
  }
  const s = String(v).trim().toUpperCase().replace(/\s+/g, " ");
  return s === "" ? null : s;
}

function toCleanDate(v) {
  if (v === null || v === undefined) return null;

  // 1. Date nativo de JS (cellDates: true de XLSX ya lo convierte)
  if (v instanceof Date && !isNaN(v.getTime())) {
    const iso = isoLocal(v);
    const y = Number(iso.slice(0, 4));
    if (!Number.isNaN(y) && y >= 2000) return iso;
    return null;
  }

  // 2. Numero de serie de Excel (45500, 46200, etc.)
  if (typeof v === "number" && isFinite(v)) {
    const d = excelSerialToDate(v);
    if (d) {
      const iso = d.toISOString().slice(0, 10);
      const y = Number(iso.slice(0, 4));
      if (!Number.isNaN(y) && y >= 2000) return iso;
    }
    return null;
  }

  // 3. Texto: probar formatos comunes del Excel
  const raw = String(v).trim();
  if (!raw) return null;

  const asNum = Number(raw);
  if (!Number.isNaN(asNum) && isFinite(asNum) && asNum > 0 && asNum < 100000) {
    const d = excelSerialToDate(asNum);
    if (d) {
      const iso = d.toISOString().slice(0, 10);
      const y = Number(iso.slice(0, 4));
      if (!Number.isNaN(y) && y >= 2000) return iso;
    }
    return null;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (Number(y) >= 2000 && Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  const slashMatch = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    if (Number(yyyy) >= 2000 && Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
      return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }

  const shortYear = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (shortYear) {
    const [, dd, mm, yy] = shortYear;
    const yyyy = Number(yy) >= 50 ? `19${yy}` : `20${yy}`;
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
      return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }

  const MONTHS = {
    ENE: "01", JAN: "01", FEB: "02", MAR: "03", ABR: "04", APR: "04",
    MAY: "05", JUN: "06", JUL: "07", AGO: "08", AUG: "08", SEP: "09",
    OCT: "10", NOV: "11", DIC: "12", DEC: "12",
  };
  const monthMatch = raw.match(/^(\d{1,2})[\/\-. ]+([A-Za-z]{3,9})[\/\-. ]+(\d{4})$/);
  if (monthMatch) {
    const [, dd, mon, yyyy] = monthMatch;
    const mm = MONTHS[mon.toUpperCase().slice(0, 3)];
    if (mm && Number(yyyy) >= 2000 && Number(dd) >= 1 && Number(dd) <= 31) {
      return `${yyyy}-${mm}-${String(dd).padStart(2, "0")}`;
    }
  }

  // Defecto 1: usar isoLocal en vez de toISOString para el fallback
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const iso = isoLocal(parsed);
    const y = Number(iso.slice(0, 4));
    if (!Number.isNaN(y) && y >= 2000) return iso;
  }

  return null;
}

function toCleanNumber(v) {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return isFinite(n) ? n : null;
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const norm = (rows[i] ?? []).map(normalizeHeader);
    if (norm.some((h) => h.includes("no avaluo"))) return i;
  }
  return null;
}

function mapHeaders(headers) {
  const colMap = [];
  headers.forEach((h, idx) => {
    let key = NORM_MAP[h];
    if (!key) {
      const has = (w) => h.includes(w);
      const hasAny = (...ws) => ws.some(has);

      if (has("fecha") && hasAny("banco", "solicitud") && !has("perito") && !has("visita") && !has("recibe"))
        key = "fecha_banco";
      else if (has("fecha") && hasAny("recibe", "solicitud") && hasAny("digitador") && !has("perito") && !has("visita"))
        key = "recibe";
      else if (hasAny("fecha", "fec", "f") && has("envio") && has("perito"))
        key = "fecha_envio_perito";
      else if (hasAny("fecha", "fec", "f") && has("perito") && !has("visita") && !has("campo"))
        key = "fecha_envio_perito";
      else if (has("perito") && hasAny("envio", "envia", "enviar"))
        key = "fecha_envio_perito";
      else if (hasAny("fecha", "fec", "f") && has("envio") && has("visita"))
        key = "fecha_envio_visita";
      else if (hasAny("fecha", "fec", "f") && hasAny("visita", "campo") && !has("perito"))
        key = "fecha_envio_visita";
      else if (hasAny("visita", "campo") && hasAny("envio", "envia", "enviar"))
        key = "fecha_envio_visita";
      else if (hasAny("f", "fec") && has("perito")) key = "fecha_envio_perito";
      else if (hasAny("f", "fec") && hasAny("visita", "campo")) key = "fecha_envio_visita";
    }
    if (key) colMap[idx] = key;
  });
  return colMap;
}

function parseWorkbook(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const out = [];

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const headerIdx = findHeaderRow(rows);
    if (headerIdx === null) continue;
    const headers = (rows[headerIdx] ?? []).map(normalizeHeader);
    const colMap = mapHeaders(headers);
    const DATE_KEYS = new Set(["fecha_banco", "recibe", "fecha_envio_perito", "fecha_envio_visita"]);
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const empty = row.every((c) => c === null || c === undefined || String(c).trim() === "");
      if (empty) continue;
      const rec = {};
      for (let c = 0; c < colMap.length; c++) {
        const key = colMap[c];
        if (!key) continue;
        const v = row[c];
        if (DATE_KEYS.has(key)) rec[key] = toCleanDate(v);
        else if (key === "dias_abierto") rec[key] = toCleanNumber(v);
        else rec[key] = toCleanString(v);
      }
      if (!rec.no_avaluo) continue;
      if (!/[A-Z0-9]/.test(rec.no_avaluo)) continue;
      out.push(rec);
    }
  }
  if (out.length === 0) throw new Error("No se encontro ninguna hoja con la columna 'No. Avaluo'");
  return out;
}

// Defecto 6: resolver vinculos externos sin destruir el archivo del usuario.
// Copia el archivo a un temporal, abre la copia con COM, y retorna ambos paths.
function resolveExcelLinks(filePath) {
  if (process.platform !== "win32") return { resolvedPath: filePath, tempOriginal: null };

  const tempOriginal = path.join(os.tmpdir(), `valtech-copy-${Date.now()}.xlsx`);
  const tempResolved = path.join(os.tmpdir(), `valtech-resolved-${Date.now()}.xlsx`);

  try {
    fs.copyFileSync(filePath, tempOriginal);
  } catch {
    return { resolvedPath: filePath, tempOriginal: null };
  }

  const psScript = `
    $ErrorActionPreference = 'Stop'
    try {
      $xl = New-Object -ComObject Excel.Application
      $xl.Visible = $false
      $xl.DisplayAlerts = $false
      $xl.AskToUpdateLinks = $false
      $xl.AlertBeforeOverwriting = $false
      $wb = $xl.Workbooks.Open("${tempOriginal.replace(/\\/g, "\\\\")}", 0, $true)
      $wb.SaveAs("${tempResolved.replace(/\\/g, "\\\\")}", 51)
      $wb.Close($false)
      $xl.Quit()
      [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null
      [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
      [System.GC]::Collect()
      [System.GC]::WaitForPendingFinalizers()
      Write-Output "OK"
    } catch {
      Write-Output "FAIL:$($_.Exception.Message)"
    }
  `;
  try {
    const result = execSync(
      `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, " ")}"`,
      { timeout: 30000, windowsHide: true, encoding: "utf8" }
    ).trim();
    if (result === "OK" && fs.existsSync(tempResolved)) {
      return { resolvedPath: tempResolved, tempOriginal };
    }
  } catch {
    // Excel COM no disponible
  }
  try { fs.unlinkSync(tempOriginal); } catch {}
  return { resolvedPath: filePath, tempOriginal: null };
}

function cleanupTempFiles(resolvedPath, tempOriginal) {
  const tmpDir = os.tmpdir();
  const isTmp = (p) => p && p.startsWith(tmpDir);
  if (isTmp(resolvedPath) && resolvedPath !== tempOriginal) {
    try { fs.unlinkSync(resolvedPath); } catch {}
  }
  if (isTmp(tempOriginal)) {
    try { fs.unlinkSync(tempOriginal); } catch {}
  }
}

module.exports = {
  normalizeHeader,
  NORM_MAP,
  excelSerialToDate,
  isoLocal,
  toCleanString,
  toCleanDate,
  toCleanNumber,
  findHeaderRow,
  mapHeaders,
  parseWorkbook,
  resolveExcelLinks,
  cleanupTempFiles,
};

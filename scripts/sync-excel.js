// Agente de sincronizacion Excel -> Supabase
// Uso:
//   node scripts/sync-excel.js                       (sincroniza una vez)
//   node scripts/sync-excel.js --watch               (vigila el archivo y sincroniza al cambiar)
//   node scripts/sync-excel.js <ruta-del-xlsx> [--watch]
//
// Lee el Excel con columnas en la fila de encabezados y hace upsert por "no_avaluo".
// Usa las claves de .env.local (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)
// o las de .env.sync (SUPABASE_URL / SUPABASE_ANON_KEY o SERVICE_ROLE) si existen.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.resolve(__dirname, "..");
const WATCH_POLL_MS = 5000;

function resolveExcelLinks(filePath) {
  const tempPath = path.join(os.tmpdir(), `valtech-resolved-${Date.now()}.xlsx`);
  const psScript = `
    $ErrorActionPreference = 'Stop'
    try {
      $xl = New-Object -ComObject Excel.Application
      $xl.Visible = $false
      $xl.DisplayAlerts = $false
      $xl.AskToUpdateLinks = $false
      $xl.AlertBeforeOverwriting = $false
      $wb = $xl.Workbooks.Open("${filePath.replace(/\\/g, "\\\\")}", 0, $true)
      $wb.SaveAs("${tempPath.replace(/\\/g, "\\\\")}", 51)
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
    if (result === "OK" && fs.existsSync(tempPath)) {
      return tempPath;
    }
  } catch {
    // Excel COM no disponible, usar archivo original
  }
  return filePath;
}

function loadEnv() {
  const env = { ...process.env };
  for (const file of [".env.local", ".env.sync"]) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m || m[2] === "") continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      env[m[1]] = val;
    }
  }
  return env;
}

// Normaliza texto de encabezado: minusculas, sin acentos, espacios colapsados
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

function toCleanString(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toUpperCase().replace(/\s+/g, " ");
  return s === "" ? null : s;
}

function toCleanDate(v) {
  if (v === null || v === undefined) return null;

  // 1. Date nativo de JS (cellDates: true de XLSX ya lo convierte)
  if (v instanceof Date && !isNaN(v.getTime())) {
    const iso = v.toISOString().slice(0, 10);
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

  // Si el texto es un numero puro (serial de Excel guardado como texto)
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

  // Intentar formato ISO directo: 2026-08-18
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    if (Number(y) >= 2000 && Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // Intentar DD/MM/YYYY o DD-MM-YYYY o DD.MM.YYYY
  const slashMatch = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    if (Number(yyyy) >= 2000 && Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
      return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }

  // Intentar DD/MM/YY (2 digitos)
  const shortYear = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (shortYear) {
    const [, dd, mm, yy] = shortYear;
    const yyyy = Number(yy) >= 50 ? `19${yy}` : `20${yy}`;
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
      return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }

  // Intentar DD-Mes-YYYY (18-Ago-2026, 18/ago/2026, etc.)
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

  // Intentar con Date() como ultimo recurso (YYYY-MM-DD, etc.)
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const iso = parsed.toISOString().slice(0, 10);
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

function parseWorkbook(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const out = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const headerIdx = findHeaderRow(rows);
    if (headerIdx === null) continue;
    const headers = (rows[headerIdx] ?? []).map(normalizeHeader);
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
  if (out.length === 0) throw new Error("No se encontro ninguna hoja con la columna 'No. Avalúo'");
  return out;
}

async function syncOnce(filePath, client) {
  const resolvedPath = resolveExcelLinks(filePath);
  let records;
  try {
    records = parseWorkbook(resolvedPath);
  } finally {
    if (resolvedPath !== filePath) {
      try { fs.unlinkSync(resolvedPath); } catch {}
    }
  }
  console.log(`[${new Date().toISOString()}] ${records.length} avaluos leidos de ${filePath}`);

  const BATCH = 400;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await client.from("avaluos").upsert(batch, {
      onConflict: "no_avaluo",
    });
    if (error) throw new Error(`Upsert fallo (lote ${i / BATCH + 1}): ${error.message}`);
    inserted += batch.length;
  }
  console.log(`[${new Date().toISOString()}] Sincronizado: ${inserted} registros`);
  return inserted;
}

function watch(filePath, client) {
  let lastMtime = 0;
  let syncing = false;
  const poll = async () => {
    try {
      const st = fs.statSync(filePath);
      const mtime = st.mtimeMs;
      if (mtime !== lastMtime && !syncing) {
        lastMtime = mtime;
        syncing = true;
        try {
          await syncOnce(filePath, client);
        } catch (err) {
          console.error(`[${new Date().toISOString()}] ${err.message}`);
        } finally {
          syncing = false;
        }
      }
    } catch {
      lastMtime = 0; // archivo no existe o no accesible; reintenta luego
    }
  };
  console.log(`[${new Date().toISOString()}] Vigilando ${filePath} cada ${WATCH_POLL_MS / 1000}s...`);
  poll();
  setInterval(poll, WATCH_POLL_MS);
}

async function main() {
  const args = process.argv.slice(2);
  const isWatch = args.includes("--watch");
  const isDryRun = args.includes("--dry-run");
  const positional = args.filter((a) => a !== "--watch" && a !== "--dry-run");
  const env = loadEnv();

  const filePath = positional[0] || env.EXCEL_PATH || path.join(ROOT, "EXCEL_MAESTRO.xlsx");
  if (!fs.existsSync(filePath)) {
    console.error(`No se encontro el Excel: ${filePath}`);
    process.exit(1);
  }

  if (isDryRun) {
    try {
      const records = parseWorkbook(filePath);
      console.log(`DRY-RUN: ${records.length} avaluos leidos de ${filePath}`);
      for (const sample of records.slice(0, 3)) {
        console.log(JSON.stringify(sample));
      }
      const nulls = records.filter((r) => !r.no_avaluo).length;
      console.log(`Sin 'no_avaluo': ${nulls}`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ${err.message}`);
      process.exit(1);
    }
    return;
  }

  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || env.SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Faltan SUPABASE_URL o una clave. Revisa .env.local o .env.sync");
    process.exit(1);
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (isWatch) {
    watch(filePath, client);
  } else {
    try {
      await syncOnce(filePath, client);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ${err.message}`);
      process.exit(1);
    }
  }
}

main();

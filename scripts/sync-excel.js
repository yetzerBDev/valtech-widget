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
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.resolve(__dirname, "..");
const WATCH_POLL_MS = 5000;

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
  recibe: "recibe",
  tipo: "tipo",
  "area de solicitud": "area_solicitud",
  "estatus de peticion": "estatus",
  codigo: "codigo",
  "no avaluo": "no_avaluo",
  "perito de campo": "perito",
  digitador: "digitador",
  "oficial de credito": "oficial_credito",
  solicitante: "solicitante",
  "identidad rtn": "identidad",
  "no telefono": "telefono",
  propietario: "propietario",
  direccion: "direccion",
  departamento: "departamento",
  "sucursal basa": "sucursal",
  "sitio avaluo": "sitio_avaluo",
  categoria: "categoria",
  observaciones: "observaciones",
  "tiempo de entrega dentro 12 24 48 horas": "tiempo_entrega",
  tiempo: "tiempo",
  "dias abierto": "dias_abierto",
  "encuesta a cliente de tiempo estimado de recibida solicitud": "encuesta",
  "fecha envio solicitud a perito": "fecha_envio_perito",
  "fecha envio visita de campo": "fecha_envio_visita",
};

function excelSerialToDate(serial) {
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d) return null;
  return new Date(Date.UTC(d.y, d.m - 1, d.d));
}

function toCleanString(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function toCleanDate(v) {
  if (v === null || v === undefined) return null;
  let iso = null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    iso = v.toISOString().slice(0, 10);
  } else if (typeof v === "number" && isFinite(v)) {
    const d = excelSerialToDate(v);
    iso = d ? d.toISOString().slice(0, 10) : null;
  } else {
    const s = toCleanString(v);
    if (s) {
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) iso = parsed.toISOString().slice(0, 10);
    }
  }
  // Excel guarda celdas de fecha vacias como serial 0 -> 30/12/1899.
  // Fechas antes del 2000 no son reales: se tratan como vacio.
  if (iso) {
    const y = Number(iso.slice(0, 4));
    if (Number.isNaN(y) || y < 2000) iso = null;
  }
  return iso;
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
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("El libro no tiene hojas");
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headerIdx = findHeaderRow(rows);
  if (headerIdx === null) {
    throw new Error("No se encontro la fila de encabezados (buscando 'No. Avalúo')");
  }
  const headers = (rows[headerIdx] ?? []).map(normalizeHeader);
  const colMap = [];
  headers.forEach((h, idx) => {
    let key = NORM_MAP[h];
    if (!key && h.includes("fecha envio") && h.includes("perito")) key = "fecha_envio_perito";
    if (!key && h.includes("fecha envio") && h.includes("visita")) key = "fecha_envio_visita";
    if (key) colMap[idx] = key;
  });
  if (!colMap.includes("no_avaluo")) {
    throw new Error("No se encontro la columna 'No. Avalúo'");
  }

  const out = [];
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
    out.push(rec);
  }
  return out;
}

async function syncOnce(filePath, client) {
  const records = parseWorkbook(filePath);
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

// Sincronizacion Excel -> Supabase integrada al widget.
// Se activa solo si existe el Excel en la ruta configurada (la PC donde vive el maestro).
// Vigila cambios (mtime) cada 5s y hace upsert por "no_avaluo".

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

const POLL_MS = 5000;

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
  recibe: "recibe",
  "fecha que recibe la solicitud digitador": "recibe",
  tipo: "tipo",
  "area de solicitud": "area_solicitud",
  "estatus de peticion": "estatus",
  "estatus peticion": "estatus",
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
  "fecha que perito envia visita de campo": "fecha_envio_visita",
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
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headerIdx = findHeaderRow(rows);
  if (headerIdx === null) return [];
  const headers = (rows[headerIdx] ?? []).map(normalizeHeader);
  const colMap = [];
  headers.forEach((h, idx) => {
    let key = NORM_MAP[h];
    if (!key && h.includes("fecha envio") && h.includes("perito")) key = "fecha_envio_perito";
    if (!key && h.includes("fecha envio") && h.includes("visita")) key = "fecha_envio_visita";
    if (key) colMap[idx] = key;
  });
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

async function syncOnce(client, filePath) {
  const records = parseWorkbook(filePath);
  const uniq = new Map();
  for (const r of records) {
    if (r.no_avaluo) uniq.set(r.no_avaluo, r);
  }
  const unique = [...uniq.values()];
  const BATCH = 400;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const { error } = await client.from("avaluos").upsert(batch, {
      onConflict: "no_avaluo",
    });
    if (error) throw new Error(error.message);
  }

  const keep = new Set(unique.map((r) => r.no_avaluo).filter(Boolean));
  const { data: existing, error: readErr } = await client
    .from("avaluos")
    .select("no_avaluo");
  if (readErr) throw new Error(readErr.message);
  const toDelete = (existing ?? [])
    .map((r) => r.no_avaluo)
    .filter((id) => id != null && !keep.has(id));
  const DEL_BATCH = 90;
  for (let i = 0; i < toDelete.length; i += DEL_BATCH) {
    const chunk = toDelete.slice(i, i + DEL_BATCH);
    const { error } = await client.from("avaluos").delete().in("no_avaluo", chunk);
    if (error) throw new Error(error.message);
  }

  return { inserted: unique.length, deleted: toDelete.length };
}

function startSync({ supabaseUrl, anonKey, excelPath, onLog }) {
  const log = (msg) => onLog?.(msg);
  if (!excelPath) {
    log("[sync] sin ruta de Excel configurada");
    return () => {};
  }
  if (!fs.existsSync(excelPath)) {
    log(`[sync] Excel no encontrado, pendiente: ${excelPath}`);
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let lastMtime = 0;
  let syncing = false;
  let lastOk = false;

  const poll = async () => {
    if (!fs.existsSync(excelPath)) {
      if (lastOk) {
        log(`[sync] Excel no encontrado: ${excelPath}`);
        lastOk = false;
      }
      return;
    }
    let mtime;
    try {
      mtime = fs.statSync(excelPath).mtimeMs;
    } catch {
      return;
    }
    if (mtime === lastMtime || syncing) return;
    lastMtime = mtime;
    syncing = true;
    try {
      const { inserted, deleted } = await syncOnce(client, excelPath);
      log(
        `[sync] ${new Date().toISOString()} sincronizado: ${inserted} avaluos, ${deleted} eliminados`
      );
      lastOk = true;
    } catch (err) {
      log(`[sync] error: ${err.message}`);
    } finally {
      syncing = false;
    }
  };

  poll();
  const id = setInterval(poll, POLL_MS);
  log(`[sync] vigilando ${excelPath} cada ${POLL_MS / 1000}s`);
  return () => clearInterval(id);
}

module.exports = { startSync };

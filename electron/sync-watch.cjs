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
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const headerIdx = findHeaderRow(rows);
    if (headerIdx === null) continue;
    const headers = (rows[headerIdx] ?? []).map(normalizeHeader);
    const colMap = [];
    headers.forEach((h, idx) => {
      let key = NORM_MAP[h];
      // Fallback: matching por keywords para encabezados no mapeados
      if (!key) {
        const has = (w) => h.includes(w);
        const hasAll = (...ws) => ws.every(has);
        const hasAny = (...ws) => ws.some(has);

        // Banco: fecha + banco/solicitud
        if (has("fecha") && hasAny("banco", "solicitud") && !has("perito") && !has("visita") && !has("recibe"))
          key = "fecha_banco";
        // Recibe: fecha + recibe/solicitud + digitador
        else if (has("fecha") && hasAny("recibe", "solicitud") && hasAny("digitador") && !has("perito") && !has("visita"))
          key = "recibe";
        // Envio a perito: combinations
        else if (hasAny("fecha", "fec", "f") && has("envio") && has("perito"))
          key = "fecha_envio_perito";
        else if (hasAny("fecha", "fec", "f") && has("perito") && !has("visita") && !has("campo"))
          key = "fecha_envio_perito";
        else if (has("perito") && hasAny("envio", "envia", "enviar"))
          key = "fecha_envio_perito";
        // Envio visita de campo: combinations
        else if (hasAny("fecha", "fec", "f") && has("envio") && has("visita"))
          key = "fecha_envio_visita";
        else if (hasAny("fecha", "fec", "f") && hasAny("visita", "campo") && !has("perito"))
          key = "fecha_envio_visita";
        else if (hasAny("visita", "campo") && hasAny("envio", "envia", "enviar"))
          key = "fecha_envio_visita";
        // Abrv. cortas: "f perito", "f visita", "fec perito", "fec visita"
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
      // Descartar correlativos que no tengan al menos una letra o un digito
      // (elimina celdas con solo simbolos, espacios residuales, etc.)
      if (!/[A-Z0-9]/.test(rec.no_avaluo)) continue;
      out.push(rec);
    }
  }
  if (out.length === 0) throw new Error("No se encontro ninguna hoja con la columna 'No. Avalúo'");
  return out;
}

async function syncOnce(client, filePath) {
  const records = parseWorkbook(filePath);
  const uniq = new Map();
  for (const r of records) {
    if (r.no_avaluo) uniq.set(r.no_avaluo, r);
  }
  const unique = [...uniq.values()];
  // Salvaguarda: si el Excel no trae registros validos, abortar en vez de
  // borrar la base entera (evita perdida de datos ante un archivo corrupto
  // o con estructura inesperada).
  if (unique.length === 0) {
    throw new Error("El Excel no trae registros validos (No. Avalúo); sincronizacion cancelada");
  }
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

function startSync({ supabaseUrl, anonKey, serviceRoleKey, excelPath, onLog }) {
  const log = (msg) => onLog?.(msg);
  if (!excelPath) {
    log("[sync] sin ruta de Excel configurada");
    return () => {};
  }
  if (!fs.existsSync(excelPath)) {
    log(`[sync] Excel no encontrado, pendiente: ${excelPath}`);
  }

  // Con RLS activa, el sync usa service_role para poder escribir/borrar;
  // sin esa clave cae al anon (funciona mientras RLS este desactivado).
  const writeClient = createClient(supabaseUrl, serviceRoleKey || anonKey, {
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
    syncing = true;
    try {
      const { inserted, deleted } = await syncOnce(writeClient, excelPath);
      lastMtime = mtime;
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

module.exports = { startSync, parseWorkbook };

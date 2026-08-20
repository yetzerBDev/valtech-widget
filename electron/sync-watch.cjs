// Sincronizacion Excel -> Supabase integrada al widget.
// Se activa solo si existe el Excel en la ruta configurada (la PC donde vive el maestro).
// Vigila cambios (mtime) cada 5s y hace upsert por "no_avaluo".

const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const { parseWorkbook, resolveExcelLinks, cleanupTempFiles } = require("../lib/excel-parser.cjs");

const POLL_MS = 5000;

async function syncOnce(client, filePath) {
  const { resolvedPath, tempOriginal } = resolveExcelLinks(filePath);
  let records;
  try {
    records = parseWorkbook(resolvedPath);
  } finally {
    cleanupTempFiles(resolvedPath, tempOriginal);
  }
  const uniq = new Map();
  for (const r of records) {
    if (r.no_avaluo) uniq.set(r.no_avaluo, r);
  }
  const unique = [...uniq.values()];
  if (unique.length === 0) {
    throw new Error("El Excel no trae registros validos (No. Avaluo); sincronizacion cancelada");
  }
  const BATCH = 400;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const { error } = await client.from("avaluos").upsert(batch, {
      onConflict: "no_avaluo",
    });
    if (error) throw new Error(error.message);
  }

  // Defecto 5: paginar select para comparar contra TODA la tabla, no solo primeras 1000
  const keep = new Set(unique.map((r) => r.no_avaluo).filter(Boolean));
  const existing = [];
  let offset = 0;
  while (true) {
    const { data, error: readErr } = await client
      .from("avaluos")
      .select("no_avaluo")
      .range(offset, offset + 999);
    if (readErr) throw new Error(readErr.message);
    if (!data || data.length === 0) break;
    existing.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  const toDelete = existing
    .map((r) => r.no_avaluo)
    .filter((id) => id != null && !keep.has(id));

  // Defecto 5: salvaguarda de proporcion (no borrar mas del 20%)
  if (toDelete.length > unique.length * 0.2) {
    throw new Error(
      `[sync] borrado abortado: se intentaba eliminar ${toDelete.length} de ${unique.length} registros`
    );
  }

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

  // Defecto 5: sync requiere serviceRoleKey (solo PC del encargado)
  if (!serviceRoleKey) {
    log("[sync] sin service_role, sync deshabilitado en este equipo");
    return () => {};
  }

  if (!excelPath) {
    log("[sync] sin ruta de Excel configurada");
    return () => {};
  }
  if (!fs.existsSync(excelPath)) {
    log(`[sync] Excel no encontrado, pendiente: ${excelPath}`);
  }

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

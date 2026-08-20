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
const { createClient } = require("@supabase/supabase-js");
const { parseWorkbook, resolveExcelLinks, cleanupTempFiles } = require("../lib/excel-parser.cjs");

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

async function syncOnce(filePath, client) {
  const { resolvedPath, tempOriginal } = resolveExcelLinks(filePath);
  let records;
  try {
    records = parseWorkbook(resolvedPath);
  } finally {
    cleanupTempFiles(resolvedPath, tempOriginal);
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
      lastMtime = 0;
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
    // Defecto 6: dry-run tambien pasa por resolveExcelLinks
    const { resolvedPath, tempOriginal } = resolveExcelLinks(filePath);
    try {
      const records = parseWorkbook(resolvedPath);
      console.log(`DRY-RUN: ${records.length} avaluos leidos de ${filePath}`);
      for (const sample of records.slice(0, 3)) {
        console.log(JSON.stringify(sample));
      }
      const nulls = records.filter((r) => !r.no_avaluo).length;
      console.log(`Sin 'no_avaluo': ${nulls}`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ${err.message}`);
      process.exit(1);
    } finally {
      cleanupTempFiles(resolvedPath, tempOriginal);
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

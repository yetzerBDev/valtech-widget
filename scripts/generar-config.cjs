// Genera electron/supabase-config.cjs a partir de .env.local (claves publicas del cliente).
// Uso: node scripts/generar-config.cjs

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function loadEnv(file) {
  const env = {};
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || m[2] === "") continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[m[1]] = val;
  }
  return env;
}

const env = loadEnv(".env.local");
const envSync = loadEnv(".env.sync");
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || envSync.SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || envSync.SUPABASE_ANON_KEY;
const serviceRoleKey = envSync.SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  process.exit(1);
}

const out = path.join(ROOT, "electron", "supabase-config.cjs");
fs.writeFileSync(
  out,
  `module.exports = ${JSON.stringify(
    {
      supabaseUrl: url,
      anonKey: key,
      serviceRoleKey: serviceRoleKey || null,
    },
    null,
    2
  )};\n`
);
console.log(`Config escrita en ${out}`);

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://uigqjlqgwexywadkvzoa.supabase.co";
const serviceRoleKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZ3FqbHFnd2V4eXdhZGt2em9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQ0MTc4OSwiZXhwIjoyMTAyMDE3Nzg5fQ.n3KX4m3dGnUQLU5Y_zHUHnguJC4LdfsjFnFndylcvZA";

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

(async () => {
  const all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client
      .from("avaluos")
      .select("*")
      .range(offset, offset + 999);
    if (error) {
      console.error("ERROR:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log("Registros encontrados:", all.length);
  if (all.length === 0) {
    console.log("No hay datos en la tabla avaluos");
    process.exit(0);
  }
  console.log("Columnas:", Object.keys(all[0]).join(", "));

  const outPath = "C:\\Users\\user\\Desktop\\RECOVERY_AVALUOS.json";
  require("fs").writeFileSync(outPath, JSON.stringify(all, null, 2));
  console.log("Guardado en:", outPath);
})();

const { createClient } = require("@supabase/supabase-js");
const c = createClient(
  "https://uigqjlqgwexywadkvzoa.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZ3FqbHFnd2V4eXdhZGt2em9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQ0MTc4OSwiZXhwIjoyMTAyMDE3Nzg5fQ.n3KX4m3dGnUQLU5Y_zHUHnguJC4LdfsjFnFndylcvZA",
  { auth: { persistSession: false } }
);

(async () => {
  const { data, error } = await c.from("avaluos").select("tipo,estatus,fecha_banco,fecha_envio_visita,perito,digitador");
  if (error) {
    console.log("ERR", error.message);
    return;
  }
  const noAvaluo = data.filter((r) => {
    const t = (r.tipo ?? "").trim().toLowerCase();
    return t !== "avalúo" && t !== "avaluo" && !/^\w{3} \w{3}/.test(String(r.tipo ?? ""));
  });
  const byTipo = {};
  for (const r of noAvaluo) {
    const t = (r.tipo ?? "(vacio)").trim();
    byTipo[t] = byTipo[t] || {};
    const e = (r.estatus ?? "(vacio)").trim();
    byTipo[t][e] = (byTipo[t][e] || 0) + 1;
  }
  Object.entries(byTipo).forEach(([t, ests]) => {
    console.log("== TIPO:", t);
    Object.entries(ests)
      .sort((a, b) => b[1] - a[1])
      .forEach(([e, cnt]) => console.log("    ", e, "->", cnt));
  });
  console.log("\nEjemplos de los abiertos no-avalúo:");
  const abiertos = noAvaluo.filter(
    (r) => !r.fecha_envio_visita && ["refrendación", "avance de obra", "informes", "topografía"].includes((r.tipo ?? "").trim().toLowerCase())
  );
  abiertos.slice(0, 8).forEach((r) =>
    console.log("  ", r.no_avaluo, "|", r.tipo, "|", r.estatus, "| fecha_banco:", r.fecha_banco, "| perito:", r.perito, "| digitador:", r.digitador)
  );
})();

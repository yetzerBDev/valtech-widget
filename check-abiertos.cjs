const { createClient } = require("@supabase/supabase-js");
const c = createClient(
  "https://uigqjlqgwexywadkvzoa.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZ3FqbHFnd2V4eXdhZGt2em9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQ0MTc4OSwiZXhwIjoyMTAyMDE3Nzg5fQ.n3KX4m3dGnUQLU5Y_zHUHnguJC4LdfsjFnFndylcvZA",
  { auth: { persistSession: false } }
);

const oculto = (s) => {
  const e = (s ?? "").trim().toLowerCase();
  if (!e) return true;
  return (
    e.includes("stand") ||
    e === "cerrado" ||
    e === "cerrada" ||
    e.includes("cotiz") ||
    e.includes("doctos") ||
    e === "devuelto" ||
    e === "devuelta" ||
    e === "0"
  );
};

(async () => {
  const { data, error } = await c.from("avaluos").select("no_avaluo,tipo,estatus,fecha_banco,fecha_envio_visita,perito,digitador");
  if (error) {
    console.log("ERR", error.message);
    return;
  }
  console.log("TOTAL en DB:", data.length);
  const porTipo = {};
  for (const r of data) {
    const tipo = (r.tipo ?? "(vacio)").trim().toLowerCase();
    const esFecha = /^\w{3} \w{3} \d{2} \d{4}/.test(String(r.tipo ?? ""));
    const tipoKey = esFecha ? "(fecha-serial)" : (r.tipo ?? "(vacio)").trim() || "(vacio)";
    porTipo[tipoKey] = porTipo[tipoKey] || { total: 0, abierto: 0, abiertoOculto: 0, conVisita: 0, oculto: 0 };
    const item = porTipo[tipoKey];
    item.total++;
    const es2026 = !r.fecha_banco || Number(String(r.fecha_banco).slice(0, 4)) >= 2026;
    const ocultoStatus = oculto(r.estatus);
    if (ocultoStatus) {
      item.oculto++;
    } else if (!es2026) {
      item.oculto++;
    } else if (!r.fecha_envio_visita || String(r.fecha_envio_visita).trim() === "") {
      item.abierto++;
    } else {
      item.conVisita++;
    }
  }
  Object.entries(porTipo)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([t, v]) => {
      console.log(
        t.padEnd(22),
        "| total:", String(v.total).padStart(4),
        "| abiertos(visibles):", String(v.abierto).padStart(3),
        "| conVisita:", String(v.conVisita).padStart(3),
        "| ocultos(estado/fecha):", String(v.oculto).padStart(3)
      );
    });
})();

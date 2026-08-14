const { createClient } = require("@supabase/supabase-js");
const c = createClient(
  "https://uigqjlqgwexywadkvzoa.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZ3FqbHFnd2V4eXdhZGt2em9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQ0MTc4OSwiZXhwIjoyMTAyMDE3Nzg5fQ.n3KX4m3dGnUQLU5Y_zHUHnguJC4LdfsjFnFndylcvZA",
  { auth: { persistSession: false } }
);

(async () => {
  const { data, error } = await c.from("avaluos").select("no_avaluo,tipo,estatus").limit(1000);
  if (error) {
    console.log("ERR", error.message);
    return;
  }
  const sinNo = data.filter((r) => r.no_avaluo === null || r.no_avaluo === undefined || r.no_avaluo === "");
  console.log("total:", data.length, "| sin no_avaluo:", sinNo.length);
  const noAvaluo = data.filter((r) => {
    const t = (r.tipo ?? "").trim().toLowerCase();
    return t !== "avalúo" && t !== "avaluo" && !/^\w{3} \w{3} \d{2} \d{4}/.test(String(r.tipo ?? ""));
  });
  console.log("no-avalúo:", noAvaluo.length);
  noAvaluo.slice(0, 12).forEach((r) =>
    console.log("  no_avaluo=" + JSON.stringify(r.no_avaluo), "| tipo:", r.tipo, "| estatus:", r.estatus)
  );
})();

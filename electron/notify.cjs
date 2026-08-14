// Notificaciones nativas de Windows basadas en la base de Supabase.
// El proceso main hace poll a la tabla "avaluos" y avisa:
//   1) Nueva solicitud asignada al usuario actual (o todas, si es encargado).
//   2) Visita programada para hoy o ya vencida en un registro aun activo.
// El estado (que ya se notifico) vive en notify-state.json dentro de userData
// para no repetir notificaciones al reiniciar el widget.

const { Notification } = require("electron");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const POLL_MS = 60 * 1000;
const AGRUPAR_NUEVAS_DESDE = 4;

function normalizeNombre(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hoyISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function loadState(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return { nuevas: [], visitas: {} };
  }
}

function saveState(filePath, state) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(state));
  } catch {
    /* no critico */
  }
}

function mostrar(title, body) {
  try {
    if (!Notification.isSupported()) return;
    new Notification({ title, body, silent: false, timeoutType: "default" }).show();
  } catch {
    /* fallo de notificacion no critico */
  }
}

function startNotifier({ supabaseConfig, userDataPath, onLog }) {
  const supabaseUrl = supabaseConfig?.supabaseUrl;
  const serviceRoleKey = supabaseConfig?.serviceRoleKey;
  if (!supabaseUrl || !serviceRoleKey) {
    onLog?.("[notify] faltan las claves de Supabase");
    return { setUser: () => {}, stop: () => {} };
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const statePath = path.join(userDataPath, "notify-state.json");
  let currentUser = null;
  let timer = null;
  let checking = false;
  let primerCheck = !fs.existsSync(statePath);

  const normEstatus = (s) => (s ?? "").trim().toLowerCase();
  const esOculto = (s) => {
    const e = normEstatus(s);
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
  const es2026OMas = (a) => {
    const f = a.fecha_banco;
    if (!f) return true;
    const y = Number(String(f).slice(0, 4));
    return !Number.isNaN(y) && y >= 2026;
  };
  const esSuyo = (a) => {
    if (!currentUser) return false;
    const cargo = (currentUser.cargo ?? "").trim().toLowerCase();
    if (cargo === "encargado") return true;
    const nombreNorm = normalizeNombre(currentUser.nombre ?? "");
    if (!nombreNorm) return false;
    const col =
      cargo === "perito" ? a.perito : cargo === "digitador" ? a.digitador : a.perito || a.digitador;
    return normalizeNombre(col) === nombreNorm;
  };
  const tieneVisita = (a) => {
    const v = a.fecha_envio_visita;
    return v != null && String(v).trim() !== "";
  };

  const check = async () => {
    if (!currentUser || checking) return;
    checking = true;
    try {
      const { data, error } = await client
        .from("avaluos")
        .select(
          "no_avaluo, tipo, estatus, fecha_banco, fecha_envio_visita, perito, digitador"
        )
        .limit(1000);
      if (error) {
        onLog?.(`[notify] error: ${error.message}`);
        return;
      }
      const records = data ?? [];
      const visibles = records.filter(
        (a) => esSuyo(a) && !esOculto(a.estatus) && es2026OMas(a)
      );
      const state = loadState(statePath);
      const nuevasVistas = new Set(state.nuevas ?? []);

      // Primer arranque: marcar todo lo existente como visto sin notificar,
      // para no disparar decenas de avisos al instalar o al iniciar sesion.
      if (primerCheck) {
        visibles.forEach((a) => {
          if (!tieneVisita(a)) nuevasVistas.add(a.no_avaluo);
        });
        const hoy = hoyISO();
        const visitas = state.visitas ?? {};
        visibles.forEach((a) => {
          if (tieneVisita(a)) visitas[a.no_avaluo] = hoy;
        });
        state.visitas = visitas;
        state.nuevas = [...nuevasVistas];
        saveState(statePath, state);
        primerCheck = false;
        return;
      }

      // 1) Nueva solicitud asignada al usuario.
      const nuevas = visibles.filter(
        (a) => !tieneVisita(a) && !nuevasVistas.has(a.no_avaluo)
      );
      if (nuevas.length > 0) {
        const titulo =
          nuevas.length === 1 ? "Nueva solicitud" : `Nuevas solicitudes (${nuevas.length})`;
        const cuerpo =
          nuevas.length <= 3
            ? nuevas.map((a) => `${a.no_avaluo}${a.tipo ? ` · ${a.tipo}` : ""}`).join("\n")
            : "Revisa tu lista de solicitudes abiertas";
        mostrar(titulo, cuerpo);
        nuevas.forEach((a) => nuevasVistas.add(a.no_avaluo));
        state.nuevas = [...nuevasVistas];
      }

      // 2) Visita hoy o vencida en registros activos (una vez por dia).
      const hoy = hoyISO();
      const visitas = state.visitas ?? {};
      const porVisita = visibles.filter(
        (a) => tieneVisita(a) && a.fecha_envio_visita <= hoy
      );
      let huboVisitas = false;
      porVisita.forEach((a) => {
        if (visitas[a.no_avaluo] === hoy) return;
        const esHoy = a.fecha_envio_visita === hoy;
        mostrar(
          esHoy ? "Visita hoy" : "Visita vencida",
          `${a.no_avaluo}${a.tipo ? ` · ${a.tipo}` : ""}${
            esHoy ? "" : ` (programada ${a.fecha_envio_visita})`
          }`
        );
        visitas[a.no_avaluo] = hoy;
        huboVisitas = true;
      });
      if (huboVisitas) state.visitas = visitas;

      saveState(statePath, state);
    } catch (err) {
      onLog?.(`[notify] error: ${err?.message ?? err}`);
    } finally {
      checking = false;
    }
  };

  const setUser = (user) => {
    const cargo = (user?.cargo ?? "").trim().toLowerCase();
    currentUser = cargo ? { cargo, nombre: user?.nombre ?? "" } : null;
    if (currentUser) check();
  };

  timer = setInterval(check, POLL_MS);
  check();

  return {
    setUser,
    stop: () => {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

module.exports = { startNotifier };

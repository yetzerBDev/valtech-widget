"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Loading02Icon,
  Logout01Icon,
  UserCircleIcon,
  MapPinIcon,
  MapPinCheckIcon,
  CloudOffIcon,
  CloudCheckIcon,
  Download01Icon,
  Settings01Icon,
  FolderSearchIcon,
} from "@hugeicons/core-free-icons";
import { supabase } from "../../lib/supabase/client";
import DownloadExe from "./DownloadExe";

const CARD_SHADOW =
  "shadow-[0_1px_2px_rgba(24,24,27,0.05),0_12px_32px_-12px_rgba(24,24,27,0.18)]";

const HOUR_MS = 3_600_000;
const WIDGET_OAUTH_REDIRECT = "https://valtech-beta.vercel.app/";

type Avaluo = {
  no_avaluo: string;
  fecha_banco: string | null;
  recibe: string | null;
  tipo: string | null;
  area_solicitud: string | null;
  estatus: string | null;
  solicitante: string | null;
  perito: string | null;
  digitador: string | null;
  fecha_envio_perito: string | null;
  fecha_envio_visita: string | null;
};

function normalizeNombre(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function colorEstatus(estatus: string | null): string {
  const e = (estatus ?? "").trim().toLowerCase();
  if (e === "abierto" || e === "abierta") return "bg-emerald-500";
  if (e === "cerrada") return "bg-amber-400";
  if (e === "devuelto") return "bg-neutral-400";
  return "bg-orange-500";
}

function horasDesde(fecha: string | null): number | null {
  if (!fecha) return null;
  const t = new Date(`${fecha}T00:00:00`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / HOUR_MS);
}

function formatFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [y, m, d] = fecha.split("-");
  if (!y || !m || !d) return fecha;
  return `${d}/${m}/${y}`;
}

function LineaTiempo({
  fecha,
  horas,
  texto,
  sin,
}: {
  fecha: string | null;
  horas: number | null;
  texto: string;
  sin: string;
}) {
  const s = semaforo(horas);
  return (
    <div className="mt-2 flex items-center gap-1.5 pl-1">
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      <span className="shrink-0 text-[10.5px] font-bold leading-none" style={{ color: s.color }}>
        {formatFecha(fecha)}
      </span>
      <span className="truncate text-[10.5px] leading-none text-on-surface-variant">
        {horas === null ? sin : `${etiquetaTiempo(horas)} ${texto}`}
      </span>
    </div>
  );
}

function semaforo(horas: number | null) {
  if (horas === null) return { dot: "bg-neutral-400", color: "#9ca3af" };
  if (horas <= 24) return { dot: "bg-emerald-500", color: "#10b981" };
  if (horas <= 48) return { dot: "bg-amber-500", color: "#f59e0b" };
  if (horas <= 72) return { dot: "bg-orange-500", color: "#f97316" };
  return { dot: "bg-red-500", color: "#ef4444" };
}

function etiquetaTiempo(horas: number | null): string {
  if (horas === null) return "Sin fecha";
  if (horas < 48) return `${horas} h`;
  return `${Math.floor(horas / 24)} d`;
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/google.svg"
      alt=""
      width={18}
      height={18}
      className={className}
      aria-hidden
    />
  );
}

export default function AuthFlow() {
  const [isWidget, setIsWidget] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<{ nombre: string; cargo: string } | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [widgetTab, setWidgetTab] = useState<"abiertos" | "convisita">("abiertos");
  const [online, setOnline] = useState(true);
  const [widgetVersion, setWidgetVersion] = useState<string | null>(null);
  const [showUpdateCard, setShowUpdateCard] = useState(false);
  const [update, setUpdate] = useState<
    | { state: "downloading"; percent: number }
    | { state: "downloaded"; version: string }
    | { state: "error"; message: string }
    | null
  >(null);
  const [avaluos, setAvaluos] = useState<Avaluo[] | null>(null);
  const [avaluosError, setAvaluosError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [excelPathInput, setExcelPathInput] = useState("");
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const [savingSync, setSavingSync] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const widget = Boolean(window.electronAPI);
      setIsWidget(widget);
      if (supabase) {
        supabase.auth.getSession().then(({ data }) => {
          setUser(data.session?.user ?? null);
        });
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    const cargar = async () => {
      const { data, error } = await client
        .from("avaluos")
        .select(
          "no_avaluo, fecha_banco, recibe, tipo, area_solicitud, estatus, solicitante, perito, digitador, fecha_envio_perito, fecha_envio_visita"
        )
        .order("recibe", { ascending: true });
      if (cancelled) return;
      if (error) {
        setAvaluosError(error.message);
        return;
      }
      setAvaluosError(null);
      setAvaluos((data as Avaluo[]) ?? []);
    };
    cargar();
    const id = window.setInterval(cargar, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!isWidget || !window.electronAPI?.getVersion) return;
    window.electronAPI.getVersion().then((v) => {
      setWidgetVersion(v);
      if (window.localStorage.getItem("valtech-widget-version") !== v) {
        setShowUpdateCard(true);
      }
    });
  }, [isWidget]);

  useEffect(() => {
    if (!isWidget || !window.electronAPI?.onUpdateDownloaded) return;
    const offs = [
      window.electronAPI.onUpdateAvailable(() =>
        setUpdate({ state: "downloading", percent: 0 })
      ),
      window.electronAPI.onUpdateProgress(({ percent }) =>
        setUpdate((u) => (u?.state === "downloading" ? { ...u, percent } : u))
      ),
      window.electronAPI.onUpdateDownloaded(({ version }) =>
        setUpdate({ state: "downloaded", version })
      ),
      window.electronAPI.onUpdateError(({ message }) =>
        setUpdate({ state: "error", message })
      ),
    ];
    return () => offs.forEach((off) => off?.());
  }, [isWidget]);

  useEffect(() => {
    if (!isWidget || !window.electronAPI?.getConfig) return;
    window.electronAPI.getConfig().then((cfg) => {
      setExcelPathInput(cfg?.excelPath ?? "");
    });
    const off = window.electronAPI.onSyncStatus?.(({ message }) => {
      setSyncLog((logs) => [...logs.slice(-8), message]);
    });
    return () => off?.();
  }, [isWidget]);

  useEffect(() => {
    if (!supabase || !user) return;
    const client = supabase;
    let cancelled = false;

    const cargarPerfil = async () => {
      const { data } = await client
        .from("perfiles")
        .select("nombre, cargo")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setPerfil(data ?? null);
    };

    const nombre =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : (user.email ?? user.id);

    (async () => {
      const { error } = await client.from("perfiles").upsert(
        { id: user.id, email: user.email ?? "", nombre },
        { onConflict: "id" }
      );
      if (error || cancelled) return;
      await cargarPerfil();
    })();

    const channel = client
      .channel(`perfiles:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "perfiles", filter: `id=eq.${user.id}` },
        () => cargarPerfil()
      )
      .subscribe();

    const onFocus = () => cargarPerfil();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      client.removeChannel(channel);
    };
  }, [user]);

  async function signIn() {
    if (!supabase) return;
    setAuthError(null);
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: isWidget
          ? WIDGET_OAUTH_REDIRECT
          : `${window.location.origin}/`,
      },
    });
    if (error) {
      setAuthError(error.message);
      setSigningIn(false);
    }
  }

  useEffect(() => {
    if (!isWidget || !window.electronAPI?.onSetSession) return;
    const off = window.electronAPI.onSetSession(async (payload) => {
      if (!supabase) return;
      const { error } = await supabase.auth.setSession({
        access_token: payload.accessToken,
        refresh_token: payload.refreshToken,
      });
      if (error) setAuthError(error.message);
    });
    return off;
  }, [isWidget]);

  useEffect(() => {
    if (!isWidget || !window.electronAPI?.onOAuthCode) return;
    const offCode = window.electronAPI.onOAuthCode(async (code) => {
      if (!supabase) return;
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) setAuthError(error.message);
      setSigningIn(false);
    });
    const offCancel = window.electronAPI.onOAuthCancelled(() => setSigningIn(false));
    return () => {
      offCode();
      offCancel();
    };
  }, [isWidget]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }

  async function vincularWidget() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    if (!s) return;
    window.location.href = `widgetavaluo://auth?at=${encodeURIComponent(
      s.access_token
    )}&rt=${encodeURIComponent(s.refresh_token)}`;
  }

  async function guardarSync() {
    if (!window.electronAPI?.setConfig) return;
    setSavingSync(true);
    const trimmed = excelPathInput.trim();
    try {
      await window.electronAPI.setConfig({ excelPath: trimmed || undefined });
      setExcelPathInput(trimmed);
      setSyncLog((l) => [
        ...l.slice(-8),
        trimmed ? `[sync] ruta guardada: ${trimmed}` : "[sync] ruta por defecto restaurada",
      ]);
    } catch {
      setSyncLog((l) => [...l.slice(-8), "[sync] no se pudo guardar la ruta"]);
    } finally {
      setSavingSync(false);
    }
  }

  async function buscarExcel() {
    if (!window.electronAPI?.pickExcel) return;
    const p = await window.electronAPI.pickExcel();
    if (p) setExcelPathInput(p);
  }

  if (isWidget) {
    if (!user) {
      return (
        <main className="flex h-[100dvh] flex-col items-center justify-center bg-background px-6 text-on-background">
          <Image
            src="/LOGO VALTECH.png"
            alt="Valtech"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            priority
          />
          <h1 className="mt-4 text-[17px] font-bold tracking-tight text-on-surface">
            Widget Avalúo
          </h1>
          <p className="mt-1 max-w-[32ch] text-center text-[12px] leading-relaxed text-on-surface-variant">
            Inicia sesión en la web (valtech-beta.vercel.app) y pulsa{" "}
            <span className="font-semibold text-on-surface">&ldquo;Abrir sesión en el widget&rdquo;</span>.
            Esta ventana se conectará sola.
          </p>
          {signingIn && (
            <p className="mt-3 flex items-center gap-2 text-[12px] text-on-surface-variant">
              <HugeiconsIcon
                icon={Loading02Icon}
                size={14}
                className="animate-spin motion-reduce:animate-none"
              />
              Conectando…
            </p>
          )}
          <button
            type="button"
            onClick={signIn}
            disabled={signingIn || !supabase}
            className="mt-5 flex h-10 w-full max-w-[260px] items-center justify-center gap-2 rounded-xl border border-outline-variant/70 bg-surface text-[12px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-70"
          >
            <GoogleLogo className="h-4 w-4" />
            Iniciar sesión aquí
          </button>
          {authError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-[11px] leading-relaxed text-red-800">
              {authError}
            </p>
          )}
          {!supabase && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-center text-[11px] leading-relaxed text-amber-800">
              Falta configurar Supabase.
            </p>
          )}
        </main>
      );
    }

    const listado = avaluos ?? [];
    const cargo = (perfil?.cargo ?? "").trim().toLowerCase();
    const nombreNorm = normalizeNombre(perfil?.nombre ?? "");
    const esSuyo = (a: Avaluo) => {
      if (cargo === "encargado") return true;
      const col =
        cargo === "perito"
          ? a.perito
          : cargo === "digitador"
            ? a.digitador
            : a.perito || a.digitador;
      return nombreNorm !== "" && normalizeNombre(col ?? "") === nombreNorm;
    };
    const normEstatus = (s: string | null) => (s ?? "").trim().toLowerCase();
    const esOculto = (s: string | null) => {
      const e = normEstatus(s);
      if (!e) return true;
      return (
        e === "cerrado" ||
        e === "cerrada" ||
        e === "cotizado" ||
        e === "cotizada" ||
        e === "devuelto" ||
        e === "devuelta" ||
        e === "standby" ||
        e === "stand by" ||
        e === "stand-by" ||
        e === "stand_by" ||
        e === "0"
      );
    };
    const es2026OMas = (a: Avaluo) => {
      const f = a.fecha_banco;
      if (!f) return false;
      const y = Number(f.slice(0, 4));
      return !Number.isNaN(y) && y >= 2026;
    };
    const tieneVisita = (a: Avaluo) => {
      const v = a.fecha_envio_visita;
      return v != null && v.trim() !== "";
    };
    const visibles = listado.filter((a) => esSuyo(a) && !esOculto(a.estatus) && es2026OMas(a));
    const abiertos = visibles.filter((a) => !tieneVisita(a));
    const conVisita = visibles.filter(tieneVisita);
    const actuales = widgetTab === "abiertos" ? abiertos : conVisita;
    const cargando = avaluos === null && !avaluosError;

    return (
      <main className="flex h-[100dvh] flex-col overflow-hidden bg-background px-4 pb-4 pt-7 text-on-background">
        <header className="flex items-center justify-between">
          <Image
            src="/LOGO VALTECH.png"
            alt="Valtech"
            width={22}
            height={22}
            className="h-[22px] w-[22px] object-contain"
            priority
          />
          <div className="flex items-center gap-1.5">
            {cargo === "encargado" && (
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                aria-label="Configuración de sincronización"
                title="Configuración de sincronización"
                className="flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <HugeiconsIcon icon={Settings01Icon} size={13} strokeWidth={2} />
              </button>
            )}
            {update && (
              <button
                type="button"
                onClick={
                  update.state === "downloaded"
                    ? () => window.electronAPI?.quitAndInstall?.()
                    : undefined
                }
                disabled={update.state !== "downloaded"}
                title={
                  update.state === "error"
                    ? update.message
                    : update.state === "downloaded"
                      ? "Clic para instalar y reiniciar"
                      : "Descargando actualización…"
                }
                className={`flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-bold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  update.state === "error"
                    ? "bg-surface-container-high text-on-surface-variant"
                    : update.state === "downloaded"
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                <HugeiconsIcon
                  icon={
                    update.state === "downloaded"
                      ? Download01Icon
                      : update.state === "error"
                        ? CloudOffIcon
                        : Loading02Icon
                  }
                  size={11}
                  strokeWidth={2}
                  className={
                    update.state === "downloading"
                      ? "animate-spin motion-reduce:animate-none"
                      : ""
                  }
                />
                {update.state === "downloading"
                  ? `${Math.round(update.percent)}%`
                  : "Actualizar"}
              </button>
            )}
            {online ? (
              <span className="relative flex h-2 w-2" title="Activo">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            ) : (
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant"
                title="Sin conexión"
              >
                <HugeiconsIcon icon={CloudOffIcon} size={13} strokeWidth={2} />
              </span>
            )}
            <button
              type="button"
              onClick={signOut}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <HugeiconsIcon icon={Logout01Icon} size={13} strokeWidth={2} />
            </button>
          </div>
        </header>

        {showUpdateCard && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/5 p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
              <HugeiconsIcon icon={CloudCheckIcon} size={13} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-on-surface">Widget actualizado</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-on-surface-variant">
                Nueva versión instalada{widgetVersion ? ` (v${widgetVersion})` : ""}.
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => {
                setShowUpdateCard(false);
                if (widgetVersion) {
                  window.localStorage.setItem("valtech-widget-version", widgetVersion);
                }
              }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        )}

        <section className="mt-4">
          <h1 className="text-[17px] font-bold leading-[1.2] tracking-tight text-on-surface">
            Solicitudes de avalúo
          </h1>

          <div className="mt-3 flex rounded-lg bg-surface-container-high p-[3px]" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={widgetTab === "abiertos"}
              onClick={() => setWidgetTab("abiertos")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                widgetTab === "abiertos"
                  ? "bg-primary text-white shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Abiertos
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  widgetTab === "abiertos" ? "bg-white/25 text-white" : "bg-surface-container-highest text-on-surface-variant"
                }`}
              >
                {abiertos.length}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={widgetTab === "convisita"}
              onClick={() => setWidgetTab("convisita")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                widgetTab === "convisita"
                  ? "bg-primary text-white shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Con visita
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  widgetTab === "convisita" ? "bg-white/25 text-white" : "bg-surface-container-highest text-on-surface-variant"
                }`}
              >
                {conVisita.length}
              </span>
            </button>
          </div>
        </section>

        <section className="mt-3 min-h-0 flex-1">
          {cargando ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <HugeiconsIcon
                icon={Loading02Icon}
                size={18}
                strokeWidth={2}
                className="animate-spin text-on-surface-variant motion-reduce:animate-none"
              />
              <p className="text-[12px] text-on-surface-variant">Cargando avalúos…</p>
            </div>
          ) : avaluosError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-[12px] leading-relaxed text-red-800">
                No se pudo cargar la información: {avaluosError}
              </p>
            </div>
          ) : actuales.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-on-surface-variant">
                <HugeiconsIcon
                  icon={widgetTab === "abiertos" ? MapPinIcon : MapPinCheckIcon}
                  size={20}
                  strokeWidth={1.5}
                />
              </div>
              <h2 className="mt-3 text-[14px] font-bold tracking-tight text-on-surface">
                {widgetTab === "abiertos" ? "Sin avalúos abiertos" : "Sin avalúos con visita"}
              </h2>
              <p className="mt-1 max-w-[30ch] text-[12px] leading-relaxed text-on-surface-variant">
                {widgetTab === "abiertos"
                  ? "Los avalúos sin visita enviada aparecerán aquí en tiempo real."
                  : "Los avalúos con visita enviada aparecerán aquí en tiempo real."}
              </p>
            </div>
          ) : (
            <div className="h-full overflow-y-auto pr-0.5">
              <ul className="flex flex-col gap-2">
                {actuales.map((a) => {
                  const horasPerito = horasDesde(a.fecha_envio_perito);
                  const horasVisita = horasDesde(a.fecha_envio_visita);
                  return (
                    <li
                      key={a.no_avaluo}
                      className="relative overflow-hidden rounded-xl border border-outline-variant/50 bg-surface p-3 shadow-[0_1px_2px_rgba(24,24,27,0.04)]"
                    >
                      <span className={`absolute inset-y-0 left-0 w-1 ${colorEstatus(a.estatus)}`} />
                      <div className="flex items-center justify-between gap-2 pl-1">
                        <p className="min-w-0 truncate text-[12px] font-bold tracking-tight text-on-surface">
                          {a.no_avaluo}
                        </p>
                        <span className="shrink-0 rounded-md bg-surface-container-high px-1.5 py-0.5 text-[10px] font-semibold leading-none text-on-surface-variant">
                          {a.estatus ?? "—"}
                        </span>
                      </div>
                      <p className="mt-1 truncate pl-1 text-[11px] font-medium text-on-surface-variant">
                        {a.solicitante ?? "—"}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5 pl-1 text-[10.5px] leading-none text-on-surface-variant">
                        <span className="truncate">{a.fecha_banco ?? "—"}</span>
                        <span className="shrink-0 text-outline">·</span>
                        <span className="truncate">{a.tipo ?? "—"}</span>
                        <span className="shrink-0 text-outline">·</span>
                        <span className="truncate">{a.area_solicitud ?? "—"}</span>
                      </div>
                      {cargo === "encargado" ? (
                        <>
                          <LineaTiempo
                            fecha={a.fecha_envio_perito}
                            horas={horasPerito}
                            texto="desde solicitud al perito"
                            sin="sin solicitud al perito"
                          />
                          <LineaTiempo
                            fecha={a.fecha_envio_visita}
                            horas={horasVisita}
                            texto="desde visita del perito"
                            sin="sin visita del perito"
                          />
                        </>
                      ) : cargo === "perito" ? (
                        <LineaTiempo
                          fecha={a.fecha_envio_perito}
                          horas={horasPerito}
                          texto="desde que te solicitaron la visita"
                          sin="sin solicitud de visita"
                        />
                      ) : (
                        <LineaTiempo
                          fecha={a.fecha_envio_visita}
                          horas={horasVisita}
                          texto="desde que el perito envió la visita"
                          sin="sin visita recibida"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        <div className="mt-3 shrink-0">
          <div className="rounded-xl border border-outline-variant/60 bg-surface p-3">
            {(perfil?.nombre || perfil?.cargo) && (
              <p className="mt-1 flex items-center gap-1.5 truncate">
                {perfil?.cargo && (
                  <span className="flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    <HugeiconsIcon icon={UserCircleIcon} size={11} strokeWidth={2} />
                    {perfil.cargo}
                  </span>
                )}
                {perfil?.nombre && (
                  <span className="truncate text-[11px] font-semibold text-on-surface">
                    {perfil.nombre}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {showSettings && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => setShowSettings(false)}
          >
            <div
              className="w-full max-w-[340px] rounded-2xl border border-outline-variant/30 bg-surface p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-bold tracking-tight text-on-surface">
                  Configuración de sincronización
                </h2>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  aria-label="Cerrar"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
                Pega la ruta del archivo Excel maestro que trabaja el encargado. Al guardar, este
                widget lo vigilará y subirá los cambios automáticamente. La sincronización{" "}
                <span className="font-semibold text-on-surface">reemplaza</span> la base: se borran
                los avalúos que ya no estén en el Excel.
              </p>
              <label className="mt-3 block text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                Ruta del Excel
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="text"
                  value={excelPathInput}
                  onChange={(e) => setExcelPathInput(e.target.value)}
                  placeholder="C:\Usuarios\…\EXCEL_MAESTRO.xlsx"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-lg border border-outline-variant/60 bg-surface-container-high px-2.5 py-2 text-[11px] text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <button
                  type="button"
                  onClick={buscarExcel}
                  disabled={savingSync}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-surface-container-high px-2 text-[10px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                  title="Buscar archivo"
                >
                  <HugeiconsIcon icon={FolderSearchIcon} size={12} strokeWidth={2} />
                  Buscar
                </button>
              </div>
              {syncLog.length > 0 && (
                <div className="mt-3 max-h-28 overflow-y-auto rounded-lg bg-surface-container-high/60 p-2 font-mono text-[9.5px] leading-relaxed text-on-surface-variant">
                  {syncLog.map((l, i) => (
                    <p key={i} className="truncate">
                      {l}
                    </p>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="flex h-9 flex-1 items-center justify-center rounded-lg border border-outline-variant/60 text-[12px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardarSync}
                  disabled={savingSync}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-[12px] font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {savingSync ? (
                    <HugeiconsIcon
                      icon={Loading02Icon}
                      size={13}
                      strokeWidth={2}
                      className="animate-spin motion-reduce:animate-none"
                    />
                  ) : (
                    <HugeiconsIcon icon={CloudCheckIcon} size={13} strokeWidth={2} />
                  )}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  const cargoLabel = perfil?.cargo
    ? perfil.cargo.charAt(0).toUpperCase() + perfil.cargo.slice(1)
    : null;

  if (user) {
    const hora = new Date().getHours();
    const saludo =
      hora >= 5 && hora < 12
        ? "buenos días"
        : hora >= 12 && hora < 19
          ? "buenas tardes"
          : "buenas noches";
    const nombre = perfil?.nombre || user.user_metadata?.full_name || user.email;

    return (
      <div className="flex min-h-[100dvh] flex-col bg-background text-on-background">
        <header className="sticky top-0 z-50 w-full border-b border-outline-variant/30 bg-surface/80 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-4 py-4 md:px-12">
            <div className="flex items-center gap-3">
              <Image
                src="/LOGO VALTECH.png"
                alt="Valtech"
                width={32}
                height={32}
                className="h-8 w-auto object-contain"
                priority
              />
              <span className="text-[20px] font-bold tracking-tight text-on-surface">
                Valtech
              </span>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-2 text-[14px] font-semibold text-on-surface-variant opacity-80 transition-colors duration-200 hover:text-primary hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Salir
              <HugeiconsIcon icon={Logout01Icon} size={20} />
            </button>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1280px] flex-1 items-center justify-center px-4 py-12 md:px-12 md:py-24">
          <div className="grid w-full grid-cols-1 items-center gap-16 md:grid-cols-2 md:gap-24">
            <div className="order-2 flex flex-col gap-6 text-center md:order-1 md:text-left">
              <div className="flex flex-col gap-2">
                <h2 className="text-[24px] font-medium tracking-tight text-primary">
                  Hola, {nombre}, {saludo}
                </h2>
                <h1 className="text-[40px] font-bold leading-[1.1] tracking-tight text-on-surface md:text-[56px]">
                  Valtech
                </h1>
              </div>
              <p className="mx-auto max-w-md text-[18px] leading-relaxed text-on-surface-variant md:mx-0">
                Es una plataforma privada para el control de solicitudes de avalúos.
              </p>
            </div>

            <div className="order-1 flex justify-center md:order-2 md:justify-end">
              <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface p-10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
                <div className="flex flex-col gap-3 text-center">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high">
                    <span className="text-primary">
                      <HugeiconsIcon icon={UserCircleIcon} size={24} />
                    </span>
                  </div>
                  <h3 className="text-[20px] font-semibold text-on-surface">Estado de cargo</h3>
                  {cargoLabel ? (
                    <p className="text-[14px] leading-5 text-on-surface-variant">
                      Tu cargo es{" "}
                      <span className="font-semibold text-primary">{cargoLabel}</span>
                    </p>
                  ) : (
                    <p className="text-[14px] leading-5 text-on-surface-variant">
                      Tu cargo aún no está asignado. Contacta al administrador para habilitar tus funciones.
                    </p>
                  )}
                </div>

                <div className="mt-2 flex flex-col gap-4 border-t border-outline-variant/30 pt-6">
                  <DownloadExe />
                  <button
                    type="button"
                    onClick={vincularWidget}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-semibold text-white transition-[transform,box-shadow,opacity] duration-150 ease-out hover:-translate-y-px hover:shadow-[0_10px_24px_-12px_rgba(0,0,0,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-70"
                  >
                    Abrir sesión en el widget
                  </button>
                  <p className="mt-1 px-2 text-center text-[13px] font-medium leading-relaxed text-outline">
                    Descarga e instala el widget para tener tus avalúos siempre a la vista en Windows.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const content = (
    <div className={`w-full max-w-[380px] rounded-2xl bg-white px-7 py-9 ${CARD_SHADOW}`}>
      <div className="flex flex-col items-center text-center">
        <Image
          src="/LOGO VALTECH.png"
          alt="Valtech"
          width={56}
          height={56}
          className="h-14 w-14 object-contain"
          priority
        />
        <h2 className="mt-5 text-[26px] font-semibold leading-[1.15] tracking-tight text-zinc-900">
          Bienvenido
        </h2>
        <p className="mt-2 max-w-[34ch] text-[14px] leading-relaxed text-zinc-600">
          Inicia sesión con tu cuenta de Google para consultar tus avalúos.
        </p>
      </div>

      <button
        type="button"
        onClick={signIn}
        disabled={signingIn || !supabase}
        className="mt-7 flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-zinc-900 text-[15px] font-medium text-white transition-[transform,box-shadow,opacity] duration-150 ease-out hover:-translate-y-px hover:shadow-[0_10px_24px_-12px_rgba(24,24,27,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-70 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        {signingIn ? (
          <HugeiconsIcon
            icon={Loading02Icon}
            size={18}
            className="animate-spin motion-reduce:animate-none"
          />
        ) : (
          <GoogleLogo className="h-[18px] w-[18px] object-contain" />
        )}
        {signingIn ? "Conectando con Google…" : "Continuar con Google"}
      </button>

      {authError && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-[12px] leading-relaxed text-red-800">
          {authError}
        </p>
      )}

      {!supabase && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-center text-[12px] leading-relaxed text-amber-800">
          Falta configurar Supabase para el acceso con Google. Agrega tus claves en .env.local.
        </p>
      )}

      <p className="mt-5 text-center text-[12px] leading-relaxed text-zinc-500">
        Al continuar aceptas los{" "}
        <Link href="/terminos" className="font-medium text-brand hover:underline">
          términos
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" className="font-medium text-brand hover:underline">
          política de privacidad
        </Link>
        .
      </p>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface">
      <main className="mx-auto grid w-full max-w-[1080px] flex-1 items-center gap-12 px-6 py-12 lg:grid-cols-2 lg:gap-16">
        <section className="text-center lg:text-left">
          <h1 className="text-balance text-[36px] font-semibold leading-tight tracking-tight text-on-surface">
            Valtech
          </h1>
          <p className="mx-auto mt-4 max-w-[44ch] text-[16px] leading-relaxed text-on-surface-variant lg:mx-0">
            Es una plataforma privada para el control de solicitudes de avalúos.
          </p>
        </section>

        <div className="mx-auto w-full max-w-[400px]">{content}</div>
      </main>
    </div>
  );
}

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
} from "@hugeicons/core-free-icons";
import { supabase } from "../../lib/supabase/client";
import DownloadExe from "./DownloadExe";

const CARD_SHADOW =
  "shadow-[0_1px_2px_rgba(24,24,27,0.05),0_12px_32px_-12px_rgba(24,24,27,0.18)]";

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
  const [widgetTab, setWidgetTab] = useState<"sin" | "con">("sin");
  const [online, setOnline] = useState(true);
  const [widgetVersion, setWidgetVersion] = useState<string | null>(null);
  const [showUpdateCard, setShowUpdateCard] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const widget = Boolean(window.electronAPI);
      setIsWidget(widget);
      if (!widget && supabase) {
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
    if (!isWidget || !window.electronAPI?.getVersion) return;
    window.electronAPI.getVersion().then((v) => {
      setWidgetVersion(v);
      if (window.localStorage.getItem("valtech-widget-version") !== v) {
        setShowUpdateCard(true);
      }
    });
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
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      setAuthError(error.message);
      setSigningIn(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }

  if (isWidget) {
    return (
      <main className="flex min-h-[100dvh] flex-col bg-background px-4 pb-4 pt-7 text-on-background">
        <header className="flex items-center justify-between">
          <Image
            src="/LOGO VALTECH.png"
            alt="Valtech"
            width={22}
            height={22}
            className="h-[22px] w-[22px] object-contain"
            priority
          />
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
              aria-selected={widgetTab === "sin"}
              onClick={() => setWidgetTab("sin")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                widgetTab === "sin"
                  ? "bg-primary text-white shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <HugeiconsIcon icon={MapPinIcon} size={13} strokeWidth={2} />
              Sin visita
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={widgetTab === "con"}
              onClick={() => setWidgetTab("con")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                widgetTab === "con"
                  ? "bg-primary text-white shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <HugeiconsIcon icon={MapPinCheckIcon} size={13} strokeWidth={2} />
              Con visita
            </button>
          </div>
        </section>

        <section className="mt-auto flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-on-surface-variant">
            <HugeiconsIcon
              icon={widgetTab === "sin" ? MapPinIcon : MapPinCheckIcon}
              size={20}
              strokeWidth={1.5}
            />
          </div>
          <h2 className="mt-3 text-[14px] font-bold tracking-tight text-on-surface">
            {widgetTab === "sin" ? "Sin visitas pendientes" : "Sin avalúos con visita"}
          </h2>
          <p className="mt-1 max-w-[30ch] text-[12px] leading-relaxed text-on-surface-variant">
            {widgetTab === "sin"
              ? "Las solicitudes pendientes de visita aparecerán aquí en tiempo real."
              : "Los avalúos ya visitados aparecerán aquí en tiempo real."}
          </p>
        </section>

        <div className="mt-auto">
          <div className="rounded-xl border border-outline-variant/60 bg-surface p-3">
            <p className="text-[12px] leading-relaxed text-on-surface-variant">
              Este widget se actualiza solo: minimízalo cuando quieras.
            </p>
          </div>
        </div>
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

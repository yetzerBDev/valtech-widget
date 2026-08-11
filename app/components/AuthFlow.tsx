"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Loading02Icon,
  CircleCheckIcon,
  MonitorDotIcon,
  Logout01Icon,
} from "@hugeicons/core-free-icons";
import { supabase } from "../../lib/supabase/client";

const INSTALL_STEPS = [
  "Abre la carpeta del proyecto y ejecuta npm run dist:win para generar el instalador.",
  "Entra en la carpeta release y ejecuta Widget Avalúo Setup.exe.",
  "Sigue la instalación. El widget quedará en tu escritorio y en el inicio de Windows.",
  "Abre el widget. Se iniciará solo cada vez que enciendas el PC.",
];

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
  const [hydrated, setHydrated] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(async () => {
      const widget = Boolean(window.electronAPI);
      setIsWidget(widget);
      if (!widget && supabase) {
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user ?? null);
      }
      setHydrated(true);
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

  if (!hydrated) return null;

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
      <main className="flex min-h-[100dvh] flex-col px-6 pb-7 pt-6">
        <header className="flex items-center gap-3">
          <Image
            src="/LOGO VALTECH.png"
            alt="Valtech"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            priority
          />
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900">Valtech</span>
        </header>

        <section className="mt-auto">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <HugeiconsIcon icon={MonitorDotIcon} size={24} strokeWidth={1.75} />
          </span>
          <h1 className="mt-4 max-w-[18ch] text-balance text-[24px] font-semibold leading-[1.15] tracking-tight text-zinc-900">
            Widget instalado y en ejecución
          </h1>
          <p className="mt-2 max-w-[30ch] text-[14px] leading-relaxed text-zinc-600">
            Este widget se abre automáticamente al encender el PC y solo se puede minimizar, nunca cerrar.
          </p>
        </section>

        <div className="mt-auto">
          <p className="rounded-xl bg-zinc-50 px-4 py-3 text-[13px] leading-relaxed text-zinc-600">
            Para minimizarlo usa el botón de la esquina superior derecha. Los datos de tus avalúos aparecerán aquí.
          </p>
        </div>
      </main>
    );
  }

  if (user) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-zinc-100 px-6 py-10">
        <div className={`w-full max-w-[400px] rounded-2xl bg-white p-7 ${CARD_SHADOW}`}>
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Image
                src="/LOGO VALTECH.png"
                alt="Valtech"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
              <span className="text-[15px] font-semibold tracking-tight text-zinc-900">Valtech</span>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none"
            >
              <HugeiconsIcon icon={Logout01Icon} size={15} />
              Salir
            </button>
          </header>

          <section className="mt-7">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <HugeiconsIcon icon={CircleCheckIcon} size={24} strokeWidth={1.75} />
            </span>
            <h1 className="mt-4 text-balance text-[24px] font-semibold leading-[1.15] tracking-tight text-zinc-900">
              Ya casi. Instala el widget
            </h1>
            <p className="mt-2 max-w-[38ch] text-[14px] leading-relaxed text-zinc-600">
              Accediste como {user.email}. Sigue estos pasos y tendrás tus avalúos siempre a la vista.
            </p>
          </section>

          <ol className="mt-7 flex flex-col gap-4">
            {INSTALL_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[12px] font-semibold text-zinc-700">
                  {i + 1}
                </span>
                <p className="text-[14px] leading-relaxed text-zinc-600">{step}</p>
              </li>
            ))}
          </ol>

          <p className="mt-7 rounded-xl bg-zinc-50 px-4 py-3 text-[13px] leading-relaxed text-zinc-600">
            Cuando lo tengas listo, el widget se abrirá solo al encender el PC y solo podrás minimizarlo, nunca cerrarlo.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-zinc-100 px-6 py-10">
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
          <h1 className="mt-5 text-[26px] font-semibold leading-[1.15] tracking-tight text-zinc-900">
            Bienvenido
          </h1>
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
    </main>
  );
}

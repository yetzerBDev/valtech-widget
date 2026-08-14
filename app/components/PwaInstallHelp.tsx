"use client";

import { useEffect, useState } from "react";

export default function PwaInstallHelp({ onClose }: { onClose: () => void }) {
  const [plataforma, setPlataforma] = useState<"android" | "ios-safari" | "ios-chrome" | "otros">("otros");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlataforma(/crios/.test(ua) ? "ios-chrome" : "ios-safari");
    } else if (/android/.test(ua)) {
      setPlataforma("android");
    } else {
      setPlataforma("otros");
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[340px] rounded-2xl border border-outline-variant/30 bg-surface p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-bold tracking-tight text-on-surface">
            Instalar en tu teléfono
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="mt-3 space-y-3 text-[12px] leading-relaxed text-on-surface-variant">
          {plataforma === "android" && (
            <>
              <p>
                En <span className="font-semibold text-on-surface">Android (Chrome)</span>:
              </p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Abre el menú <span className="font-semibold">⋮</span> arriba a la derecha.</li>
                <li>Toca <span className="font-semibold">"Agregar a pantalla principal"</span>.</li>
                <li>Confirma con <span className="font-semibold">"Agregar"</span>.</li>
              </ol>
            </>
          )}
          {plataforma === "ios-chrome" && (
            <>
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-400">
                En Chrome de iPhone no se puede instalar. Necesitas Safari.
              </p>
              <p>
                En <span className="font-semibold text-on-surface">Safari</span>:
              </p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Abre <span className="font-semibold">valtech-beta.vercel.app</span> en Safari.</li>
                <li>Toca el botón <span className="font-semibold">Compartir</span> (cuadro con flecha ↑).</li>
                <li>Desliza y toca <span className="font-semibold">"Agregar a pantalla de inicio"</span>.</li>
                <li>Confirma con <span className="font-semibold">"Agregar"</span>.</li>
              </ol>
            </>
          )}
          {plataforma === "ios-safari" && (
            <>
              <p>
                En <span className="font-semibold text-on-surface">iPhone (Safari)</span>:
              </p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Toca el botón <span className="font-semibold">Compartir</span> (cuadro con flecha ↑).</li>
                <li>Desliza y toca <span className="font-semibold">"Agregar a pantalla de inicio"</span>.</li>
                <li>Confirma con <span className="font-semibold">"Agregar"</span>.</li>
              </ol>
            </>
          )}
          {plataforma === "otros" && (
            <>
              <p>
                En <span className="font-semibold text-on-surface">Android (Chrome)</span>:
              </p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Abre el menú <span className="font-semibold">⋮</span> arriba a la derecha.</li>
                <li>Toca <span className="font-semibold">"Agregar a pantalla principal"</span>.</li>
                <li>Confirma con <span className="font-semibold">"Agregar"</span>.</li>
              </ol>
              <p>
                En <span className="font-semibold text-on-surface">iPhone (Safari)</span>:
              </p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Toca el botón <span className="font-semibold">Compartir</span> (cuadro con flecha ↑).</li>
                <li>Desliza y toca <span className="font-semibold">"Agregar a pantalla de inicio"</span>.</li>
                <li>Confirma con <span className="font-semibold">"Agregar"</span>.</li>
              </ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

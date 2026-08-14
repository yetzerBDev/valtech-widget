"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const registrar = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        // Al instalar/actualizar la PWA, refresca la pagina para usar el
        // shell mas reciente.
        if (navigator.serviceWorker.controller) {
          reg.addEventListener("updatefound", () => {
            const nuevo = reg.installing;
            if (!nuevo) return;
            nuevo.addEventListener("statechange", () => {
              if (nuevo.state === "activated" && navigator.serviceWorker.controller) {
                window.location.reload();
              }
            });
          });
        }
      } catch {
        /* SW no disponible, la web sigue funcionando normal */
      }
    };
    registrar();
  }, []);

  return null;
}

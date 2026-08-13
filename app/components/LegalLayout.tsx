import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-[16px] font-semibold tracking-tight text-on-surface">
        {title}
      </h2>
      <div className="mt-2 flex flex-col gap-3 text-[14px] leading-relaxed text-on-surface-variant">
        {children}
      </div>
    </section>
  );
}

export default function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-[100dvh] bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-[860px] rounded-2xl bg-surface p-7 shadow-[0_1px_2px_rgba(24,24,27,0.05),0_12px_32px_-12px_rgba(24,24,27,0.18)] sm:p-10">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/LOGO VALTECH BLANCO.png"
              alt="Valtech"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <span className="text-[15px] font-semibold tracking-tight text-on-surface">
              Valtech
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Volver al inicio
          </Link>
        </header>

        <div className="mt-8">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-on-surface">
            {title}
          </h1>
          <p className="mt-2 text-[13px] text-on-surface-variant">
            Última actualización: {updated}
          </p>
        </div>

        <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">{children}</div>
      </div>
    </main>
  );
}

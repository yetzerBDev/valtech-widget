"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon } from "@hugeicons/core-free-icons";

const EXE_URL =
  process.env.NEXT_PUBLIC_EXE_URL ??
  "https://github.com/yetzerBDev/valtech-widget/releases/download/v0.1.24/widget-avaluo-setup-0.1.24.exe";

export default function DownloadExe() {
  return (
    <a
      href={EXE_URL}
      download
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-[14px] font-semibold text-on-primary shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <HugeiconsIcon icon={Download01Icon} size={20} />
      Descargar instalador
    </a>
  );
}

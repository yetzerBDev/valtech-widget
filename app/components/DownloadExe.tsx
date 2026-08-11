"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon } from "@hugeicons/core-free-icons";

const EXE_URL =
  process.env.NEXT_PUBLIC_EXE_URL ?? "/downloads/widget-avaluo-setup.exe";

export default function DownloadExe() {
  return (
    <a
      href={EXE_URL}
      download
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-brand text-[15px] font-medium text-white transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:shadow-[0_10px_24px_-12px_rgba(24,24,27,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <HugeiconsIcon icon={Download01Icon} size={18} strokeWidth={1.75} />
      Descargar instalador (exe)
    </a>
  );
}

"use client";

import { useEffect, useState } from "react";

export default function WidgetChrome() {
  const [size, setSize] = useState<[number, number] | null>(null);

  useEffect(() => {
    window.electronAPI?.getSize().then(setSize);
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex h-7 items-center select-none [-webkit-app-region:drag]">
      <span className="px-3 text-[10px] tabular-nums text-zinc-400">
        {size ? `${size[0]} × ${size[1]}` : ""}
      </span>
      <button
        type="button"
        aria-label="Minimizar"
        onClick={() => window.electronAPI?.minimize()}
        className="ml-auto flex h-7 w-9 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-200 [-webkit-app-region:no-drag]"
      >
        <span className="block h-px w-3 bg-current" />
      </button>
    </div>
  );
}

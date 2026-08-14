"use client";

export default function WidgetChrome() {
  if (typeof window === "undefined" || !window.electronAPI) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex h-7 items-center select-none bg-background/80 backdrop-blur-sm [-webkit-app-region:drag]">
      <button
        type="button"
        aria-label="Minimizar"
        onClick={() => window.electronAPI?.minimize()}
        className="ml-auto flex h-7 w-9 items-center justify-center text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-none [-webkit-app-region:no-drag]"
      >
        <span className="block h-px w-3 bg-current" />
      </button>
    </div>
  );
}

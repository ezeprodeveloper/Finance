interface PageTransitionLoaderProps {
  visible: boolean;
  label?: string;
}

export function PageTransitionLoader({
  visible,
  label = 'Loading...',
}: PageTransitionLoaderProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[90] pointer-events-auto flex flex-col items-center justify-center bg-slate-950/35 backdrop-blur-xs transition-opacity duration-200"
      role="progressbar"
      aria-busy="true"
      aria-label={label}
    >
      {/* Top Linear Color-Sweep Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-200/30 overflow-hidden">
        <div className="h-full w-1/2 splash-progress-bar" />
      </div>

      {/* Centered Compact Loader Card */}
      <div className="bg-white/95 border border-slate-200 rounded-2xl px-6 py-5 shadow-2xl flex items-center gap-4">
        <div className="relative w-10 h-10 shrink-0">
          <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#071B38] border-r-emerald-600 animate-spin" />
        </div>
        <div>
          <p className="font-display text-sm font-bold text-[#071B38]">E-Finance</p>
          <p className="text-xs font-medium text-slate-600">{label}</p>
        </div>
      </div>
    </div>
  );
}

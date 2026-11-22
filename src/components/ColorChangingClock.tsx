import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

const PALETTE = [
  { text: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  { text: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
];

interface ColorChangingClockProps {
  darkSurface?: boolean;
}

export function ColorChangingClock({ darkSurface = false }: ColorChangingClockProps) {
  const [now, setNow] = useState(() => new Date());
  const [colorIdx, setColorIdx] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = new Date();
      setNow(next);
      // Shift color gracefully every 3 seconds
      if (next.getSeconds() % 3 === 0) {
        setColorIdx((prev) => (prev + 1) % PALETTE.length);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const kigaliTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kigali',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  const kigaliDate = new Intl.DateTimeFormat('en-RW', {
    timeZone: 'Africa/Kigali',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);

  const tone = PALETTE[colorIdx];

  if (darkSurface) {
    return (
      <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-white/15">
        <Clock className="w-4 h-4 clock-color-cycle shrink-0" />
        <div className="leading-tight">
          <span className="font-mono text-sm font-semibold tabular-nums clock-color-cycle block">
            {kigaliTime} CAT
          </span>
          <span className="text-[11px] text-slate-300 block">{kigaliDate}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-colors duration-700 ${tone.bg} ${tone.border}`}
      aria-live="off"
    >
      <Clock className={`w-4 h-4 shrink-0 transition-colors duration-700 ${tone.text}`} />
      <div className="leading-tight">
        <span className={`font-mono text-sm font-semibold tabular-nums block transition-colors duration-700 ${tone.text}`}>
          {kigaliTime} CAT
        </span>
        <span className="text-[11px] text-slate-600 block">{kigaliDate}</span>
      </div>
    </div>
  );
}

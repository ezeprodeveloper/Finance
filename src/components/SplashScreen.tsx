import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const holdMs = prefersReduced ? 600 : 1850;

    const fadeTimer = window.setTimeout(() => setFadingOut(true), holdMs);
    const doneTimer = window.setTimeout(() => onFinish(), holdMs + 350);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-shifting-aurora flex flex-col items-center justify-center px-6 text-white transition-opacity duration-350 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      role="status"
      aria-label="Loading E-Finance"
    >
      <div className="flex flex-col items-center text-center max-w-sm">
        {/* Custom Animated Geometric Brand Emblem */}
        <div className="relative w-24 h-24 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl mb-6 splash-logo-float">
          <svg
            viewBox="0 0 64 64"
            className="w-14 h-14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="efBrandGrad" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="50%" stopColor="#34D399" />
                <stop offset="100%" stopColor="#FBBF24" />
              </linearGradient>
            </defs>
            <path
              d="M32 6L54 14V31C54 44.5 44.6 54.4 32 58C19.4 54.4 10 44.5 10 31V14L32 6Z"
              stroke="url(#efBrandGrad)"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            <path
              d="M22 22H42M22 32H37M22 42H42M22 22V42"
              stroke="#FFFFFF"
              strokeWidth="3.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="43" cy="32" r="3.2" fill="#34D399" />
          </svg>
        </div>

        {/* Vibrant Color-Shifting Wordmark */}
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight splash-word-colors">
          E-Finance
        </h1>
        <p className="text-xs sm:text-sm font-medium text-slate-200 mt-2 tracking-wide">
          Rwanda Digital Savings, Credit &amp; Community Earnings
        </p>

        {/* Smooth Progress Indicator */}
        <div className="w-48 h-1.5 bg-white/15 rounded-full overflow-hidden mt-7">
          <div className="h-full rounded-full splash-progress-bar" />
        </div>
      </div>
    </div>
  );
}

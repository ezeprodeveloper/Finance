import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Gift, Sparkles, Users } from 'lucide-react';
import { RegisteredUser, SpinHistoryRecord } from '../../types/finance';
import { formatDateTime, formatRwf } from '../../utils/formatters';

interface WheelSegment {
  label: string;
  valueRwf: number;
  weight: number;
  color: string;
  textColor: string;
}

// 500 RWF is a visual-only wedge (weight 0); maximum payout strictly <= 200 RWF
const SPIN_SEGMENTS: WheelSegment[] = [
  { label: '10 RWF', valueRwf: 10, weight: 24, color: '#0f172a', textColor: '#f8fafc' },
  { label: '20 RWF', valueRwf: 20, weight: 22, color: '#1e3a8a', textColor: '#f8fafc' },
  { label: '40 RWF', valueRwf: 40, weight: 18, color: '#065f46', textColor: '#f8fafc' },
  { label: '50 RWF', valueRwf: 50, weight: 14, color: '#0d9488', textColor: '#f8fafc' },
  { label: '80 RWF', valueRwf: 80, weight: 9, color: '#1d4ed8', textColor: '#f8fafc' },
  { label: '100 RWF', valueRwf: 100, weight: 7, color: '#047857', textColor: '#f8fafc' },
  { label: '150 RWF', valueRwf: 150, weight: 4, color: '#b45309', textColor: '#ffffff' },
  { label: '200 RWF', valueRwf: 200, weight: 2, color: '#4338ca', textColor: '#ffffff' },
  { label: '500 RWF', valueRwf: 500, weight: 0, color: '#991b1b', textColor: '#fef2f2' },
];

function pickWeightedSegmentIndex(): number {
  const totalWeight = SPIN_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < SPIN_SEGMENTS.length; i += 1) {
    roll -= SPIN_SEGMENTS[i].weight;
    if (roll <= 0 && SPIN_SEGMENTS[i].weight > 0) {
      return i;
    }
  }
  return 0;
}

interface LuckySpinWheelProps {
  user: RegisteredUser;
  referredUsersCount: number;
  referralCommissionPercent: number;
  spinHistory: SpinHistoryRecord[];
  onCompleteSpin: (rewardRwf: number) => void;
}

export function LuckySpinWheel({
  user,
  referredUsersCount,
  referralCommissionPercent,
  spinHistory,
  onCompleteSpin,
}: LuckySpinWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<number>(0);
  const [spinning, setSpinning] = useState(false);
  const [lastResultRwf, setLastResultRwf] = useState<number | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  const referralLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?ref=${encodeURIComponent(user.referralCode)}`
      : `?ref=${user.referralCode}`;

  const drawWheel = (angleRad: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 12;
    const sliceAngle = (2 * Math.PI) / SPIN_SEGMENTS.length;

    ctx.clearRect(0, 0, size, size);

    // Outer metallic ring
    ctx.beginPath();
    ctx.arc(center, center, radius + 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#071B38';
    ctx.fill();

    SPIN_SEGMENTS.forEach((seg, idx) => {
      const start = angleRad + idx * sliceAngle;
      const end = start + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.stroke();

      // Text label
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(start + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = seg.textColor;
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.fillText(seg.label, radius - 14, 5);
      ctx.restore();
    });

    // Center hub
    ctx.beginPath();
    ctx.arc(center, center, 26, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#071B38';
    ctx.stroke();

    ctx.fillStyle = '#071B38';
    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPIN', center, center + 4);
  };

  useEffect(() => {
    drawWheel(rotationRef.current);
  }, []);

  const handleSpin = () => {
    if (spinning || user.spinCredits <= 0) return;

    const targetIndex = pickWeightedSegmentIndex();
    const chosen = SPIN_SEGMENTS[targetIndex];
    const sliceAngle = (2 * Math.PI) / SPIN_SEGMENTS.length;
    // Pointer sits at top (-Math.PI / 2)
    const desiredCenterAngle = -Math.PI / 2 - (targetIndex + 0.5) * sliceAngle;
    const extraRotations = 5 * 2 * Math.PI;
    const currentMod = rotationRef.current % (2 * Math.PI);
    const delta =
      extraRotations + ((desiredCenterAngle - currentMod + 4 * Math.PI) % (2 * Math.PI));

    const startRotation = rotationRef.current;
    const endRotation = startRotation + delta;
    const duration = 4200;
    const startTime = performance.now();

    setSpinning(true);
    setLastResultRwf(null);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      const currentAngle = startRotation + (endRotation - startRotation) * eased;
      rotationRef.current = currentAngle;
      drawWheel(currentAngle);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        setLastResultRwf(chosen.valueRwf);
        onCompleteSpin(chosen.valueRwf);
      }
    };

    requestAnimationFrame(animate);
  };

  const handleCopyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Referral & Spin Stats */}
      <div className="bg-white/95 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-5">
          <p className="text-xs text-slate-500">Available Spin Credits</p>
          <p className="font-mono text-2xl font-semibold text-[#071B38] mt-1 tabular-nums">
            {user.spinCredits} spin{user.spinCredits === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-slate-500 mt-1">Earn +1 free spin per activated referral</p>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500">Invited Active Referrals</p>
          <p className="font-mono text-2xl font-semibold text-emerald-700 mt-1 tabular-nums">
            {referredUsersCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            +{referralCommissionPercent}% commission on deposits &amp; activations
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500">Your Referral Code</p>
          <p className="font-mono text-lg font-semibold text-blue-800 mt-1">{user.referralCode}</p>
          <button
            type="button"
            onClick={handleCopyReferral}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950"
          >
            {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedRef ? 'Copied Referral Link' : 'Copy Referral Link'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive Canvas Wheel */}
        <section className="lg:col-span-7 bg-white/95 border border-slate-200 rounded-xl p-6 flex flex-col items-center">
          <div className="w-full pb-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">E-Finance Lucky Spin Wheel</h2>
              <p className="text-xs text-slate-500">
                Invite friends to unlock free spins and win instant RWF rewards.
              </p>
            </div>
            <Sparkles className="w-5 h-5 text-amber-600" />
          </div>

          <div className="relative mt-6 flex flex-col items-center">
            {/* Top Pointer Triangle */}
            <div
              className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-amber-500 -mb-2 z-10"
              aria-hidden="true"
            />
            <canvas
              ref={canvasRef}
              width={320}
              height={320}
              className="max-w-full h-auto"
              aria-label="E-Finance Lucky Spin Wheel"
            />
          </div>

          {lastResultRwf !== null && (
            <div className="mt-4 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-semibold text-emerald-800 inline-flex items-center gap-2">
              <Gift className="w-4 h-4" />
              <span>Congratulations! You won {formatRwf(lastResultRwf)} — credited to your balance.</span>
            </div>
          )}

          <button
            type="button"
            disabled={spinning || user.spinCredits <= 0}
            onClick={handleSpin}
            className="mt-5 h-11 px-8 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-45 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {spinning
              ? 'Spinning Wheel...'
              : user.spinCredits > 0
                ? `Spin Now (${user.spinCredits} left)`
                : 'No Spin Credits — Invite a Friend'}
          </button>
        </section>

        {/* Referral Share Box + Recent Spin Wins */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-shifting-aurora text-white rounded-xl p-6 space-y-3">
            <p className="text-xs font-semibold text-emerald-300 inline-flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>Referral Program</span>
            </p>
            <h3 className="font-display text-lg font-bold">
              Earn 1 Free Spin + {referralCommissionPercent}% Commission
            </h3>
            <p className="text-xs text-slate-200 leading-relaxed">
              Share your link below. When a referred member registers and activates their account, you immediately earn 1 Free Spin plus {referralCommissionPercent}% commission on their deposits and activation.
            </p>
            <div className="bg-white/10 border border-white/20 rounded-lg p-2.5 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-slate-100 truncate">{referralLink}</span>
              <button
                type="button"
                onClick={handleCopyReferral}
                className="px-2.5 py-1 bg-white text-[#071B38] rounded text-xs font-semibold shrink-0"
              >
                {copiedRef ? 'Copied' : 'Copy'}
              </button>
            </div>
          </section>

          <section className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Your recent spin wins</h3>
            </div>
            {spinHistory.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">No spins recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {spinHistory.slice(0, 6).map((sp) => (
                  <div key={sp.id} className="px-5 py-3 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-500 tabular-nums">
                      {formatDateTime(sp.spunAt)}
                    </span>
                    <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                      +{formatRwf(sp.rewardRwf)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

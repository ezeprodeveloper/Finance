import { CheckCircle2, Clock, AlertCircle, CircleDot } from 'lucide-react';

interface StatusLabelProps {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}

export function StatusLabel({ label, tone }: StatusLabelProps) {
  const toneClasses: Record<StatusLabelProps['tone'], string> = {
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-red-700',
    neutral: 'text-slate-600',
  };

  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'warning'
        ? Clock
        : tone === 'danger'
          ? AlertCircle
          : CircleDot;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${toneClasses[tone]}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

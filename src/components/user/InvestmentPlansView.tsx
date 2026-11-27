import React, { useState } from 'react';
import { PhoneCall, TrendingUp } from 'lucide-react';
import { INVESTMENT_PLAN_TIERS } from '../../data/platformStore';
import {
  InvestmentPlanTier,
  SystemSettings,
  UserInvestment,
} from '../../types/finance';
import {
  buildUssdFullCode,
  buildUssdTelHref,
  formatDateTime,
  formatRwf,
} from '../../utils/formatters';
import { StatusLabel } from '../StatusLabel';

interface InvestmentPlansViewProps {
  settings: SystemSettings;
  investments: UserInvestment[];
  onPurchasePlan: (tier: InvestmentPlanTier, paymentRef: string) => Promise<string | null> | void;
}

export function InvestmentPlansView({
  settings,
  investments,
  onPurchasePlan,
}: InvestmentPlansViewProps) {
  const [selectedTier, setSelectedTier] = useState<InvestmentPlanTier>(INVESTMENT_PLAN_TIERS[0]);
  const [paymentRef, setPaymentRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ussdDisplay = buildUssdFullCode(settings.momoPayCode, selectedTier.depositRwf);
  const ussdHref = buildUssdTelHref(settings.momoPayCode, selectedTier.depositRwf);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setNotice(null);
    if (paymentRef.trim().length < 4) {
      setError('Dial the MoMo USSD code first and enter your Transaction Reference ID.');
      return;
    }
    setSubmitting(true);
    try {
      const err = await onPurchasePlan(selectedTier, paymentRef.trim());
      if (err) {
        setError(err);
        return;
      }
      setPaymentRef('');
      setNotice(
        `Submitted ${selectedTier.name} (${formatRwf(selectedTier.depositRwf)}). Admin will confirm your MoMo deposit and activate daily ${formatRwf(selectedTier.dailyReturnRwf)} payouts.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 10 Daily Return Investment Tiers */}
        <section className="lg:col-span-7 bg-white/95 border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Daily return investment plans</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select a tier to deposit via MoMo USSD and earn automatic daily returns every 24 hours.
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-700 shrink-0" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INVESTMENT_PLAN_TIERS.map((tier) => {
              const selected = selectedTier.id === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedTier(tier)}
                  className={`p-4 rounded-xl border text-left transition-colors ${
                    selected
                      ? 'bg-[#071B38] text-white border-[#071B38]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-base font-bold tabular-nums">
                      {formatRwf(tier.depositRwf)}
                    </span>
                    <span
                      className={`text-xs font-mono font-semibold tabular-nums ${
                        selected ? 'text-emerald-300' : 'text-emerald-700'
                      }`}
                    >
                      +{formatRwf(tier.dailyReturnRwf)} / day
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                    {tier.name} · {tier.durationDays} days cycle
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* USSD Payment & Active Investments */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white/95 border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-200">
              Activate {selectedTier.name}
            </h2>

            <div className="bg-shifting-aurora text-white rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Deposit Amount</span>
                <span className="font-mono font-semibold tabular-nums">{formatRwf(selectedTier.depositRwf)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Daily Return (24h)</span>
                <span className="font-mono font-semibold text-emerald-300 tabular-nums">
                  +{formatRwf(selectedTier.dailyReturnRwf)} / day
                </span>
              </div>
              <div className="pt-2 border-t border-white/15 space-y-2">
                <p className="text-[11px] text-slate-300">Tap below to dial Rwanda MoMo USSD:</p>
                <a
                  href={ussdHref}
                  className="w-full h-10 px-4 bg-white text-[#071B38] hover:bg-slate-100 rounded-lg text-xs font-mono font-bold inline-flex items-center justify-center gap-2"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>{ussdDisplay}</span>
                </a>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label htmlFor="inv-ref" className="block text-xs font-medium text-slate-700 mb-1">
                  MoMo Transaction ID / Reference *
                </label>
                <input
                  id="inv-ref"
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Enter MoMo confirmation reference"
                  required
                  className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-60 text-white text-sm font-semibold rounded-lg"
              >
                {submitting ? 'Submitting Plan...' : 'Submit Plan Deposit'}
              </button>
            </form>
          </section>

          <section className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Your investment plans</h3>
            </div>
            {investments.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">No active plans yet.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {investments.map((inv) => (
                  <div key={inv.id} className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{inv.planName}</span>
                      <StatusLabel
                        label={
                          inv.status === 'active'
                            ? 'Earning Daily'
                            : inv.status === 'completed'
                              ? 'Completed'
                              : inv.status === 'rejected'
                                ? 'Rejected'
                                : 'Pending Admin'
                        }
                        tone={
                          inv.status === 'active' || inv.status === 'completed'
                            ? 'success'
                            : inv.status === 'rejected'
                              ? 'danger'
                              : 'warning'
                        }
                      />
                    </div>
                    <p className="text-xs font-mono text-slate-600 tabular-nums">
                      Deposit: {formatRwf(inv.depositRwf)} · +{formatRwf(inv.dailyReturnRwf)}/day · Earned:{' '}
                      <strong className="text-emerald-700">{formatRwf(inv.totalEarnedRwf)}</strong>
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Started {formatDateTime(inv.createdAt)}
                    </p>
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

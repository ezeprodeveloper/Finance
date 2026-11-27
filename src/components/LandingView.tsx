import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Megaphone,
  Menu,
  ShieldCheck,
  Video,
  Wallet,
  X,
} from 'lucide-react';
import { AdminPromotion, SystemSettings } from '../types/finance';
import { formatShortDate } from '../utils/formatters';

interface LandingViewProps {
  promotions: AdminPromotion[];
  settings: SystemSettings;
  totalActiveVideos: number;
  totalActiveTasks: number;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
}

export function LandingView({
  promotions,
  settings,
  totalActiveVideos,
  totalActiveTasks,
  onOpenLogin,
  onOpenRegister,
}: LandingViewProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const visiblePromotions = promotions.filter((p) => p.active);

  return (
    <div className="min-h-screen flex flex-col bg-shifting-soft text-slate-900">
      {/* Top Bar Contract: strictly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-[#071B38] whitespace-nowrap shrink-0"
          >
            E-Finance
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-700" aria-label="Primary">
            <a href="#announcements" className="hover:text-[#071B38] hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              Announcements
            </a>
            <a href="#services" className="hover:text-[#071B38] hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              Services
            </a>
            <a href="#how-it-works" className="hover:text-[#071B38] hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              How It Works
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenLogin}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[#071B38] hover:bg-[#0c2954] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((p) => !p)}
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden w-10 h-10 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 bg-white"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
            <nav className="flex flex-col space-y-1 text-sm font-medium text-slate-700">
              <a href="#announcements" onClick={() => setMobileNavOpen(false)} className="py-2 px-2 rounded-md hover:bg-slate-50">
                Announcements
              </a>
              <a href="#services" onClick={() => setMobileNavOpen(false)} className="py-2 px-2 rounded-md hover:bg-slate-50">
                Services
              </a>
              <a href="#how-it-works" onClick={() => setMobileNavOpen(false)} className="py-2 px-2 rounded-md hover:bg-slate-50">
                How It Works
              </a>
            </nav>
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                onOpenLogin();
              }}
              className="w-full h-11 bg-[#071B38] text-white text-sm font-semibold rounded-lg"
            >
              Sign In
            </button>
          </div>
        )}
      </header>

      <main id="top" className="flex-1">
        {/* Hero Section with shifting color canvas */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-10 pb-12 lg:pt-14 lg:pb-16">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-7 bg-white/90 backdrop-blur-xs border border-slate-200/90 rounded-2xl p-7 sm:p-10 flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-700 mb-3">
                  E-Finance Rwanda · Digital Financial &amp; Creator Platform
                </p>
                <h1 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] font-bold tracking-tight leading-[1.08] text-[#071B38] text-balance">
                  Save, borrow, promote videos, and earn in Rwandan Francs.
                </h1>
                <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
                  {settings.platformTagline}
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3.5">
                  <button
                    type="button"
                    onClick={onOpenRegister}
                    className="h-12 px-6 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <span>Create Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    className="h-12 px-5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-900 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                  >
                    Sign In
                  </button>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
                <span>Rwanda KYC Verified</span>
                <span aria-hidden="true">·</span>
                <span>MTN Mobile Money &amp; Airtel Money</span>
                <span aria-hidden="true">·</span>
                <span>Full RWF Transaction History</span>
              </div>
            </div>

            {/* Dynamic Shifting Aurora Focal Card */}
            <div className="lg:col-span-5 bg-shifting-aurora text-white rounded-2xl p-7 sm:p-8 border border-slate-800 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="pb-4 border-b border-white/15">
                  <p className="text-xs font-medium text-emerald-300">Rwanda Digital Finance Network</p>
                  <h2 className="font-display text-2xl font-bold text-white mt-1.5">
                    Built for Rwanda&apos;s digital economy
                  </h2>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    Manage personal savings, request financing, and participate in verified video and task campaigns from one unified account.
                  </p>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                    <span className="text-slate-100">
                      Rwanda KYC verification protects every savings plan and Mobile Money withdrawal.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                    <span className="text-slate-100">
                      Every task submission is verified against requirements before rewards release.
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                    <span className="text-slate-100">
                      Complete timestamped ledger with instant CSV statement downloads.
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-slate-200">
                <span>Live platform inventory</span>
                <span className="font-mono tabular-nums">
                  {totalActiveVideos} videos · {totalActiveTasks} tasks
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Public Updates & Promotions visible BEFORE creating an account */}
        <section id="announcements" className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-14">
          <div className="bg-white/95 border border-slate-200 rounded-2xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200">
              <div>
                <p className="text-xs font-semibold text-blue-800 inline-flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4" />
                  <span>E-Finance Updates &amp; Promotions</span>
                </p>
                <h2 className="font-display text-2xl font-bold text-[#071B38] mt-1">
                  Current announcements &amp; platform opportunities
                </h2>
              </div>
              <button
                type="button"
                onClick={onOpenRegister}
                className="text-xs font-semibold text-blue-800 hover:underline whitespace-nowrap shrink-0"
              >
                Register to participate →
              </button>
            </div>

            {visiblePromotions.length === 0 ? (
              <p className="py-8 text-sm text-slate-500">
                No public announcements posted yet.
              </p>
            ) : (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                {visiblePromotions.map((promo) => (
                  <article
                    key={promo.id}
                    className="border border-slate-200 rounded-xl p-5 bg-slate-50/70 flex flex-col justify-between"
                  >
                    <div>
                      <p className="text-xs text-slate-500">
                        {promo.category} · {formatShortDate(promo.createdAt)}
                      </p>
                      <h3 className="font-display text-lg font-semibold text-[#071B38] mt-1">
                        {promo.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed">{promo.summary}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-14">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold text-blue-800 mb-1.5">Core Platform Features</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-[#071B38]">
              Built for Rwandan savers, borrowers, and creators
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <article className="bg-white/95 border border-slate-200 rounded-xl p-6">
              <Wallet className="w-5 h-5 text-blue-800 mb-3" />
              <h3 className="font-display text-lg font-semibold text-[#071B38]">01. Flexible Savings &amp; Loans</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Save RWF anytime after completing Rwanda KYC, or submit loan requests to E-Finance when you need capital, with full transaction history.
              </p>
            </article>

            <article className="bg-white/95 border border-slate-200 rounded-xl p-6">
              <Video className="w-5 h-5 text-emerald-700 mb-3" />
              <h3 className="font-display text-lg font-semibold text-[#071B38]">02. Watch &amp; Upload Short Videos</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Earn RWF by watching approved short videos (once per video), or upload your own promotional video campaign with custom viewer targets.
              </p>
            </article>

            <article className="bg-white/95 border border-slate-200 rounded-xl p-6">
              <ShieldCheck className="w-5 h-5 text-amber-700 mb-3" />
              <h3 className="font-display text-lg font-semibold text-[#071B38]">03. Verified Custom Tasks</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Publish custom tasks with exact requirements. Every submitted proof is verified before rewards are approved, and no user can repeat the same task twice.
              </p>
            </article>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-16">
          <div className="bg-white/95 border border-slate-200 rounded-2xl p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold text-[#071B38] mb-6">
              Account onboarding &amp; verification lifecycle
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="border border-slate-200 rounded-xl p-5">
                <span className="font-mono text-xs font-semibold text-blue-800">01</span>
                <h3 className="text-sm font-semibold text-slate-900 mt-1.5">3-Step Registration</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Provide Personal ID &amp; locked photo, Education (University or A-Level), and Place of Birth &amp; Residence.
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl p-5">
                <span className="font-mono text-xs font-semibold text-blue-800">02</span>
                <h3 className="text-sm font-semibold text-slate-900 mt-1.5">Account Review</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  E-Finance reviews your profile details and identification photo before enabling account activation.
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl p-5">
                <span className="font-mono text-xs font-semibold text-blue-800">03</span>
                <h3 className="text-sm font-semibold text-slate-900 mt-1.5">Dashboard Activation</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Complete account activation from your onboarding screen to unlock your wallet, bonus, and daily check-ins.
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl p-5">
                <span className="font-mono text-xs font-semibold text-blue-800">04</span>
                <h3 className="text-sm font-semibold text-slate-900 mt-1.5">Rwanda KYC for Savings &amp; Cashout</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Submit Rwanda KYC details to unlock Saving Money and Mobile Money withdrawals.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white/95 border-t border-slate-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-slate-600">
          <div>
            <span className="font-display font-bold text-[#071B38]">E-Finance Rwanda</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>© {new Date().getFullYear()} E-Finance Rwanda.</span>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs font-medium">
            <button type="button" onClick={onOpenRegister} className="hover:text-slate-950">
              Register
            </button>
            <button type="button" onClick={onOpenLogin} className="hover:text-slate-950">
              Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

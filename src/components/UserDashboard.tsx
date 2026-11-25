import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Brain,
  CalendarCheck,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  History,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  PhoneCall,
  PiggyBank,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  User as UserIcon,
  Video,
  X,
} from 'lucide-react';
import {
  AirtimeRequest,
  BetSession,
  CustomTask,
  FxExchangeRecord,
  InvestmentPlanTier,
  LoanRequest,
  P2PTransfer,
  RegisteredUser,
  RwandaKycData,
  SavingsGoal,
  ShortVideoCampaign,
  SpinHistoryRecord,
  SystemSettings,
  TaskSubmission,
  TransactionRecord,
  UsdtRequest,
  UserInvestment,
  UserPortalSection,
  WalletAddressRecord,
  WithdrawalRequest,
} from '../types/finance';
import {
  buildUssdFullCode,
  buildUssdTelHref,
  formatDateTime,
  formatRwf,
  formatUsd,
  formatUsdt,
} from '../utils/formatters';
import { ColorChangingClock } from './ColorChangingClock';
import { StatusLabel } from './StatusLabel';
import { InvestmentPlansView } from './user/InvestmentPlansView';
import { LuckySpinWheel } from './user/LuckySpinWheel';
import { QuizBetArena } from './user/QuizBetArena';
import {
  UserKycView,
  UserLoansView,
  UserSavingsView,
  UserWithdrawalsView,
} from './user/UserFinancePanels';
import {
  UserAirtimeView,
  UserExchangeUsdtView,
  UserSendMoneyView,
} from './user/UserServicesPanels';
import { UserTasksView, UserVideosView } from './user/UserVideoTasksPanel';

interface UserDashboardProps {
  user: RegisteredUser;
  referredUsersCount: number;
  settings: SystemSettings;
  savingsGoals: SavingsGoal[];
  loans: LoanRequest[];
  investments: UserInvestment[];
  spinHistory: SpinHistoryRecord[];
  withdrawals: WithdrawalRequest[];
  videoCampaigns: ShortVideoCampaign[];
  customTasks: CustomTask[];
  taskSubmissions: TaskSubmission[];
  betSessions: BetSession[];
  airtimeRequests: AirtimeRequest[];
  p2pTransfers: P2PTransfer[];
  fxExchanges: FxExchangeRecord[];
  usdtRequests: UsdtRequest[];
  transactions: TransactionRecord[];
  onSubmitActivationPayment: (phone: string, ref: string) => void;
  onDailyCheckIn: () => void;
  onSubmitKyc: (data: RwandaKycData) => void;
  onCreateSavingsGoal: (title: string, planType: SavingsGoal['planType'], targetRwf: number, targetDate: string) => void;
  onDepositToSavings: (goalId: string, amountRwf: number) => void;
  onWithdrawFromSavings: (goalId: string, amountRwf: number) => void;
  onRequestLoan: (payload: {
    product: string;
    reason: string;
    principalRwf: number;
    termMonths: number;
    annualRatePercent: number;
    monthlyPaymentRwf: number;
    totalRepayableRwf: number;
  }) => void;
  onRepayLoan: (loanId: string, amountRwf: number) => void;
  onPurchasePlan: (tier: InvestmentPlanTier, paymentRef: string) => void;
  onCompleteSpin: (rewardRwf: number) => void;
  onStartQuizBet: (stakeRwf: number) => void;
  onFinishQuizBet: (session: BetSession) => void;
  onRequestAirtime: (payload: {
    network: 'MTN Rwanda' | 'Airtel Rwanda';
    serviceType: 'Airtime' | 'Internet Bundle';
    phoneNumber: string;
    amountRwf: number;
    bundleLabel?: string;
  }) => void;
  onLookupWalletAddress: (address: string) => Promise<WalletAddressRecord | null>;
  onSendP2P: (payload: {
    receiverId: string;
    receiverName: string;
    receiverAddress: string;
    grossAmountRwf: number;
    note?: string;
  }) => Promise<string | null>;
  onFxExchange: (
    direction: FxExchangeRecord['direction'],
    fromAmount: number,
  ) => Promise<string | null> | string | null;
  onUsdtSavingsMove: (
    action: 'deposit' | 'withdraw',
    amountUsdt: number,
  ) => Promise<string | null> | string | null;
  onCreateUsdtRequest: (payload: {
    actionType: UsdtRequest['actionType'];
    amountUsdt: number;
    network: UsdtRequest['network'];
    destinationOrTxRef: string;
    note?: string;
  }) => Promise<string | null> | string | null;
  onRequestWithdrawal: (payload: {
    network: 'MTN Rwanda' | 'Airtel / Tigo Rwanda';
    destinationType: 'Phone Number' | 'MoMo Pay Code';
    destinationValue: string;
    accountRegisteredNames: string;
    grossAmountRwf: number;
    feePercent: number;
    feeRwf: number;
    netAmountRwf: number;
    isFirstBonusWithdrawal: boolean;
  }) => void;
  onWatchVideoComplete: (campaignId: string) => void;
  onCreateVideoCampaign: (payload: {
    title: string;
    description: string;
    videoUrl: string;
    rewardPerViewRwf: number;
    targetViewers: number;
    paymentRef: string;
  }) => void;
  onSubmitTaskProof: (payload: { taskId: string; proofText: string; proofUrl?: string }) => void;
  onCreateCustomTask: (payload: {
    title: string;
    requirements: string;
    rewardPerCompletionRwf: number;
    targetCompletions: number;
    paymentRef: string;
  }) => void;
  onSignOut: () => void;
}

const NAV_ITEMS: Array<{
  id: UserPortalSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'quiz_bet', label: 'Quiz Bet (10s)', icon: Brain },
  { id: 'send_money', label: 'Send Money', icon: Send },
  { id: 'airtime', label: 'Airtime & Data', icon: Smartphone },
  { id: 'exchange_usdt', label: 'FX USD & USDT', icon: ArrowLeftRight },
  { id: 'invest', label: 'Investment Plans', icon: TrendingUp },
  { id: 'spin', label: 'Lucky Spin & Referrals', icon: Sparkles },
  { id: 'kyc', label: 'Rwanda KYC', icon: ShieldCheck },
  { id: 'savings', label: 'Save Money', icon: PiggyBank },
  { id: 'loans', label: 'Borrow / Loans', icon: Banknote },
  { id: 'withdrawals', label: 'Withdraw', icon: ArrowUpRight },
  { id: 'videos', label: 'Short Videos', icon: Video },
  { id: 'tasks', label: 'Paid Tasks', icon: ClipboardCheck },
  { id: 'transactions', label: 'History', icon: History },
  { id: 'profile', label: 'My Profile', icon: UserIcon },
];

export function UserDashboard(props: UserDashboardProps) {
  const { user, settings } = props;
  const [section, setSection] = useState<UserPortalSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSelectSection = (next: UserPortalSection) => {
    if (next === section) return;
    setSection(next);
  };

  // Activation payment & address copy state
  const [actPhone, setActPhone] = useState(user.phone);
  const [actRef, setActRef] = useState('');
  const [copiedActCode, setCopiedActCode] = useState(false);
  const [copiedWalletAddr, setCopiedWalletAddr] = useState(false);

  // Transactions filter
  const [txSearch, setTxSearch] = useState('');
  const [txCat, setTxCat] = useState<string>('All');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const lastCheckInMs = user.lastCheckInAt ? Date.parse(user.lastCheckInAt) : 0;
  const msRemainingForCheckIn = lastCheckInMs > 0 ? Math.max(0, lastCheckInMs + 86400000 - nowMs) : 0;
  const checkInAvailable = msRemainingForCheckIn === 0;

  useEffect(() => {
    if (checkInAvailable) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [checkInAvailable]);

  const formatCountdown = (ms: number): string => {
    const totalSec = Math.ceil(ms / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
  };

  const userSavings = props.savingsGoals.filter((g) => g.userId === user.id);
  const userLoans = props.loans.filter((l) => l.userId === user.id);
  const userInvestments = props.investments.filter((inv) => inv.userId === user.id);
  const userSpins = props.spinHistory.filter((s) => s.userId === user.id);
  const userWithdrawals = props.withdrawals.filter((w) => w.userId === user.id);
  const userTransactions = props.transactions.filter((t) => t.userId === user.id);

  const activeLoanBalanceRwf = userLoans
    .filter((l) => l.status === 'approved')
    .reduce((sum, l) => sum + Math.max(0, l.totalRepayableRwf - l.repaidRwf), 0);

  const filteredTransactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return userTransactions.filter((tx) => {
      if (txCat !== 'All' && tx.category !== txCat) return false;
      if (!q) return true;
      return (
        tx.title.toLowerCase().includes(q) ||
        tx.reference.toLowerCase().includes(q) ||
        tx.channel.toLowerCase().includes(q)
      );
    });
  }, [userTransactions, txSearch, txCat]);

  const handleExportCsv = () => {
    const headers = ['Reference', 'Timestamp', 'Title', 'Category', 'Channel', 'Direction', 'Amount RWF', 'Fee RWF', 'Status'];
    const rows = filteredTransactions.map((tx) => [
      tx.reference,
      tx.timestamp,
      `"${tx.title.replace(/"/g, '""')}"`,
      tx.category,
      `"${tx.channel.replace(/"/g, '""')}"`,
      tx.direction,
      String(tx.amountRwf),
      String(tx.feeRwf ?? 0),
      tx.status,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `efinance-${user.accountNumber}-history.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ------------------------------------------------------------------------ */
  /* Gate 1: Waiting for Admin Approval                                       */
  /* ------------------------------------------------------------------------ */
  if (user.accountStatus === 'pending_approval') {
    return (
      <div className="min-h-screen bg-shifting-aurora text-white flex flex-col">
        <header className="px-4 sm:px-8 h-16 border-b border-white/15 flex items-center justify-between gap-4">
          <span className="font-display text-lg font-bold">E-Finance Rwanda</span>
          <div className="flex items-center gap-3">
            <ColorChangingClock darkSurface />
            <button
              type="button"
              onClick={props.onSignOut}
              className="h-9 px-3.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white text-slate-900 rounded-2xl p-7 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center gap-4">
              {user.photoDataUrl && (
                <img
                  src={user.photoDataUrl}
                  alt={`${user.firstName} ${user.secondName}`}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                />
              )}
              <div>
                <p className="text-xs font-semibold text-amber-700 inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Awaiting E-Finance Admin Approval</span>
                </p>
                <h1 className="font-display text-xl font-bold text-[#071B38] mt-0.5">
                  Hello, {user.firstName} {user.secondName}
                </h1>
                <p className="font-mono text-xs text-slate-500">{user.accountNumber}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Your 3-step registration has been received. E-Finance Admin is verifying your personal identification, education details, and uploaded photo. Once approved, you will unlock the{' '}
              <strong>{formatRwf(settings.activationFeeRwf)} system activation</strong> step and receive your{' '}
              <strong>{formatRwf(settings.welcomeBonusRwf)} welcome bonus</strong>.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-1.5 text-slate-700">
              <p>
                <strong>Education:</strong> {user.education.type} — {user.education.institutionName} ({user.education.levelOrClass}, {user.education.facultyOrCombination})
              </p>
              <p>
                <strong>National ID:</strong> <span className="font-mono">{user.idNumber}</span>
              </p>
              <p>
                <strong>Place of Birth:</strong> {user.residence.placeOfBirth}
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Gate 2: 200 RWF System Activation Payment Dashboard                      */
  /* ------------------------------------------------------------------------ */
  if (user.accountStatus === 'awaiting_payment' || user.accountStatus === 'payment_submitted') {
    const activationCode = buildUssdFullCode(settings.momoPayCode, settings.activationFeeRwf);
    const activationHref = buildUssdTelHref(settings.momoPayCode, settings.activationFeeRwf);
    return (
      <div className="min-h-screen bg-shifting-aurora text-white flex flex-col">
        <header className="px-4 sm:px-8 h-16 border-b border-white/15 flex items-center justify-between gap-4">
          <span className="font-display text-lg font-bold">E-Finance Rwanda</span>
          <div className="flex items-center gap-3">
            <ColorChangingClock darkSurface />
            <button
              type="button"
              onClick={props.onSignOut}
              className="h-9 px-3.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white text-slate-900 rounded-2xl p-7 sm:p-8 shadow-2xl space-y-5">
            <div>
              <p className="text-xs font-semibold text-emerald-700">Registration Approved by Admin</p>
              <h1 className="font-display text-2xl font-bold text-[#071B38] mt-1">
                Activate your E-Finance Dashboard ({formatRwf(settings.activationFeeRwf)})
              </h1>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                Pay the {formatRwf(settings.activationFeeRwf)} system activation fee below. Once verified by E-Finance Admin, your full dashboard opens with a{' '}
                <strong>{formatRwf(settings.welcomeBonusRwf)} welcome bonus</strong> in your balance.
              </p>
            </div>

            <div className="bg-[#071B38] text-white rounded-xl p-5 space-y-3">
              <div>
                <p className="text-xs text-slate-300">Tap to Dial Rwanda MoMo USSD Code</p>
                <a
                  href={activationHref}
                  className="font-mono text-2xl font-bold text-emerald-300 hover:underline mt-1 inline-flex items-center gap-2 tabular-nums"
                >
                  <PhoneCall className="w-5 h-5" />
                  <span>{activationCode}</span>
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={activationHref}
                  className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Dial Now</span>
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(activationCode);
                      setCopiedActCode(true);
                      setTimeout(() => setCopiedActCode(false), 1800);
                    } catch {
                      // ignore
                    }
                  }}
                  className="h-9 px-3 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedActCode ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>
            </div>

            {user.accountStatus === 'payment_submitted' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1">
                <p className="font-semibold">Activation payment confirmation submitted</p>
                <p>
                  MoMo Ref: <span className="font-mono font-semibold">{user.activationPaymentRef}</span> · Phone:{' '}
                  <span className="font-mono">{user.activationPaidPhone}</span>
                </p>
                <p>E-Finance Admin is confirming your {formatRwf(settings.activationFeeRwf)} transfer.</p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (actRef.trim().length < 4) return;
                  props.onSubmitActivationPayment(actPhone.trim(), actRef.trim());
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="act-phone" className="block text-xs font-medium text-slate-700 mb-1">
                    Mobile Money Number Used *
                  </label>
                  <input
                    id="act-phone"
                    type="tel"
                    value={actPhone}
                    onChange={(e) => setActPhone(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="act-ref" className="block text-xs font-medium text-slate-700 mb-1">
                    MoMo Transaction ID / Reference *
                  </label>
                  <input
                    id="act-ref"
                    type="text"
                    value={actRef}
                    onChange={(e) => setActRef(e.target.value)}
                    placeholder="Enter Transaction ID after paying 200 RWF"
                    required
                    className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-11 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg"
                >
                  Confirm {formatRwf(settings.activationFeeRwf)} Payment
                </button>
              </form>
            )}
          </div>
        </main>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Active Member Dashboard                                                  */
  /* ------------------------------------------------------------------------ */
  const activeNav = NAV_ITEMS.find((n) => n.id === section) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-shifting-soft text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-shifting-aurora text-white shrink-0">
        <div className="h-16 px-5 border-b border-white/15 flex items-center justify-between">
          <span className="font-display text-lg font-bold tracking-tight">E-Finance Rwanda</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Member navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSection(item.id)}
                className={`w-full h-10 px-3 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-[#071B38] font-semibold'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/15 space-y-3">
          <div className="flex items-center gap-2.5">
            {user.photoDataUrl && (
              <img
                src={user.photoDataUrl}
                alt={`${user.firstName} ${user.secondName}`}
                className="w-9 h-9 rounded-lg object-cover border border-white/25 shrink-0"
              />
            )}
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-white truncate">
                {user.firstName} {user.secondName}
              </p>
              <p className="font-mono text-slate-300 truncate">{user.accountNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={props.onSignOut}
            className="w-full h-9 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          <aside className="relative w-72 max-w-full bg-shifting-aurora text-white h-full flex flex-col z-10">
            <div className="h-16 px-5 border-b border-white/15 flex items-center justify-between">
              <span className="font-display text-base font-bold">E-Finance Rwanda</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close menu"
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      handleSelectSection(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full h-10 px-3 rounded-lg text-sm font-medium flex items-center gap-3 ${
                      isActive ? 'bg-white text-[#071B38] font-semibold' : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/15">
              <button
                type="button"
                onClick={props.onSignOut}
                className="w-full h-10 bg-white/15 rounded-lg text-xs font-semibold text-white"
              >
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="lg:hidden w-10 h-10 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 hidden sm:block">E-Finance Rwanda Member</p>
              <h1 className="font-display text-base font-bold text-[#071B38] truncate">
                {activeNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <ColorChangingClock />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1200px] w-full mx-auto">
          {section === 'overview' && (
            <div className="space-y-6">
              {/* 4-column balance strip */}
              <div className="bg-white/95 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                <div className="p-5">
                  <p className="text-xs text-slate-500">Main Wallet Balance</p>
                  <p className="font-mono text-2xl font-semibold text-[#071B38] mt-1 tabular-nums">
                    {formatRwf(user.walletBalanceRwf)}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-mono">{user.accountNumber}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(user.accountNumber);
                          setCopiedWalletAddr(true);
                          setTimeout(() => setCopiedWalletAddr(false), 1800);
                        } catch {
                          // ignore
                        }
                      }}
                      className="text-[11px] font-semibold text-blue-800 hover:underline inline-flex items-center gap-0.5"
                    >
                      {copiedWalletAddr ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedWalletAddr ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">Savings Vault Balance</p>
                  <p className="font-mono text-2xl font-semibold text-emerald-700 mt-1 tabular-nums">
                    {formatRwf(user.savingsBalanceRwf)}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectSection('savings')}
                    className="text-xs font-semibold text-blue-800 hover:underline mt-1"
                  >
                    Manage savings →
                  </button>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">Welcome Bonus &amp; Spins</p>
                  <p className="font-mono text-2xl font-semibold text-amber-700 mt-1 tabular-nums">
                    {formatRwf(user.bonusBalanceRwf)}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectSection('spin')}
                    className="text-xs font-semibold text-blue-800 hover:underline mt-1"
                  >
                    {user.spinCredits} Lucky Spin{user.spinCredits === 1 ? '' : 's'} available →
                  </button>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">Active Loan Balance</p>
                  <p className="font-mono text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
                    {formatRwf(activeLoanBalanceRwf)}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <StatusLabel
                      label={
                        user.kycStatus === 'approved'
                          ? 'KYC Verified'
                          : user.kycStatus === 'pending'
                            ? 'KYC Pending'
                            : 'KYC Required'
                      }
                      tone={
                        user.kycStatus === 'approved'
                          ? 'success'
                          : user.kycStatus === 'pending'
                            ? 'warning'
                            : 'danger'
                      }
                    />
                    {user.kycStatus !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => handleSelectSection('kyc')}
                        className="text-xs font-semibold text-blue-800 hover:underline"
                      >
                        Verify →
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Multi-Currency & Quick Services Strip */}
              <div className="bg-white/95 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-6 text-xs">
                  <div>
                    <span className="text-slate-500 block">USD Balance</span>
                    <span className="font-mono text-sm font-bold text-blue-800 tabular-nums">
                      {formatUsd(user.walletBalanceUsd ?? 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">USDT Wallet</span>
                    <span className="font-mono text-sm font-bold text-emerald-700 tabular-nums">
                      {formatUsdt(user.usdtBalance ?? 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">USDT Savings</span>
                    <span className="font-mono text-sm font-bold text-amber-700 tabular-nums">
                      {formatUsdt(user.usdtSavingsBalance ?? 0)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectSection('quiz_bet')}
                    className="h-8 px-3 bg-[#071B38] text-white text-xs font-semibold rounded-lg"
                  >
                    Play 10s Quiz Bet
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSection('send_money')}
                    className="h-8 px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg"
                  >
                    Send Money
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSection('airtime')}
                    className="h-8 px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg"
                  >
                    Buy Airtime / Data
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSection('exchange_usdt')}
                    className="h-8 px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg"
                  >
                    FX USD &amp; USDT
                  </button>
                </div>
              </div>

              {/* Daily Check-in Card (strict 24h) + Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <section className="lg:col-span-5 bg-shifting-aurora text-white rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold text-emerald-300 inline-flex items-center gap-1.5">
                      <CalendarCheck className="w-4 h-4" />
                      <span>Daily 24-Hour Check-In · Streak {user.checkInStreak}</span>
                    </p>
                    <h2 className="font-display text-xl font-bold mt-2">
                      Claim your {formatRwf(settings.dailyCheckInRwf)} every 24 hours
                    </h2>
                    <p className="text-xs text-slate-200 mt-1.5 leading-relaxed">
                      Every 24 hours you can claim {formatRwf(settings.dailyCheckInRwf)} directly to your Main Wallet balance.
                    </p>
                  </div>
                  <div className="mt-6">
                    {!checkInAvailable ? (
                      <div className="w-full h-11 px-4 bg-white/15 rounded-lg text-xs font-semibold inline-flex items-center justify-between gap-2 text-emerald-300">
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Check-In Claimed</span>
                        </span>
                        <span className="font-mono text-white tabular-nums">
                          Next in {formatCountdown(msRemainingForCheckIn)}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          props.onDailyCheckIn();
                          setNowMs(Date.now());
                        }}
                        className="w-full h-11 px-4 bg-white text-[#071B38] hover:bg-slate-100 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Claim {formatRwf(settings.dailyCheckInRwf)} Now
                      </button>
                    )}
                  </div>
                </section>

                <section className="lg:col-span-7 bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">Recent activity</h2>
                    <button
                      type="button"
                      onClick={() => handleSelectSection('transactions')}
                      className="text-xs font-semibold text-blue-800 hover:underline"
                    >
                      View all →
                    </button>
                  </div>
                  {userTransactions.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No transactions recorded yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {userTransactions.slice(0, 5).map((tx) => (
                        <div key={tx.id} className="px-6 py-3 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{tx.title}</p>
                            <p className="text-xs text-slate-500 font-mono">
                              {tx.reference} · {formatDateTime(tx.timestamp)}
                            </p>
                          </div>
                          <span
                            className={`font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
                              tx.direction === 'credit' ? 'text-emerald-700' : 'text-slate-900'
                            }`}
                          >
                            {tx.direction === 'credit' ? '+' : '-'}
                            {formatRwf(tx.amountRwf)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {section === 'quiz_bet' && (
            <QuizBetArena
              user={user}
              betSessions={props.betSessions}
              onStartBet={props.onStartQuizBet}
              onFinishBet={props.onFinishQuizBet}
            />
          )}

          {section === 'airtime' && (
            <UserAirtimeView
              user={user}
              requests={props.airtimeRequests}
              onRequestAirtime={props.onRequestAirtime}
            />
          )}

          {section === 'send_money' && (
            <UserSendMoneyView
              user={user}
              settings={settings}
              transfers={props.p2pTransfers}
              onLookupAddress={props.onLookupWalletAddress}
              onSendMoney={props.onSendP2P}
            />
          )}

          {section === 'exchange_usdt' && (
            <UserExchangeUsdtView
              user={user}
              settings={settings}
              fxExchanges={props.fxExchanges}
              usdtRequests={props.usdtRequests}
              onFxExchange={props.onFxExchange}
              onUsdtSavingsMove={props.onUsdtSavingsMove}
              onCreateUsdtRequest={props.onCreateUsdtRequest}
            />
          )}

          {section === 'invest' && (
            <InvestmentPlansView
              settings={settings}
              investments={userInvestments}
              onPurchasePlan={props.onPurchasePlan}
            />
          )}

          {section === 'spin' && (
            <LuckySpinWheel
              user={user}
              referredUsersCount={props.referredUsersCount}
              referralCommissionPercent={settings.referralCommissionPercent}
              spinHistory={userSpins}
              onCompleteSpin={props.onCompleteSpin}
            />
          )}

          {section === 'kyc' && (
            <UserKycView user={user} onSubmitKyc={props.onSubmitKyc} />
          )}

          {section === 'savings' && (
            <UserSavingsView
              user={user}
              goals={userSavings}
              onGoToKyc={() => handleSelectSection('kyc')}
              onCreateGoal={props.onCreateSavingsGoal}
              onDepositToSavings={props.onDepositToSavings}
              onWithdrawFromSavings={props.onWithdrawFromSavings}
            />
          )}

          {section === 'loans' && (
            <UserLoansView
              user={user}
              loans={userLoans}
              onGoToSavings={() => handleSelectSection('savings')}
              onRequestLoan={props.onRequestLoan}
              onRepayLoan={props.onRepayLoan}
            />
          )}

          {section === 'withdrawals' && (
            <UserWithdrawalsView
              user={user}
              settings={settings}
              withdrawals={userWithdrawals}
              onGoToKyc={() => handleSelectSection('kyc')}
              onRequestWithdrawal={props.onRequestWithdrawal}
            />
          )}

          {section === 'videos' && (
            <UserVideosView
              user={user}
              settings={settings}
              campaigns={props.videoCampaigns}
              onWatchComplete={props.onWatchVideoComplete}
              onCreateVideoCampaign={props.onCreateVideoCampaign}
            />
          )}

          {section === 'tasks' && (
            <UserTasksView
              user={user}
              settings={settings}
              tasks={props.customTasks}
              submissions={props.taskSubmissions}
              onSubmitTaskProof={props.onSubmitTaskProof}
              onCreateCustomTask={props.onCreateCustomTask}
            />
          )}

          {section === 'transactions' && (
            <div className="space-y-5">
              <div className="bg-white/95 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    'All',
                    'Bonus',
                    'Check-In',
                    'Savings',
                    'Loan',
                    'Quiz Bet',
                    'Quiz Win',
                    'Airtime & Data',
                    'Transfer Sent',
                    'Transfer Received',
                    'Currency Exchange',
                    'USDT Deposit',
                    'USDT Savings',
                    'USDT Send / Withdraw',
                    'Investment ROI',
                    'Investment Deposit',
                    'Spin Win',
                    'Referral Commission',
                    'Withdrawal',
                    'Video Reward',
                    'Task Reward',
                    'Campaign Payment',
                  ].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTxCat(cat)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md border ${
                        txCat === cat
                          ? 'bg-[#071B38] text-white border-[#071B38]'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      placeholder="Search ledger..."
                      className="h-9 pl-9 pr-3 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={filteredTransactions.length === 0}
                    className="h-9 px-3 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              <div className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
                {filteredTransactions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No matching transactions found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                          <th className="py-2.5 px-4">Reference</th>
                          <th className="py-2.5 px-4">Operation</th>
                          <th className="py-2.5 px-4">Category</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-4 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {filteredTransactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-3 px-4 font-mono text-xs text-slate-600">{tx.reference}</td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-900">{tx.title}</p>
                              <p className="text-xs text-slate-500">{tx.channel}</p>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600">{tx.category}</td>
                            <td className="py-3 px-4">
                              <StatusLabel
                                label={tx.status}
                                tone={
                                  tx.status === 'Completed'
                                    ? 'success'
                                    : tx.status === 'Rejected'
                                      ? 'danger'
                                      : 'warning'
                                }
                              />
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-slate-500 tabular-nums">
                              {formatDateTime(tx.timestamp)}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono font-semibold tabular-nums ${
                                tx.direction === 'credit' ? 'text-emerald-700' : 'text-slate-900'
                              }`}
                            >
                              {tx.direction === 'credit' ? '+' : '-'}
                              {formatRwf(tx.amountRwf)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {section === 'profile' && (
            <div className="bg-white/95 border border-slate-200 rounded-xl p-6 max-w-3xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-4">
                  {user.photoDataUrl && (
                    <img
                      src={user.photoDataUrl}
                      alt={`${user.firstName} ${user.secondName}`}
                      className="w-20 h-20 rounded-xl object-cover border border-slate-300"
                    />
                  )}
                  <div>
                    <h2 className="font-display text-xl font-bold text-[#071B38]">
                      {user.firstName} {user.secondName}
                    </h2>
                    <p className="font-mono text-xs text-slate-500 mt-0.5">{user.accountNumber}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Photo &amp; ID Locked (Admin Only Edit)</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-slate-500 block">Email</span>
                  <span className="font-medium text-slate-900">{user.email}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Phone Number</span>
                  <span className="font-mono text-slate-900">{user.phone}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Gender &amp; Date of Birth</span>
                  <span className="text-slate-900">
                    {user.gender} · {user.dateOfBirth}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">National ID Number</span>
                  <span className="font-mono text-slate-900">{user.idNumber}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Education Background ({user.education.type})</span>
                  <span className="text-slate-900">
                    {user.education.institutionName} · {user.education.levelOrClass} · {user.education.facultyOrCombination}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Place of Birth &amp; Residence</span>
                  <span className="text-slate-900">
                    Born: {user.residence.placeOfBirth}
                    {user.residence.akarere ? ` · ${user.residence.akarere}` : ''}
                    {user.residence.umurenge ? ` / ${user.residence.umurenge}` : ''}
                    {user.residence.akagari ? ` / ${user.residence.akagari}` : ''}
                    {user.residence.umudugudu ? ` / ${user.residence.umudugudu}` : ''}
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

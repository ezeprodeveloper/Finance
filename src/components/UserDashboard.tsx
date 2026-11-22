import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  GitBranch,
  History,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  PiggyBank,
  Search,
  ShieldCheck,
  User as UserIcon,
  Video,
  X,
} from 'lucide-react';
import {
  CustomTask,
  GitHubConfig,
  LoanRequest,
  RegisteredUser,
  RwandaKycData,
  SavingsGoal,
  ShortVideoCampaign,
  SystemSettings,
  TaskSubmission,
  TransactionRecord,
  UserPortalSection,
  WithdrawalRequest,
} from '../types/finance';
import {
  buildMomoPayCode,
  formatDateTime,
  formatRwf,
  todayRwandaDateKey,
} from '../utils/formatters';
import { ColorChangingClock } from './ColorChangingClock';
import { GitHubHostModule } from './portal/GitHubHostModule';
import { StatusLabel } from './StatusLabel';
import {
  UserKycView,
  UserLoansView,
  UserSavingsView,
  UserWithdrawalsView,
} from './user/UserFinancePanels';
import { UserTasksView, UserVideosView } from './user/UserVideoTasksPanel';

interface UserDashboardProps {
  user: RegisteredUser;
  settings: SystemSettings;
  savingsGoals: SavingsGoal[];
  loans: LoanRequest[];
  withdrawals: WithdrawalRequest[];
  videoCampaigns: ShortVideoCampaign[];
  customTasks: CustomTask[];
  taskSubmissions: TaskSubmission[];
  transactions: TransactionRecord[];
  githubConfig: GitHubConfig | null;
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
  onRequestWithdrawal: (payload: {
    provider: 'MTN Mobile Money' | 'Airtel Money';
    phone: string;
    grossAmountRwf: number;
    feePercent: number;
    feeRwf: number;
    netAmountRwf: number;
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
  onSaveGitHubConfig: (next: GitHubConfig | null) => void;
  onSignOut: () => void;
}

const NAV_ITEMS: Array<{
  id: UserPortalSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'kyc', label: 'Rwanda KYC', icon: ShieldCheck },
  { id: 'savings', label: 'Save Money', icon: PiggyBank },
  { id: 'loans', label: 'Borrow / Loans', icon: Banknote },
  { id: 'withdrawals', label: 'Withdraw (25% fee)', icon: ArrowUpRight },
  { id: 'videos', label: 'Short Videos', icon: Video },
  { id: 'tasks', label: 'Paid Tasks', icon: ClipboardCheck },
  { id: 'transactions', label: 'History', icon: History },
  { id: 'profile', label: 'My Profile', icon: UserIcon },
  { id: 'github', label: 'GitHub Host', icon: GitBranch },
];

export function UserDashboard(props: UserDashboardProps) {
  const { user, settings } = props;
  const [section, setSection] = useState<UserPortalSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Activation payment state
  const [actPhone, setActPhone] = useState(user.phone);
  const [actRef, setActRef] = useState('');
  const [copiedActCode, setCopiedActCode] = useState(false);

  // Transactions filter
  const [txSearch, setTxSearch] = useState('');
  const [txCat, setTxCat] = useState<string>('All');

  const todayKey = todayRwandaDateKey();
  const checkedInToday = user.lastCheckInDate === todayKey;

  const userSavings = props.savingsGoals.filter((g) => g.userId === user.id);
  const userLoans = props.loans.filter((l) => l.userId === user.id);
  const userWithdrawals = props.withdrawals.filter((w) => w.userId === user.id);
  const userTransactions = props.transactions.filter((t) => t.userId === user.id);

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
    const activationCode = buildMomoPayCode(settings.momoPayCode, settings.activationFeeRwf);
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

            <div className="bg-[#071B38] text-white rounded-xl p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-300">Dial Rwanda MoMo Payment Code</p>
                <p className="font-mono text-2xl font-bold text-emerald-300 mt-1 tabular-nums">
                  {activationCode}
                </p>
              </div>
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
                <span>{copiedActCode ? 'Copied' : 'Copy'}</span>
              </button>
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
                onClick={() => setSection(item.id)}
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
                      setSection(item.id);
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
                  <p className="text-xs text-slate-500">Available Wallet Balance</p>
                  <p className="font-mono text-2xl font-semibold text-[#071B38] mt-1 tabular-nums">
                    {formatRwf(user.walletBalanceRwf)}
                  </p>
                  <p className="text-xs text-slate-500 font-mono mt-1">{user.accountNumber}</p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">Total Saved</p>
                  <p className="font-mono text-2xl font-semibold text-emerald-700 mt-1 tabular-nums">
                    {formatRwf(user.savingsBalanceRwf)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSection('savings')}
                    className="text-xs font-semibold text-blue-800 hover:underline mt-1"
                  >
                    Manage savings →
                  </button>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">Rwanda KYC Status</p>
                  <div className="mt-2">
                    <StatusLabel
                      label={
                        user.kycStatus === 'approved'
                          ? 'Approved'
                          : user.kycStatus === 'pending'
                            ? 'Pending Review'
                            : user.kycStatus === 'rejected'
                              ? 'Rejected'
                              : 'Required for Save/Withdraw'
                      }
                      tone={
                        user.kycStatus === 'approved'
                          ? 'success'
                          : user.kycStatus === 'pending'
                            ? 'warning'
                            : 'danger'
                      }
                    />
                  </div>
                  {user.kycStatus !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => setSection('kyc')}
                      className="text-xs font-semibold text-blue-800 hover:underline mt-1.5 block"
                    >
                      Complete KYC →
                    </button>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">Daily Check-In Bonus</p>
                  <p className="font-mono text-xl font-semibold text-slate-900 mt-1 tabular-nums">
                    +{formatRwf(settings.dailyCheckInRwf)} / day
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Streak: {user.checkInStreak} days</p>
                </div>
              </div>

              {/* Daily Check-in Card + Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <section className="lg:col-span-5 bg-shifting-aurora text-white rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold text-emerald-300 inline-flex items-center gap-1.5">
                      <CalendarCheck className="w-4 h-4" />
                      <span>Daily Member Check-In</span>
                    </p>
                    <h2 className="font-display text-xl font-bold mt-2">
                      Claim your daily {formatRwf(settings.dailyCheckInRwf)} reward
                    </h2>
                    <p className="text-xs text-slate-200 mt-1.5 leading-relaxed">
                      Sign in once every day (Rwanda Kigali date {todayKey}) to add {formatRwf(settings.dailyCheckInRwf)} directly to your wallet balance.
                    </p>
                  </div>
                  <div className="mt-6">
                    {checkedInToday ? (
                      <div className="h-11 px-4 bg-white/15 rounded-lg text-xs font-semibold inline-flex items-center gap-2 text-emerald-300">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Today&apos;s {formatRwf(settings.dailyCheckInRwf)} Check-In Claimed</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={props.onDailyCheckIn}
                        className="w-full h-11 px-4 bg-white text-[#071B38] hover:bg-slate-100 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Claim Today&apos;s {formatRwf(settings.dailyCheckInRwf)}
                      </button>
                    )}
                  </div>
                </section>

                <section className="lg:col-span-7 bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">Recent activity</h2>
                    <button
                      type="button"
                      onClick={() => setSection('transactions')}
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

          {section === 'kyc' && (
            <UserKycView user={user} onSubmitKyc={props.onSubmitKyc} />
          )}

          {section === 'savings' && (
            <UserSavingsView
              user={user}
              goals={userSavings}
              onGoToKyc={() => setSection('kyc')}
              onCreateGoal={props.onCreateSavingsGoal}
              onDepositToSavings={props.onDepositToSavings}
              onWithdrawFromSavings={props.onWithdrawFromSavings}
            />
          )}

          {section === 'loans' && (
            <UserLoansView
              user={user}
              loans={userLoans}
              onRequestLoan={props.onRequestLoan}
              onRepayLoan={props.onRepayLoan}
            />
          )}

          {section === 'withdrawals' && (
            <UserWithdrawalsView
              user={user}
              settings={settings}
              withdrawals={userWithdrawals}
              onGoToKyc={() => setSection('kyc')}
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
                  {['All', 'Bonus', 'Check-In', 'Savings', 'Loan', 'Withdrawal', 'Video Reward', 'Task Reward', 'Campaign Payment'].map(
                    (cat) => (
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
                    ),
                  )}
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

          {section === 'github' && (
            <GitHubHostModule config={props.githubConfig} onSaveConfig={props.onSaveGitHubConfig} />
          )}
        </main>
      </div>
    </div>
  );
}

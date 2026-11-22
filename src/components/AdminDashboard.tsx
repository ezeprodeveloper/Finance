import React, { useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Globe,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  AdminPortalSection,
  AdminPromotion,
  CustomTask,
  LoanRequest,
  RegisteredUser,
  ShortVideoCampaign,
  SystemSettings,
  TaskSubmission,
  UserInvestment,
  WithdrawalRequest,
} from '../types/finance';
import { formatDateTime, formatRwf, readFileAsDataUrl } from '../utils/formatters';
import { ColorChangingClock } from './ColorChangingClock';
import { StatusLabel } from './StatusLabel';

interface AdminDashboardProps {
  users: RegisteredUser[];
  loans: LoanRequest[];
  investments: UserInvestment[];
  withdrawals: WithdrawalRequest[];
  videoCampaigns: ShortVideoCampaign[];
  customTasks: CustomTask[];
  taskSubmissions: TaskSubmission[];
  promotions: AdminPromotion[];
  settings: SystemSettings;
  cloudConnected: boolean;
  onTriggerPageLoad: (label?: string) => void;
  onConnectAdminCloud: () => Promise<void>;
  onApproveUserRegistration: (userId: string) => void;
  onActivateUserWithBonus: (userId: string) => void;
  onToggleSuspendUser: (userId: string) => void;
  onAdminUpdateUser: (updated: RegisteredUser) => void;
  onReviewKyc: (userId: string, decision: 'approved' | 'rejected', note?: string) => void;
  onReviewVideoCampaign: (campaignId: string, decision: 'active' | 'rejected') => void;
  onReviewCustomTask: (taskId: string, decision: 'active' | 'rejected') => void;
  onReviewTaskSubmission: (submissionId: string, decision: 'approved' | 'rejected', note?: string) => void;
  onReviewLoan: (loanId: string, decision: 'approved' | 'rejected') => void;
  onReviewInvestment: (investmentId: string, decision: 'active' | 'rejected') => void;
  onReviewWithdrawal: (withdrawalId: string, decision: 'paid' | 'rejected') => void;
  onAddPromotion: (title: string, category: string, summary: string) => void;
  onTogglePromotion: (promoId: string) => void;
  onDeletePromotion: (promoId: string) => void;
  onUpdateSettings: (next: SystemSettings) => void;
  onSignOut: () => void;
}

const ADMIN_NAV: Array<{
  id: AdminPortalSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Admin Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users & Photos', icon: Users },
  { id: 'kyc', label: 'Rwanda KYC Desk', icon: ShieldCheck },
  { id: 'videos_tasks', label: 'Videos & Tasks', icon: Video },
  { id: 'loans_withdrawals', label: 'Loans & Payouts', icon: Banknote },
  { id: 'promotions', label: 'Public Promotions', icon: Megaphone },
  { id: 'settings', label: 'System Settings', icon: Settings },
];

export function AdminDashboard(props: AdminDashboardProps) {
  const [section, setSection] = useState<AdminPortalSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);

  const handleSelectSection = (next: AdminPortalSection) => {
    if (next === section) return;
    props.onTriggerPageLoad('Loading section...');
    setSection(next);
  };

  // User editor modal state
  const [editingUser, setEditingUser] = useState<RegisteredUser | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // KYC note
  const [kycNotes, setKycNotes] = useState<Record<string, string>>({});

  // Promotion form
  const [promoTitle, setPromoTitle] = useState('');
  const [promoCat, setPromoCat] = useState('Official Announcement');
  const [promoSummary, setPromoSummary] = useState('');

  // Settings draft
  const [settingsDraft, setSettingsDraft] = useState<SystemSettings>(props.settings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const pendingRegistrations = props.users.filter((u) => u.accountStatus === 'pending_approval').length;
  const pendingActivations = props.users.filter(
    (u) => u.accountStatus === 'awaiting_payment' || u.accountStatus === 'payment_submitted',
  ).length;
  const pendingKyc = props.users.filter((u) => u.kycStatus === 'pending').length;
  const pendingVideos = props.videoCampaigns.filter((v) => v.status === 'pending_admin').length;
  const pendingTasks = props.customTasks.filter((t) => t.status === 'pending_admin').length;
  const pendingSubmissions = props.taskSubmissions.filter((s) => s.status === 'pending_admin').length;
  const pendingLoans = props.loans.filter((l) => l.status === 'pending_admin').length;
  const pendingInvestments = props.investments.filter((i) => i.status === 'pending_admin').length;
  const pendingWithdrawals = props.withdrawals.filter((w) => w.status === 'pending_admin').length;

  const totalWithdrawalFees = props.withdrawals
    .filter((w) => w.status === 'paid')
    .reduce((sum, w) => sum + w.feeRwf, 0);

  const kycQueue = props.users.filter((u) => u.kycStatus !== 'not_submitted' && u.kycData);

  const handleEditPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingUser) return;
    setEditError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file, 3);
      setEditingUser({ ...editingUser, photoDataUrl: dataUrl });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to upload image.');
    }
  };

  const activeNav = ADMIN_NAV.find((n) => n.id === section) ?? ADMIN_NAV[0];

  return (
    <div className="min-h-screen bg-shifting-soft text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-shifting-aurora text-white shrink-0">
        <div className="h-16 px-5 border-b border-white/15 flex items-center justify-between">
          <span className="font-display text-lg font-bold">E-Finance Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Admin navigation">
          {ADMIN_NAV.map((item) => {
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
          <div className="text-xs">
            <p className="font-semibold text-white">System Administrator</p>
            <p className="font-mono text-[11px] text-slate-300 truncate">ezeprodeveloper@gmail.com</p>
          </div>
          {props.cloudConnected ? (
            <p className="text-[11px] font-medium text-emerald-300 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Cloud Live Sync Active</span>
            </p>
          ) : (
            <button
              type="button"
              disabled={syncingCloud}
              onClick={async () => {
                setSyncingCloud(true);
                try {
                  await props.onConnectAdminCloud();
                } finally {
                  setSyncingCloud(false);
                }
              }}
              className="w-full h-9 px-3 bg-emerald-600/90 hover:bg-emerald-600 rounded-lg text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{syncingCloud ? 'Connecting...' : 'Sync Admin Cloud'}</span>
            </button>
          )}
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
              <span className="font-display text-base font-bold">E-Finance Admin</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {ADMIN_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      handleSelectSection(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full h-10 px-3 rounded-lg text-sm font-medium flex items-center gap-3 ${
                      section === item.id ? 'bg-white text-[#071B38] font-semibold' : 'text-slate-200 hover:bg-white/10'
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
              className="lg:hidden w-10 h-10 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 hidden sm:block">E-Finance Rwanda Control Center</p>
              <h1 className="font-display text-base font-bold text-[#071B38] truncate">
                {activeNav.label}
              </h1>
            </div>
          </div>

          <ColorChangingClock />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1200px] w-full mx-auto space-y-6">
          {/* 1. Admin Dashboard Overview */}
          {section === 'dashboard' && (
            <div className="space-y-6">
              <div className="bg-white/95 border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 sm:divide-x divide-slate-200">
                <div className="p-5">
                  <p className="text-xs text-slate-500">Registered Users</p>
                  <p className="font-mono text-2xl font-semibold text-[#071B38] mt-1 tabular-nums">
                    {props.users.length}
                  </p>
                  <p className="text-xs text-amber-700 mt-1">{pendingRegistrations} awaiting approval</p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">200 RWF Activations &amp; KYC</p>
                  <p className="font-mono text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
                    {pendingActivations + pendingKyc}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {pendingActivations} payments · {pendingKyc} KYC
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">Videos &amp; Task Reviews</p>
                  <p className="font-mono text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
                    {pendingVideos + pendingTasks + pendingSubmissions}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {pendingVideos} videos · {pendingSubmissions} worker proofs
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">25% Withdrawal Fees Earned</p>
                  <p className="font-mono text-2xl font-semibold text-emerald-700 mt-1 tabular-nums">
                    {formatRwf(totalWithdrawalFees)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {pendingLoans} loans · {pendingWithdrawals} payouts pending
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <section className="bg-white/95 border border-slate-200 rounded-xl p-6 space-y-3">
                  <h2 className="text-base font-semibold text-slate-900">Action queue</h2>
                  <div className="space-y-2 text-sm">
                    <button
                      type="button"
                      onClick={() => handleSelectSection('users')}
                      className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between"
                    >
                      <span>Registration &amp; 200 RWF Activation Queue</span>
                      <span className="font-mono font-semibold text-[#071B38]">{pendingRegistrations + pendingActivations}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectSection('kyc')}
                      className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between"
                    >
                      <span>Rwanda KYC Verification Queue</span>
                      <span className="font-mono font-semibold text-[#071B38]">{pendingKyc}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectSection('videos_tasks')}
                      className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between"
                    >
                      <span>Videos, Tasks &amp; Requirement Proofs</span>
                      <span className="font-mono font-semibold text-[#071B38]">
                        {pendingVideos + pendingTasks + pendingSubmissions}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectSection('loans_withdrawals')}
                      className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between"
                    >
                      <span>Investments, Loans &amp; Withdrawal Requests</span>
                      <span className="font-mono font-semibold text-[#071B38]">
                        {pendingInvestments + pendingLoans + pendingWithdrawals}
                      </span>
                    </button>
                  </div>
                </section>

                <section className="bg-shifting-aurora text-white rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold text-emerald-300">System Parameters</p>
                    <h2 className="font-display text-xl font-bold mt-1">Active E-Finance Rwanda Rules</h2>
                    <div className="mt-4 space-y-1.5 text-xs text-slate-200 font-mono tabular-nums">
                      <p>MoMo Pay Code: {props.settings.momoPayCode}*amount#</p>
                      <p>Activation Fee: {formatRwf(props.settings.activationFeeRwf)} | Bonus: {formatRwf(props.settings.welcomeBonusRwf)}</p>
                      <p>Daily Check-In: {formatRwf(props.settings.dailyCheckInRwf)} | Min Video: {formatRwf(props.settings.minVideoRewardRwf)}/view</p>
                      <p>Withdrawal Fee: {props.settings.withdrawalFeePercent}%</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectSection('settings')}
                    className="mt-5 h-10 px-4 bg-white text-[#071B38] text-xs font-semibold rounded-lg w-fit"
                  >
                    Edit System Settings
                  </button>
                </section>
              </div>
            </div>
          )}

          {/* 2. Users & Photos Management */}
          {section === 'users' && (
            <div className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">All registered users &amp; photos</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Admin can view all 3-step details, approve registrations, confirm 200 RWF payments, and edit any user info or photo.
                  </p>
                </div>
                <span className="font-mono text-xs text-slate-500">{props.users.length} total users</span>
              </div>

              {props.users.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No users have registered yet. New registrations appear here immediately.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {props.users.map((u) => (
                    <div key={u.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        {u.photoDataUrl ? (
                          <img
                            src={u.photoDataUrl}
                            alt={`${u.firstName} ${u.secondName}`}
                            className="w-16 h-16 rounded-xl object-cover border border-slate-300 shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 shrink-0" />
                        )}
                        <div className="space-y-1 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-[#071B38]">
                              {u.firstName} {u.secondName}
                            </h3>
                            <span className="font-mono text-slate-500">{u.accountNumber}</span>
                            <StatusLabel
                              label={u.accountStatus.replace('_', ' ')}
                              tone={
                                u.accountStatus === 'active'
                                  ? 'success'
                                  : u.accountStatus === 'suspended'
                                    ? 'danger'
                                    : 'warning'
                              }
                            />
                          </div>
                          <p className="text-slate-600">
                            {u.email} · <span className="font-mono">{u.phone}</span> · ID: <span className="font-mono">{u.idNumber}</span> · {u.gender} ({u.dateOfBirth})
                          </p>
                          <p className="text-slate-600">
                            <strong>{u.education.type}:</strong> {u.education.institutionName} ({u.education.levelOrClass}, {u.education.facultyOrCombination})
                          </p>
                          <p className="text-slate-600">
                            <strong>Birth:</strong> {u.residence.placeOfBirth}
                            {u.residence.akarere ? ` · Residence: ${u.residence.akarere} / ${u.residence.umurenge ?? '-'} / ${u.residence.akagari ?? '-'} / ${u.residence.umudugudu ?? '-'}` : ''}
                          </p>
                          {u.activationPaymentRef && (
                            <p className="font-mono text-blue-800">
                              Activation MoMo Ref: {u.activationPaymentRef} ({u.activationPaidPhone})
                            </p>
                          )}
                          <p className="font-mono text-slate-800 tabular-nums">
                            Wallet: <strong>{formatRwf(u.walletBalanceRwf)}</strong> · Saved: <strong>{formatRwf(u.savingsBalanceRwf)}</strong> · KYC: {u.kycStatus}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {u.accountStatus === 'pending_approval' && (
                          <button
                            type="button"
                            onClick={() => props.onApproveUserRegistration(u.id)}
                            className="h-9 px-3 bg-[#071B38] hover:bg-[#0c2954] text-white text-xs font-semibold rounded-lg"
                          >
                            Approve Registration
                          </button>
                        )}
                        {(u.accountStatus === 'awaiting_payment' || u.accountStatus === 'payment_submitted') && (
                          <button
                            type="button"
                            onClick={() => props.onActivateUserWithBonus(u.id)}
                            className="h-9 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                          >
                            Confirm {props.settings.activationFeeRwf} RWF &amp; Grant {props.settings.welcomeBonusRwf} Bonus
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUser({ ...u });
                            setEditError(null);
                          }}
                          className="h-9 px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg"
                        >
                          Edit Info &amp; Photo
                        </button>
                        {u.accountStatus === 'active' || u.accountStatus === 'suspended' ? (
                          <button
                            type="button"
                            onClick={() => props.onToggleSuspendUser(u.id)}
                            className="h-9 px-3 border border-slate-300 bg-white hover:bg-red-50 text-xs font-semibold rounded-lg text-slate-700"
                          >
                            {u.accountStatus === 'suspended' ? 'Unsuspend' : 'Suspend'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Rwanda KYC Desk */}
          {section === 'kyc' && (
            <div className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-900">Rwanda KYC Submissions</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review submitted Rwanda National ID details, addresses, and ID photos before unlocking Savings &amp; Withdrawals.
                </p>
              </div>

              {kycQueue.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No KYC submissions received yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {kycQueue.map((u) => (
                    <div key={u.id} className="p-6 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="flex items-center gap-2 shrink-0">
                            {u.kycData?.idDocumentPhotoDataUrl && (
                              <img
                                src={u.kycData.idDocumentPhotoDataUrl}
                                alt="Rwanda National ID document"
                                className="w-24 h-18 rounded-lg object-cover border border-slate-300"
                              />
                            )}
                            {u.kycData?.selfiePhotoDataUrl && (
                              <img
                                src={u.kycData.selfiePhotoDataUrl}
                                alt="Member KYC selfie"
                                className="w-18 h-18 rounded-lg object-cover border border-slate-300"
                              />
                            )}
                          </div>
                          <div className="text-xs space-y-1">
                            <h3 className="text-sm font-bold text-[#071B38]">
                              {u.firstName} {u.secondName} ({u.accountNumber})
                            </h3>
                            <p className="font-mono text-slate-700">
                              National ID: {u.kycData?.nationalId} · Issued: {u.kycData?.idIssueDistrict}
                            </p>
                            <p className="text-slate-600">
                              {u.kycData?.province} · Akarere: {u.kycData?.akarere} · Umurenge: {u.kycData?.umurenge} · Akagari: {u.kycData?.akagari} · Umudugudu: {u.kycData?.umudugudu}
                            </p>
                            <p className="text-slate-600">
                              Occupation: {u.kycData?.occupation} · Next of Kin: {u.kycData?.nextOfKinName} ({u.kycData?.nextOfKinPhone})
                            </p>
                          </div>
                        </div>

                        <StatusLabel
                          label={u.kycStatus}
                          tone={
                            u.kycStatus === 'approved'
                              ? 'success'
                              : u.kycStatus === 'rejected'
                                ? 'danger'
                                : 'warning'
                          }
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <input
                          type="text"
                          value={kycNotes[u.id] ?? ''}
                          onChange={(e) => setKycNotes((prev) => ({ ...prev, [u.id]: e.target.value }))}
                          placeholder="Optional review note..."
                          className="flex-1 min-w-[200px] h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => props.onReviewKyc(u.id, 'approved', kycNotes[u.id])}
                          className="h-9 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                        >
                          Approve KYC
                        </button>
                        <button
                          type="button"
                          onClick={() => props.onReviewKyc(u.id, 'rejected', kycNotes[u.id])}
                          className="h-9 px-3.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 text-xs font-semibold rounded-lg"
                        >
                          Reject KYC
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Videos & Tasks Moderation */}
          {section === 'videos_tasks' && (
            <div className="space-y-6">
              {/* Task Submissions Requiring Admin Verification */}
              <section className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-base font-semibold text-slate-900">
                    Task completion proofs (Admin approval required)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verify whether each participant satisfied the task requirements before approving their RWF reward.
                  </p>
                </div>
                {props.taskSubmissions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">No task submissions yet.</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {props.taskSubmissions.map((sub) => {
                      const parentTask = props.customTasks.find((t) => t.id === sub.taskId);
                      return (
                        <div key={sub.id} className="p-5 space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900">
                                {sub.workerName} → {sub.taskTitle}
                              </h3>
                              <p className="text-xs text-slate-500 font-mono">
                                Reward: {formatRwf(sub.rewardRwf)} · Submitted {formatDateTime(sub.submittedAt)}
                              </p>
                            </div>
                            <StatusLabel
                              label={sub.status}
                              tone={
                                sub.status === 'approved'
                                  ? 'success'
                                  : sub.status === 'rejected'
                                    ? 'danger'
                                    : 'warning'
                              }
                            />
                          </div>
                          {parentTask && (
                            <p className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700">
                              <strong>Creator Requirements:</strong> {parentTask.requirements}
                            </p>
                          )}
                          <p className="text-xs text-slate-800">
                            <strong>Worker Proof:</strong> {sub.proofText}{' '}
                            {sub.proofUrl && (
                              <a
                                href={sub.proofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-800 underline ml-1"
                              >
                                Open proof link
                              </a>
                            )}
                          </p>
                          {sub.status === 'pending_admin' && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => props.onReviewTaskSubmission(sub.id, 'approved')}
                                className="h-9 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                              >
                                Approve &amp; Pay {formatRwf(sub.rewardRwf)}
                              </button>
                              <button
                                type="button"
                                onClick={() => props.onReviewTaskSubmission(sub.id, 'rejected')}
                                className="h-9 px-3.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 text-xs font-semibold rounded-lg"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Video Campaigns */}
              <section className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-base font-semibold text-slate-900">Uploaded short video campaigns</h2>
                </div>
                {props.videoCampaigns.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">No video campaigns uploaded yet.</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {props.videoCampaigns.map((camp) => (
                      <div key={camp.id} className="p-5 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">{camp.title}</h3>
                            <p className="text-xs text-slate-500 font-mono">
                              By {camp.creatorName} · {formatRwf(camp.rewardPerViewRwf)}/view × {camp.targetViewers} views = {formatRwf(camp.totalBudgetRwf)} · Code: {camp.paymentCode} · Ref: {camp.paymentRef}
                            </p>
                          </div>
                          <StatusLabel
                            label={camp.status}
                            tone={
                              camp.status === 'active' || camp.status === 'completed'
                                ? 'success'
                                : camp.status === 'rejected'
                                  ? 'danger'
                                  : 'warning'
                            }
                          />
                        </div>
                        <video src={camp.videoUrl} controls className="max-h-44 rounded-lg border border-slate-200 bg-black" />
                        {camp.status === 'pending_admin' && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => props.onReviewVideoCampaign(camp.id, 'active')}
                              className="h-9 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                            >
                              Verify Payment &amp; Publish Video
                            </button>
                            <button
                              type="button"
                              onClick={() => props.onReviewVideoCampaign(camp.id, 'rejected')}
                              className="h-9 px-3.5 border border-red-200 bg-red-50 text-red-800 text-xs font-semibold rounded-lg"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Custom Tasks */}
              <section className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-base font-semibold text-slate-900">Creator custom tasks</h2>
                </div>
                {props.customTasks.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">No custom tasks submitted yet.</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {props.customTasks.map((task) => (
                      <div key={task.id} className="p-5 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                            <p className="text-xs font-mono text-slate-500">
                              By {task.creatorName} · {formatRwf(task.rewardPerCompletionRwf)} × {task.targetCompletions} = {formatRwf(task.totalBudgetRwf)} · Ref: {task.paymentRef}
                            </p>
                          </div>
                          <StatusLabel
                            label={task.status}
                            tone={task.status === 'active' || task.status === 'completed' ? 'success' : task.status === 'rejected' ? 'danger' : 'warning'}
                          />
                        </div>
                        <p className="text-xs text-slate-600">{task.requirements}</p>
                        {task.status === 'pending_admin' && (
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => props.onReviewCustomTask(task.id, 'active')}
                              className="h-9 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                            >
                              Verify Payment &amp; Publish Task
                            </button>
                            <button
                              type="button"
                              onClick={() => props.onReviewCustomTask(task.id, 'rejected')}
                              className="h-9 px-3.5 border border-red-200 bg-red-50 text-red-800 text-xs font-semibold rounded-lg"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* 5. Investment Plans, Loans & Withdrawals Desk */}
          {section === 'loans_withdrawals' && (
            <div className="space-y-6">
              {/* Investment Plan Deposits */}
              <section className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-base font-semibold text-slate-900">Investment plan deposits (Daily ROI)</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verify MoMo deposits to activate daily 24-hour payouts and grant 10% referral commissions.
                  </p>
                </div>
                {props.investments.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">No investment deposits submitted yet.</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {props.investments.map((inv) => (
                      <div key={inv.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {inv.userName} · {inv.planName}
                          </h3>
                          <p className="text-xs font-mono text-slate-600 tabular-nums">
                            Deposit: {formatRwf(inv.depositRwf)} · Daily ROI: +{formatRwf(inv.dailyReturnRwf)}/24h · Ref: {inv.paymentRef} ({inv.paymentCode})
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">
                            Earned so far: {formatRwf(inv.totalEarnedRwf)} · Submitted {formatDateTime(inv.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusLabel
                            label={inv.status}
                            tone={
                              inv.status === 'active' || inv.status === 'completed'
                                ? 'success'
                                : inv.status === 'rejected'
                                  ? 'danger'
                                  : 'warning'
                            }
                          />
                          {inv.status === 'pending_admin' && (
                            <>
                              <button
                                type="button"
                                onClick={() => props.onReviewInvestment(inv.id, 'active')}
                                className="h-8 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-md"
                              >
                                Confirm &amp; Activate
                              </button>
                              <button
                                type="button"
                                onClick={() => props.onReviewInvestment(inv.id, 'rejected')}
                                className="h-8 px-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-md"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden h-fit">
                  <div className="px-6 py-4 border-b border-slate-200">
                    <h2 className="text-base font-semibold text-slate-900">Loan requests</h2>
                  </div>
                  {props.loans.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">No loan requests yet.</div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {props.loans.map((ln) => (
                        <div key={ln.id} className="p-5 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900">
                                {ln.userName} · {ln.product}
                              </h3>
                              <p className="text-xs font-mono text-slate-500 tabular-nums">
                                {formatRwf(ln.principalRwf)} · {ln.termMonths} mo · Repayable {formatRwf(ln.totalRepayableRwf)}
                              </p>
                            </div>
                            <StatusLabel
                              label={ln.status}
                              tone={ln.status === 'approved' || ln.status === 'repaid' ? 'success' : ln.status === 'rejected' ? 'danger' : 'warning'}
                            />
                          </div>
                          <p className="text-xs text-slate-600">{ln.reason}</p>
                          {ln.status === 'pending_admin' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => props.onReviewLoan(ln.id, 'approved')}
                                className="h-8 px-3 bg-emerald-700 text-white text-xs font-semibold rounded-md"
                              >
                                Approve &amp; Disburse to Wallet
                              </button>
                              <button
                                type="button"
                                onClick={() => props.onReviewLoan(ln.id, 'rejected')}
                                className="h-8 px-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-md"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden h-fit">
                  <div className="px-6 py-4 border-b border-slate-200">
                    <h2 className="text-base font-semibold text-slate-900">Mobile Money withdrawal requests</h2>
                  </div>
                  {props.withdrawals.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">No withdrawal requests yet.</div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {props.withdrawals.map((wd) => (
                        <div key={wd.id} className="p-5 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900">
                                {wd.userName} · {wd.network}
                              </h3>
                              <p className="text-xs text-slate-700 mt-0.5">
                                {wd.destinationType}: <strong className="font-mono">{wd.destinationValue}</strong> · Names: <strong>{wd.accountRegisteredNames}</strong>
                              </p>
                              <p className="text-xs font-mono text-slate-600 tabular-nums mt-0.5">
                                Gross {formatRwf(wd.grossAmountRwf)} · Fee ({wd.feePercent}%) {formatRwf(wd.feeRwf)} · Net Send:{' '}
                                <strong className="text-emerald-700">{formatRwf(wd.netAmountRwf)}</strong>
                              </p>
                            </div>
                            <StatusLabel
                              label={wd.status}
                              tone={wd.status === 'paid' ? 'success' : wd.status === 'rejected' ? 'danger' : 'warning'}
                            />
                          </div>
                          {wd.status === 'pending_admin' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => props.onReviewWithdrawal(wd.id, 'paid')}
                                className="h-8 px-3 bg-emerald-700 text-white text-xs font-semibold rounded-md"
                              >
                                Mark MoMo Payout Sent
                              </button>
                              <button
                                type="button"
                                onClick={() => props.onReviewWithdrawal(wd.id, 'rejected')}
                                className="h-8 px-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-md"
                              >
                                Reject &amp; Refund Wallet
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* 6. Public Promotions / Yamamaza */}
          {section === 'promotions' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <section className="lg:col-span-5 bg-white/95 border border-slate-200 rounded-xl p-6 h-fit">
                <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-200">
                  Publish public E-Finance promotion
                </h2>
                <p className="text-xs text-slate-500 mt-1.5">
                  Visible on the home page to visitors before creating an account.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (promoTitle.trim().length < 3 || promoSummary.trim().length < 5) return;
                    props.onAddPromotion(promoTitle.trim(), promoCat, promoSummary.trim());
                    setPromoTitle('');
                    setPromoSummary('');
                  }}
                  className="mt-4 space-y-3.5"
                >
                  <input
                    type="text"
                    value={promoTitle}
                    onChange={(e) => setPromoTitle(e.target.value)}
                    placeholder="Promotion / Announcement Title"
                    required
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={promoCat}
                    onChange={(e) => setPromoCat(e.target.value)}
                    placeholder="Category"
                    required
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                  <textarea
                    rows={4}
                    value={promoSummary}
                    onChange={(e) => setPromoSummary(e.target.value)}
                    placeholder="Write what E-Finance is advertising or announcing..."
                    required
                    className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                  <button
                    type="submit"
                    className="w-full h-10 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg"
                  >
                    Publish to Public Home Page
                  </button>
                </form>
              </section>

              <section className="lg:col-span-7 bg-white/95 border border-slate-200 rounded-xl divide-y divide-slate-200 h-fit">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-base font-semibold text-slate-900">Published announcements</h2>
                </div>
                {props.promotions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">No announcements created.</div>
                ) : (
                  props.promotions.map((p) => (
                    <div key={p.id} className="p-5 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-slate-500">{p.category}</p>
                        <h3 className="text-sm font-semibold text-slate-900 mt-0.5">{p.title}</h3>
                        <p className="text-xs text-slate-600 mt-1">{p.summary}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => props.onTogglePromotion(p.id)}
                          className="px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded-md"
                        >
                          {p.active ? 'Visible' : 'Hidden'}
                        </button>
                        <button
                          type="button"
                          onClick={() => props.onDeletePromotion(p.id)}
                          aria-label="Delete promotion"
                          className="p-1.5 text-red-700 hover:bg-red-50 rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </section>
            </div>
          )}

          {/* 7. System Settings */}
          {section === 'settings' && (
            <section className="bg-white/95 border border-slate-200 rounded-xl p-6 max-w-2xl">
              <h2 className="text-base font-semibold text-slate-900 pb-3 border-b border-slate-200">
                E-Finance Rwanda system settings
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  props.onUpdateSettings(settingsDraft);
                  setSettingsSaved(true);
                  setTimeout(() => setSettingsSaved(false), 2500);
                }}
                className="mt-5 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Account Activation Fee (RWF)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={settingsDraft.activationFeeRwf}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, activationFeeRwf: Number(e.target.value) || 0 })
                      }
                      className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Welcome Bonus (RWF)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={settingsDraft.welcomeBonusRwf}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, welcomeBonusRwf: Number(e.target.value) || 0 })
                      }
                      className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Daily Check-In Reward (RWF)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={settingsDraft.dailyCheckInRwf}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, dailyCheckInRwf: Number(e.target.value) || 0 })
                      }
                      className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Withdrawal System Fee (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={settingsDraft.withdrawalFeePercent}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, withdrawalFeePercent: Number(e.target.value) || 0 })
                      }
                      className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Minimum Video Reward per View (RWF)
                    </label>
                    <input
                      type="number"
                      min={10}
                      value={settingsDraft.minVideoRewardRwf}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, minVideoRewardRwf: Number(e.target.value) || 50 })
                      }
                      className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      MoMo Merchant / Pay Code
                    </label>
                    <input
                      type="text"
                      value={settingsDraft.momoPayCode}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, momoPayCode: e.target.value })}
                      className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Subsequent Min Withdrawal (RWF)
                    </label>
                    <input
                      type="number"
                      min={100}
                      value={settingsDraft.subsequentMinWithdrawalRwf}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          subsequentMinWithdrawalRwf: Number(e.target.value) || 1000,
                        })
                      }
                      className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Subsequent Max Withdrawal (RWF)
                    </label>
                    <input
                      type="number"
                      min={500}
                      value={settingsDraft.subsequentMaxWithdrawalRwf}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          subsequentMaxWithdrawalRwf: Number(e.target.value) || 5000,
                        })
                      }
                      className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Referral Commission (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={settingsDraft.referralCommissionPercent}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          referralCommissionPercent: Number(e.target.value) || 10,
                        })
                      }
                      className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsDraft.maintenanceMode}
                        onChange={(e) =>
                          setSettingsDraft({ ...settingsDraft, maintenanceMode: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <span>Enable System Maintenance Mode</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Public Platform Tagline
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.platformTagline}
                    onChange={(e) => setSettingsDraft({ ...settingsDraft, platformTagline: e.target.value })}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                {settingsSaved && (
                  <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>System settings saved and applied across E-Finance.</span>
                  </p>
                )}

                <div>
                  <button
                    type="submit"
                    className="h-10 px-5 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg"
                  >
                    Save System Settings
                  </button>
                </div>
              </form>
            </section>
          )}
        </main>
      </div>

      {/* Admin User Edit Modal (Admin CAN edit all user fields & photo) */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 sm:p-7 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="font-display text-lg font-bold text-[#071B38]">
                Edit Member Details &amp; Photo ({editingUser.accountNumber})
              </h2>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
              {editingUser.photoDataUrl && (
                <img
                  src={editingUser.photoDataUrl}
                  alt="Member"
                  className="w-16 h-16 rounded-lg object-cover border border-slate-300"
                />
              )}
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-900">Member Photo (Admin Override)</p>
                <p className="text-xs text-slate-500">Users cannot modify this photo; only Admin can replace it.</p>
              </div>
              <label className="cursor-pointer h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-100">
                <Upload className="w-3.5 h-3.5" />
                <span>Change Photo</span>
                <input type="file" accept="image/*" onChange={handleEditPhotoUpload} className="sr-only" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={editingUser.firstName}
                  onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Second Name</label>
                <input
                  type="text"
                  value={editingUser.secondName}
                  onChange={(e) => setEditingUser({ ...editingUser, secondName: e.target.value })}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editingUser.phone}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  className="w-full h-9 px-3 font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">National ID</label>
                <input
                  type="text"
                  value={editingUser.idNumber}
                  onChange={(e) => setEditingUser({ ...editingUser, idNumber: e.target.value })}
                  className="w-full h-9 px-3 font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Wallet Balance (RWF)</label>
                <input
                  type="number"
                  value={editingUser.walletBalanceRwf}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, walletBalanceRwf: Number(e.target.value) || 0 })
                  }
                  className="w-full h-9 px-3 font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Bonus Balance (RWF)</label>
                <input
                  type="number"
                  value={editingUser.bonusBalanceRwf}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, bonusBalanceRwf: Number(e.target.value) || 0 })
                  }
                  className="w-full h-9 px-3 font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Spin Credits</label>
                <input
                  type="number"
                  min={0}
                  value={editingUser.spinCredits}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, spinCredits: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-full h-9 px-3 font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Akarere</label>
                <input
                  type="text"
                  value={editingUser.residence.akarere ?? ''}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      residence: { ...editingUser.residence, akarere: e.target.value },
                    })
                  }
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Umurenge</label>
                <input
                  type="text"
                  value={editingUser.residence.umurenge ?? ''}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      residence: { ...editingUser.residence, umurenge: e.target.value },
                    })
                  }
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {editError && <p className="text-xs text-red-700">{editError}</p>}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="h-9 px-4 border border-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  props.onAdminUpdateUser(editingUser);
                  setEditingUser(null);
                }}
                className="h-9 px-4 bg-[#071B38] text-white rounded-lg text-xs font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

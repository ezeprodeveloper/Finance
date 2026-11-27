import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Eye,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  Menu,
  PlusCircle,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Video,
  X,
} from 'lucide-react';
import type { AdminMergedAuthEntry, AdminUsersDirectoryMeta } from '../contexts/AuthContext';
import { MAX_LOCAL_VIDEO_FILE_BYTES } from '../services/storageService';
import {
  AdminPortalSection,
  AdminPromotion,
  AirtimeRequest,
  BetSession,
  CustomTask,
  FxExchangeRecord,
  LoanRequest,
  P2PTransfer,
  PlatformNotification,
  RegisteredUser,
  ShortVideoCampaign,
  SystemSettings,
  TaskSubmission,
  TransactionRecord,
  UsdtRequest,
  UserInvestment,
  WithdrawalRequest,
} from '../types/finance';
import {
  formatBytes,
  formatDateTime,
  formatRwf,
  formatUsdt,
  readFileAsDataUrl,
} from '../utils/formatters';
import { ColorChangingClock } from './ColorChangingClock';
import { NotificationsBell } from './NotificationsBell';
import { SmartVideoPlayer } from './SmartVideoPlayer';
import { StatusLabel } from './StatusLabel';

interface AdminDashboardProps {
  users: RegisteredUser[];
  adminUsersMeta?: AdminUsersDirectoryMeta;
  loans: LoanRequest[];
  investments: UserInvestment[];
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
  promotions: AdminPromotion[];
  settings: SystemSettings;
  onApproveUserRegistration: (userId: string) => void;
  onActivateUserWithBonus: (userId: string) => void;
  onToggleSuspendUser: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  onAdminUpdateUser: (updated: RegisteredUser) => void;
  onReviewKyc: (userId: string, decision: 'approved' | 'rejected', note?: string) => void;
  onReviewVideoCampaign: (campaignId: string, decision: 'active' | 'rejected') => void;
  onReviewCustomTask: (taskId: string, decision: 'active' | 'rejected') => void;
  onAdminCreateVideoCampaign: (payload: {
    title: string;
    description: string;
    videoUrl: string;
    videoFile?: File | null;
    requiredWatchSeconds?: number;
    rewardPerViewRwf: number;
    targetViewers: number;
    onUploadProgress?: (percent: number, stage: string) => void;
  }) => Promise<string | null> | void;
  onAdminCreateCustomTask: (payload: {
    title: string;
    requirements: string;
    videoUrl?: string;
    videoFile?: File | null;
    requiredWatchSeconds?: number;
    rewardPerCompletionRwf: number;
    targetCompletions: number;
    onUploadProgress?: (percent: number, stage: string) => void;
  }) => Promise<string | null> | void;
  onReviewTaskSubmission: (submissionId: string, decision: 'approved' | 'rejected', note?: string) => void;
  onReviewLoan: (loanId: string, decision: 'approved' | 'rejected') => void;
  onReviewInvestment: (investmentId: string, decision: 'active' | 'rejected') => void;
  onReviewWithdrawal: (withdrawalId: string, decision: 'paid' | 'rejected') => void;
  onReviewAirtime: (requestId: string, decision: 'approved' | 'rejected') => void;
  onReviewUsdtRequest: (requestId: string, decision: 'approved' | 'rejected') => void;
  onAddPromotion: (title: string, category: string, summary: string) => void;
  onTogglePromotion: (promoId: string) => void;
  onDeletePromotion: (promoId: string) => void;
  onUpdateSettings: (next: SystemSettings) => void;
  onRefreshUsers?: () => Promise<{ count: number; error: string | null }>;
  notifications?: PlatformNotification[];
  onMarkNotificationRead?: (id: string) => void;
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
  { id: 'services_crypto', label: 'Airtime, USDT & Binance', icon: Coins },
  { id: 'transactions_audit', label: 'Transactions & 10% Tax', icon: History },
  { id: 'videos_tasks', label: 'Videos & Tasks', icon: Video },
  { id: 'loans_withdrawals', label: 'Loans & Payouts', icon: Banknote },
  { id: 'promotions', label: 'Public Promotions', icon: Megaphone },
  { id: 'settings', label: 'System Settings', icon: Settings },
];

export function AdminDashboard(props: AdminDashboardProps) {
  const [section, setSection] = useState<AdminPortalSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSelectSection = (next: AdminPortalSection) => {
    if (next === section) return;
    setSection(next);
  };

  // User editor, delete confirmation & photo lightbox modal state
  const [editingUser, setEditingUser] = useState<RegisteredUser | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<RegisteredUser | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; caption: string } | null>(null);

  // KYC note
  const [kycNotes, setKycNotes] = useState<Record<string, string>>({});

  // Users directory search, filter & pagination
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('all');
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(25);
  const [refreshingUsers, setRefreshingUsers] = useState(false);
  const [refreshUsersNotice, setRefreshUsersNotice] = useState<string | null>(null);

  // Admin direct add Video & Task state
  const [vidTitle, setVidTitle] = useState('');
  const [vidDesc, setVidDesc] = useState('');
  const [vidUrl, setVidUrl] = useState('');
  const [vidFile, setVidFile] = useState<File | null>(null);
  const [vidPreviewUrl, setVidPreviewUrl] = useState<string | null>(null);
  const [vidRequiredSec, setVidRequiredSec] = useState('15');
  const [vidReward, setVidReward] = useState(String(props.settings.minVideoRewardRwf || 50));
  const [vidTarget, setVidTarget] = useState('50');
  const [vidUploading, setVidUploading] = useState(false);
  const [vidProgress, setVidProgress] = useState<{ percent: number; stage: string } | null>(null);
  const [vidError, setVidError] = useState<string | null>(null);
  const [vidNotice, setVidNotice] = useState<string | null>(null);

  const [tskTitle, setTskTitle] = useState('');
  const [tskReqs, setTskReqs] = useState('');
  const [tskVideoUrl, setTskVideoUrl] = useState('');
  const [tskVideoFile, setTskVideoFile] = useState<File | null>(null);
  const [tskPreviewUrl, setTskPreviewUrl] = useState<string | null>(null);
  const [tskRequiredSec, setTskRequiredSec] = useState('15');
  const [tskReward, setTskReward] = useState('100');
  const [tskTarget, setTskTarget] = useState('50');
  const [tskUploading, setTskUploading] = useState(false);
  const [tskProgress, setTskProgress] = useState<{ percent: number; stage: string } | null>(null);
  const [tskError, setTskError] = useState<string | null>(null);
  const [tskNotice, setTskNotice] = useState<string | null>(null);

  // Audit search/filter
  const [auditSearch, setAuditSearch] = useState('');
  const [auditCategory, setAuditCategory] = useState('All');

  // Promotion form
  const [promoTitle, setPromoTitle] = useState('');
  const [promoCat, setPromoCat] = useState('Official Announcement');
  const [promoSummary, setPromoSummary] = useState('');

  // Settings draft
  const [settingsDraft, setSettingsDraft] = useState<SystemSettings>(props.settings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    setSettingsDraft(props.settings);
  }, [props.settings]);

  useEffect(() => {
    return () => {
      if (vidPreviewUrl) URL.revokeObjectURL(vidPreviewUrl);
    };
  }, [vidPreviewUrl]);

  useEffect(() => {
    return () => {
      if (tskPreviewUrl) URL.revokeObjectURL(tskPreviewUrl);
    };
  }, [tskPreviewUrl]);

  type DirectoryRow =
    | {
        kind: 'firestore';
        uid: string;
        user: RegisteredUser;
        authMeta?: AdminMergedAuthEntry;
      }
    | {
        kind: 'auth_only';
        uid: string;
        authMeta: AdminMergedAuthEntry;
      };

  const combinedDirectoryUsers = useMemo<DirectoryRow[]>(() => {
    const authEntries = props.adminUsersMeta?.authUsers ?? [];
    const authByUid = new Map<string, AdminMergedAuthEntry>();
    for (const entry of authEntries) {
      authByUid.set(entry.uid, entry);
    }

    const rows: DirectoryRow[] = [];
    const seenUids = new Set<string>();

    for (const u of props.users) {
      seenUids.add(u.id);
      rows.push({
        kind: 'firestore',
        uid: u.id,
        user: u,
        authMeta: authByUid.get(u.id),
      });
    }

    for (const entry of authEntries) {
      if (seenUids.has(entry.uid)) continue;
      seenUids.add(entry.uid);
      if (entry.profile) {
        rows.push({
          kind: 'firestore',
          uid: entry.uid,
          user: entry.profile,
          authMeta: entry,
        });
      } else {
        rows.push({
          kind: 'auth_only',
          uid: entry.uid,
          authMeta: entry,
        });
      }
    }

    return rows;
  }, [props.users, props.adminUsersMeta]);

  const filteredDirectoryUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return combinedDirectoryUsers.filter((row) => {
      if (row.kind === 'auth_only') {
        if (userStatusFilter !== 'all' && userStatusFilter !== 'auth_only') return false;
        if (!q) return true;
        return (
          row.uid.toLowerCase().includes(q) ||
          row.authMeta.email.toLowerCase().includes(q) ||
          row.authMeta.displayName.toLowerCase().includes(q) ||
          row.authMeta.phone.toLowerCase().includes(q)
        );
      }

      const u = row.user;
      if (userStatusFilter === 'auth_only') return false;
      if (userStatusFilter !== 'all' && u.accountStatus !== userStatusFilter) return false;
      if (!q) return true;
      return (
        u.id.toLowerCase().includes(q) ||
        `${u.firstName} ${u.secondName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        u.accountNumber.toLowerCase().includes(q) ||
        u.idNumber.toLowerCase().includes(q)
      );
    });
  }, [combinedDirectoryUsers, userSearch, userStatusFilter]);

  useEffect(() => {
    setUsersPage(1);
  }, [userSearch, userStatusFilter, usersPageSize]);

  const totalUserPages = Math.max(1, Math.ceil(filteredDirectoryUsers.length / usersPageSize));
  const safeUserPage = Math.min(usersPage, totalUserPages);
  const paginatedDirectoryUsers = useMemo(() => {
    const start = (safeUserPage - 1) * usersPageSize;
    return filteredDirectoryUsers.slice(start, start + usersPageSize);
  }, [filteredDirectoryUsers, safeUserPage, usersPageSize]);

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
  const pendingAirtime = props.airtimeRequests.filter((a) => a.status === 'pending_admin').length;
  const pendingUsdt = props.usdtRequests.filter((u) => u.status === 'pending_admin').length;

  const totalWithdrawalFees = props.withdrawals
    .filter((w) => w.status === 'paid')
    .reduce((sum, w) => sum + w.feeRwf, 0);

  const totalP2pTaxRwf = props.p2pTransfers.reduce((sum, t) => sum + t.taxRwf, 0);
  const totalP2pVolumeRwf = props.p2pTransfers.reduce((sum, t) => sum + t.grossAmountRwf, 0);

  const kycQueue = props.users.filter((u) => u.kycStatus !== 'not_submitted' && u.kycData);

  const filteredTransactions = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return props.transactions.filter((tx) => {
      if (auditCategory !== 'All' && tx.category !== auditCategory) return false;
      if (!q) return true;
      const owner = props.users.find((u) => u.id === tx.userId);
      const ownerLabel = owner ? `${owner.firstName} ${owner.secondName} ${owner.accountNumber}` : tx.userId;
      return (
        tx.title.toLowerCase().includes(q) ||
        tx.reference.toLowerCase().includes(q) ||
        tx.channel.toLowerCase().includes(q) ||
        ownerLabel.toLowerCase().includes(q)
      );
    });
  }, [props.transactions, props.users, auditSearch, auditCategory]);

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

          <div className="flex items-center gap-3 shrink-0">
            {props.notifications && props.onMarkNotificationRead && (
              <NotificationsBell
                notifications={props.notifications}
                onMarkRead={props.onMarkNotificationRead}
              />
            )}
            <ColorChangingClock />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1200px] w-full mx-auto space-y-6">
          {/* 1. Admin Dashboard Overview */}
          {section === 'dashboard' && (
            <div className="space-y-6">
              <div className="bg-white/95 border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 sm:divide-x divide-slate-200">
                <div className="p-5">
                  <p className="text-xs text-slate-500">Registered Users</p>
                  <p className="font-mono text-2xl font-semibold text-[#071B38] mt-1 tabular-nums">
                    {combinedDirectoryUsers.length}
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
                      onClick={() => handleSelectSection('services_crypto')}
                      className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between"
                    >
                      <span>Airtime / Internet &amp; USDT / Binance Queue</span>
                      <span className="font-mono font-semibold text-[#071B38]">
                        {pendingAirtime + pendingUsdt}
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
                      <p>MoMo Pay Code: {props.settings.momoPayCode}*amount# | 10% P2P Tax: {props.settings.sendMoneyTaxPercent ?? 10}%</p>
                      <p>FX Rate: 1 USD = {formatRwf(props.settings.rwfPerUsdRate ?? 1380)} | 10% Tax Collected: {formatRwf(totalP2pTaxRwf)}</p>
                      <p>Activation Fee: {formatRwf(props.settings.activationFeeRwf)} | Bonus: {formatRwf(props.settings.welcomeBonusRwf)}</p>
                      <p>Daily Check-In: {formatRwf(props.settings.dailyCheckInRwf)} | Min Video: {formatRwf(props.settings.minVideoRewardRwf)}/view</p>
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
              <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    All registered users (Firebase Auth &amp; Firestore Directory)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Full user directory ({combinedDirectoryUsers.length} total · {props.users.length} Firestore profiles
                    {props.adminUsersMeta?.authLookupAvailable
                      ? ` · ${props.adminUsersMeta.totalAuthUsers} Firebase Auth accounts`
                      : ''}
                    )
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {props.onRefreshUsers && (
                    <button
                      type="button"
                      disabled={refreshingUsers}
                      onClick={async () => {
                        if (!props.onRefreshUsers) return;
                        setRefreshingUsers(true);
                        setRefreshUsersNotice(null);
                        try {
                          const res = await props.onRefreshUsers();
                          if (res.error) {
                            setRefreshUsersNotice(`Refresh error: ${res.error}`);
                          } else {
                            setRefreshUsersNotice(`Synced ${res.count} user records from Firebase.`);
                          }
                        } finally {
                          setRefreshingUsers(false);
                        }
                      }}
                      className="h-9 px-3 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-60 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                    >
                      {refreshingUsers ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>{refreshingUsers ? 'Syncing…' : 'Refresh All Users'}</span>
                    </button>
                  )}
                </div>
              </div>

              {refreshUsersNotice && (
                <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs font-medium text-emerald-800">
                  {refreshUsersNotice}
                </div>
              )}

              {props.adminUsersMeta?.authLookupAvailable === false && (
                <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-900">
                  Displaying all {props.users.length} Firestore user profiles. Firebase Auth-only account listing (accounts without a Firestore profile yet) requires Admin SDK IAM read access on project <span className="font-mono">e-finance-2026</span>.
                </div>
              )}

              {/* Search, Filter & Page Size Controls */}
              <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search name, email, phone, UID, National ID, or account..."
                    className="w-full h-9 pl-8 pr-3 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                    className="h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="all">All Statuses ({combinedDirectoryUsers.length})</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="awaiting_payment">Awaiting Activation Payment</option>
                    <option value="payment_submitted">Payment Submitted</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="auth_only">Firebase Auth Only (Missing Profile)</option>
                  </select>
                  <select
                    value={usersPageSize}
                    onChange={(e) => setUsersPageSize(Number(e.target.value) || 25)}
                    className="h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                    aria-label="Users per page"
                  >
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>
              </div>

              {filteredDirectoryUsers.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  {combinedDirectoryUsers.length === 0
                    ? 'No users have registered yet. New registrations appear here immediately.'
                    : 'No users match the current search or filter.'}
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-200">
                    {paginatedDirectoryUsers.map((row) => {
                      if (row.kind === 'auth_only') {
                        const a = row.authMeta;
                        return (
                          <div
                            key={row.uid}
                            className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/40"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-16 h-16 rounded-xl bg-slate-200 border border-slate-300 shrink-0 flex items-center justify-center text-slate-500 text-xs font-mono">
                                AUTH
                              </div>
                              <div className="space-y-1 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm font-bold text-[#071B38]">
                                    {a.displayName || a.email || a.uid}
                                  </h3>
                                  <StatusLabel label="Auth Only (No Profile)" tone="warning" />
                                  {a.disabled && <StatusLabel label="Disabled in Auth" tone="danger" />}
                                  <StatusLabel
                                    label={a.emailVerified ? 'Email Verified' : 'Unverified Email'}
                                    tone={a.emailVerified ? 'success' : 'neutral'}
                                  />
                                </div>
                                <p className="text-slate-600 font-mono">
                                  UID: {a.uid} · {a.email || 'No email'} {a.phone ? `· ${a.phone}` : ''}
                                </p>
                                <p className="text-slate-500 text-[11px] font-mono">
                                  Created: {a.authCreatedAt ? formatDateTime(a.authCreatedAt) : '—'} · Last Sign-In:{' '}
                                  {a.lastSignInAt ? formatDateTime(a.lastSignInAt) : '—'}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      const u = row.user;
                      const authMeta = row.authMeta;
                      return (
                        <div key={u.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            {u.photoDataUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: u.photoDataUrl,
                                    caption: `${u.firstName} ${u.secondName} — Registration Photo`,
                                  })
                                }
                                className="group relative shrink-0"
                                title="View full photo"
                              >
                                <img
                                  src={u.photoDataUrl}
                                  alt={`${u.firstName} ${u.secondName}`}
                                  className="w-16 h-16 rounded-xl object-cover border border-slate-300 group-hover:opacity-90"
                                />
                                <span className="absolute bottom-1 right-1 bg-slate-900/75 text-white p-0.5 rounded">
                                  <Eye className="w-3 h-3" />
                                </span>
                              </button>
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 shrink-0" />
                            )}
                            <div className="space-y-1 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-bold text-[#071B38]">
                                  {u.firstName || 'Unnamed'} {u.secondName}
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
                                {authMeta ? (
                                  <StatusLabel
                                    label={
                                      authMeta.emailVerified
                                        ? 'Auth + Firestore (Verified)'
                                        : 'Auth + Firestore'
                                    }
                                    tone="neutral"
                                  />
                                ) : (
                                  <StatusLabel label="Firestore Profile" tone="neutral" />
                                )}
                              </div>
                              <p className="text-slate-600">
                                {u.email || '—'} · <span className="font-mono">{u.phone || '—'}</span> · ID:{' '}
                                <span className="font-mono">{u.idNumber || '—'}</span> · {u.gender} (
                                {u.dateOfBirth || '—'})
                              </p>
                              <p className="text-slate-600">
                                <strong>{u.education?.type ?? 'University'}:</strong>{' '}
                                {u.education?.institutionName || '—'} ({u.education?.levelOrClass || '—'},{' '}
                                {u.education?.facultyOrCombination || '—'})
                              </p>
                              <p className="text-slate-600">
                                <strong>Birth:</strong> {u.residence?.placeOfBirth || '—'}
                                {u.residence?.province ? ` · ${u.residence.province}` : ''}
                                {u.residence?.akarere
                                  ? ` · Residence: ${u.residence.akarere} / ${u.residence.umurenge ?? '-'} / ${u.residence.akagari ?? '-'} / ${u.residence.umudugudu ?? '-'}`
                                  : ''}
                              </p>
                              <p className="text-[11px] font-mono text-slate-400">
                                UID: {u.id} · Registered: {u.createdAt ? formatDateTime(u.createdAt) : '—'}
                                {authMeta?.lastSignInAt
                                  ? ` · Last Sign-In: ${formatDateTime(authMeta.lastSignInAt)}`
                                  : ''}
                              </p>
                              {u.activationPaymentRef && (
                                <p className="font-mono text-blue-800">
                                  Activation MoMo Ref: {u.activationPaymentRef} ({u.activationPaidPhone})
                                </p>
                              )}
                              <p className="font-mono text-slate-800 tabular-nums">
                                Wallet: <strong>{formatRwf(u.walletBalanceRwf)}</strong> · Saved:{' '}
                                <strong>{formatRwf(u.savingsBalanceRwf)}</strong> · USDT:{' '}
                                <strong>{formatUsdt(u.usdtBalance ?? 0)}</strong> · KYC: {u.kycStatus}
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
                            {(u.accountStatus === 'awaiting_payment' ||
                              u.accountStatus === 'payment_submitted') && (
                              <button
                                type="button"
                                onClick={() => props.onActivateUserWithBonus(u.id)}
                                className="h-9 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg"
                              >
                                Confirm {props.settings.activationFeeRwf} RWF &amp; Grant{' '}
                                {props.settings.welcomeBonusRwf} Bonus
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
                                className="h-9 px-3 border border-slate-300 bg-white hover:bg-amber-50 text-xs font-semibold rounded-lg text-slate-700"
                              >
                                {u.accountStatus === 'suspended' ? 'Unsuspend' : 'Suspend'}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUser(u)}
                              className="h-9 px-3 border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Footer */}
                  <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                    <span className="font-mono">
                      Showing {(safeUserPage - 1) * usersPageSize + 1}–
                      {Math.min(safeUserPage * usersPageSize, filteredDirectoryUsers.length)} of{' '}
                      {filteredDirectoryUsers.length} users
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={safeUserPage <= 1}
                        onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                        className="h-8 px-2.5 border border-slate-300 bg-white rounded-md font-semibold disabled:opacity-40 inline-flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Previous</span>
                      </button>
                      <span className="font-mono px-2">
                        Page {safeUserPage} of {totalUserPages}
                      </span>
                      <button
                        type="button"
                        disabled={safeUserPage >= totalUserPages}
                        onClick={() => setUsersPage((p) => Math.min(totalUserPages, p + 1))}
                        className="h-8 px-2.5 border border-slate-300 bg-white rounded-md font-semibold disabled:opacity-40 inline-flex items-center gap-1"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
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
                        <div className="flex flex-col sm:flex-row items-start gap-4">
                          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                            {u.kycData?.idDocumentPhotoDataUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: u.kycData!.idDocumentPhotoDataUrl,
                                    caption: `${u.firstName} ${u.secondName} — Rwanda National ID Photo`,
                                  })
                                }
                                className="group text-left"
                              >
                                <img
                                  src={u.kycData.idDocumentPhotoDataUrl}
                                  alt="Rwanda National ID document"
                                  className="w-28 h-20 rounded-lg object-cover border border-slate-300 group-hover:ring-2 group-hover:ring-blue-600"
                                />
                                <span className="block text-[10px] font-semibold text-blue-800 mt-1 text-center">
                                  Click: National ID
                                </span>
                              </button>
                            )}
                            {u.kycData?.selfiePhotoDataUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: u.kycData!.selfiePhotoDataUrl!,
                                    caption: `${u.firstName} ${u.secondName} — KYC Selfie Proof`,
                                  })
                                }
                                className="group text-left"
                              >
                                <img
                                  src={u.kycData.selfiePhotoDataUrl}
                                  alt="Member KYC selfie"
                                  className="w-20 h-20 rounded-lg object-cover border border-slate-300 group-hover:ring-2 group-hover:ring-blue-600"
                                />
                                <span className="block text-[10px] font-semibold text-blue-800 mt-1 text-center">
                                  Click: KYC Selfie
                                </span>
                              </button>
                            )}
                            {u.photoDataUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: u.photoDataUrl,
                                    caption: `${u.firstName} ${u.secondName} — Profile Photo`,
                                  })
                                }
                                className="group text-left"
                              >
                                <img
                                  src={u.photoDataUrl}
                                  alt="Member profile"
                                  className="w-20 h-20 rounded-lg object-cover border border-slate-300 group-hover:ring-2 group-hover:ring-blue-600"
                                />
                                <span className="block text-[10px] font-semibold text-blue-800 mt-1 text-center">
                                  Click: Profile Photo
                                </span>
                              </button>
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

          {/* New Section: Airtime/Internet & USDT/Binance Approval Desk */}
          {section === 'services_crypto' && (
            <div className="space-y-6">
              <section className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Airtime &amp; Internet Bundle Orders (MTN &amp; Airtel)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Approve after sending airtime/data to the user phone number, or reject to refund their RWF wallet.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    {pendingAirtime} pending
                  </span>
                </div>
                {props.airtimeRequests.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No airtime or internet bundle orders yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {props.airtimeRequests.map((req) => (
                      <div key={req.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {req.userName} · {req.network} {req.serviceType}
                            {req.bundleLabel ? ` (${req.bundleLabel})` : ''}
                          </h3>
                          <p className="text-xs font-mono text-slate-600">
                            Phone: <strong>{req.phoneNumber}</strong> · Amount:{' '}
                            <strong className="text-[#071B38]">{formatRwf(req.amountRwf)}</strong>
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">
                            {formatDateTime(req.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusLabel
                            label={req.status}
                            tone={
                              req.status === 'approved'
                                ? 'success'
                                : req.status === 'rejected'
                                  ? 'danger'
                                  : 'warning'
                            }
                          />
                          {req.status === 'pending_admin' && (
                            <>
                              <button
                                type="button"
                                onClick={() => props.onReviewAirtime(req.id, 'approved')}
                                className="h-8 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-md"
                              >
                                Accept &amp; Mark Delivered
                              </button>
                              <button
                                type="button"
                                onClick={() => props.onReviewAirtime(req.id, 'rejected')}
                                className="h-8 px-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-md"
                              >
                                Reject &amp; Refund
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      USDT Deposits, Withdrawals &amp; Send to Binance Requests
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Approve USDT deposits to credit user USDT balances, or approve Binance sends &amp; USDT withdrawals after sending.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    {pendingUsdt} pending
                  </span>
                </div>
                {props.usdtRequests.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No USDT or Binance requests yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {props.usdtRequests.map((req) => (
                      <div key={req.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {req.userName} ·{' '}
                            {req.actionType === 'deposit'
                              ? 'USDT Deposit'
                              : req.actionType === 'send_binance'
                                ? 'Send USDT to Binance'
                                : 'Withdraw USDT'}{' '}
                            · <span className="font-mono text-emerald-700">{formatUsdt(req.amountUsdt)}</span>
                          </h3>
                          <p className="text-xs font-mono text-slate-600 break-all">
                            {req.network} · Ref/Address: <strong>{req.destinationOrTxRef}</strong>
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">
                            {formatDateTime(req.createdAt)} {req.note ? `· Note: ${req.note}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <StatusLabel
                            label={req.status}
                            tone={
                              req.status === 'approved'
                                ? 'success'
                                : req.status === 'rejected'
                                  ? 'danger'
                                  : 'warning'
                            }
                          />
                          {req.status === 'pending_admin' && (
                            <>
                              <button
                                type="button"
                                onClick={() => props.onReviewUsdtRequest(req.id, 'approved')}
                                className="h-8 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-md"
                              >
                                {req.actionType === 'deposit'
                                  ? 'Verify & Credit USDT'
                                  : req.actionType === 'send_binance'
                                    ? 'Approve After Binance Send'
                                    : 'Approve USDT Withdrawal'}
                              </button>
                              <button
                                type="button"
                                onClick={() => props.onReviewUsdtRequest(req.id, 'rejected')}
                                className="h-8 px-3 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold rounded-md"
                              >
                                {req.actionType === 'deposit' ? 'Reject' : 'Reject & Refund USDT'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* New Section: Transactions Audit, 10% P2P System Tax & FX/Bet Overview */}
          {section === 'transactions_audit' && (
            <div className="space-y-6">
              <div className="bg-white/95 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                <div className="p-5">
                  <p className="text-xs text-slate-500">10% Send Money Tax Collected</p>
                  <p className="font-mono text-2xl font-semibold text-emerald-700 mt-1 tabular-nums">
                    {formatRwf(totalP2pTaxRwf)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {props.p2pTransfers.length} P2P transfers
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">Total P2P Transfer Volume</p>
                  <p className="font-mono text-2xl font-semibold text-[#071B38] mt-1 tabular-nums">
                    {formatRwf(totalP2pVolumeRwf)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Address-to-address RWF</p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">10s Quiz Bet Volume</p>
                  <p className="font-mono text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
                    {formatRwf(props.betSessions.reduce((s, b) => s + b.stakeRwf, 0))}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {props.betSessions.length} rounds ({formatRwf(props.betSessions.reduce((s, b) => s + b.payoutRwf, 0))} paid out)
                  </p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">All Ledger Transactions</p>
                  <p className="font-mono text-2xl font-semibold text-blue-800 mt-1 tabular-nums">
                    {props.transactions.length}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {props.fxExchanges.length} FX conversions
                  </p>
                </div>
              </div>

              {/* P2P Transfers & 10% Tax Table */}
              <section className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-base font-semibold text-slate-900">
                    P2P Send Money Ledger &amp; {props.settings.sendMoneyTaxPercent ?? 10}% System Tax
                  </h2>
                </div>
                {props.p2pTransfers.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No user-to-user transfers recorded yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2.5 px-4">Sender</th>
                          <th className="py-2.5 px-4">Receiver</th>
                          <th className="py-2.5 px-4 text-right">Gross Sent</th>
                          <th className="py-2.5 px-4 text-right">System Tax</th>
                          <th className="py-2.5 px-4 text-right">Net Delivered</th>
                          <th className="py-2.5 px-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {props.p2pTransfers.map((tr) => (
                          <tr key={tr.id}>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900">{tr.senderName}</p>
                              <p className="font-mono text-[11px] text-slate-500">{tr.senderAddress}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900">{tr.receiverName}</p>
                              <p className="font-mono text-[11px] text-slate-500">{tr.receiverAddress}</p>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              {formatRwf(tr.grossAmountRwf)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 tabular-nums">
                              +{formatRwf(tr.taxRwf)} ({tr.taxPercent}%)
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                              {formatRwf(tr.netAmountRwf)}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500 tabular-nums">
                              {formatDateTime(tr.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* All Platform Transactions */}
              <section className="bg-white/95 border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900">
                    All Member Transactions History
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={auditCategory}
                      onChange={(e) => setAuditCategory(e.target.value)}
                      className="h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      {[
                        'All',
                        'Transfer Sent',
                        'Transfer Received',
                        'Airtime & Data',
                        'Quiz Bet',
                        'Quiz Win',
                        'Currency Exchange',
                        'USDT Deposit',
                        'USDT Savings',
                        'USDT Send / Withdraw',
                        'Withdrawal',
                        'Savings',
                        'Loan',
                        'Bonus',
                        'Check-In',
                        'Video Reward',
                        'Task Reward',
                      ].map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        placeholder="Search member or ref..."
                        className="h-9 pl-8 pr-3 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {filteredTransactions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No matching transactions found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-2.5 px-4">Member</th>
                          <th className="py-2.5 px-4">Reference</th>
                          <th className="py-2.5 px-4">Operation</th>
                          <th className="py-2.5 px-4">Category</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredTransactions.slice(0, 100).map((tx) => {
                          const owner = props.users.find((u) => u.id === tx.userId);
                          return (
                            <tr key={tx.id}>
                              <td className="py-3 px-4 font-medium text-slate-900">
                                {owner ? `${owner.firstName} ${owner.secondName}` : tx.userId}
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-600">{tx.reference}</td>
                              <td className="py-3 px-4">
                                <p className="font-medium text-slate-900">{tx.title}</p>
                                <p className="text-[11px] text-slate-500">{tx.channel}</p>
                              </td>
                              <td className="py-3 px-4 text-slate-600">{tx.category}</td>
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
                              <td
                                className={`py-3 px-4 text-right font-mono font-semibold tabular-nums ${
                                  tx.direction === 'credit' ? 'text-emerald-700' : 'text-slate-900'
                                }`}
                              >
                                {tx.direction === 'credit' ? '+' : '-'}
                                {formatRwf(tx.amountRwf)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* 4. Videos & Tasks Moderation + Admin Direct Publishing */}
          {section === 'videos_tasks' && (
            <div className="space-y-6">
              {/* Admin Direct Create Video & Task Forms */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-white/95 border border-slate-200 rounded-xl p-6 space-y-3.5">
                  <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        Admin Publish Short Video (Instant Active)
                      </h2>
                      <p className="text-xs text-slate-500">
                        Directly add a watch-to-earn short video for all members.
                      </p>
                    </div>
                    <PlusCircle className="w-5 h-5 text-blue-800" />
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setVidError(null);
                      setVidNotice(null);
                      if (vidTitle.trim().length < 3) {
                        setVidError('Enter a video title (at least 3 characters).');
                        return;
                      }
                      if (!vidFile && !vidUrl.trim()) {
                        setVidError('Upload a video file (max 6 MB) or paste a valid video URL.');
                        return;
                      }
                      const reqSec = Math.max(5, Math.min(600, Math.round(Number(vidRequiredSec) || 15)));
                      setVidUploading(true);
                      setVidProgress(vidFile ? { percent: 5, stage: 'Starting upload…' } : null);
                      try {
                        const errMsg = await props.onAdminCreateVideoCampaign({
                          title: vidTitle.trim(),
                          description: vidDesc.trim() || 'Official E-Finance Rwanda video campaign',
                          videoUrl: vidUrl.trim(),
                          videoFile: vidFile,
                          requiredWatchSeconds: reqSec,
                          rewardPerViewRwf: Math.max(props.settings.minVideoRewardRwf, Number(vidReward) || 50),
                          targetViewers: Math.max(1, Number(vidTarget) || 20),
                          onUploadProgress: (percent, stage) => setVidProgress({ percent, stage }),
                        });
                        if (errMsg) {
                          setVidError(errMsg);
                          return;
                        }
                        setVidTitle('');
                        setVidDesc('');
                        setVidUrl('');
                        if (vidPreviewUrl) URL.revokeObjectURL(vidPreviewUrl);
                        setVidPreviewUrl(null);
                        setVidFile(null);
                        setVidRequiredSec('15');
                        setVidNotice('Short video published immediately as active!');
                        setTimeout(() => setVidNotice(null), 4000);
                      } catch (err) {
                        setVidError(err instanceof Error ? err.message : 'Unable to publish video.');
                      } finally {
                        setVidUploading(false);
                        setVidProgress(null);
                      }
                    }}
                    className="space-y-3"
                  >
                    <input
                      type="text"
                      value={vidTitle}
                      onChange={(e) => setVidTitle(e.target.value)}
                      placeholder="Video Title *"
                      required
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                    />
                    <input
                      type="text"
                      value={vidDesc}
                      onChange={(e) => setVidDesc(e.target.value)}
                      placeholder="Short description..."
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={vidFile ? '' : vidUrl}
                        onChange={(e) => {
                          if (vidPreviewUrl) URL.revokeObjectURL(vidPreviewUrl);
                          setVidPreviewUrl(null);
                          setVidFile(null);
                          setVidUrl(e.target.value);
                        }}
                        placeholder="Paste MP4, YouTube, Vimeo, or Google Drive URL →"
                        className="flex-1 h-10 px-3 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      />
                      <label className="cursor-pointer h-10 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{vidFile ? 'Replace File' : 'Upload File (6 MB)'}</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/ogg,video/*"
                          onChange={(e) => {
                            setVidError(null);
                            const f = e.target.files?.[0];
                            if (!f) return;
                            if (f.size > MAX_LOCAL_VIDEO_FILE_BYTES) {
                              setVidError(
                                `Video (${formatBytes(f.size)}) exceeds the 6 MB upload limit. Compress under 6 MB or paste a URL.`,
                              );
                              return;
                            }
                            if (vidPreviewUrl) URL.revokeObjectURL(vidPreviewUrl);
                            setVidFile(f);
                            setVidUrl('');
                            setVidPreviewUrl(URL.createObjectURL(f));
                            e.target.value = '';
                          }}
                          className="sr-only"
                        />
                      </label>
                    </div>
                    {vidFile && (
                      <div className="flex items-center justify-between gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        <span className="truncate font-medium">
                          Ready: {vidFile.name} ({formatBytes(vidFile.size)})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (vidPreviewUrl) URL.revokeObjectURL(vidPreviewUrl);
                            setVidPreviewUrl(null);
                            setVidFile(null);
                          }}
                          className="text-slate-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {vidPreviewUrl && (
                      <video
                        src={vidPreviewUrl}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full max-h-36 rounded-lg bg-black border border-slate-200"
                      />
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">
                          Required Watch (sec)
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={600}
                          value={vidRequiredSec}
                          onChange={(e) => setVidRequiredSec(e.target.value)}
                          required
                          className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">
                          Reward / View (Min {props.settings.minVideoRewardRwf})
                        </label>
                        <input
                          type="number"
                          min={props.settings.minVideoRewardRwf}
                          value={vidReward}
                          onChange={(e) => setVidReward(e.target.value)}
                          required
                          className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">
                          Target Viewers
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={vidTarget}
                          onChange={(e) => setVidTarget(e.target.value)}
                          required
                          className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                    {vidProgress && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                          <span>{vidProgress.stage}</span>
                          <span className="font-mono">{vidProgress.percent}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#071B38] transition-all duration-300"
                            style={{ width: `${vidProgress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {vidError && <p className="text-xs font-semibold text-red-700">{vidError}</p>}
                    {vidNotice && <p className="text-xs font-semibold text-emerald-700">{vidNotice}</p>}
                    <button
                      type="submit"
                      disabled={vidUploading}
                      className="w-full h-10 bg-[#071B38] hover:bg-[#0c2954] disabled:opacity-60 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2"
                    >
                      {vidUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{vidUploading ? 'Uploading & Publishing…' : 'Publish Active Video Now'}</span>
                    </button>
                  </form>
                </section>

                <section className="bg-white/95 border border-slate-200 rounded-xl p-6 space-y-3.5">
                  <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        Admin Publish Paid Task (Instant Active)
                      </h2>
                      <p className="text-xs text-slate-500">
                        Directly create a task (optionally with an in-app video) for members to complete.
                      </p>
                    </div>
                    <PlusCircle className="w-5 h-5 text-emerald-700" />
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setTskError(null);
                      setTskNotice(null);
                      if (tskTitle.trim().length < 3 || tskReqs.trim().length < 5) {
                        setTskError('Provide a task title and clear requirements.');
                        return;
                      }
                      const reqSec = Math.max(5, Math.min(600, Math.round(Number(tskRequiredSec) || 15)));
                      setTskUploading(true);
                      setTskProgress(tskVideoFile ? { percent: 5, stage: 'Uploading task video…' } : null);
                      try {
                        const errMsg = await props.onAdminCreateCustomTask({
                          title: tskTitle.trim(),
                          requirements: tskReqs.trim(),
                          videoUrl: tskVideoUrl.trim() || undefined,
                          videoFile: tskVideoFile,
                          requiredWatchSeconds: tskVideoFile || tskVideoUrl.trim() ? reqSec : undefined,
                          rewardPerCompletionRwf: Math.max(20, Number(tskReward) || 50),
                          targetCompletions: Math.max(1, Number(tskTarget) || 20),
                          onUploadProgress: (percent, stage) => setTskProgress({ percent, stage }),
                        });
                        if (errMsg) {
                          setTskError(errMsg);
                          return;
                        }
                        setTskTitle('');
                        setTskReqs('');
                        setTskVideoUrl('');
                        if (tskPreviewUrl) URL.revokeObjectURL(tskPreviewUrl);
                        setTskPreviewUrl(null);
                        setTskVideoFile(null);
                        setTskRequiredSec('15');
                        setTskNotice('Paid task published immediately as active!');
                        setTimeout(() => setTskNotice(null), 4000);
                      } catch (err) {
                        setTskError(err instanceof Error ? err.message : 'Unable to create task.');
                      } finally {
                        setTskUploading(false);
                        setTskProgress(null);
                      }
                    }}
                    className="space-y-3"
                  >
                    <input
                      type="text"
                      value={tskTitle}
                      onChange={(e) => setTskTitle(e.target.value)}
                      placeholder="Task Title *"
                      required
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                    />
                    <textarea
                      rows={2}
                      value={tskReqs}
                      onChange={(e) => setTskReqs(e.target.value)}
                      placeholder="Exact requirements members must prove..."
                      required
                      className="w-full p-3 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={tskVideoFile ? '' : tskVideoUrl}
                        onChange={(e) => {
                          if (tskPreviewUrl) URL.revokeObjectURL(tskPreviewUrl);
                          setTskPreviewUrl(null);
                          setTskVideoFile(null);
                          setTskVideoUrl(e.target.value);
                        }}
                        placeholder="Optional Task Video URL (YouTube/MP4/Vimeo)"
                        className="flex-1 h-9 px-3 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      />
                      <label className="cursor-pointer h-9 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{tskVideoFile ? 'Replace' : 'Video (6 MB)'}</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/ogg,video/*"
                          onChange={(e) => {
                            setTskError(null);
                            const f = e.target.files?.[0];
                            if (!f) return;
                            if (f.size > MAX_LOCAL_VIDEO_FILE_BYTES) {
                              setTskError(`Task video (${formatBytes(f.size)}) exceeds the 6 MB limit.`);
                              return;
                            }
                            if (tskPreviewUrl) URL.revokeObjectURL(tskPreviewUrl);
                            setTskVideoFile(f);
                            setTskVideoUrl('');
                            setTskPreviewUrl(URL.createObjectURL(f));
                            e.target.value = '';
                          }}
                          className="sr-only"
                        />
                      </label>
                    </div>
                    {tskVideoFile && (
                      <div className="flex items-center justify-between gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        <span className="truncate font-medium">
                          Ready: {tskVideoFile.name} ({formatBytes(tskVideoFile.size)})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (tskPreviewUrl) URL.revokeObjectURL(tskPreviewUrl);
                            setTskPreviewUrl(null);
                            setTskVideoFile(null);
                          }}
                          className="text-slate-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">
                          Watch Req (sec)
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={600}
                          value={tskRequiredSec}
                          onChange={(e) => setTskRequiredSec(e.target.value)}
                          className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">
                          Reward / Completion
                        </label>
                        <input
                          type="number"
                          min={20}
                          value={tskReward}
                          onChange={(e) => setTskReward(e.target.value)}
                          required
                          className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">
                          Target Completions
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={tskTarget}
                          onChange={(e) => setTskTarget(e.target.value)}
                          required
                          className="w-full h-9 px-3 text-xs font-mono border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                    {tskProgress && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                          <span>{tskProgress.stage}</span>
                          <span className="font-mono">{tskProgress.percent}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-700 transition-all duration-300"
                            style={{ width: `${tskProgress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {tskError && <p className="text-xs font-semibold text-red-700">{tskError}</p>}
                    {tskNotice && <p className="text-xs font-semibold text-emerald-700">{tskNotice}</p>}
                    <button
                      type="submit"
                      disabled={tskUploading}
                      className="w-full h-10 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2"
                    >
                      {tskUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{tskUploading ? 'Uploading & Publishing…' : 'Publish Active Task Now'}</span>
                    </button>
                  </form>
                </section>
              </div>

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
                              By {camp.creatorName} · {camp.watchedByUserIds.length}/{camp.targetViewers} views ·{' '}
                              {camp.requiredWatchSeconds ?? 15}s req · {formatRwf(camp.rewardPerViewRwf)}/view ={' '}
                              {formatRwf(camp.totalBudgetRwf)} · Code: {camp.paymentCode} · Ref: {camp.paymentRef}
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
                        <div className="max-w-lg">
                          <SmartVideoPlayer
                            videoUrl={camp.videoUrl}
                            title={camp.title}
                            compact
                            trackWatchCompletion={false}
                          />
                        </div>
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
                      <div key={task.id} className="p-5 space-y-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                              {task.videoUrl && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[11px] font-mono text-blue-900">
                                  <Clock className="w-3 h-3" />
                                  {task.requiredWatchSeconds ?? 15}s Video Attached
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-mono text-slate-500 mt-0.5">
                              By {task.creatorName} · {formatRwf(task.rewardPerCompletionRwf)} × {task.targetCompletions} = {formatRwf(task.totalBudgetRwf)} · Ref: {task.paymentRef}
                            </p>
                          </div>
                          <StatusLabel
                            label={task.status}
                            tone={task.status === 'active' || task.status === 'completed' ? 'success' : task.status === 'rejected' ? 'danger' : 'warning'}
                          />
                        </div>
                        <p className="text-xs text-slate-600">{task.requirements}</p>
                        {task.videoUrl && (
                          <div className="max-w-lg pt-1">
                            <SmartVideoPlayer
                              videoUrl={task.videoUrl}
                              title={task.title}
                              compact
                              trackWatchCompletion={false}
                            />
                          </div>
                        )}
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
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Send Money System Tax (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={settingsDraft.sendMoneyTaxPercent ?? 10}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          sendMoneyTaxPercent: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      FX Rate (RWF per 1 USD)
                    </label>
                    <input
                      type="number"
                      min={100}
                      value={settingsDraft.rwfPerUsdRate ?? 1380}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          rwfPerUsdRate: Number(e.target.value) || 1380,
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
                    E-Finance Binance / USDT Deposit Address (Shown to Members)
                  </label>
                  <input
                    type="text"
                    value={settingsDraft.binanceDepositAddress ?? ''}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, binanceDepositAddress: e.target.value })
                    }
                    className="w-full h-10 px-3 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                  />
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
                  value={editingUser.residence?.akarere ?? ''}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      residence: { ...(editingUser.residence ?? { placeOfBirth: '' }), akarere: e.target.value },
                    })
                  }
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Umurenge</label>
                <input
                  type="text"
                  value={editingUser.residence?.umurenge ?? ''}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      residence: { ...(editingUser.residence ?? { placeOfBirth: '' }), umurenge: e.target.value },
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

      {/* Delete User Confirmation Modal */}
      {confirmDeleteUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h2 className="font-display text-lg font-bold text-red-800">
              Delete Member Account?
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong>
                {confirmDeleteUser.firstName} {confirmDeleteUser.secondName}
              </strong>{' '}
              ({confirmDeleteUser.accountNumber}) and their associated platform records? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteUser(null)}
                className="h-9 px-4 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  props.onDeleteUser(confirmDeleteUser.id);
                  setConfirmDeleteUser(null);
                }}
                className="h-9 px-4 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Resolution Photo Lightbox Modal (KYC & Member Photos) */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <p className="text-sm font-bold text-[#071B38]">{previewPhoto.caption}</p>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                aria-label="Close photo preview"
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-center bg-slate-100 rounded-xl overflow-hidden max-h-[75vh]">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.caption}
                className="max-h-[72vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

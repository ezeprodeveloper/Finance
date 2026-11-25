import type {
  AdminPromotion,
  AirtimeRequest,
  BetSession,
  CustomTask,
  FxExchangeRecord,
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
  WalletAddressRecord,
  WithdrawalRequest,
} from '../types/finance';

export class ApiError extends Error {
  status: number;
  data?: Record<string, unknown>;

  constructor(message: string, status: number, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const fallbackMessage =
      res.status === 404
        ? 'API endpoint unavailable (404). Verify the backend server or serverless /api function is deployed.'
        : `Request failed (${res.status})`;
    throw new ApiError(
      typeof data.error === 'string' ? data.error : fallbackMessage,
      res.status,
      data,
    );
  }
  return data as T;
}

export interface SetupStatusResponse {
  dbReady: boolean;
  engine: 'postgres' | 'sqlite' | 'unconfigured';
  needsVercelPostgresStore: boolean;
  error: string | null;
  adminConfigured: boolean;
  migrationsApplied: number[];
  newlyApplied: number[];
  alreadyInitialized?: boolean;
  setupMessage?: string;
}

export interface PublicBootstrapResponse {
  settings: SystemSettings;
  promotions: AdminPromotion[];
  totalActiveVideos: number;
  totalActiveTasks: number;
}

export interface MemberStateResponse {
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
}

export interface AdminStateResponse {
  settings: SystemSettings;
  users: RegisteredUser[];
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
  promotions: AdminPromotion[];
}

export type LoginResponse =
  | { token: string; role: 'admin' }
  | { token: string; role: 'user'; user: RegisteredUser };

export const apiClient = {
  getSetupStatus: () => request<SetupStatusResponse>('/api/setup/status'),

  getPublicBootstrap: () => request<PublicBootstrapResponse>('/api/public/bootstrap'),

  getAdminStatus: () =>
    request<{ adminEmail: string; configured: boolean }>('/api/auth/admin-status'),

  claimAdminPassword: (email: string, password: string) =>
    request<{ token: string; role: 'admin' }>('/api/auth/admin-claim', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (identifier: string, password: string) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),

  register: (payload: {
    firstName: string;
    secondName: string;
    email: string;
    phone: string;
    gender: RegisteredUser['gender'];
    dateOfBirth: string;
    idNumber: string;
    photoDataUrl: string;
    education: RegisteredUser['education'];
    residence: RegisteredUser['residence'];
    rawPassword: string;
    referralCodeInput: string;
  }) =>
    request<{ token: string; role: 'user'; user: RegisteredUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: (token: string | null) =>
    request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }, token),

  // Member endpoints
  getMemberState: (token: string) =>
    request<MemberStateResponse>('/api/member/state', {}, token),

  submitActivation: (token: string, phone: string, ref: string) =>
    request<{ ok: boolean }>(
      '/api/member/activation',
      { method: 'POST', body: JSON.stringify({ phone, ref }) },
      token,
    ),

  dailyCheckIn: (token: string) =>
    request<{ ok: boolean }>('/api/member/check-in', { method: 'POST' }, token),

  submitKyc: (token: string, data: RwandaKycData) =>
    request<{ ok: boolean }>(
      '/api/member/kyc',
      { method: 'POST', body: JSON.stringify(data) },
      token,
    ),

  createSavingsGoal: (
    token: string,
    payload: { title: string; planType: SavingsGoal['planType']; targetRwf: number; targetDate: string },
  ) =>
    request<{ ok: boolean }>(
      '/api/member/savings/goals',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  depositSavings: (token: string, goalId: string, amountRwf: number) =>
    request<{ ok: boolean }>(
      '/api/member/savings/deposit',
      { method: 'POST', body: JSON.stringify({ goalId, amountRwf }) },
      token,
    ),

  withdrawSavings: (token: string, goalId: string, amountRwf: number) =>
    request<{ ok: boolean }>(
      '/api/member/savings/withdraw',
      { method: 'POST', body: JSON.stringify({ goalId, amountRwf }) },
      token,
    ),

  requestLoan: (
    token: string,
    payload: {
      product: string;
      reason: string;
      principalRwf: number;
      termMonths: number;
      annualRatePercent: number;
      monthlyPaymentRwf: number;
      totalRepayableRwf: number;
    },
  ) =>
    request<{ ok: boolean }>(
      '/api/member/loans/request',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  repayLoan: (token: string, loanId: string, amountRwf: number) =>
    request<{ ok: boolean }>(
      '/api/member/loans/repay',
      { method: 'POST', body: JSON.stringify({ loanId, amountRwf }) },
      token,
    ),

  purchaseInvestment: (token: string, tierId: string, paymentRef: string) =>
    request<{ ok: boolean }>(
      '/api/member/investments/purchase',
      { method: 'POST', body: JSON.stringify({ tierId, paymentRef }) },
      token,
    ),

  completeSpin: (token: string, rewardRwf: number) =>
    request<{ ok: boolean }>(
      '/api/member/spin/complete',
      { method: 'POST', body: JSON.stringify({ rewardRwf }) },
      token,
    ),

  requestWithdrawal: (
    token: string,
    payload: {
      network: 'MTN Rwanda' | 'Airtel / Tigo Rwanda';
      destinationType: 'Phone Number' | 'MoMo Pay Code';
      destinationValue: string;
      accountRegisteredNames: string;
      grossAmountRwf: number;
    },
  ) =>
    request<{ ok: boolean }>(
      '/api/member/withdrawals/request',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  watchVideoComplete: (token: string, campaignId: string) =>
    request<{ ok: boolean }>(
      '/api/member/videos/watch',
      { method: 'POST', body: JSON.stringify({ campaignId }) },
      token,
    ),

  createVideoCampaign: (
    token: string,
    payload: {
      title: string;
      description: string;
      videoUrl: string;
      rewardPerViewRwf: number;
      targetViewers: number;
      paymentRef: string;
    },
  ) =>
    request<{ ok: boolean }>(
      '/api/member/videos/create',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  submitTaskProof: (
    token: string,
    payload: { taskId: string; proofText: string; proofUrl?: string },
  ) =>
    request<{ ok: boolean }>(
      '/api/member/tasks/submit',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  createCustomTask: (
    token: string,
    payload: {
      title: string;
      requirements: string;
      rewardPerCompletionRwf: number;
      targetCompletions: number;
      paymentRef: string;
    },
  ) =>
    request<{ ok: boolean }>(
      '/api/member/tasks/create',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  startQuizBet: (token: string, stakeRwf: number) =>
    request<{ ok: boolean }>(
      '/api/member/quiz-bet/start',
      { method: 'POST', body: JSON.stringify({ stakeRwf }) },
      token,
    ),

  finishQuizBet: (token: string, session: BetSession) =>
    request<{ ok: boolean }>(
      '/api/member/quiz-bet/finish',
      { method: 'POST', body: JSON.stringify({ session }) },
      token,
    ),

  requestAirtime: (
    token: string,
    payload: {
      network: 'MTN Rwanda' | 'Airtel Rwanda';
      serviceType: 'Airtime' | 'Internet Bundle';
      phoneNumber: string;
      amountRwf: number;
      bundleLabel?: string;
    },
  ) =>
    request<{ ok: boolean }>(
      '/api/member/airtime/request',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  lookupWalletAddress: async (
    token: string,
    address: string,
  ): Promise<WalletAddressRecord | null> => {
    try {
      const res = await request<{ record: WalletAddressRecord }>(
        `/api/member/wallet-lookup?address=${encodeURIComponent(address)}`,
        {},
        token,
      );
      return res.record;
    } catch {
      return null;
    }
  },

  sendP2P: (
    token: string,
    payload: {
      receiverAddress: string;
      grossAmountRwf: number;
      note?: string;
    },
  ) =>
    request<{ ok: boolean }>(
      '/api/member/p2p/send',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  fxExchange: (
    token: string,
    direction: FxExchangeRecord['direction'],
    fromAmount: number,
  ) =>
    request<{ ok: boolean }>(
      '/api/member/fx/exchange',
      { method: 'POST', body: JSON.stringify({ direction, fromAmount }) },
      token,
    ),

  usdtSavingsMove: (token: string, action: 'deposit' | 'withdraw', amountUsdt: number) =>
    request<{ ok: boolean }>(
      '/api/member/usdt/savings',
      { method: 'POST', body: JSON.stringify({ action, amountUsdt }) },
      token,
    ),

  createUsdtRequest: (
    token: string,
    payload: {
      actionType: UsdtRequest['actionType'];
      amountUsdt: number;
      network: UsdtRequest['network'];
      destinationOrTxRef: string;
      note?: string;
    },
  ) =>
    request<{ ok: boolean }>(
      '/api/member/usdt/request',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  // Admin endpoints
  getAdminState: (token: string) =>
    request<AdminStateResponse>('/api/admin/state', {}, token),

  adminApproveUser: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(userId)}/approve`, { method: 'POST' }, token),

  adminActivateUser: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(userId)}/activate`, { method: 'POST' }, token),

  adminToggleSuspend: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(userId)}/toggle-suspend`, { method: 'POST' }, token),

  adminUpdateUser: (token: string, user: RegisteredUser) =>
    request<{ ok: boolean }>(
      `/api/admin/users/${encodeURIComponent(user.id)}`,
      { method: 'PUT', body: JSON.stringify(user) },
      token,
    ),

  adminDeleteUser: (token: string, userId: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' }, token),

  adminReviewKyc: (token: string, userId: string, decision: 'approved' | 'rejected', note?: string) =>
    request<{ ok: boolean }>(
      `/api/admin/users/${encodeURIComponent(userId)}/kyc`,
      { method: 'POST', body: JSON.stringify({ decision, note }) },
      token,
    ),

  adminCreateVideo: (
    token: string,
    payload: {
      title: string;
      description: string;
      videoUrl: string;
      rewardPerViewRwf: number;
      targetViewers: number;
    },
  ) =>
    request<{ ok: boolean }>(
      '/api/admin/videos/create',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  adminReviewVideo: (token: string, id: string, decision: 'active' | 'rejected') =>
    request<{ ok: boolean }>(
      `/api/admin/videos/${encodeURIComponent(id)}/review`,
      { method: 'POST', body: JSON.stringify({ decision }) },
      token,
    ),

  adminCreateTask: (
    token: string,
    payload: {
      title: string;
      requirements: string;
      rewardPerCompletionRwf: number;
      targetCompletions: number;
    },
  ) =>
    request<{ ok: boolean }>(
      '/api/admin/tasks/create',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  adminReviewTask: (token: string, id: string, decision: 'active' | 'rejected') =>
    request<{ ok: boolean }>(
      `/api/admin/tasks/${encodeURIComponent(id)}/review`,
      { method: 'POST', body: JSON.stringify({ decision }) },
      token,
    ),

  adminReviewSubmission: (
    token: string,
    id: string,
    decision: 'approved' | 'rejected',
    note?: string,
  ) =>
    request<{ ok: boolean }>(
      `/api/admin/submissions/${encodeURIComponent(id)}/review`,
      { method: 'POST', body: JSON.stringify({ decision, note }) },
      token,
    ),

  adminReviewLoan: (token: string, id: string, decision: 'approved' | 'rejected') =>
    request<{ ok: boolean }>(
      `/api/admin/loans/${encodeURIComponent(id)}/review`,
      { method: 'POST', body: JSON.stringify({ decision }) },
      token,
    ),

  adminReviewInvestment: (token: string, id: string, decision: 'active' | 'rejected') =>
    request<{ ok: boolean }>(
      `/api/admin/investments/${encodeURIComponent(id)}/review`,
      { method: 'POST', body: JSON.stringify({ decision }) },
      token,
    ),

  adminReviewWithdrawal: (token: string, id: string, decision: 'paid' | 'rejected') =>
    request<{ ok: boolean }>(
      `/api/admin/withdrawals/${encodeURIComponent(id)}/review`,
      { method: 'POST', body: JSON.stringify({ decision }) },
      token,
    ),

  adminReviewAirtime: (token: string, id: string, decision: 'approved' | 'rejected') =>
    request<{ ok: boolean }>(
      `/api/admin/airtime/${encodeURIComponent(id)}/review`,
      { method: 'POST', body: JSON.stringify({ decision }) },
      token,
    ),

  adminReviewUsdt: (token: string, id: string, decision: 'approved' | 'rejected') =>
    request<{ ok: boolean }>(
      `/api/admin/usdt/${encodeURIComponent(id)}/review`,
      { method: 'POST', body: JSON.stringify({ decision }) },
      token,
    ),

  adminAddPromotion: (token: string, title: string, category: string, summary: string) =>
    request<{ ok: boolean }>(
      '/api/admin/promotions',
      { method: 'POST', body: JSON.stringify({ title, category, summary }) },
      token,
    ),

  adminTogglePromotion: (token: string, id: string) =>
    request<{ ok: boolean }>(`/api/admin/promotions/${encodeURIComponent(id)}/toggle`, { method: 'POST' }, token),

  adminDeletePromotion: (token: string, id: string) =>
    request<{ ok: boolean }>(`/api/admin/promotions/${encodeURIComponent(id)}`, { method: 'DELETE' }, token),

  adminUpdateSettings: (token: string, settings: SystemSettings) =>
    request<{ ok: boolean }>(
      '/api/admin/settings',
      { method: 'PUT', body: JSON.stringify(settings) },
      token,
    ),
};

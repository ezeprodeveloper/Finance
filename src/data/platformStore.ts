import {
  InvestmentPlanTier,
  PlatformStoreState,
  SystemSettings,
} from '../types/finance';

export const PLATFORM_STORAGE_KEY = 'efinance_rwanda_store_v3';

export const ADMIN_EMAIL = 'ezeprodeveloper@gmail.com';
// Exact SHA-256 of configured administrator password
export const ADMIN_PASSWORD_SHA256 =
  '6c2fd62a214bcfe45e1a4f8a2abfac29ddb81623d1840c2f7f3807325f8d8e4f';

export const INVESTMENT_PLAN_TIERS: InvestmentPlanTier[] = [
  { id: 'plan-500', name: 'Starter 500 Plan', depositRwf: 500, dailyReturnRwf: 20, durationDays: 60 },
  { id: 'plan-1000', name: 'Micro 1,000 Plan', depositRwf: 1000, dailyReturnRwf: 50, durationDays: 60 },
  { id: 'plan-1500', name: 'Basic 1,500 Plan', depositRwf: 1500, dailyReturnRwf: 70, durationDays: 60 },
  { id: 'plan-2000', name: 'Growth 2,000 Plan', depositRwf: 2000, dailyReturnRwf: 100, durationDays: 60 },
  { id: 'plan-3000', name: 'Builder 3,000 Plan', depositRwf: 3000, dailyReturnRwf: 200, durationDays: 60 },
  { id: 'plan-5000', name: 'Silver 5,000 Plan', depositRwf: 5000, dailyReturnRwf: 400, durationDays: 60 },
  { id: 'plan-8000', name: 'Gold 8,000 Plan', depositRwf: 8000, dailyReturnRwf: 700, durationDays: 60 },
  { id: 'plan-10000', name: 'Platinum 10,000 Plan', depositRwf: 10000, dailyReturnRwf: 1000, durationDays: 60 },
  { id: 'plan-15000', name: 'Executive 15,000 Plan', depositRwf: 15000, dailyReturnRwf: 1600, durationDays: 60 },
  { id: 'plan-20000', name: 'Premier 20,000 Plan', depositRwf: 20000, dailyReturnRwf: 2200, durationDays: 60 },
];


export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  activationFeeRwf: 200,
  welcomeBonusRwf: 200,
  dailyCheckInRwf: 20,
  withdrawalFeePercent: 25,
  subsequentMinWithdrawalRwf: 1000,
  subsequentMaxWithdrawalRwf: 5000,
  referralCommissionPercent: 10,
  minVideoRewardRwf: 50,
  momoPayCode: '1880554',
  platformTagline:
    'Rwanda Digital Finance — Savings, Credit Requests, Daily Return Plans, Video Campaigns & Verified Tasks.',
  maintenanceMode: false,
};

export const INITIAL_PLATFORM_STATE: PlatformStoreState = {
  users: [],
  savingsGoals: [],
  loans: [],
  investments: [],
  spinHistory: [],
  withdrawals: [],
  videoCampaigns: [],
  customTasks: [],
  taskSubmissions: [],
  transactions: [],
  promotions: [
    {
      id: 'promo-launch',
      title: 'Welcome to E-Finance Rwanda',
      summary:
        'Register your verified member account in three simple steps to manage RWF savings, invest in daily return plans, spin to win rewards, and track all transactions.',
      category: 'Official Announcement',
      active: true,
      createdAt: '2026-11-01T08:00:00Z',
    },
    {
      id: 'promo-creators',
      title: 'Promote Short Videos & Paid Tasks Across Rwanda',
      summary:
        'Upload short promotional videos or publish custom tasks with clear requirements. Every submission is carefully reviewed before rewards are released.',
      category: 'Creator & Business Campaign',
      active: true,
      createdAt: '2026-11-10T10:00:00Z',
    },
  ],
  settings: DEFAULT_SYSTEM_SETTINGS,
  session: { type: 'guest' },
};

export function loadPlatformState(): PlatformStoreState {
  if (typeof window === 'undefined') return INITIAL_PLATFORM_STATE;
  try {
    const raw = window.localStorage.getItem(PLATFORM_STORAGE_KEY);
    if (!raw) return INITIAL_PLATFORM_STATE;
    const parsed = JSON.parse(raw) as Partial<PlatformStoreState>;
    return {
      ...INITIAL_PLATFORM_STATE,
      ...parsed,
      settings: {
        ...DEFAULT_SYSTEM_SETTINGS,
        ...(parsed.settings ?? {}),
      },
      session: parsed.session ?? { type: 'guest' },
    };
  } catch {
    return INITIAL_PLATFORM_STATE;
  }
}

export function savePlatformState(state: PlatformStoreState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PLATFORM_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Handle storage quota limits gracefully
  }
}

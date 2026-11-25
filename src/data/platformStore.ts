import type {
  InvestmentPlanTier,
  PlatformStoreState,
  SystemSettings,
} from '../types/finance.ts';

export const ADMIN_EMAIL = 'ezeprodeveloper@gmail.com';

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
  sendMoneyTaxPercent: 10,
  rwfPerUsdRate: 1380,
  binanceDepositAddress: 'Binance Pay ID: 58392014 · TRC20: TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
  platformTagline:
    'Rwanda Digital Finance — Savings, Credit Requests, Quiz Bet, Airtime, FX & USDT, Video Campaigns & Verified Tasks.',
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
  betSessions: [],
  airtimeRequests: [],
  p2pTransfers: [],
  fxExchanges: [],
  usdtRequests: [],
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

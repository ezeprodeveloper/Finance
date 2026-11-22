import { GitHubConfig, PlatformStoreState, SystemSettings } from '../types/finance';

export const PLATFORM_STORAGE_KEY = 'efinance_rwanda_store_v2';

export const ADMIN_EMAIL = 'ezeprodeveloper@gmail.com';
// SHA-256 of the configured administrator password
export const ADMIN_PASSWORD_SHA256 =
  '2540d84f8459e72cf286ec271e1650b52809826a735174a668a7352c4598c4fb';

export function detectGitHubPagesRepo(): GitHubConfig | null {
  if (typeof window === 'undefined') return null;
  const { hostname, pathname } = window.location;
  if (!hostname.endsWith('.github.io')) return null;

  const owner = hostname.replace('.github.io', '').trim();
  const pathSegments = pathname.split('/').filter(Boolean);
  const repo = pathSegments[0] || `${owner}.github.io`;
  if (!owner || !repo) return null;
  return { owner, repo };
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  activationFeeRwf: 200,
  welcomeBonusRwf: 200,
  dailyCheckInRwf: 20,
  withdrawalFeePercent: 25,
  minVideoRewardRwf: 50,
  momoPayCode: '182811880554',
  platformTagline:
    'Rwanda Digital Finance — Savings, Credit Requests, Video Campaigns & Verified Tasks.',
};

export const INITIAL_PLATFORM_STATE: PlatformStoreState = {
  users: [],
  savingsGoals: [],
  loans: [],
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
        'Register in 3 steps, complete verification with E-Finance Admin, activate your account with 200 RWF via 182811880554*200#, and immediately unlock your 200 RWF welcome bonus plus 20 RWF daily check-ins.',
      category: 'Official Announcement',
      active: true,
      createdAt: '2026-11-01T08:00:00Z',
    },
    {
      id: 'promo-creators',
      title: 'Promote Short Videos & Paid Tasks Across Rwanda',
      summary:
        'Upload short promotional videos starting from 50 RWF per view or publish custom tasks with clear requirements. Every submission is manually reviewed by E-Finance Admin before rewards are released.',
      category: 'Creator & Business Campaign',
      active: true,
      createdAt: '2026-11-10T10:00:00Z',
    },
  ],
  settings: DEFAULT_SYSTEM_SETTINGS,
  session: { type: 'guest' },
  githubConfig: detectGitHubPagesRepo(),
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
      githubConfig: parsed.githubConfig ?? detectGitHubPagesRepo(),
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

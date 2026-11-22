export type Gender = 'Male' | 'Female' | 'Other';

export type EducationType = 'University' | 'A-Level';

export type AccountStatus =
  | 'pending_approval'
  | 'awaiting_payment'
  | 'payment_submitted'
  | 'active'
  | 'suspended';

export type KycStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export interface EducationDetails {
  type: EducationType;
  institutionName: string;
  levelOrClass: string;
  facultyOrCombination: string;
}

export interface ResidenceDetails {
  placeOfBirth: string;
  akarere?: string;
  umurenge?: string;
  akagari?: string;
  umudugudu?: string;
}

export interface RwandaKycData {
  nationalId: string;
  idIssueDistrict: string;
  province: string;
  akarere: string;
  umurenge: string;
  akagari: string;
  umudugudu: string;
  occupation: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  idDocumentPhotoDataUrl: string;
  submittedAt: string;
  reviewNote?: string;
}

export interface RegisteredUser {
  id: string;
  firstName: string;
  secondName: string;
  email: string;
  phone: string;
  gender: Gender;
  dateOfBirth: string;
  idNumber: string;
  photoDataUrl: string;
  education: EducationDetails;
  residence: ResidenceDetails;
  passwordHash: string;
  accountNumber: string;
  accountStatus: AccountStatus;
  activationPaymentRef?: string;
  activationPaidPhone?: string;
  walletBalanceRwf: number;
  savingsBalanceRwf: number;
  lastCheckInDate: string | null;
  checkInStreak: number;
  kycStatus: KycStatus;
  kycData?: RwandaKycData;
  createdAt: string;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  planType: 'Flexible' | 'Goal-Based' | 'Long-Term';
  targetRwf: number;
  currentRwf: number;
  targetDate: string;
  createdAt: string;
}

export interface LoanRequest {
  id: string;
  userId: string;
  userName: string;
  product: string;
  reason: string;
  principalRwf: number;
  termMonths: number;
  annualRatePercent: number;
  monthlyPaymentRwf: number;
  totalRepayableRwf: number;
  repaidRwf: number;
  status: 'pending_admin' | 'approved' | 'repaid' | 'rejected';
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  provider: 'MTN Mobile Money' | 'Airtel Money';
  phone: string;
  grossAmountRwf: number;
  feePercent: number;
  feeRwf: number;
  netAmountRwf: number;
  status: 'pending_admin' | 'paid' | 'rejected';
  createdAt: string;
}

export interface ShortVideoCampaign {
  id: string;
  creatorId: string;
  creatorName: string;
  title: string;
  description: string;
  videoUrl: string;
  rewardPerViewRwf: number;
  targetViewers: number;
  totalBudgetRwf: number;
  paymentCode: string;
  paymentRef: string;
  watchedByUserIds: string[];
  status: 'pending_admin' | 'active' | 'completed' | 'rejected';
  createdAt: string;
}

export interface CustomTask {
  id: string;
  creatorId: string;
  creatorName: string;
  title: string;
  requirements: string;
  rewardPerCompletionRwf: number;
  targetCompletions: number;
  totalBudgetRwf: number;
  paymentCode: string;
  paymentRef: string;
  approvedWorkerIds: string[];
  status: 'pending_admin' | 'active' | 'completed' | 'rejected';
  createdAt: string;
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  taskTitle: string;
  workerId: string;
  workerName: string;
  proofText: string;
  proofUrl?: string;
  rewardRwf: number;
  status: 'pending_admin' | 'approved' | 'rejected';
  adminNote?: string;
  submittedAt: string;
  reviewedAt?: string;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  reference: string;
  title: string;
  category:
    | 'Bonus'
    | 'Check-In'
    | 'Activation'
    | 'Savings'
    | 'Loan'
    | 'Withdrawal'
    | 'Video Reward'
    | 'Task Reward'
    | 'Campaign Payment'
    | 'Admin Adjustment';
  channel: string;
  amountRwf: number;
  feeRwf?: number;
  direction: 'credit' | 'debit';
  status: 'Completed' | 'Pending Review' | 'Rejected';
  timestamp: string;
}

export interface AdminPromotion {
  id: string;
  title: string;
  summary: string;
  category: string;
  active: boolean;
  createdAt: string;
}

export interface SystemSettings {
  activationFeeRwf: number;
  welcomeBonusRwf: number;
  dailyCheckInRwf: number;
  withdrawalFeePercent: number;
  minVideoRewardRwf: number;
  momoPayCode: string;
  platformTagline: string;
}

export interface GitHubConfig {
  owner: string;
  repo: string;
  token?: string;
}

export interface GitHubRepoSummary {
  fullName: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  defaultBranch: string;
  visibility: string;
  stars: number;
  forks: number;
  openIssues: number;
  pushedAt: string;
  hasPages: boolean;
  licenseName: string | null;
}

export interface GitHubWorkflowRunSummary {
  id: number;
  name: string;
  headBranch: string;
  headSha: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
  runNumber: number;
}

export interface GitHubReleaseAsset {
  id: number;
  name: string;
  sizeBytes: number;
  downloadCount: number;
  browserDownloadUrl: string;
}

export interface GitHubReleaseSummary {
  id: number;
  tagName: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  body: string;
  assets: GitHubReleaseAsset[];
}

export interface GitHubCommitSummary {
  sha: string;
  message: string;
  authorName: string;
  date: string;
  htmlUrl: string;
}

export interface GitHubHostBundle {
  repo: GitHubRepoSummary;
  runs: GitHubWorkflowRunSummary[];
  releases: GitHubReleaseSummary[];
  commits: GitHubCommitSummary[];
  pagesUrl: string | null;
  fetchedAt: string;
}

export type SessionRole =
  | { type: 'guest' }
  | { type: 'user'; userId: string }
  | { type: 'admin' };

export type UserPortalSection =
  | 'overview'
  | 'kyc'
  | 'savings'
  | 'loans'
  | 'withdrawals'
  | 'videos'
  | 'tasks'
  | 'transactions'
  | 'profile'
  | 'github';

export type AdminPortalSection =
  | 'dashboard'
  | 'users'
  | 'kyc'
  | 'videos_tasks'
  | 'loans_withdrawals'
  | 'promotions'
  | 'settings'
  | 'github';

export interface PlatformStoreState {
  users: RegisteredUser[];
  savingsGoals: SavingsGoal[];
  loans: LoanRequest[];
  withdrawals: WithdrawalRequest[];
  videoCampaigns: ShortVideoCampaign[];
  customTasks: CustomTask[];
  taskSubmissions: TaskSubmission[];
  transactions: TransactionRecord[];
  promotions: AdminPromotion[];
  settings: SystemSettings;
  session: SessionRole;
  githubConfig: GitHubConfig | null;
}

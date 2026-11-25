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
  province?: string;
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
  selfiePhotoDataUrl?: string;
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
  referralCode: string;
  referredByUserId?: string;
  spinCredits: number;
  hasCompletedFirstWithdrawal: boolean;
  accountStatus: AccountStatus;
  activationPaymentRef?: string;
  activationPaidPhone?: string;
  walletBalanceRwf: number;
  bonusBalanceRwf: number;
  savingsBalanceRwf: number;
  walletBalanceUsd?: number;
  usdtBalance?: number;
  usdtSavingsBalance?: number;
  lastCheckInAt: string | null;
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

export interface InvestmentPlanTier {
  id: string;
  name: string;
  depositRwf: number;
  dailyReturnRwf: number;
  durationDays: number;
}

export interface UserInvestment {
  id: string;
  userId: string;
  userName: string;
  tierId: string;
  planName: string;
  depositRwf: number;
  dailyReturnRwf: number;
  paymentCode: string;
  paymentRef: string;
  status: 'pending_admin' | 'active' | 'completed' | 'rejected';
  totalEarnedRwf: number;
  lastRoiCreditedAt: string | null;
  createdAt: string;
}

export interface SpinHistoryRecord {
  id: string;
  userId: string;
  rewardRwf: number;
  spunAt: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  network: 'MTN Rwanda' | 'Airtel / Tigo Rwanda';
  destinationType: 'Phone Number' | 'MoMo Pay Code';
  destinationValue: string;
  accountRegisteredNames: string;
  grossAmountRwf: number;
  feePercent: number;
  feeRwf: number;
  netAmountRwf: number;
  isFirstBonusWithdrawal: boolean;
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

export type QuizCategory = 'math' | 'physics' | 'world' | 'mixed';

export interface BetSession {
  id: string;
  userId: string;
  userName: string;
  category: QuizCategory;
  stakeRwf: number;
  questionsAnswered: number;
  multiplier: number;
  payoutRwf: number;
  status: 'won_cashed_out' | 'lost';
  endedReason: string;
  createdAt: string;
}

export interface AirtimeRequest {
  id: string;
  userId: string;
  userName: string;
  network: 'MTN Rwanda' | 'Airtel Rwanda';
  serviceType: 'Airtime' | 'Internet Bundle';
  phoneNumber: string;
  amountRwf: number;
  bundleLabel?: string;
  status: 'pending_admin' | 'approved' | 'rejected';
  adminNote?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface P2PTransfer {
  id: string;
  senderId: string;
  senderName: string;
  senderAddress: string;
  receiverId: string;
  receiverName: string;
  receiverAddress: string;
  grossAmountRwf: number;
  taxPercent: number;
  taxRwf: number;
  netAmountRwf: number;
  note?: string;
  status: 'completed';
  claimedByReceiver: boolean;
  createdAt: string;
}

export interface FxExchangeRecord {
  id: string;
  userId: string;
  userName: string;
  direction: 'RWF_TO_USD' | 'USD_TO_RWF' | 'USD_TO_USDT' | 'USDT_TO_USD';
  fromAmount: number;
  toAmount: number;
  rateApplied: number;
  createdAt: string;
}

export interface UsdtRequest {
  id: string;
  userId: string;
  userName: string;
  actionType: 'deposit' | 'withdraw' | 'send_binance';
  amountUsdt: number;
  network: 'BEP20 (BSC)' | 'TRC20 (Tron)' | 'ERC20' | 'Binance Pay';
  destinationOrTxRef: string;
  note?: string;
  status: 'pending_admin' | 'approved' | 'rejected';
  adminNote?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WalletAddressRecord {
  address: string;
  userId: string;
  fullName: string;
  createdAt: string;
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
    | 'Investment ROI'
    | 'Investment Deposit'
    | 'Spin Win'
    | 'Referral Commission'
    | 'Quiz Bet'
    | 'Quiz Win'
    | 'Airtime & Data'
    | 'Transfer Sent'
    | 'Transfer Received'
    | 'Currency Exchange'
    | 'USDT Deposit'
    | 'USDT Savings'
    | 'USDT Send / Withdraw'
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
  subsequentMinWithdrawalRwf: number;
  subsequentMaxWithdrawalRwf: number;
  referralCommissionPercent: number;
  minVideoRewardRwf: number;
  momoPayCode: string;
  sendMoneyTaxPercent: number;
  rwfPerUsdRate: number;
  binanceDepositAddress: string;
  platformTagline: string;
  maintenanceMode: boolean;
}

export type SessionRole =
  | { type: 'guest' }
  | { type: 'user'; userId: string }
  | { type: 'admin' };

export type UserPortalSection =
  | 'overview'
  | 'invest'
  | 'spin'
  | 'quiz_bet'
  | 'airtime'
  | 'send_money'
  | 'exchange_usdt'
  | 'kyc'
  | 'savings'
  | 'loans'
  | 'withdrawals'
  | 'videos'
  | 'tasks'
  | 'transactions'
  | 'profile';

export type AdminPortalSection =
  | 'dashboard'
  | 'users'
  | 'kyc'
  | 'videos_tasks'
  | 'loans_withdrawals'
  | 'services_crypto'
  | 'transactions_audit'
  | 'promotions'
  | 'settings';

export interface PlatformStoreState {
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
  settings: SystemSettings;
  session: SessionRole;
}

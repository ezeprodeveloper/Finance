import { DEFAULT_SYSTEM_SETTINGS, INVESTMENT_PLAN_TIERS } from '../src/data/platformStore.ts';
import type {
  AdminPromotion,
  AirtimeRequest,
  BetSession,
  CustomTask,
  EducationDetails,
  FxExchangeRecord,
  LoanRequest,
  P2PTransfer,
  RegisteredUser,
  ResidenceDetails,
  RwandaKycData,
  SavingsGoal,
  ShortVideoCampaign,
  SpinHistoryRecord,
  SystemSettings,
  TaskSubmission,
  TransactionRecord,
  UsdtRequest,
  UserInvestment,
  WithdrawalRequest,
} from '../src/types/finance.ts';
import { dbExecute, dbQuery, dbQueryOne } from './db.ts';
import { generateReference, generateSafeId } from './security.ts';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function mapUserRow(row: Record<string, unknown>): RegisteredUser {
  return {
    id: String(row.id),
    firstName: String(row.first_name),
    secondName: String(row.second_name),
    email: String(row.email),
    phone: String(row.phone),
    gender: String(row.gender) as RegisteredUser['gender'],
    dateOfBirth: String(row.date_of_birth),
    idNumber: String(row.id_number),
    photoDataUrl: String(row.photo_data_url),
    education: safeJsonParse<EducationDetails>(row.education as string, {
      type: 'University',
      institutionName: '',
      levelOrClass: '',
      facultyOrCombination: '',
    }),
    residence: safeJsonParse<ResidenceDetails>(row.residence as string, {
      placeOfBirth: '',
    }),
    passwordHash: '',
    accountNumber: String(row.account_number),
    referralCode: String(row.referral_code),
    referredByUserId: row.referred_by_user_id ? String(row.referred_by_user_id) : undefined,
    spinCredits: Number(row.spin_credits ?? 0),
    hasCompletedFirstWithdrawal: Boolean(Number(row.has_completed_first_withdrawal ?? 0)),
    accountStatus: String(row.account_status) as RegisteredUser['accountStatus'],
    activationPaymentRef: row.activation_payment_ref ? String(row.activation_payment_ref) : undefined,
    activationPaidPhone: row.activation_paid_phone ? String(row.activation_paid_phone) : undefined,
    walletBalanceRwf: Number(row.wallet_balance_rwf ?? 0),
    bonusBalanceRwf: Number(row.bonus_balance_rwf ?? 0),
    savingsBalanceRwf: Number(row.savings_balance_rwf ?? 0),
    walletBalanceUsd: Number(row.wallet_balance_usd ?? 0),
    usdtBalance: Number(row.usdt_balance ?? 0),
    usdtSavingsBalance: Number(row.usdt_savings_balance ?? 0),
    lastCheckInAt: row.last_check_in_at ? String(row.last_check_in_at) : null,
    checkInStreak: Number(row.check_in_streak ?? 0),
    kycStatus: String(row.kyc_status) as RegisteredUser['kycStatus'],
    kycData: row.kyc_data ? safeJsonParse<RwandaKycData | undefined>(row.kyc_data as string, undefined) : undefined,
    createdAt: String(row.created_at),
  };
}

export function mapSavingsGoalRow(row: Record<string, unknown>): SavingsGoal {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    planType: String(row.plan_type) as SavingsGoal['planType'],
    targetRwf: Number(row.target_rwf ?? 0),
    currentRwf: Number(row.current_rwf ?? 0),
    targetDate: String(row.target_date),
    createdAt: String(row.created_at),
  };
}

export function mapLoanRow(row: Record<string, unknown>): LoanRequest {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    product: String(row.product),
    reason: String(row.reason),
    principalRwf: Number(row.principal_rwf ?? 0),
    termMonths: Number(row.term_months ?? 1),
    annualRatePercent: Number(row.annual_rate_percent ?? 0),
    monthlyPaymentRwf: Number(row.monthly_payment_rwf ?? 0),
    totalRepayableRwf: Number(row.total_repayable_rwf ?? 0),
    repaidRwf: Number(row.repaid_rwf ?? 0),
    status: String(row.status) as LoanRequest['status'],
    createdAt: String(row.created_at),
  };
}

export function mapInvestmentRow(row: Record<string, unknown>): UserInvestment {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    tierId: String(row.tier_id),
    planName: String(row.plan_name),
    depositRwf: Number(row.deposit_rwf ?? 0),
    dailyReturnRwf: Number(row.daily_return_rwf ?? 0),
    paymentCode: String(row.payment_code),
    paymentRef: String(row.payment_ref),
    status: String(row.status) as UserInvestment['status'],
    totalEarnedRwf: Number(row.total_earned_rwf ?? 0),
    lastRoiCreditedAt: row.last_roi_credited_at ? String(row.last_roi_credited_at) : null,
    createdAt: String(row.created_at),
  };
}

export function mapSpinRow(row: Record<string, unknown>): SpinHistoryRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    rewardRwf: Number(row.reward_rwf ?? 0),
    spunAt: String(row.spun_at),
  };
}

export function mapWithdrawalRow(row: Record<string, unknown>): WithdrawalRequest {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    network: String(row.network) as WithdrawalRequest['network'],
    destinationType: String(row.destination_type) as WithdrawalRequest['destinationType'],
    destinationValue: String(row.destination_value),
    accountRegisteredNames: String(row.account_registered_names),
    grossAmountRwf: Number(row.gross_amount_rwf ?? 0),
    feePercent: Number(row.fee_percent ?? 0),
    feeRwf: Number(row.fee_rwf ?? 0),
    netAmountRwf: Number(row.net_amount_rwf ?? 0),
    isFirstBonusWithdrawal: Boolean(Number(row.is_first_bonus_withdrawal ?? 0)),
    status: String(row.status) as WithdrawalRequest['status'],
    createdAt: String(row.created_at),
  };
}

export function mapVideoRow(row: Record<string, unknown>): ShortVideoCampaign {
  return {
    id: String(row.id),
    creatorId: String(row.creator_id),
    creatorName: String(row.creator_name),
    title: String(row.title),
    description: String(row.description),
    videoUrl: String(row.video_url),
    rewardPerViewRwf: Number(row.reward_per_view_rwf ?? 0),
    targetViewers: Number(row.target_viewers ?? 0),
    totalBudgetRwf: Number(row.total_budget_rwf ?? 0),
    paymentCode: String(row.payment_code),
    paymentRef: String(row.payment_ref),
    watchedByUserIds: safeJsonParse<string[]>(row.watched_by_user_ids as string, []),
    status: String(row.status) as ShortVideoCampaign['status'],
    createdAt: String(row.created_at),
  };
}

export function mapTaskRow(row: Record<string, unknown>): CustomTask {
  return {
    id: String(row.id),
    creatorId: String(row.creator_id),
    creatorName: String(row.creator_name),
    title: String(row.title),
    requirements: String(row.requirements),
    rewardPerCompletionRwf: Number(row.reward_per_completion_rwf ?? 0),
    targetCompletions: Number(row.target_completions ?? 0),
    totalBudgetRwf: Number(row.total_budget_rwf ?? 0),
    paymentCode: String(row.payment_code),
    paymentRef: String(row.payment_ref),
    approvedWorkerIds: safeJsonParse<string[]>(row.approved_worker_ids as string, []),
    status: String(row.status) as CustomTask['status'],
    createdAt: String(row.created_at),
  };
}

export function mapSubmissionRow(row: Record<string, unknown>): TaskSubmission {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    taskTitle: String(row.task_title),
    workerId: String(row.worker_id),
    workerName: String(row.worker_name),
    proofText: String(row.proof_text),
    proofUrl: row.proof_url ? String(row.proof_url) : undefined,
    rewardRwf: Number(row.reward_rwf ?? 0),
    status: String(row.status) as TaskSubmission['status'],
    adminNote: row.admin_note ? String(row.admin_note) : undefined,
    submittedAt: String(row.submitted_at),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
  };
}

export function mapBetSessionRow(row: Record<string, unknown>): BetSession {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    category: String(row.category) as BetSession['category'],
    stakeRwf: Number(row.stake_rwf ?? 0),
    questionsAnswered: Number(row.questions_answered ?? 0),
    multiplier: Number(row.multiplier ?? 0),
    payoutRwf: Number(row.payout_rwf ?? 0),
    status: String(row.status) as BetSession['status'],
    endedReason: String(row.ended_reason),
    createdAt: String(row.created_at),
  };
}

export function mapAirtimeRow(row: Record<string, unknown>): AirtimeRequest {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    network: String(row.network) as AirtimeRequest['network'],
    serviceType: String(row.service_type) as AirtimeRequest['serviceType'],
    phoneNumber: String(row.phone_number),
    amountRwf: Number(row.amount_rwf ?? 0),
    bundleLabel: row.bundle_label ? String(row.bundle_label) : undefined,
    status: String(row.status) as AirtimeRequest['status'],
    adminNote: row.admin_note ? String(row.admin_note) : undefined,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function mapP2PRow(row: Record<string, unknown>): P2PTransfer {
  return {
    id: String(row.id),
    senderId: String(row.sender_id),
    senderName: String(row.sender_name),
    senderAddress: String(row.sender_address),
    receiverId: String(row.receiver_id),
    receiverName: String(row.receiver_name),
    receiverAddress: String(row.receiver_address),
    grossAmountRwf: Number(row.gross_amount_rwf ?? 0),
    taxPercent: Number(row.tax_percent ?? 10),
    taxRwf: Number(row.tax_rwf ?? 0),
    netAmountRwf: Number(row.net_amount_rwf ?? 0),
    note: row.note ? String(row.note) : undefined,
    status: 'completed',
    claimedByReceiver: Boolean(Number(row.claimed_by_receiver ?? 1)),
    createdAt: String(row.created_at),
  };
}

export function mapFxRow(row: Record<string, unknown>): FxExchangeRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    direction: String(row.direction) as FxExchangeRecord['direction'],
    fromAmount: Number(row.from_amount ?? 0),
    toAmount: Number(row.to_amount ?? 0),
    rateApplied: Number(row.rate_applied ?? 1),
    createdAt: String(row.created_at),
  };
}

export function mapUsdtRow(row: Record<string, unknown>): UsdtRequest {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    actionType: String(row.action_type) as UsdtRequest['actionType'],
    amountUsdt: Number(row.amount_usdt ?? 0),
    network: String(row.network) as UsdtRequest['network'],
    destinationOrTxRef: String(row.destination_or_tx_ref),
    note: row.note ? String(row.note) : undefined,
    status: String(row.status) as UsdtRequest['status'],
    adminNote: row.admin_note ? String(row.admin_note) : undefined,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function mapTransactionRow(row: Record<string, unknown>): TransactionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    reference: String(row.reference),
    title: String(row.title),
    category: String(row.category) as TransactionRecord['category'],
    channel: String(row.channel),
    amountRwf: Number(row.amount_rwf ?? 0),
    feeRwf: row.fee_rwf !== null && row.fee_rwf !== undefined ? Number(row.fee_rwf) : undefined,
    direction: String(row.direction) as TransactionRecord['direction'],
    status: String(row.status) as TransactionRecord['status'],
    timestamp: String(row.timestamp),
  };
}

export function mapPromotionRow(row: Record<string, unknown>): AdminPromotion {
  return {
    id: String(row.id),
    title: String(row.title),
    summary: String(row.summary),
    category: String(row.category),
    active: Boolean(Number(row.active ?? 0)),
    createdAt: String(row.created_at),
  };
}

export async function getPlatformSettings(): Promise<SystemSettings> {
  const row = await dbQueryOne<{ data: string }>(
    'SELECT data FROM settings WHERE key = $1',
    ['platform'],
  );
  if (!row) return DEFAULT_SYSTEM_SETTINGS;
  return {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...safeJsonParse<Partial<SystemSettings>>(row.data, {}),
  };
}

export async function insertTransaction(tx: TransactionRecord): Promise<void> {
  await dbExecute(
    `INSERT INTO transactions (id, user_id, reference, title, category, channel, amount_rwf, fee_rwf, direction, status, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      tx.id,
      tx.userId,
      tx.reference,
      tx.title,
      tx.category,
      tx.channel,
      tx.amountRwf,
      tx.feeRwf ?? null,
      tx.direction,
      tx.status,
      tx.timestamp,
    ],
  );
}

export async function processDueInvestmentRoi(scopeUserId?: string): Promise<void> {
  const activeRows = scopeUserId
    ? await dbQuery<Record<string, unknown>>(
        `SELECT * FROM investments WHERE status = 'active' AND user_id = $1`,
        [scopeUserId],
      )
    : await dbQuery<Record<string, unknown>>(
        `SELECT * FROM investments WHERE status = 'active'`,
      );

  if (activeRows.length === 0) return;

  const now = Date.now();
  const dayMs = 86400000;

  for (const row of activeRows) {
    const inv = mapInvestmentRow(row);
    if (!inv.lastRoiCreditedAt) continue;
    const lastMs = Date.parse(inv.lastRoiCreditedAt);
    if (Number.isNaN(lastMs)) continue;

    const daysDue = Math.floor((now - lastMs) / dayMs);
    if (daysDue < 1) continue;

    const tier = INVESTMENT_PLAN_TIERS.find((t) => t.id === inv.tierId);
    const maxTotal = (tier?.durationDays ?? 60) * inv.dailyReturnRwf;
    const daysCreditedSoFar = Math.floor(inv.totalEarnedRwf / inv.dailyReturnRwf);
    const remainingDays = Math.max(0, (tier?.durationDays ?? 60) - daysCreditedSoFar);
    const actualDays = Math.min(daysDue, remainingDays);
    const nowIso = new Date().toISOString();

    if (actualDays <= 0) {
      await dbExecute(
        `UPDATE investments SET status = 'completed', updated_at = $1 WHERE id = $2`,
        [nowIso, inv.id],
      );
      continue;
    }

    const payout = actualDays * inv.dailyReturnRwf;
    const nextEarned = Math.min(maxTotal, inv.totalEarnedRwf + payout);
    const completed = nextEarned >= maxTotal;
    const creditIso = new Date(lastMs + actualDays * dayMs).toISOString();

    await dbExecute(
      `UPDATE investments
       SET total_earned_rwf = $1, last_roi_credited_at = $2, status = $3, updated_at = $4
       WHERE id = $5`,
      [nextEarned, creditIso, completed ? 'completed' : 'active', nowIso, inv.id],
    );

    await dbExecute(
      `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + $1, updated_at = $2 WHERE id = $3`,
      [payout, nowIso, inv.userId],
    );

    await insertTransaction({
      id: generateSafeId('tx-roi'),
      userId: inv.userId,
      reference: generateReference('ROI'),
      title: `Daily Plan Return (${inv.planName} × ${actualDays}d)`,
      category: 'Investment ROI',
      channel: 'Automated 24h Yield Engine',
      amountRwf: payout,
      direction: 'credit',
      status: 'Completed',
      timestamp: creditIso,
    });
  }
}

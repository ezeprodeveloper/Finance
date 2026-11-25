import { Router } from 'express';
import { INVESTMENT_PLAN_TIERS } from '../src/data/platformStore.ts';
import type { BetSession, FxExchangeRecord, UsdtRequest } from '../src/types/finance.ts';
import { dbExecute, dbQuery, dbQueryOne } from './db.ts';
import {
  getPlatformSettings,
  insertTransaction,
  mapAirtimeRow,
  mapBetSessionRow,
  mapFxRow,
  mapInvestmentRow,
  mapLoanRow,
  mapP2PRow,
  mapSavingsGoalRow,
  mapSpinRow,
  mapSubmissionRow,
  mapTaskRow,
  mapTransactionRow,
  mapUsdtRow,
  mapUserRow,
  mapVideoRow,
  mapWithdrawalRow,
  processDueInvestmentRoi,
} from './mappers.ts';
import { type AuthRequest, requireMember } from './middleware.ts';
import {
  generateReference,
  generateSafeId,
  isSafeHttpUrl,
  isSafeMediaOrHttpUrl,
  isValidRwandaId,
  isValidRwandaPhone,
} from './security.ts';

function buildUssdCode(payCode: string, amountRwf: number): string {
  const cleanCode = payCode.replace(/[^0-9*#]/g, '').replace(/#$/, '');
  if (cleanCode.startsWith('*182*8*1*')) {
    return `${cleanCode}*${Math.round(amountRwf)}#`;
  }
  return `*182*8*1*${cleanCode}*${Math.round(amountRwf)}#`;
}

export function createMemberRouter(): Router {
  const router = Router();
  router.use(requireMember);

  router.get('/state', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      await processDueInvestmentRoi(uid);

      const userRow = await dbQueryOne<Record<string, unknown>>(
        'SELECT * FROM users WHERE id = $1',
        [uid],
      );
      if (!userRow) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }

      const [
        settings,
        refCountRow,
        savingsRows,
        loanRows,
        invRows,
        spinRows,
        wdRows,
        vidRows,
        taskRows,
        subRows,
        betRows,
        airRows,
        p2pRows,
        fxRows,
        usdtRows,
        txRows,
      ] = await Promise.all([
        getPlatformSettings(),
        dbQueryOne<{ cnt: number | string }>(
          `SELECT COUNT(*) AS cnt FROM users WHERE referred_by_user_id = $1 AND account_status = 'active'`,
          [uid],
        ),
        dbQuery<Record<string, unknown>>(
          'SELECT * FROM savings_goals WHERE user_id = $1 ORDER BY created_at DESC',
          [uid],
        ),
        dbQuery<Record<string, unknown>>(
          'SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC',
          [uid],
        ),
        dbQuery<Record<string, unknown>>(
          'SELECT * FROM investments WHERE user_id = $1 ORDER BY created_at DESC',
          [uid],
        ),
        dbQuery<Record<string, unknown>>(
          'SELECT * FROM spin_history WHERE user_id = $1 ORDER BY spun_at DESC',
          [uid],
        ),
        dbQuery<Record<string, unknown>>(
          'SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC',
          [uid],
        ),
        dbQuery<Record<string, unknown>>(
          `SELECT * FROM video_campaigns WHERE status = 'active' OR creator_id = $1 ORDER BY created_at DESC`,
          [uid],
        ),
        dbQuery<Record<string, unknown>>(
          `SELECT * FROM custom_tasks WHERE status = 'active' OR creator_id = $1 ORDER BY created_at DESC`,
          [uid],
        ),
        dbQuery<Record<string, unknown>>(
          'SELECT * FROM task_submissions WHERE worker_id = $1 ORDER BY submitted_at DESC',
          [uid],
        ),
        dbQuery<Record<string, unknown>>(
          'SELECT * FROM bet_sessions WHERE user_id = $1 ORDER BY created_at DESC',
          [uid],
        ),
        dbQuery<Record<string, unknown>>(
          'SELECT * FROM airtime_requests WHERE user_id = $1 ORDER BY created_at DESC',
          [uid],
        ),
        dbQuery<Record<string, unknown>>(
          'SELECT * FROM p2p_transfers WHERE sender_id = $1 OR receiver_id = $1 ORDER BY created_at DESC',
          [uid],
        ),
        dbQuery<Record<string, unknown>>(
          'SELECT * FROM fx_exchanges WHERE user_id = $1 ORDER BY created_at DESC',
          [uid],
        ),
        dbQuery<Record<string, unknown>>(
          'SELECT * FROM usdt_requests WHERE user_id = $1 ORDER BY created_at DESC',
          [uid],
        ),
        dbQuery<Record<string, unknown>>(
          'SELECT * FROM transactions WHERE user_id = $1 ORDER BY timestamp DESC',
          [uid],
        ),
      ]);

      res.json({
        user: mapUserRow(userRow),
        referredUsersCount: Number(refCountRow?.cnt ?? 0),
        settings,
        savingsGoals: savingsRows.map(mapSavingsGoalRow),
        loans: loanRows.map(mapLoanRow),
        investments: invRows.map(mapInvestmentRow),
        spinHistory: spinRows.map(mapSpinRow),
        withdrawals: wdRows.map(mapWithdrawalRow),
        videoCampaigns: vidRows.map(mapVideoRow),
        customTasks: taskRows.map(mapTaskRow),
        taskSubmissions: subRows.map(mapSubmissionRow),
        betSessions: betRows.map(mapBetSessionRow),
        airtimeRequests: airRows.map(mapAirtimeRow),
        p2pTransfers: p2pRows.map(mapP2PRow),
        fxExchanges: fxRows.map(mapFxRow),
        usdtRequests: usdtRows.map(mapUsdtRow),
        transactions: txRows.map(mapTransactionRow),
      });
    } catch (err) {
      console.error('Failed to fetch member state:', err);
      res.status(500).json({ error: 'Unable to load member workspace data.' });
    }
  });

  router.post('/activation', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const phone = String(req.body?.phone ?? '').trim();
      const ref = String(req.body?.ref ?? '').trim();
      if (!phone || ref.length < 3) {
        res.status(400).json({ error: 'Valid payment phone and Mobile Money reference required.' });
        return;
      }

      const settings = await getPlatformSettings();
      const nowIso = new Date().toISOString();

      await dbExecute(
        `UPDATE users SET account_status = 'payment_submitted', activation_paid_phone = $1, activation_payment_ref = $2, updated_at = $3 WHERE id = $4`,
        [phone, ref, nowIso, uid],
      );

      await insertTransaction({
        id: generateSafeId('tx'),
        userId: uid,
        reference: generateReference('ACT'),
        title: `System Activation Fee (${settings.activationFeeRwf} RWF)`,
        category: 'Activation',
        channel: `${settings.momoPayCode}*${settings.activationFeeRwf}# · Ref ${ref}`,
        amountRwf: settings.activationFeeRwf,
        direction: 'debit',
        status: 'Pending Review',
        timestamp: nowIso,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('Activation error:', err);
      res.status(500).json({ error: 'Failed to submit activation payment.' });
    }
  });

  router.post('/check-in', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const userRow = await dbQueryOne<Record<string, unknown>>(
        'SELECT * FROM users WHERE id = $1',
        [uid],
      );
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const user = mapUserRow(userRow);
      const now = Date.now();
      if (user.lastCheckInAt) {
        const lastMs = Date.parse(user.lastCheckInAt);
        if (!Number.isNaN(lastMs) && now - lastMs < 86400000) {
          res.status(400).json({ error: 'Daily check-in already claimed within the last 24 hours.' });
          return;
        }
      }

      const settings = await getPlatformSettings();
      const reward = settings.dailyCheckInRwf;
      const nowIso = new Date(now).toISOString();

      await dbExecute(
        `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + $1, last_check_in_at = $2, check_in_streak = check_in_streak + 1, updated_at = $3 WHERE id = $4`,
        [reward, nowIso, nowIso, uid],
      );

      await insertTransaction({
        id: generateSafeId('tx-chk'),
        userId: uid,
        reference: generateReference('CHK'),
        title: 'Daily 24h Check-In Reward',
        category: 'Check-In',
        channel: 'E-Finance Daily Check-In',
        amountRwf: reward,
        direction: 'credit',
        status: 'Completed',
        timestamp: nowIso,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('Check-in error:', err);
      res.status(500).json({ error: 'Failed to claim daily check-in.' });
    }
  });

  router.post('/kyc', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const data = req.body;
      if (!data || !isValidRwandaId(String(data.nationalId ?? '')) || !isValidRwandaPhone(String(data.nextOfKinPhone ?? ''))) {
        res.status(400).json({ error: 'Provide a valid 16-digit National ID and Next-of-Kin Rwanda phone.' });
        return;
      }
      const nowIso = new Date().toISOString();
      const kycPayload = {
        ...data,
        nationalId: String(data.nationalId).replace(/\s/g, ''),
        submittedAt: String(data.submittedAt || nowIso),
      };
      await dbExecute(
        `UPDATE users SET kyc_status = 'pending', kyc_data = $1, updated_at = $2 WHERE id = $3`,
        [JSON.stringify(kycPayload), nowIso, uid],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('KYC submission error:', err);
      res.status(500).json({ error: 'Failed to submit Rwanda KYC details.' });
    }
  });

  router.post('/savings/goals', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const userRow = await dbQueryOne<{ kyc_status: string }>(
        'SELECT kyc_status FROM users WHERE id = $1',
        [uid],
      );
      if (!userRow || userRow.kyc_status !== 'approved') {
        res.status(403).json({ error: 'Complete Rwanda KYC approval before creating savings goals.' });
        return;
      }
      const title = String(req.body?.title ?? '').trim();
      const planType = String(req.body?.planType ?? 'Flexible');
      const targetRwf = Number(req.body?.targetRwf ?? 0);
      const targetDate = String(req.body?.targetDate ?? '');
      if (title.length < 2 || !Number.isFinite(targetRwf) || targetRwf <= 0) {
        res.status(400).json({ error: 'Provide a valid goal title and target amount.' });
        return;
      }
      const nowIso = new Date().toISOString();
      await dbExecute(
        `INSERT INTO savings_goals (id, user_id, title, plan_type, target_rwf, current_rwf, target_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [generateSafeId('sav'), uid, title, planType, Math.round(targetRwf), 0, targetDate, nowIso, nowIso],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('Create savings goal error:', err);
      res.status(500).json({ error: 'Failed to create savings goal.' });
    }
  });

  router.post('/savings/deposit', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const goalId = String(req.body?.goalId ?? '');
      const amountRwf = Math.round(Number(req.body?.amountRwf ?? 0));
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      const goalRow = await dbQueryOne<Record<string, unknown>>(
        'SELECT * FROM savings_goals WHERE id = $1 AND user_id = $2',
        [goalId, uid],
      );
      if (!userRow || !goalRow) {
        res.status(404).json({ error: 'Savings goal or account not found.' });
        return;
      }
      const user = mapUserRow(userRow);
      const goal = mapSavingsGoalRow(goalRow);
      if (user.kycStatus !== 'approved') {
        res.status(403).json({ error: 'KYC approval required.' });
        return;
      }
      if (amountRwf <= 0 || amountRwf > user.walletBalanceRwf) {
        res.status(400).json({ error: 'Invalid amount or insufficient wallet balance.' });
        return;
      }
      const nowIso = new Date().toISOString();
      await dbExecute(
        `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf - $1, savings_balance_rwf = savings_balance_rwf + $1, updated_at = $2 WHERE id = $3`,
        [amountRwf, nowIso, uid],
      );
      await dbExecute(
        `UPDATE savings_goals SET current_rwf = current_rwf + $1, updated_at = $2 WHERE id = $3`,
        [amountRwf, nowIso, goalId],
      );
      await insertTransaction({
        id: generateSafeId('tx-sav'),
        userId: uid,
        reference: generateReference('SAV'),
        title: `Saved to ${goal.title}`,
        category: 'Savings',
        channel: `Smart Savings · ${goal.planType}`,
        amountRwf,
        direction: 'debit',
        status: 'Completed',
        timestamp: nowIso,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('Savings deposit error:', err);
      res.status(500).json({ error: 'Failed to deposit into savings.' });
    }
  });

  router.post('/savings/withdraw', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const goalId = String(req.body?.goalId ?? '');
      const amountRwf = Math.round(Number(req.body?.amountRwf ?? 0));
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      const goalRow = await dbQueryOne<Record<string, unknown>>(
        'SELECT * FROM savings_goals WHERE id = $1 AND user_id = $2',
        [goalId, uid],
      );
      if (!userRow || !goalRow) {
        res.status(404).json({ error: 'Savings goal not found.' });
        return;
      }
      const user = mapUserRow(userRow);
      const goal = mapSavingsGoalRow(goalRow);
      if (user.kycStatus !== 'approved') {
        res.status(403).json({ error: 'KYC approval required.' });
        return;
      }
      if (amountRwf <= 0 || amountRwf > goal.currentRwf || amountRwf > user.savingsBalanceRwf) {
        res.status(400).json({ error: 'Amount exceeds savings balance.' });
        return;
      }
      const nowIso = new Date().toISOString();
      await dbExecute(
        `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + $1, savings_balance_rwf = GREATEST(0, savings_balance_rwf - $1), updated_at = $2 WHERE id = $3`,
        [amountRwf, nowIso, uid],
      ).catch(async () => {
        // SQLite uses MAX instead of GREATEST
        await dbExecute(
          `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + $1, savings_balance_rwf = MAX(0, savings_balance_rwf - $1), updated_at = $2 WHERE id = $3`,
          [amountRwf, nowIso, uid],
        );
      });
      await dbExecute(
        `UPDATE savings_goals SET current_rwf = current_rwf - $1, updated_at = $2 WHERE id = $3`,
        [amountRwf, nowIso, goalId],
      );
      await insertTransaction({
        id: generateSafeId('tx-sav'),
        userId: uid,
        reference: generateReference('SAV'),
        title: `Moved from ${goal.title} to Wallet`,
        category: 'Savings',
        channel: 'Smart Savings Retrieval',
        amountRwf,
        direction: 'credit',
        status: 'Completed',
        timestamp: nowIso,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('Savings withdraw error:', err);
      res.status(500).json({ error: 'Failed to retrieve savings.' });
    }
  });

  router.post('/loans/request', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const user = mapUserRow(userRow);
      const principalRwf = Math.round(Number(req.body?.principalRwf ?? 0));
      const termMonths = Math.max(1, Math.round(Number(req.body?.termMonths ?? 1)));
      const annualRatePercent = Number(req.body?.annualRatePercent ?? 0);
      const monthlyPaymentRwf = Math.round(Number(req.body?.monthlyPaymentRwf ?? 0));
      const totalRepayableRwf = Math.round(Number(req.body?.totalRepayableRwf ?? 0));
      const product = String(req.body?.product ?? '').trim();
      const reason = String(req.body?.reason ?? '').trim();

      if (principalRwf <= 0 || !product || !reason) {
        res.status(400).json({ error: 'Complete all loan fields.' });
        return;
      }
      if (user.savingsBalanceRwf <= principalRwf) {
        res.status(400).json({
          error: `Loan denied: Your savings balance (${user.savingsBalanceRwf} RWF) must be strictly greater than the requested loan (${principalRwf} RWF).`,
        });
        return;
      }

      const nowIso = new Date().toISOString();
      await dbExecute(
        `INSERT INTO loans (id, user_id, user_name, product, reason, principal_rwf, term_months, annual_rate_percent, monthly_payment_rwf, total_repayable_rwf, repaid_rwf, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          generateSafeId('loan'),
          uid,
          `${user.firstName} ${user.secondName}`,
          product,
          reason,
          principalRwf,
          termMonths,
          annualRatePercent,
          monthlyPaymentRwf,
          totalRepayableRwf,
          0,
          'pending_admin',
          nowIso,
          nowIso,
        ],
      );

      await insertTransaction({
        id: generateSafeId('tx-ln'),
        userId: uid,
        reference: generateReference('LN'),
        title: `Loan Request: ${product}`,
        category: 'Loan',
        channel: `${termMonths} months · ${reason}`,
        amountRwf: principalRwf,
        direction: 'credit',
        status: 'Pending Review',
        timestamp: nowIso,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('Loan request error:', err);
      res.status(500).json({ error: 'Failed to submit loan request.' });
    }
  });

  router.post('/loans/repay', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const loanId = String(req.body?.loanId ?? '');
      const amountRwf = Math.round(Number(req.body?.amountRwf ?? 0));
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      const loanRow = await dbQueryOne<Record<string, unknown>>(
        'SELECT * FROM loans WHERE id = $1 AND user_id = $2',
        [loanId, uid],
      );
      if (!userRow || !loanRow) {
        res.status(404).json({ error: 'Loan not found.' });
        return;
      }
      const user = mapUserRow(userRow);
      const loan = mapLoanRow(loanRow);
      if (amountRwf <= 0 || amountRwf > user.walletBalanceRwf) {
        res.status(400).json({ error: 'Insufficient wallet balance.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const nextRepaid = loan.repaidRwf + amountRwf;
      const isFullyRepaid = nextRepaid >= loan.totalRepayableRwf;

      await dbExecute(
        `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf - $1, updated_at = $2 WHERE id = $3`,
        [amountRwf, nowIso, uid],
      );
      await dbExecute(
        `UPDATE loans SET repaid_rwf = $1, status = $2, updated_at = $3 WHERE id = $4`,
        [nextRepaid, isFullyRepaid ? 'repaid' : loan.status, nowIso, loanId],
      );
      await insertTransaction({
        id: generateSafeId('tx-rep'),
        userId: uid,
        reference: generateReference('REP'),
        title: `Loan Repayment: ${loan.product}`,
        category: 'Loan',
        channel: 'Wallet Repayment',
        amountRwf,
        direction: 'debit',
        status: 'Completed',
        timestamp: nowIso,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('Loan repay error:', err);
      res.status(500).json({ error: 'Failed to process loan repayment.' });
    }
  });

  router.post('/investments/purchase', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const tierId = String(req.body?.tierId ?? '');
      const paymentRef = String(req.body?.paymentRef ?? '').trim();
      const tier = INVESTMENT_PLAN_TIERS.find((t) => t.id === tierId);
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      if (!tier || !userRow || paymentRef.length < 3) {
        res.status(400).json({ error: 'Valid investment tier and payment reference required.' });
        return;
      }
      const user = mapUserRow(userRow);
      const settings = await getPlatformSettings();
      const payCode = buildUssdCode(settings.momoPayCode, tier.depositRwf);
      const nowIso = new Date().toISOString();

      await dbExecute(
        `INSERT INTO investments (id, user_id, user_name, tier_id, plan_name, deposit_rwf, daily_return_rwf, payment_code, payment_ref, status, total_earned_rwf, last_roi_credited_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          generateSafeId('inv'),
          uid,
          `${user.firstName} ${user.secondName}`,
          tier.id,
          tier.name,
          tier.depositRwf,
          tier.dailyReturnRwf,
          payCode,
          paymentRef,
          'pending_admin',
          0,
          null,
          nowIso,
          nowIso,
        ],
      );

      await insertTransaction({
        id: generateSafeId('tx-inv'),
        userId: uid,
        reference: generateReference('INV'),
        title: `Investment Plan Deposit: ${tier.name}`,
        category: 'Investment Deposit',
        channel: `${payCode} · Ref ${paymentRef}`,
        amountRwf: tier.depositRwf,
        direction: 'debit',
        status: 'Pending Review',
        timestamp: nowIso,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('Investment purchase error:', err);
      res.status(500).json({ error: 'Failed to submit investment deposit.' });
    }
  });

  router.post('/spin/complete', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const user = mapUserRow(userRow);
      if (user.spinCredits <= 0) {
        res.status(400).json({ error: 'No spin credits remaining.' });
        return;
      }
      const safeReward = Math.max(0, Math.min(200, Math.round(Number(req.body?.rewardRwf ?? 0))));
      const nowIso = new Date().toISOString();

      await dbExecute(
        `UPDATE users SET spin_credits = spin_credits - 1, wallet_balance_rwf = wallet_balance_rwf + $1, updated_at = $2 WHERE id = $3 AND spin_credits > 0`,
        [safeReward, nowIso, uid],
      );
      await dbExecute(
        `INSERT INTO spin_history (id, user_id, reward_rwf, spun_at) VALUES ($1, $2, $3, $4)`,
        [generateSafeId('sp'), uid, safeReward, nowIso],
      );
      await insertTransaction({
        id: generateSafeId('tx-spn'),
        userId: uid,
        reference: generateReference('SPN'),
        title: `Lucky Spin Wheel Reward (${safeReward} RWF)`,
        category: 'Spin Win',
        channel: 'E-Finance Lucky Wheel',
        amountRwf: safeReward,
        direction: 'credit',
        status: 'Completed',
        timestamp: nowIso,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('Spin complete error:', err);
      res.status(500).json({ error: 'Failed to record spin reward.' });
    }
  });

  router.post('/withdrawals/request', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const user = mapUserRow(userRow);
      if (user.kycStatus !== 'approved') {
        res.status(403).json({ error: 'Rwanda KYC approval is required before withdrawing.' });
        return;
      }

      const grossAmountRwf = Math.round(Number(req.body?.grossAmountRwf ?? 0));
      const network = String(req.body?.network ?? 'MTN Rwanda');
      const destinationType = String(req.body?.destinationType ?? 'Phone Number');
      const destinationValue = String(req.body?.destinationValue ?? '').trim();
      const accountRegisteredNames = String(req.body?.accountRegisteredNames ?? '').trim();

      if (grossAmountRwf <= 0 || grossAmountRwf > user.walletBalanceRwf || !destinationValue || !accountRegisteredNames) {
        res.status(400).json({ error: 'Invalid withdrawal details or insufficient balance.' });
        return;
      }

      const settings = await getPlatformSettings();
      const feePercent = settings.withdrawalFeePercent ?? 25;
      const feeRwf = Math.round((grossAmountRwf * feePercent) / 100);
      const netAmountRwf = Math.max(0, grossAmountRwf - feeRwf);
      const isFirstBonusWithdrawal = !user.hasCompletedFirstWithdrawal;
      const nowIso = new Date().toISOString();

      await dbExecute(
        `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf - $1, updated_at = $2 WHERE id = $3`,
        [grossAmountRwf, nowIso, uid],
      );
      await dbExecute(
        `INSERT INTO withdrawals (id, user_id, user_name, network, destination_type, destination_value, account_registered_names, gross_amount_rwf, fee_percent, fee_rwf, net_amount_rwf, is_first_bonus_withdrawal, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          generateSafeId('wd'),
          uid,
          `${user.firstName} ${user.secondName}`,
          network,
          destinationType,
          destinationValue,
          accountRegisteredNames,
          grossAmountRwf,
          feePercent,
          feeRwf,
          netAmountRwf,
          isFirstBonusWithdrawal ? 1 : 0,
          'pending_admin',
          nowIso,
          nowIso,
        ],
      );
      await insertTransaction({
        id: generateSafeId('tx-wd'),
        userId: uid,
        reference: generateReference('WDR'),
        title: `Withdrawal (${network}) — Net ${netAmountRwf} RWF`,
        category: 'Withdrawal',
        channel: `${network} · ${destinationType}: ${destinationValue} (${accountRegisteredNames}) · ${feePercent}% fee`,
        amountRwf: grossAmountRwf,
        feeRwf,
        direction: 'debit',
        status: 'Pending Review',
        timestamp: nowIso,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('Withdrawal error:', err);
      res.status(500).json({ error: 'Failed to submit withdrawal request.' });
    }
  });

  router.post('/videos/watch', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const campaignId = String(req.body?.campaignId ?? '');
      const campRow = await dbQueryOne<Record<string, unknown>>(
        'SELECT * FROM video_campaigns WHERE id = $1',
        [campaignId],
      );
      if (!campRow) {
        res.status(404).json({ error: 'Video campaign not found.' });
        return;
      }
      const camp = mapVideoRow(campRow);
      if (camp.status !== 'active') {
        res.status(400).json({ error: 'Video campaign is not active.' });
        return;
      }
      if (camp.watchedByUserIds.includes(uid)) {
        res.status(400).json({ error: 'You already watched this video campaign.' });
        return;
      }
      if (camp.watchedByUserIds.length >= camp.targetViewers) {
        res.status(400).json({ error: 'Video campaign view target has been reached.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const updatedWatchers = [...camp.watchedByUserIds, uid];
      const completed = updatedWatchers.length >= camp.targetViewers;

      await dbExecute(
        `UPDATE video_campaigns SET watched_by_user_ids = $1, status = $2, updated_at = $3 WHERE id = $4`,
        [JSON.stringify(updatedWatchers), completed ? 'completed' : camp.status, nowIso, campaignId],
      );
      await dbExecute(
        `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + $1, updated_at = $2 WHERE id = $3`,
        [camp.rewardPerViewRwf, nowIso, uid],
      );
      await insertTransaction({
        id: generateSafeId('tx-vid'),
        userId: uid,
        reference: generateReference('VID'),
        title: `Short Video Reward: ${camp.title}`,
        category: 'Video Reward',
        channel: 'Watch-to-Earn',
        amountRwf: camp.rewardPerViewRwf,
        direction: 'credit',
        status: 'Completed',
        timestamp: nowIso,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('Watch video error:', err);
      res.status(500).json({ error: 'Failed to credit video watch reward.' });
    }
  });

  router.post('/videos/create', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const user = mapUserRow(userRow);
      const settings = await getPlatformSettings();

      const title = String(req.body?.title ?? '').trim();
      const description = String(req.body?.description ?? '').trim();
      const videoUrl = String(req.body?.videoUrl ?? '').trim();
      const rewardPerViewRwf = Math.round(Number(req.body?.rewardPerViewRwf ?? 0));
      const targetViewers = Math.round(Number(req.body?.targetViewers ?? 0));
      const paymentRef = String(req.body?.paymentRef ?? '').trim();

      if (!title || !isSafeMediaOrHttpUrl(videoUrl) || targetViewers < 1 || paymentRef.length < 3) {
        res.status(400).json({ error: 'Valid video details, safe video URL, and payment reference required.' });
        return;
      }
      if (rewardPerViewRwf < settings.minVideoRewardRwf) {
        res.status(400).json({ error: `Minimum reward per view is ${settings.minVideoRewardRwf} RWF.` });
        return;
      }

      const nowIso = new Date().toISOString();
      const totalBudgetRwf = rewardPerViewRwf * targetViewers;
      const paymentCode = buildUssdCode(settings.momoPayCode, totalBudgetRwf);

      await dbExecute(
        `INSERT INTO video_campaigns (id, creator_id, creator_name, title, description, video_url, reward_per_view_rwf, target_viewers, total_budget_rwf, payment_code, payment_ref, watched_by_user_ids, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          generateSafeId('vid'),
          uid,
          `${user.firstName} ${user.secondName}`,
          title,
          description,
          videoUrl,
          rewardPerViewRwf,
          targetViewers,
          totalBudgetRwf,
          paymentCode,
          paymentRef,
          '[]',
          'pending_admin',
          nowIso,
          nowIso,
        ],
      );

      await insertTransaction({
        id: generateSafeId('tx-cmp'),
        userId: uid,
        reference: generateReference('CMP'),
        title: `Video Campaign Deposit: ${title}`,
        category: 'Campaign Payment',
        channel: `${paymentCode} · Ref ${paymentRef}`,
        amountRwf: totalBudgetRwf,
        direction: 'debit',
        status: 'Pending Review',
        timestamp: nowIso,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('Create video error:', err);
      res.status(500).json({ error: 'Failed to create video campaign.' });
    }
  });

  router.post('/tasks/submit', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const taskId = String(req.body?.taskId ?? '');
      const proofText = String(req.body?.proofText ?? '').trim();
      const rawProofUrl = String(req.body?.proofUrl ?? '').trim();
      const proofUrl = rawProofUrl.length >= 4 ? rawProofUrl : undefined;

      if (proofUrl && !isSafeHttpUrl(proofUrl)) {
        res.status(400).json({ error: 'Proof URL must start with http:// or https://.' });
        return;
      }

      const taskRow = await dbQueryOne<Record<string, unknown>>(
        `SELECT * FROM custom_tasks WHERE id = $1 AND status = 'active'`,
        [taskId],
      );
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      if (!taskRow || !userRow || proofText.length < 3) {
        res.status(400).json({ error: 'Active task and completion proof required.' });
        return;
      }
      const existingSub = await dbQueryOne<{ id: string }>(
        'SELECT id FROM task_submissions WHERE task_id = $1 AND worker_id = $2',
        [taskId, uid],
      );
      if (existingSub) {
        res.status(400).json({ error: 'You already submitted proof for this task.' });
        return;
      }

      const task = mapTaskRow(taskRow);
      const user = mapUserRow(userRow);
      const nowIso = new Date().toISOString();

      await dbExecute(
        `INSERT INTO task_submissions (id, task_id, task_title, worker_id, worker_name, proof_text, proof_url, reward_rwf, status, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          generateSafeId('sub'),
          task.id,
          task.title,
          uid,
          `${user.firstName} ${user.secondName}`,
          proofText,
          proofUrl ?? null,
          task.rewardPerCompletionRwf,
          'pending_admin',
          nowIso,
        ],
      );

      res.json({ ok: true });
    } catch (err) {
      console.error('Submit task proof error:', err);
      res.status(500).json({ error: 'Failed to submit task proof.' });
    }
  });

  router.post('/tasks/create', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const user = mapUserRow(userRow);
      const settings = await getPlatformSettings();

      const title = String(req.body?.title ?? '').trim();
      const requirements = String(req.body?.requirements ?? '').trim();
      const rewardPerCompletionRwf = Math.round(Number(req.body?.rewardPerCompletionRwf ?? 0));
      const targetCompletions = Math.round(Number(req.body?.targetCompletions ?? 0));
      const paymentRef = String(req.body?.paymentRef ?? '').trim();

      if (!title || !requirements || rewardPerCompletionRwf < 20 || targetCompletions < 1 || paymentRef.length < 3) {
        res.status(400).json({ error: 'Valid task details and payment reference required.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const totalBudgetRwf = rewardPerCompletionRwf * targetCompletions;
      const paymentCode = buildUssdCode(settings.momoPayCode, totalBudgetRwf);

      await dbExecute(
        `INSERT INTO custom_tasks (id, creator_id, creator_name, title, requirements, reward_per_completion_rwf, target_completions, total_budget_rwf, payment_code, payment_ref, approved_worker_ids, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          generateSafeId('tsk'),
          uid,
          `${user.firstName} ${user.secondName}`,
          title,
          requirements,
          rewardPerCompletionRwf,
          targetCompletions,
          totalBudgetRwf,
          paymentCode,
          paymentRef,
          '[]',
          'pending_admin',
          nowIso,
          nowIso,
        ],
      );

      await insertTransaction({
        id: generateSafeId('tx-tsk'),
        userId: uid,
        reference: generateReference('TSK'),
        title: `Custom Task Funding: ${title}`,
        category: 'Campaign Payment',
        channel: `${paymentCode} · Ref ${paymentRef}`,
        amountRwf: totalBudgetRwf,
        direction: 'debit',
        status: 'Pending Review',
        timestamp: nowIso,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('Create task error:', err);
      res.status(500).json({ error: 'Failed to create custom task.' });
    }
  });

  router.post('/quiz-bet/start', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const stakeRwf = Math.round(Number(req.body?.stakeRwf ?? 0));
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const user = mapUserRow(userRow);
      if (stakeRwf < 100 || stakeRwf > user.walletBalanceRwf) {
        res.status(400).json({ error: 'Minimum bet stake is 100 RWF and must not exceed wallet balance.' });
        return;
      }

      const nowIso = new Date().toISOString();
      await dbExecute(
        `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf - $1, updated_at = $2 WHERE id = $3`,
        [stakeRwf, nowIso, uid],
      );
      await insertTransaction({
        id: generateSafeId('tx-bet'),
        userId: uid,
        reference: generateReference('BET'),
        title: `Quiz Bet Stake (${stakeRwf} RWF)`,
        category: 'Quiz Bet',
        channel: '10s Quiz Bet Arena',
        amountRwf: stakeRwf,
        direction: 'debit',
        status: 'Completed',
        timestamp: nowIso,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('Quiz bet start error:', err);
      res.status(500).json({ error: 'Failed to place quiz bet stake.' });
    }
  });

  router.post('/quiz-bet/finish', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const session = req.body?.session as BetSession | undefined;
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      if (!userRow || !session) {
        res.status(400).json({ error: 'Invalid bet session payload.' });
        return;
      }
      const user = mapUserRow(userRow);
      const questionsAnswered = Math.max(0, Math.min(20, Math.round(Number(session.questionsAnswered ?? 0))));
      const stakeRwf = Math.max(100, Math.round(Number(session.stakeRwf ?? 0)));
      const multiplier = Number(session.multiplier ?? 0);
      const payoutRwf =
        session.status === 'won_cashed_out'
          ? Math.max(0, Math.min(stakeRwf * 10, Math.round(Number(session.payoutRwf ?? 0))))
          : 0;
      const createdAt = session.createdAt || new Date().toISOString();

      await dbExecute(
        `INSERT INTO bet_sessions (id, user_id, user_name, category, stake_rwf, questions_answered, multiplier, payout_rwf, status, ended_reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          generateSafeId('bet'),
          uid,
          `${user.firstName} ${user.secondName}`,
          String(session.category || 'mixed'),
          stakeRwf,
          questionsAnswered,
          multiplier,
          payoutRwf,
          session.status === 'won_cashed_out' ? 'won_cashed_out' : 'lost',
          String(session.endedReason || ''),
          createdAt,
        ],
      );

      if (session.status === 'won_cashed_out' && payoutRwf > 0) {
        await dbExecute(
          `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + $1, updated_at = $2 WHERE id = $3`,
          [payoutRwf, new Date().toISOString(), uid],
        );
        await insertTransaction({
          id: generateSafeId('tx-win'),
          userId: uid,
          reference: generateReference('WIN'),
          title: `Quiz Bet Cashout (${questionsAnswered} Qs · ${multiplier}x)`,
          category: 'Quiz Win',
          channel: '10s Quiz Bet Arena',
          amountRwf: payoutRwf,
          direction: 'credit',
          status: 'Completed',
          timestamp: createdAt,
        });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('Quiz bet finish error:', err);
      res.status(500).json({ error: 'Failed to settle quiz bet.' });
    }
  });

  router.post('/airtime/request', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const user = mapUserRow(userRow);
      const network = String(req.body?.network ?? 'MTN Rwanda');
      const serviceType = String(req.body?.serviceType ?? 'Airtime');
      const phoneNumber = String(req.body?.phoneNumber ?? '').trim();
      const amountRwf = Math.round(Number(req.body?.amountRwf ?? 0));
      const bundleLabel = req.body?.bundleLabel ? String(req.body.bundleLabel).trim() : undefined;

      if (!phoneNumber || amountRwf < 100 || amountRwf > user.walletBalanceRwf) {
        res.status(400).json({ error: 'Valid phone number, minimum 100 RWF, and sufficient balance required.' });
        return;
      }

      const nowIso = new Date().toISOString();
      await dbExecute(
        `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf - $1, updated_at = $2 WHERE id = $3`,
        [amountRwf, nowIso, uid],
      );
      await dbExecute(
        `INSERT INTO airtime_requests (id, user_id, user_name, network, service_type, phone_number, amount_rwf, bundle_label, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          generateSafeId('air'),
          uid,
          `${user.firstName} ${user.secondName}`,
          network,
          serviceType,
          phoneNumber,
          amountRwf,
          bundleLabel ?? null,
          'pending_admin',
          nowIso,
          nowIso,
        ],
      );
      await insertTransaction({
        id: generateSafeId('tx-air'),
        userId: uid,
        reference: generateReference('AIR'),
        title: `${network} ${serviceType}: ${phoneNumber}`,
        category: 'Airtime & Data',
        channel: bundleLabel ? `${network} · ${bundleLabel}` : network,
        amountRwf,
        direction: 'debit',
        status: 'Pending Review',
        timestamp: nowIso,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('Airtime request error:', err);
      res.status(500).json({ error: 'Failed to submit airtime/internet request.' });
    }
  });

  router.get('/wallet-lookup', async (req: AuthRequest, res) => {
    try {
      const address = String(req.query.address ?? '').trim().toUpperCase();
      if (address.length < 4) {
        res.status(400).json({ error: 'Enter a valid receiver wallet address.' });
        return;
      }
      const row = await dbQueryOne<{
        id: string;
        account_number: string;
        first_name: string;
        second_name: string;
        created_at: string;
      }>(
        'SELECT id, account_number, first_name, second_name, created_at FROM users WHERE UPPER(account_number) = $1',
        [address],
      );
      if (!row) {
        res.status(404).json({ error: 'Receiver wallet address not found.' });
        return;
      }
      res.json({
        record: {
          address: row.account_number,
          userId: row.id,
          fullName: `${row.first_name} ${row.second_name}`,
          createdAt: row.created_at,
        },
      });
    } catch (err) {
      console.error('Wallet lookup error:', err);
      res.status(500).json({ error: 'Wallet address lookup failed.' });
    }
  });

  router.post('/p2p/send', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const receiverAddress = String(req.body?.receiverAddress ?? '').trim().toUpperCase();
      const grossAmountRwf = Math.round(Number(req.body?.grossAmountRwf ?? 0));
      const note = req.body?.note ? String(req.body.note).trim() : undefined;

      const senderRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      const receiverRow = await dbQueryOne<Record<string, unknown>>(
        'SELECT * FROM users WHERE UPPER(account_number) = $1',
        [receiverAddress],
      );
      if (!senderRow) {
        res.status(404).json({ error: 'Sender account not found.' });
        return;
      }
      if (!receiverRow) {
        res.status(404).json({ error: 'Receiver wallet address not found.' });
        return;
      }

      const sender = mapUserRow(senderRow);
      const receiver = mapUserRow(receiverRow);

      if (sender.id === receiver.id) {
        res.status(400).json({ error: 'Cannot send money to your own wallet address.' });
        return;
      }
      if (grossAmountRwf < 100) {
        res.status(400).json({ error: 'Minimum P2P transfer is 100 RWF.' });
        return;
      }
      if (grossAmountRwf > sender.walletBalanceRwf) {
        res.status(400).json({ error: 'Insufficient wallet balance.' });
        return;
      }

      const settings = await getPlatformSettings();
      const taxPercent = settings.sendMoneyTaxPercent ?? 10;
      const taxRwf = Math.round((grossAmountRwf * taxPercent) / 100);
      const netAmountRwf = Math.max(0, grossAmountRwf - taxRwf);
      const nowIso = new Date().toISOString();
      const senderFullName = `${sender.firstName} ${sender.secondName}`;
      const receiverFullName = `${receiver.firstName} ${receiver.secondName}`;

      await dbExecute(
        `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf - $1, updated_at = $2 WHERE id = $3`,
        [grossAmountRwf, nowIso, sender.id],
      );
      await dbExecute(
        `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + $1, updated_at = $2 WHERE id = $3`,
        [netAmountRwf, nowIso, receiver.id],
      );

      await dbExecute(
        `INSERT INTO p2p_transfers (id, sender_id, sender_name, sender_address, receiver_id, receiver_name, receiver_address, gross_amount_rwf, tax_percent, tax_rwf, net_amount_rwf, note, status, claimed_by_receiver, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          generateSafeId('p2p'),
          sender.id,
          senderFullName,
          sender.accountNumber,
          receiver.id,
          receiverFullName,
          receiver.accountNumber,
          grossAmountRwf,
          taxPercent,
          taxRwf,
          netAmountRwf,
          note ?? null,
          'completed',
          1,
          nowIso,
        ],
      );

      await insertTransaction({
        id: generateSafeId('tx-snd'),
        userId: sender.id,
        reference: generateReference('SND'),
        title: `Sent to ${receiverFullName} (${receiver.accountNumber})`,
        category: 'Transfer Sent',
        channel: `${taxPercent}% system tax (${taxRwf} RWF) · Net ${netAmountRwf} RWF`,
        amountRwf: grossAmountRwf,
        feeRwf: taxRwf,
        direction: 'debit',
        status: 'Completed',
        timestamp: nowIso,
      });

      await insertTransaction({
        id: generateSafeId('tx-rcv'),
        userId: receiver.id,
        reference: generateReference('RCV'),
        title: `Received from ${senderFullName} (${sender.accountNumber})`,
        category: 'Transfer Received',
        channel: `P2P Wallet Transfer (${taxPercent}% tax paid by sender)`,
        amountRwf: netAmountRwf,
        direction: 'credit',
        status: 'Completed',
        timestamp: nowIso,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('P2P send error:', err);
      res.status(500).json({ error: 'Failed to process P2P transfer.' });
    }
  });

  router.post('/fx/exchange', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const direction = String(req.body?.direction ?? '') as FxExchangeRecord['direction'];
      const fromAmount = Number(req.body?.fromAmount ?? 0);
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      if (!userRow || !Number.isFinite(fromAmount) || fromAmount <= 0) {
        res.status(400).json({ error: 'Enter a valid positive exchange amount.' });
        return;
      }

      const user = mapUserRow(userRow);
      const settings = await getPlatformSettings();
      const rate = Math.max(100, settings.rwfPerUsdRate || 1380);
      const usdBal = user.walletBalanceUsd ?? 0;
      const usdtBal = user.usdtBalance ?? 0;

      let nextRwf = user.walletBalanceRwf;
      let nextUsd = usdBal;
      let nextUsdt = usdtBal;
      let toAmount = 0;
      let rateApplied = 1;
      let rwfEquivalent = 0;

      if (direction === 'RWF_TO_USD') {
        const fromRwf = Math.round(fromAmount);
        if (fromRwf < 100) {
          res.status(400).json({ error: 'Minimum RWF exchange is 100 RWF.' });
          return;
        }
        if (fromRwf > user.walletBalanceRwf) {
          res.status(400).json({ error: 'Insufficient RWF wallet balance.' });
          return;
        }
        toAmount = Number((fromRwf / rate).toFixed(2));
        if (toAmount <= 0) {
          res.status(400).json({ error: 'Amount too small for USD conversion.' });
          return;
        }
        nextRwf = user.walletBalanceRwf - fromRwf;
        nextUsd = Number((usdBal + toAmount).toFixed(2));
        rateApplied = rate;
        rwfEquivalent = fromRwf;
      } else if (direction === 'USD_TO_RWF') {
        if (fromAmount > usdBal) {
          res.status(400).json({ error: 'Insufficient USD wallet balance.' });
          return;
        }
        toAmount = Math.round(fromAmount * rate);
        nextUsd = Number((usdBal - fromAmount).toFixed(2));
        nextRwf = user.walletBalanceRwf + toAmount;
        rateApplied = rate;
        rwfEquivalent = toAmount;
      } else if (direction === 'USD_TO_USDT') {
        if (fromAmount > usdBal) {
          res.status(400).json({ error: 'Insufficient USD wallet balance.' });
          return;
        }
        toAmount = Number(fromAmount.toFixed(2));
        nextUsd = Number((usdBal - fromAmount).toFixed(2));
        nextUsdt = Number((usdtBal + toAmount).toFixed(2));
        rwfEquivalent = Math.round(toAmount * rate);
      } else if (direction === 'USDT_TO_USD') {
        if (fromAmount > usdtBal) {
          res.status(400).json({ error: 'Insufficient USDT wallet balance.' });
          return;
        }
        toAmount = Number(fromAmount.toFixed(2));
        nextUsdt = Number((usdtBal - fromAmount).toFixed(2));
        nextUsd = Number((usdBal + toAmount).toFixed(2));
        rwfEquivalent = Math.round(toAmount * rate);
      } else {
        res.status(400).json({ error: 'Invalid conversion direction.' });
        return;
      }

      const nowIso = new Date().toISOString();
      await dbExecute(
        `UPDATE users SET wallet_balance_rwf = $1, wallet_balance_usd = $2, usdt_balance = $3, updated_at = $4 WHERE id = $5`,
        [nextRwf, nextUsd, nextUsdt, nowIso, uid],
      );
      await dbExecute(
        `INSERT INTO fx_exchanges (id, user_id, user_name, direction, from_amount, to_amount, rate_applied, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          generateSafeId('fx'),
          uid,
          `${user.firstName} ${user.secondName}`,
          direction,
          fromAmount,
          toAmount,
          rateApplied,
          nowIso,
        ],
      );
      await insertTransaction({
        id: generateSafeId('tx-fx'),
        userId: uid,
        reference: generateReference('FX'),
        title: `FX ${direction.replace(/_/g, ' ')}: ${fromAmount} → ${toAmount}`,
        category: 'Currency Exchange',
        channel: `Rate ${rateApplied}`,
        amountRwf: rwfEquivalent,
        direction: direction === 'USD_TO_RWF' ? 'credit' : 'debit',
        status: 'Completed',
        timestamp: nowIso,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('FX exchange error:', err);
      res.status(500).json({ error: 'Failed to process currency exchange.' });
    }
  });

  router.post('/usdt/savings', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const action = req.body?.action === 'withdraw' ? 'withdraw' : 'deposit';
      const amountUsdt = Number(req.body?.amountUsdt ?? 0);
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      if (!userRow || !Number.isFinite(amountUsdt) || amountUsdt <= 0) {
        res.status(400).json({ error: 'Enter a valid USDT amount.' });
        return;
      }

      const user = mapUserRow(userRow);
      const usdtBal = user.usdtBalance ?? 0;
      const usdtSav = user.usdtSavingsBalance ?? 0;
      const settings = await getPlatformSettings();
      const rate = Math.max(100, settings.rwfPerUsdRate || 1380);

      if (action === 'deposit' && amountUsdt > usdtBal) {
        res.status(400).json({ error: 'Insufficient USDT wallet balance.' });
        return;
      }
      if (action === 'withdraw' && amountUsdt > usdtSav) {
        res.status(400).json({ error: 'Amount exceeds USDT Savings Vault balance.' });
        return;
      }

      const nextUsdt =
        action === 'deposit'
          ? Number((usdtBal - amountUsdt).toFixed(2))
          : Number((usdtBal + amountUsdt).toFixed(2));
      const nextSav =
        action === 'deposit'
          ? Number((usdtSav + amountUsdt).toFixed(2))
          : Number((usdtSav - amountUsdt).toFixed(2));
      const nowIso = new Date().toISOString();

      await dbExecute(
        `UPDATE users SET usdt_balance = $1, usdt_savings_balance = $2, updated_at = $3 WHERE id = $4`,
        [nextUsdt, nextSav, nowIso, uid],
      );
      await insertTransaction({
        id: generateSafeId('tx-usav'),
        userId: uid,
        reference: generateReference('USAV'),
        title:
          action === 'deposit'
            ? `Saved ${amountUsdt.toFixed(2)} USDT to Vault`
            : `Moved ${amountUsdt.toFixed(2)} USDT from Vault to Wallet`,
        category: 'USDT Savings',
        channel: 'USDT Smart Savings',
        amountRwf: Math.round(amountUsdt * rate),
        direction: action === 'deposit' ? 'debit' : 'credit',
        status: 'Completed',
        timestamp: nowIso,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('USDT savings error:', err);
      res.status(500).json({ error: 'Failed to update USDT savings.' });
    }
  });

  router.post('/usdt/request', async (req: AuthRequest, res) => {
    try {
      const uid = req.auth!.userId!;
      const actionType = String(req.body?.actionType ?? '') as UsdtRequest['actionType'];
      const amountUsdt = Number(req.body?.amountUsdt ?? 0);
      const network = String(req.body?.network ?? 'BEP20 (BSC)');
      const destinationOrTxRef = String(req.body?.destinationOrTxRef ?? '').trim();
      const note = req.body?.note ? String(req.body.note).trim() : undefined;

      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [uid]);
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      if (!['deposit', 'withdraw', 'send_binance'].includes(actionType)) {
        res.status(400).json({ error: 'Invalid USDT action type.' });
        return;
      }
      if (!Number.isFinite(amountUsdt) || amountUsdt < 1) {
        res.status(400).json({ error: 'Minimum USDT operation is 1.00 USDT.' });
        return;
      }
      if (destinationOrTxRef.length < 4) {
        res.status(400).json({ error: 'Enter a valid Binance Pay ID, USDT address, or TxHash.' });
        return;
      }

      const user = mapUserRow(userRow);
      const usdtBal = user.usdtBalance ?? 0;
      const isDebit = actionType === 'withdraw' || actionType === 'send_binance';
      if (isDebit && amountUsdt > usdtBal) {
        res.status(400).json({ error: `Insufficient USDT balance (${usdtBal.toFixed(2)} USDT available).` });
        return;
      }

      const nextUsdt = isDebit ? Number((usdtBal - amountUsdt).toFixed(2)) : usdtBal;
      const settings = await getPlatformSettings();
      const rate = Math.max(100, settings.rwfPerUsdRate || 1380);
      const nowIso = new Date().toISOString();

      if (isDebit) {
        await dbExecute(`UPDATE users SET usdt_balance = $1, updated_at = $2 WHERE id = $3`, [
          nextUsdt,
          nowIso,
          uid,
        ]);
      }

      await dbExecute(
        `INSERT INTO usdt_requests (id, user_id, user_name, action_type, amount_usdt, network, destination_or_tx_ref, note, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          generateSafeId('usdt'),
          uid,
          `${user.firstName} ${user.secondName}`,
          actionType,
          Number(amountUsdt.toFixed(2)),
          network,
          destinationOrTxRef,
          note ?? null,
          'pending_admin',
          nowIso,
          nowIso,
        ],
      );

      await insertTransaction({
        id: generateSafeId('tx-usdt'),
        userId: uid,
        reference: generateReference('USDT'),
        title:
          actionType === 'deposit'
            ? `USDT Deposit (${amountUsdt.toFixed(2)} USDT)`
            : actionType === 'send_binance'
              ? `Send ${amountUsdt.toFixed(2)} USDT to Binance`
              : `Withdraw ${amountUsdt.toFixed(2)} USDT`,
        category: actionType === 'deposit' ? 'USDT Deposit' : 'USDT Send / Withdraw',
        channel: `${network} · ${destinationOrTxRef}`,
        amountRwf: Math.round(amountUsdt * rate),
        direction: actionType === 'deposit' ? 'credit' : 'debit',
        status: 'Pending Review',
        timestamp: nowIso,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('USDT request error:', err);
      res.status(500).json({ error: 'Failed to submit USDT request.' });
    }
  });

  return router;
}

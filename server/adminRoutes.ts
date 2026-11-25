import { Router } from 'express';
import type { RegisteredUser, SystemSettings } from '../src/types/finance.ts';
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
  mapPromotionRow,
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
import { type AuthRequest, requireAdmin } from './middleware.ts';
import { generateReference, generateSafeId, isSafeMediaOrHttpUrl } from './security.ts';

export function createAdminRouter(): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get('/state', async (_req: AuthRequest, res) => {
    try {
      await processDueInvestmentRoi();

      const [
        settings,
        userRows,
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
        promoRows,
      ] = await Promise.all([
        getPlatformSettings(),
        dbQuery<Record<string, unknown>>('SELECT * FROM users ORDER BY created_at DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM savings_goals ORDER BY created_at DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM loans ORDER BY created_at DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM investments ORDER BY created_at DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM spin_history ORDER BY spun_at DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM withdrawals ORDER BY created_at DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM video_campaigns ORDER BY created_at DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM custom_tasks ORDER BY created_at DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM task_submissions ORDER BY submitted_at DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM bet_sessions ORDER BY created_at DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM airtime_requests ORDER BY created_at DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM p2p_transfers ORDER BY created_at DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM fx_exchanges ORDER BY created_at DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM usdt_requests ORDER BY created_at DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM transactions ORDER BY timestamp DESC'),
        dbQuery<Record<string, unknown>>('SELECT * FROM promotions ORDER BY created_at DESC'),
      ]);

      res.json({
        settings,
        users: userRows.map(mapUserRow),
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
        promotions: promoRows.map(mapPromotionRow),
      });
    } catch (err) {
      console.error('Failed to fetch admin state:', err);
      res.status(500).json({ error: 'Unable to load Admin workspace.' });
    }
  });

  router.post('/users/:id/approve', async (req: AuthRequest, res) => {
    try {
      const userId = String(req.params.id);
      await dbExecute(
        `UPDATE users SET account_status = 'awaiting_payment', updated_at = $1 WHERE id = $2`,
        [new Date().toISOString(), userId],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('Approve user error:', err);
      res.status(500).json({ error: 'Failed to approve user.' });
    }
  });

  router.post('/users/:id/activate', async (req: AuthRequest, res) => {
    try {
      const userId = String(req.params.id);
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [userId]);
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const targetUser = mapUserRow(userRow);
      const settings = await getPlatformSettings();
      const bonus = settings.welcomeBonusRwf;
      const nowIso = new Date().toISOString();

      await dbExecute(
        `UPDATE users SET account_status = 'active', wallet_balance_rwf = wallet_balance_rwf + $1, bonus_balance_rwf = bonus_balance_rwf + $1, updated_at = $2 WHERE id = $3`,
        [bonus, nowIso, userId],
      );

      await dbExecute(
        `UPDATE transactions SET status = 'Completed' WHERE user_id = $1 AND category = 'Activation' AND status = 'Pending Review'`,
        [userId],
      );

      await insertTransaction({
        id: generateSafeId('tx-bns'),
        userId,
        reference: generateReference('BNS'),
        title: `Welcome Bonus (${bonus} RWF)`,
        category: 'Bonus',
        channel: 'E-Finance System Activation',
        amountRwf: bonus,
        direction: 'credit',
        status: 'Completed',
        timestamp: nowIso,
      });

      if (targetUser.referredByUserId) {
        const refRow = await dbQueryOne<Record<string, unknown>>(
          'SELECT * FROM users WHERE id = $1',
          [targetUser.referredByUserId],
        );
        if (refRow) {
          const referralCommRwf = Math.round(
            (settings.activationFeeRwf * settings.referralCommissionPercent) / 100,
          );
          await dbExecute(
            `UPDATE users SET spin_credits = spin_credits + 1, wallet_balance_rwf = wallet_balance_rwf + $1, updated_at = $2 WHERE id = $3`,
            [referralCommRwf, nowIso, String(refRow.id)],
          );
          await insertTransaction({
            id: generateSafeId('tx-ref'),
            userId: String(refRow.id),
            reference: generateReference('REF'),
            title: `Referral Bonus +1 Spin (${targetUser.firstName} activated)`,
            category: 'Referral Commission',
            channel: `${settings.referralCommissionPercent}% Activation Commission`,
            amountRwf: referralCommRwf,
            direction: 'credit',
            status: 'Completed',
            timestamp: nowIso,
          });
        }
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('Activate user error:', err);
      res.status(500).json({ error: 'Failed to activate user.' });
    }
  });

  router.post('/users/:id/toggle-suspend', async (req: AuthRequest, res) => {
    try {
      const userId = String(req.params.id);
      const userRow = await dbQueryOne<{ account_status: string }>(
        'SELECT account_status FROM users WHERE id = $1',
        [userId],
      );
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const nextStatus = userRow.account_status === 'suspended' ? 'active' : 'suspended';
      await dbExecute(`UPDATE users SET account_status = $1, updated_at = $2 WHERE id = $3`, [
        nextStatus,
        new Date().toISOString(),
        userId,
      ]);
      if (nextStatus === 'suspended') {
        await dbExecute('DELETE FROM sessions WHERE user_id = $1', [userId]);
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('Toggle suspend error:', err);
      res.status(500).json({ error: 'Failed to toggle user suspension.' });
    }
  });

  router.put('/users/:id', async (req: AuthRequest, res) => {
    try {
      const userId = String(req.params.id);
      const u = req.body as RegisteredUser;
      const nowIso = new Date().toISOString();
      await dbExecute(
        `UPDATE users SET
          first_name = $1,
          second_name = $2,
          email = $3,
          phone = $4,
          gender = $5,
          date_of_birth = $6,
          id_number = $7,
          photo_data_url = $8,
          education = $9,
          residence = $10,
          account_status = $11,
          wallet_balance_rwf = $12,
          bonus_balance_rwf = $13,
          savings_balance_rwf = $14,
          wallet_balance_usd = $15,
          usdt_balance = $16,
          usdt_savings_balance = $17,
          kyc_status = $18,
          kyc_data = $19,
          updated_at = $20
        WHERE id = $21`,
        [
          u.firstName,
          u.secondName,
          u.email.toLowerCase(),
          u.phone,
          u.gender,
          u.dateOfBirth,
          u.idNumber,
          u.photoDataUrl,
          JSON.stringify(u.education),
          JSON.stringify(u.residence),
          u.accountStatus,
          Number(u.walletBalanceRwf ?? 0),
          Number(u.bonusBalanceRwf ?? 0),
          Number(u.savingsBalanceRwf ?? 0),
          Number(u.walletBalanceUsd ?? 0),
          Number(u.usdtBalance ?? 0),
          Number(u.usdtSavingsBalance ?? 0),
          u.kycStatus,
          u.kycData ? JSON.stringify(u.kycData) : null,
          nowIso,
          userId,
        ],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('Admin update user error:', err);
      res.status(500).json({ error: 'Failed to update user record.' });
    }
  });

  router.delete('/users/:id', async (req: AuthRequest, res) => {
    try {
      const userId = String(req.params.id);
      await Promise.all([
        dbExecute('DELETE FROM sessions WHERE user_id = $1', [userId]),
        dbExecute('DELETE FROM savings_goals WHERE user_id = $1', [userId]),
        dbExecute('DELETE FROM loans WHERE user_id = $1', [userId]),
        dbExecute('DELETE FROM investments WHERE user_id = $1', [userId]),
        dbExecute('DELETE FROM spin_history WHERE user_id = $1', [userId]),
        dbExecute('DELETE FROM withdrawals WHERE user_id = $1', [userId]),
        dbExecute('DELETE FROM task_submissions WHERE worker_id = $1', [userId]),
        dbExecute('DELETE FROM bet_sessions WHERE user_id = $1', [userId]),
        dbExecute('DELETE FROM airtime_requests WHERE user_id = $1', [userId]),
        dbExecute('DELETE FROM p2p_transfers WHERE sender_id = $1 OR receiver_id = $1', [userId]),
        dbExecute('DELETE FROM fx_exchanges WHERE user_id = $1', [userId]),
        dbExecute('DELETE FROM usdt_requests WHERE user_id = $1', [userId]),
        dbExecute('DELETE FROM transactions WHERE user_id = $1', [userId]),
        dbExecute('DELETE FROM users WHERE id = $1', [userId]),
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete user error:', err);
      res.status(500).json({ error: 'Failed to delete user.' });
    }
  });

  router.post('/users/:id/kyc', async (req: AuthRequest, res) => {
    try {
      const userId = String(req.params.id);
      const decision = req.body?.decision === 'approved' ? 'approved' : 'rejected';
      const note = String(req.body?.note ?? '').trim();
      const userRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [userId]);
      if (!userRow) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const user = mapUserRow(userRow);
      const nextKycData = user.kycData
        ? {
            ...user.kycData,
            ...(note ? { reviewNote: note } : {}),
          }
        : undefined;

      await dbExecute(
        `UPDATE users SET kyc_status = $1, kyc_data = $2, updated_at = $3 WHERE id = $4`,
        [decision, nextKycData ? JSON.stringify(nextKycData) : null, new Date().toISOString(), userId],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('KYC review error:', err);
      res.status(500).json({ error: 'Failed to review KYC.' });
    }
  });

  router.post('/videos/create', async (req: AuthRequest, res) => {
    try {
      const title = String(req.body?.title ?? '').trim();
      const description = String(req.body?.description ?? '').trim();
      const videoUrl = String(req.body?.videoUrl ?? '').trim();
      const rewardPerViewRwf = Math.round(Number(req.body?.rewardPerViewRwf ?? 0));
      const targetViewers = Math.round(Number(req.body?.targetViewers ?? 0));

      if (!title || !isSafeMediaOrHttpUrl(videoUrl) || rewardPerViewRwf < 1 || targetViewers < 1) {
        res.status(400).json({ error: 'Provide valid title, video URL/upload, reward, and target viewers.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const totalBudgetRwf = rewardPerViewRwf * targetViewers;
      await dbExecute(
        `INSERT INTO video_campaigns (id, creator_id, creator_name, title, description, video_url, reward_per_view_rwf, target_viewers, total_budget_rwf, payment_code, payment_ref, watched_by_user_ids, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          generateSafeId('vid'),
          'admin',
          'E-Finance Admin',
          title,
          description,
          videoUrl,
          rewardPerViewRwf,
          targetViewers,
          totalBudgetRwf,
          'ADMIN-DIRECT',
          'ADMIN-PUBLISHED',
          '[]',
          'active',
          nowIso,
          nowIso,
        ],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('Admin video create error:', err);
      res.status(500).json({ error: 'Failed to publish video campaign.' });
    }
  });

  router.post('/videos/:id/review', async (req: AuthRequest, res) => {
    try {
      const id = String(req.params.id);
      const decision = req.body?.decision === 'active' ? 'active' : 'rejected';
      await dbExecute(`UPDATE video_campaigns SET status = $1, updated_at = $2 WHERE id = $3`, [
        decision,
        new Date().toISOString(),
        id,
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Review video error:', err);
      res.status(500).json({ error: 'Failed to update video campaign.' });
    }
  });

  router.post('/tasks/create', async (req: AuthRequest, res) => {
    try {
      const title = String(req.body?.title ?? '').trim();
      const requirements = String(req.body?.requirements ?? '').trim();
      const rewardPerCompletionRwf = Math.round(Number(req.body?.rewardPerCompletionRwf ?? 0));
      const targetCompletions = Math.round(Number(req.body?.targetCompletions ?? 0));

      if (!title || !requirements || rewardPerCompletionRwf < 1 || targetCompletions < 1) {
        res.status(400).json({ error: 'Provide valid task title, requirements, reward, and target.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const totalBudgetRwf = rewardPerCompletionRwf * targetCompletions;
      await dbExecute(
        `INSERT INTO custom_tasks (id, creator_id, creator_name, title, requirements, reward_per_completion_rwf, target_completions, total_budget_rwf, payment_code, payment_ref, approved_worker_ids, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          generateSafeId('tsk'),
          'admin',
          'E-Finance Admin',
          title,
          requirements,
          rewardPerCompletionRwf,
          targetCompletions,
          totalBudgetRwf,
          'ADMIN-DIRECT',
          'ADMIN-PUBLISHED',
          '[]',
          'active',
          nowIso,
          nowIso,
        ],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('Admin task create error:', err);
      res.status(500).json({ error: 'Failed to publish task.' });
    }
  });

  router.post('/tasks/:id/review', async (req: AuthRequest, res) => {
    try {
      const id = String(req.params.id);
      const decision = req.body?.decision === 'active' ? 'active' : 'rejected';
      await dbExecute(`UPDATE custom_tasks SET status = $1, updated_at = $2 WHERE id = $3`, [
        decision,
        new Date().toISOString(),
        id,
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Review task error:', err);
      res.status(500).json({ error: 'Failed to review custom task.' });
    }
  });

  router.post('/submissions/:id/review', async (req: AuthRequest, res) => {
    try {
      const submissionId = String(req.params.id);
      const decision = req.body?.decision === 'approved' ? 'approved' : 'rejected';
      const note = String(req.body?.note ?? '').trim();

      const subRow = await dbQueryOne<Record<string, unknown>>(
        'SELECT * FROM task_submissions WHERE id = $1',
        [submissionId],
      );
      if (!subRow) {
        res.status(404).json({ error: 'Submission not found.' });
        return;
      }
      const sub = mapSubmissionRow(subRow);
      if (sub.status !== 'pending_admin') {
        res.status(400).json({ error: 'Submission already reviewed.' });
        return;
      }

      const nowIso = new Date().toISOString();
      await dbExecute(
        `UPDATE task_submissions SET status = $1, admin_note = $2, reviewed_at = $3 WHERE id = $4`,
        [decision, note || null, nowIso, submissionId],
      );

      if (decision === 'approved') {
        await dbExecute(
          `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + $1, updated_at = $2 WHERE id = $3`,
          [sub.rewardRwf, nowIso, sub.workerId],
        );

        const taskRow = await dbQueryOne<Record<string, unknown>>(
          'SELECT * FROM custom_tasks WHERE id = $1',
          [sub.taskId],
        );
        if (taskRow) {
          const parentTask = mapTaskRow(taskRow);
          const approvedList = parentTask.approvedWorkerIds.includes(sub.workerId)
            ? parentTask.approvedWorkerIds
            : [...parentTask.approvedWorkerIds, sub.workerId];
          const nextStatus =
            approvedList.length >= parentTask.targetCompletions ? 'completed' : parentTask.status;
          await dbExecute(
            `UPDATE custom_tasks SET approved_worker_ids = $1, status = $2, updated_at = $3 WHERE id = $4`,
            [JSON.stringify(approvedList), nextStatus, nowIso, parentTask.id],
          );
        }

        await insertTransaction({
          id: generateSafeId('tx-tsk'),
          userId: sub.workerId,
          reference: generateReference('TSK'),
          title: `Task Approved: ${sub.taskTitle}`,
          category: 'Task Reward',
          channel: 'Admin Verified Completion',
          amountRwf: sub.rewardRwf,
          direction: 'credit',
          status: 'Completed',
          timestamp: nowIso,
        });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('Review submission error:', err);
      res.status(500).json({ error: 'Failed to review task submission.' });
    }
  });

  router.post('/loans/:id/review', async (req: AuthRequest, res) => {
    try {
      const loanId = String(req.params.id);
      const decision = req.body?.decision === 'approved' ? 'approved' : 'rejected';
      const loanRow = await dbQueryOne<Record<string, unknown>>('SELECT * FROM loans WHERE id = $1', [loanId]);
      if (!loanRow) {
        res.status(404).json({ error: 'Loan not found.' });
        return;
      }
      const loan = mapLoanRow(loanRow);
      if (loan.status !== 'pending_admin') {
        res.status(400).json({ error: 'Loan already reviewed.' });
        return;
      }

      const nowIso = new Date().toISOString();
      await dbExecute(`UPDATE loans SET status = $1, updated_at = $2 WHERE id = $3`, [
        decision,
        nowIso,
        loanId,
      ]);

      if (decision === 'approved') {
        await dbExecute(
          `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + $1, updated_at = $2 WHERE id = $3`,
          [loan.principalRwf, nowIso, loan.userId],
        );
      }

      await dbExecute(
        `UPDATE transactions SET status = $1 WHERE user_id = $2 AND category = 'Loan' AND status = 'Pending Review' AND amount_rwf = $3`,
        [decision === 'approved' ? 'Completed' : 'Rejected', loan.userId, loan.principalRwf],
      );

      res.json({ ok: true });
    } catch (err) {
      console.error('Review loan error:', err);
      res.status(500).json({ error: 'Failed to review loan.' });
    }
  });

  router.post('/investments/:id/review', async (req: AuthRequest, res) => {
    try {
      const invId = String(req.params.id);
      const decision = req.body?.decision === 'active' ? 'active' : 'rejected';
      const invRow = await dbQueryOne<Record<string, unknown>>(
        'SELECT * FROM investments WHERE id = $1',
        [invId],
      );
      if (!invRow) {
        res.status(404).json({ error: 'Investment not found.' });
        return;
      }
      const inv = mapInvestmentRow(invRow);
      if (inv.status !== 'pending_admin') {
        res.status(400).json({ error: 'Investment already reviewed.' });
        return;
      }

      const nowIso = new Date().toISOString();
      await dbExecute(
        `UPDATE investments SET status = $1, last_roi_credited_at = $2, updated_at = $3 WHERE id = $4`,
        [decision, decision === 'active' ? nowIso : null, nowIso, invId],
      );

      await dbExecute(
        `UPDATE transactions SET status = $1 WHERE user_id = $2 AND category = 'Investment Deposit' AND status = 'Pending Review' AND amount_rwf = $3`,
        [decision === 'active' ? 'Completed' : 'Rejected', inv.userId, inv.depositRwf],
      );

      if (decision === 'active') {
        const investorRow = await dbQueryOne<Record<string, unknown>>(
          'SELECT * FROM users WHERE id = $1',
          [inv.userId],
        );
        const investor = investorRow ? mapUserRow(investorRow) : null;
        if (investor?.referredByUserId) {
          const settings = await getPlatformSettings();
          const commRwf = Math.round((inv.depositRwf * settings.referralCommissionPercent) / 100);
          if (commRwf > 0) {
            await dbExecute(
              `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + $1, updated_at = $2 WHERE id = $3`,
              [commRwf, nowIso, investor.referredByUserId],
            );
            await insertTransaction({
              id: generateSafeId('tx-refinv'),
              userId: investor.referredByUserId,
              reference: generateReference('REF'),
              title: `10% Investment Commission (${inv.userName})`,
              category: 'Referral Commission',
              channel: `${inv.planName} Referral Commission`,
              amountRwf: commRwf,
              direction: 'credit',
              status: 'Completed',
              timestamp: nowIso,
            });
          }
        }
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('Review investment error:', err);
      res.status(500).json({ error: 'Failed to review investment.' });
    }
  });

  router.post('/withdrawals/:id/review', async (req: AuthRequest, res) => {
    try {
      const wdId = String(req.params.id);
      const decision = req.body?.decision === 'paid' ? 'paid' : 'rejected';
      const wdRow = await dbQueryOne<Record<string, unknown>>(
        'SELECT * FROM withdrawals WHERE id = $1',
        [wdId],
      );
      if (!wdRow) {
        res.status(404).json({ error: 'Withdrawal not found.' });
        return;
      }
      const wd = mapWithdrawalRow(wdRow);
      if (wd.status !== 'pending_admin') {
        res.status(400).json({ error: 'Withdrawal already processed.' });
        return;
      }

      const nowIso = new Date().toISOString();
      await dbExecute(`UPDATE withdrawals SET status = $1, updated_at = $2 WHERE id = $3`, [
        decision,
        nowIso,
        wdId,
      ]);

      if (decision === 'rejected') {
        await dbExecute(
          `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + $1, updated_at = $2 WHERE id = $3`,
          [wd.grossAmountRwf, nowIso, wd.userId],
        );
      } else {
        await dbExecute(
          `UPDATE users SET has_completed_first_withdrawal = 1, updated_at = $1 WHERE id = $2`,
          [nowIso, wd.userId],
        );
      }

      await dbExecute(
        `UPDATE transactions SET status = $1 WHERE user_id = $2 AND category = 'Withdrawal' AND status = 'Pending Review' AND amount_rwf = $3`,
        [decision === 'paid' ? 'Completed' : 'Rejected', wd.userId, wd.grossAmountRwf],
      );

      res.json({ ok: true });
    } catch (err) {
      console.error('Review withdrawal error:', err);
      res.status(500).json({ error: 'Failed to review withdrawal.' });
    }
  });

  router.post('/airtime/:id/review', async (req: AuthRequest, res) => {
    try {
      const reqId = String(req.params.id);
      const decision = req.body?.decision === 'approved' ? 'approved' : 'rejected';
      const airRow = await dbQueryOne<Record<string, unknown>>(
        'SELECT * FROM airtime_requests WHERE id = $1',
        [reqId],
      );
      if (!airRow) {
        res.status(404).json({ error: 'Airtime request not found.' });
        return;
      }
      const air = mapAirtimeRow(airRow);
      if (air.status !== 'pending_admin') {
        res.status(400).json({ error: 'Airtime request already processed.' });
        return;
      }

      const nowIso = new Date().toISOString();
      await dbExecute(`UPDATE airtime_requests SET status = $1, updated_at = $2 WHERE id = $3`, [
        decision,
        nowIso,
        reqId,
      ]);

      if (decision === 'rejected') {
        await dbExecute(
          `UPDATE users SET wallet_balance_rwf = wallet_balance_rwf + $1, updated_at = $2 WHERE id = $3`,
          [air.amountRwf, nowIso, air.userId],
        );
      }

      await dbExecute(
        `UPDATE transactions SET status = $1 WHERE user_id = $2 AND category = 'Airtime & Data' AND status = 'Pending Review' AND amount_rwf = $3`,
        [decision === 'approved' ? 'Completed' : 'Rejected', air.userId, air.amountRwf],
      );

      res.json({ ok: true });
    } catch (err) {
      console.error('Review airtime error:', err);
      res.status(500).json({ error: 'Failed to review airtime request.' });
    }
  });

  router.post('/usdt/:id/review', async (req: AuthRequest, res) => {
    try {
      const reqId = String(req.params.id);
      const decision = req.body?.decision === 'approved' ? 'approved' : 'rejected';
      const usdtRow = await dbQueryOne<Record<string, unknown>>(
        'SELECT * FROM usdt_requests WHERE id = $1',
        [reqId],
      );
      if (!usdtRow) {
        res.status(404).json({ error: 'USDT request not found.' });
        return;
      }
      const usdtReq = mapUsdtRow(usdtRow);
      if (usdtReq.status !== 'pending_admin') {
        res.status(400).json({ error: 'USDT request already processed.' });
        return;
      }

      const nowIso = new Date().toISOString();
      await dbExecute(`UPDATE usdt_requests SET status = $1, updated_at = $2 WHERE id = $3`, [
        decision,
        nowIso,
        reqId,
      ]);

      const isDebit = usdtReq.actionType === 'withdraw' || usdtReq.actionType === 'send_binance';
      if ((usdtReq.actionType === 'deposit' && decision === 'approved') || (isDebit && decision === 'rejected')) {
        const userBalRow = await dbQueryOne<{ usdt_balance: number }>(
          'SELECT usdt_balance FROM users WHERE id = $1',
          [usdtReq.userId],
        );
        const nextUsdtBalance = Number(
          (Number(userBalRow?.usdt_balance ?? 0) + usdtReq.amountUsdt).toFixed(2),
        );
        await dbExecute(
          `UPDATE users SET usdt_balance = $1, updated_at = $2 WHERE id = $3`,
          [nextUsdtBalance, nowIso, usdtReq.userId],
        );
      }

      const targetCategory = usdtReq.actionType === 'deposit' ? 'USDT Deposit' : 'USDT Send / Withdraw';
      await dbExecute(
        `UPDATE transactions SET status = $1 WHERE user_id = $2 AND category = $3 AND status = 'Pending Review'`,
        [decision === 'approved' ? 'Completed' : 'Rejected', usdtReq.userId, targetCategory],
      );

      res.json({ ok: true });
    } catch (err) {
      console.error('Review USDT request error:', err);
      res.status(500).json({ error: 'Failed to review USDT request.' });
    }
  });

  router.post('/promotions', async (req: AuthRequest, res) => {
    try {
      const title = String(req.body?.title ?? '').trim();
      const category = String(req.body?.category ?? 'Official Announcement').trim();
      const summary = String(req.body?.summary ?? '').trim();
      if (!title || !summary) {
        res.status(400).json({ error: 'Promotion title and summary required.' });
        return;
      }
      await dbExecute(
        `INSERT INTO promotions (id, title, summary, category, active, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [generateSafeId('promo'), title, summary, category, 1, new Date().toISOString()],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('Create promotion error:', err);
      res.status(500).json({ error: 'Failed to publish promotion.' });
    }
  });

  router.post('/promotions/:id/toggle', async (req: AuthRequest, res) => {
    try {
      const id = String(req.params.id);
      const row = await dbQueryOne<{ active: number }>('SELECT active FROM promotions WHERE id = $1', [id]);
      if (!row) {
        res.status(404).json({ error: 'Promotion not found.' });
        return;
      }
      await dbExecute(`UPDATE promotions SET active = $1 WHERE id = $2`, [row.active ? 0 : 1, id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Toggle promotion error:', err);
      res.status(500).json({ error: 'Failed to toggle promotion.' });
    }
  });

  router.delete('/promotions/:id', async (req: AuthRequest, res) => {
    try {
      await dbExecute('DELETE FROM promotions WHERE id = $1', [String(req.params.id)]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete promotion error:', err);
      res.status(500).json({ error: 'Failed to delete promotion.' });
    }
  });

  router.put('/settings', async (req: AuthRequest, res) => {
    try {
      const nextSettings = req.body as SystemSettings;
      await dbExecute(
        `UPDATE settings SET data = $1, updated_at = $2 WHERE key = 'platform'`,
        [JSON.stringify(nextSettings), new Date().toISOString()],
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('Update settings error:', err);
      res.status(500).json({ error: 'Failed to update settings.' });
    }
  });

  return router;
}

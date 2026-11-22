import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { LandingView } from './components/LandingView';
import { LoginModal } from './components/LoginModal';
import { GitHubHostModule } from './components/portal/GitHubHostModule';
import { RegisterWizard } from './components/RegisterWizard';
import { UserDashboard } from './components/UserDashboard';
import { loadPlatformState, savePlatformState } from './data/platformStore';
import {
  GitHubConfig,
  PlatformStoreState,
  RegisteredUser,
  RwandaKycData,
  SavingsGoal,
  SystemSettings,
} from './types/finance';
import {
  buildMomoPayCode,
  generateReference,
  todayRwandaDateKey,
} from './utils/formatters';

export default function App() {
  const [store, setStore] = useState<PlatformStoreState>(() => loadPlatformState());
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [publicGitHubOpen, setPublicGitHubOpen] = useState(false);

  useEffect(() => {
    savePlatformState(store);
  }, [store]);

  const currentUser =
    store.session.type === 'user'
      ? store.users.find((u) => u.id === (store.session as { type: 'user'; userId: string }).userId) ?? null
      : null;

  /* ------------------------------------------------------------------------ */
  /* Registration & Authentication                                            */
  /* ------------------------------------------------------------------------ */
  const handleRegisterComplete = (newUser: RegisteredUser) => {
    setStore((prev) => ({
      ...prev,
      users: [newUser, ...prev.users],
      session: { type: 'user', userId: newUser.id },
    }));
    setRegisterOpen(false);
  };

  const handleLoginUser = (userId: string) => {
    setStore((prev) => ({
      ...prev,
      session: { type: 'user', userId },
    }));
    setLoginOpen(false);
    setPublicGitHubOpen(false);
  };

  const handleLoginAdmin = () => {
    setStore((prev) => ({
      ...prev,
      session: { type: 'admin' },
    }));
    setLoginOpen(false);
    setPublicGitHubOpen(false);
  };

  const handleSignOut = () => {
    setStore((prev) => ({
      ...prev,
      session: { type: 'guest' },
    }));
  };

  /* ------------------------------------------------------------------------ */
  /* User Lifecycle & Financial Handlers                                      */
  /* ------------------------------------------------------------------------ */
  const handleSubmitActivationPayment = (phone: string, ref: string) => {
    if (!currentUser) return;
    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              accountStatus: 'payment_submitted',
              activationPaidPhone: phone,
              activationPaymentRef: ref,
            }
          : u,
      ),
      transactions: [
        {
          id: `tx-${Date.now()}`,
          userId: currentUser.id,
          reference: generateReference('ACT'),
          title: `System Activation Fee (${prev.settings.activationFeeRwf} RWF)`,
          category: 'Activation',
          channel: `${prev.settings.momoPayCode}*${prev.settings.activationFeeRwf}# · Ref ${ref}`,
          amountRwf: prev.settings.activationFeeRwf,
          direction: 'debit',
          status: 'Pending Review',
          timestamp: new Date().toISOString(),
        },
        ...prev.transactions,
      ],
    }));
  };

  const handleDailyCheckIn = () => {
    if (!currentUser) return;
    const todayKey = todayRwandaDateKey();
    if (currentUser.lastCheckInDate === todayKey) return;

    setStore((prev) => {
      const reward = prev.settings.dailyCheckInRwf;
      return {
        ...prev,
        users: prev.users.map((u) =>
          u.id === currentUser.id
            ? {
                ...u,
                walletBalanceRwf: u.walletBalanceRwf + reward,
                lastCheckInDate: todayKey,
                checkInStreak: u.checkInStreak + 1,
              }
            : u,
        ),
        transactions: [
          {
            id: `tx-${Date.now()}`,
            userId: currentUser.id,
            reference: generateReference('CHK'),
            title: `Daily Check-In Reward (${todayKey})`,
            category: 'Check-In',
            channel: 'E-Finance Daily Check-In',
            amountRwf: reward,
            direction: 'credit',
            status: 'Completed',
            timestamp: new Date().toISOString(),
          },
          ...prev.transactions,
        ],
      };
    });
  };

  const handleSubmitKyc = (data: RwandaKycData) => {
    if (!currentUser) return;
    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id ? { ...u, kycStatus: 'pending', kycData: data } : u,
      ),
    }));
  };

  const handleCreateSavingsGoal = (
    title: string,
    planType: SavingsGoal['planType'],
    targetRwf: number,
    targetDate: string,
  ) => {
    if (!currentUser || currentUser.kycStatus !== 'approved') return;
    setStore((prev) => ({
      ...prev,
      savingsGoals: [
        {
          id: `sav-${Date.now()}`,
          userId: currentUser.id,
          title,
          planType,
          targetRwf,
          currentRwf: 0,
          targetDate,
          createdAt: new Date().toISOString(),
        },
        ...prev.savingsGoals,
      ],
    }));
  };

  const handleDepositToSavings = (goalId: string, amountRwf: number) => {
    if (!currentUser || currentUser.kycStatus !== 'approved') return;
    if (amountRwf > currentUser.walletBalanceRwf || amountRwf <= 0) return;

    const goal = store.savingsGoals.find((g) => g.id === goalId && g.userId === currentUser.id);
    if (!goal) return;

    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              walletBalanceRwf: u.walletBalanceRwf - amountRwf,
              savingsBalanceRwf: u.savingsBalanceRwf + amountRwf,
            }
          : u,
      ),
      savingsGoals: prev.savingsGoals.map((g) =>
        g.id === goalId ? { ...g, currentRwf: g.currentRwf + amountRwf } : g,
      ),
      transactions: [
        {
          id: `tx-${Date.now()}`,
          userId: currentUser.id,
          reference: generateReference('SAV'),
          title: `Saved to ${goal.title}`,
          category: 'Savings',
          channel: `Smart Savings · ${goal.planType}`,
          amountRwf,
          direction: 'debit',
          status: 'Completed',
          timestamp: new Date().toISOString(),
        },
        ...prev.transactions,
      ],
    }));
  };

  const handleWithdrawFromSavings = (goalId: string, amountRwf: number) => {
    if (!currentUser || currentUser.kycStatus !== 'approved') return;
    const goal = store.savingsGoals.find((g) => g.id === goalId && g.userId === currentUser.id);
    if (!goal || amountRwf > goal.currentRwf || amountRwf <= 0) return;

    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              walletBalanceRwf: u.walletBalanceRwf + amountRwf,
              savingsBalanceRwf: Math.max(0, u.savingsBalanceRwf - amountRwf),
            }
          : u,
      ),
      savingsGoals: prev.savingsGoals.map((g) =>
        g.id === goalId ? { ...g, currentRwf: g.currentRwf - amountRwf } : g,
      ),
      transactions: [
        {
          id: `tx-${Date.now()}`,
          userId: currentUser.id,
          reference: generateReference('SAV'),
          title: `Moved from ${goal.title} to Wallet`,
          category: 'Savings',
          channel: 'Smart Savings Retrieval',
          amountRwf,
          direction: 'credit',
          status: 'Completed',
          timestamp: new Date().toISOString(),
        },
        ...prev.transactions,
      ],
    }));
  };

  const handleRequestLoan = (payload: {
    product: string;
    reason: string;
    principalRwf: number;
    termMonths: number;
    annualRatePercent: number;
    monthlyPaymentRwf: number;
    totalRepayableRwf: number;
  }) => {
    if (!currentUser) return;
    setStore((prev) => ({
      ...prev,
      loans: [
        {
          id: `loan-${Date.now()}`,
          userId: currentUser.id,
          userName: `${currentUser.firstName} ${currentUser.secondName}`,
          ...payload,
          repaidRwf: 0,
          status: 'pending_admin',
          createdAt: new Date().toISOString(),
        },
        ...prev.loans,
      ],
      transactions: [
        {
          id: `tx-${Date.now()}`,
          userId: currentUser.id,
          reference: generateReference('LN'),
          title: `Loan Request: ${payload.product}`,
          category: 'Loan',
          channel: `${payload.termMonths} months · ${payload.reason}`,
          amountRwf: payload.principalRwf,
          direction: 'credit',
          status: 'Pending Review',
          timestamp: new Date().toISOString(),
        },
        ...prev.transactions,
      ],
    }));
  };

  const handleRepayLoan = (loanId: string, amountRwf: number) => {
    if (!currentUser || amountRwf <= 0 || amountRwf > currentUser.walletBalanceRwf) return;
    const loan = store.loans.find((l) => l.id === loanId && l.userId === currentUser.id);
    if (!loan) return;

    const nextRepaid = loan.repaidRwf + amountRwf;
    const isFullyRepaid = nextRepaid >= loan.totalRepayableRwf;

    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id ? { ...u, walletBalanceRwf: u.walletBalanceRwf - amountRwf } : u,
      ),
      loans: prev.loans.map((l) =>
        l.id === loanId
          ? {
              ...l,
              repaidRwf: nextRepaid,
              status: isFullyRepaid ? 'repaid' : l.status,
            }
          : l,
      ),
      transactions: [
        {
          id: `tx-${Date.now()}`,
          userId: currentUser.id,
          reference: generateReference('REP'),
          title: `Loan Repayment: ${loan.product}`,
          category: 'Loan',
          channel: 'Wallet Repayment',
          amountRwf,
          direction: 'debit',
          status: 'Completed',
          timestamp: new Date().toISOString(),
        },
        ...prev.transactions,
      ],
    }));
  };

  const handleRequestWithdrawal = (payload: {
    provider: 'MTN Mobile Money' | 'Airtel Money';
    phone: string;
    grossAmountRwf: number;
    feePercent: number;
    feeRwf: number;
    netAmountRwf: number;
  }) => {
    if (!currentUser || currentUser.kycStatus !== 'approved') return;
    if (payload.grossAmountRwf > currentUser.walletBalanceRwf) return;

    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? { ...u, walletBalanceRwf: u.walletBalanceRwf - payload.grossAmountRwf }
          : u,
      ),
      withdrawals: [
        {
          id: `wd-${Date.now()}`,
          userId: currentUser.id,
          userName: `${currentUser.firstName} ${currentUser.secondName}`,
          ...payload,
          status: 'pending_admin',
          createdAt: new Date().toISOString(),
        },
        ...prev.withdrawals,
      ],
      transactions: [
        {
          id: `tx-${Date.now()}`,
          userId: currentUser.id,
          reference: generateReference('WDR'),
          title: `Withdrawal (${payload.provider}) — Net ${payload.netAmountRwf} RWF`,
          category: 'Withdrawal',
          channel: `${payload.provider} · ${payload.phone} · ${payload.feePercent}% fee (${payload.feeRwf} RWF)`,
          amountRwf: payload.grossAmountRwf,
          feeRwf: payload.feeRwf,
          direction: 'debit',
          status: 'Pending Review',
          timestamp: new Date().toISOString(),
        },
        ...prev.transactions,
      ],
    }));
  };

  const handleWatchVideoComplete = (campaignId: string) => {
    if (!currentUser) return;
    const camp = store.videoCampaigns.find((c) => c.id === campaignId);
    if (!camp || camp.status !== 'active') return;
    // Enforce: one view per user
    if (camp.watchedByUserIds.includes(currentUser.id)) return;
    if (camp.watchedByUserIds.length >= camp.targetViewers) return;

    const updatedWatchers = [...camp.watchedByUserIds, currentUser.id];
    const completed = updatedWatchers.length >= camp.targetViewers;

    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? { ...u, walletBalanceRwf: u.walletBalanceRwf + camp.rewardPerViewRwf }
          : u,
      ),
      videoCampaigns: prev.videoCampaigns.map((c) =>
        c.id === campaignId
          ? {
              ...c,
              watchedByUserIds: updatedWatchers,
              status: completed ? 'completed' : c.status,
            }
          : c,
      ),
      transactions: [
        {
          id: `tx-${Date.now()}`,
          userId: currentUser.id,
          reference: generateReference('VID'),
          title: `Short Video Reward: ${camp.title}`,
          category: 'Video Reward',
          channel: 'Watch-to-Earn',
          amountRwf: camp.rewardPerViewRwf,
          direction: 'credit',
          status: 'Completed',
          timestamp: new Date().toISOString(),
        },
        ...prev.transactions,
      ],
    }));
  };

  const handleCreateVideoCampaign = (payload: {
    title: string;
    description: string;
    videoUrl: string;
    rewardPerViewRwf: number;
    targetViewers: number;
    paymentRef: string;
  }) => {
    if (!currentUser) return;
    if (payload.rewardPerViewRwf < store.settings.minVideoRewardRwf) return;
    const totalBudgetRwf = payload.rewardPerViewRwf * payload.targetViewers;
    const paymentCode = buildMomoPayCode(store.settings.momoPayCode, totalBudgetRwf);

    setStore((prev) => ({
      ...prev,
      videoCampaigns: [
        {
          id: `vid-${Date.now()}`,
          creatorId: currentUser.id,
          creatorName: `${currentUser.firstName} ${currentUser.secondName}`,
          title: payload.title,
          description: payload.description,
          videoUrl: payload.videoUrl,
          rewardPerViewRwf: payload.rewardPerViewRwf,
          targetViewers: payload.targetViewers,
          totalBudgetRwf,
          paymentCode,
          paymentRef: payload.paymentRef,
          watchedByUserIds: [],
          status: 'pending_admin',
          createdAt: new Date().toISOString(),
        },
        ...prev.videoCampaigns,
      ],
      transactions: [
        {
          id: `tx-${Date.now()}`,
          userId: currentUser.id,
          reference: generateReference('CMP'),
          title: `Video Campaign Deposit: ${payload.title}`,
          category: 'Campaign Payment',
          channel: `${paymentCode} · Ref ${payload.paymentRef}`,
          amountRwf: totalBudgetRwf,
          direction: 'debit',
          status: 'Pending Review',
          timestamp: new Date().toISOString(),
        },
        ...prev.transactions,
      ],
    }));
  };

  const handleSubmitTaskProof = (payload: {
    taskId: string;
    proofText: string;
    proofUrl?: string;
  }) => {
    if (!currentUser) return;
    const task = store.customTasks.find((t) => t.id === payload.taskId && t.status === 'active');
    if (!task) return;
    // Enforce: user cannot submit same task twice
    const already = store.taskSubmissions.some(
      (s) => s.taskId === task.id && s.workerId === currentUser.id,
    );
    if (already) return;

    setStore((prev) => ({
      ...prev,
      taskSubmissions: [
        {
          id: `sub-${Date.now()}`,
          taskId: task.id,
          taskTitle: task.title,
          workerId: currentUser.id,
          workerName: `${currentUser.firstName} ${currentUser.secondName}`,
          proofText: payload.proofText,
          proofUrl: payload.proofUrl,
          rewardRwf: task.rewardPerCompletionRwf,
          status: 'pending_admin',
          submittedAt: new Date().toISOString(),
        },
        ...prev.taskSubmissions,
      ],
    }));
  };

  const handleCreateCustomTask = (payload: {
    title: string;
    requirements: string;
    rewardPerCompletionRwf: number;
    targetCompletions: number;
    paymentRef: string;
  }) => {
    if (!currentUser) return;
    const totalBudgetRwf = payload.rewardPerCompletionRwf * payload.targetCompletions;
    const paymentCode = buildMomoPayCode(store.settings.momoPayCode, totalBudgetRwf);

    setStore((prev) => ({
      ...prev,
      customTasks: [
        {
          id: `tsk-${Date.now()}`,
          creatorId: currentUser.id,
          creatorName: `${currentUser.firstName} ${currentUser.secondName}`,
          title: payload.title,
          requirements: payload.requirements,
          rewardPerCompletionRwf: payload.rewardPerCompletionRwf,
          targetCompletions: payload.targetCompletions,
          totalBudgetRwf,
          paymentCode,
          paymentRef: payload.paymentRef,
          approvedWorkerIds: [],
          status: 'pending_admin',
          createdAt: new Date().toISOString(),
        },
        ...prev.customTasks,
      ],
      transactions: [
        {
          id: `tx-${Date.now()}`,
          userId: currentUser.id,
          reference: generateReference('TSK'),
          title: `Custom Task Funding: ${payload.title}`,
          category: 'Campaign Payment',
          channel: `${paymentCode} · Ref ${payload.paymentRef}`,
          amountRwf: totalBudgetRwf,
          direction: 'debit',
          status: 'Pending Review',
          timestamp: new Date().toISOString(),
        },
        ...prev.transactions,
      ],
    }));
  };

  /* ------------------------------------------------------------------------ */
  /* Admin Control Handlers                                                   */
  /* ------------------------------------------------------------------------ */
  const handleApproveUserRegistration = (userId: string) => {
    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId ? { ...u, accountStatus: 'awaiting_payment' } : u,
      ),
    }));
  };

  const handleActivateUserWithBonus = (userId: string) => {
    setStore((prev) => {
      const bonus = prev.settings.welcomeBonusRwf;
      return {
        ...prev,
        users: prev.users.map((u) =>
          u.id === userId
            ? {
                ...u,
                accountStatus: 'active',
                walletBalanceRwf: u.walletBalanceRwf + bonus,
              }
            : u,
        ),
        transactions: [
          {
            id: `tx-${Date.now()}`,
            userId,
            reference: generateReference('BNS'),
            title: `Welcome Bonus (${bonus} RWF)`,
            category: 'Bonus',
            channel: 'E-Finance System Activation',
            amountRwf: bonus,
            direction: 'credit',
            status: 'Completed',
            timestamp: new Date().toISOString(),
          },
          ...prev.transactions.map((t) =>
            t.userId === userId && t.category === 'Activation' && t.status === 'Pending Review'
              ? { ...t, status: 'Completed' as const }
              : t,
          ),
        ],
      };
    });
  };

  const handleToggleSuspendUser = (userId: string) => {
    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId
          ? { ...u, accountStatus: u.accountStatus === 'suspended' ? 'active' : 'suspended' }
          : u,
      ),
    }));
  };

  const handleAdminUpdateUser = (updated: RegisteredUser) => {
    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === updated.id ? updated : u)),
    }));
  };

  const handleReviewKyc = (userId: string, decision: 'approved' | 'rejected', note?: string) => {
    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId
          ? {
              ...u,
              kycStatus: decision,
              kycData: u.kycData ? { ...u.kycData, reviewNote: note } : undefined,
            }
          : u,
      ),
    }));
  };

  const handleReviewVideoCampaign = (campaignId: string, decision: 'active' | 'rejected') => {
    setStore((prev) => ({
      ...prev,
      videoCampaigns: prev.videoCampaigns.map((c) =>
        c.id === campaignId ? { ...c, status: decision } : c,
      ),
    }));
  };

  const handleReviewCustomTask = (taskId: string, decision: 'active' | 'rejected') => {
    setStore((prev) => ({
      ...prev,
      customTasks: prev.customTasks.map((t) => (t.id === taskId ? { ...t, status: decision } : t)),
    }));
  };

  const handleReviewTaskSubmission = (
    submissionId: string,
    decision: 'approved' | 'rejected',
    note?: string,
  ) => {
    const sub = store.taskSubmissions.find((s) => s.id === submissionId);
    if (!sub || sub.status !== 'pending_admin') return;

    setStore((prev) => {
      const nextUsers =
        decision === 'approved'
          ? prev.users.map((u) =>
              u.id === sub.workerId
                ? { ...u, walletBalanceRwf: u.walletBalanceRwf + sub.rewardRwf }
                : u,
            )
          : prev.users;

      const nextTasks =
        decision === 'approved'
          ? prev.customTasks.map((t) => {
              if (t.id !== sub.taskId) return t;
              const approvedList = t.approvedWorkerIds.includes(sub.workerId)
                ? t.approvedWorkerIds
                : [...t.approvedWorkerIds, sub.workerId];
              return {
                ...t,
                approvedWorkerIds: approvedList,
                status: approvedList.length >= t.targetCompletions ? ('completed' as const) : t.status,
              };
            })
          : prev.customTasks;

      const nextTx =
        decision === 'approved'
          ? [
              {
                id: `tx-${Date.now()}`,
                userId: sub.workerId,
                reference: generateReference('TSK'),
                title: `Task Approved: ${sub.taskTitle}`,
                category: 'Task Reward' as const,
                channel: 'Admin Verified Completion',
                amountRwf: sub.rewardRwf,
                direction: 'credit' as const,
                status: 'Completed' as const,
                timestamp: new Date().toISOString(),
              },
              ...prev.transactions,
            ]
          : prev.transactions;

      return {
        ...prev,
        users: nextUsers,
        customTasks: nextTasks,
        taskSubmissions: prev.taskSubmissions.map((s) =>
          s.id === submissionId
            ? {
                ...s,
                status: decision,
                adminNote: note,
                reviewedAt: new Date().toISOString(),
              }
            : s,
        ),
        transactions: nextTx,
      };
    });
  };

  const handleReviewLoan = (loanId: string, decision: 'approved' | 'rejected') => {
    const loan = store.loans.find((l) => l.id === loanId);
    if (!loan || loan.status !== 'pending_admin') return;

    setStore((prev) => ({
      ...prev,
      users:
        decision === 'approved'
          ? prev.users.map((u) =>
              u.id === loan.userId
                ? { ...u, walletBalanceRwf: u.walletBalanceRwf + loan.principalRwf }
                : u,
            )
          : prev.users,
      loans: prev.loans.map((l) => (l.id === loanId ? { ...l, status: decision } : l)),
      transactions: prev.transactions.map((t) =>
        t.userId === loan.userId &&
        t.category === 'Loan' &&
        t.status === 'Pending Review' &&
        t.amountRwf === loan.principalRwf
          ? { ...t, status: decision === 'approved' ? 'Completed' : 'Rejected' }
          : t,
      ),
    }));
  };

  const handleReviewWithdrawal = (withdrawalId: string, decision: 'paid' | 'rejected') => {
    const wd = store.withdrawals.find((w) => w.id === withdrawalId);
    if (!wd || wd.status !== 'pending_admin') return;

    setStore((prev) => ({
      ...prev,
      users:
        decision === 'rejected'
          ? prev.users.map((u) =>
              u.id === wd.userId
                ? { ...u, walletBalanceRwf: u.walletBalanceRwf + wd.grossAmountRwf }
                : u,
            )
          : prev.users,
      withdrawals: prev.withdrawals.map((w) =>
        w.id === withdrawalId ? { ...w, status: decision } : w,
      ),
      transactions: prev.transactions.map((t) =>
        t.userId === wd.userId &&
        t.category === 'Withdrawal' &&
        t.status === 'Pending Review' &&
        t.amountRwf === wd.grossAmountRwf
          ? { ...t, status: decision === 'paid' ? 'Completed' : 'Rejected' }
          : t,
      ),
    }));
  };

  const handleAddPromotion = (title: string, category: string, summary: string) => {
    setStore((prev) => ({
      ...prev,
      promotions: [
        {
          id: `promo-${Date.now()}`,
          title,
          category,
          summary,
          active: true,
          createdAt: new Date().toISOString(),
        },
        ...prev.promotions,
      ],
    }));
  };

  const handleTogglePromotion = (promoId: string) => {
    setStore((prev) => ({
      ...prev,
      promotions: prev.promotions.map((p) =>
        p.id === promoId ? { ...p, active: !p.active } : p,
      ),
    }));
  };

  const handleDeletePromotion = (promoId: string) => {
    setStore((prev) => ({
      ...prev,
      promotions: prev.promotions.filter((p) => p.id !== promoId),
    }));
  };

  const handleUpdateSettings = (next: SystemSettings) => {
    setStore((prev) => ({
      ...prev,
      settings: next,
    }));
  };

  const handleSaveGitHubConfig = (next: GitHubConfig | null) => {
    setStore((prev) => ({
      ...prev,
      githubConfig: next,
    }));
  };

  /* ------------------------------------------------------------------------ */
  /* Render Router                                                            */
  /* ------------------------------------------------------------------------ */
  if (store.session.type === 'admin') {
    return (
      <AdminDashboard
        users={store.users}
        loans={store.loans}
        withdrawals={store.withdrawals}
        videoCampaigns={store.videoCampaigns}
        customTasks={store.customTasks}
        taskSubmissions={store.taskSubmissions}
        promotions={store.promotions}
        settings={store.settings}
        githubConfig={store.githubConfig}
        onApproveUserRegistration={handleApproveUserRegistration}
        onActivateUserWithBonus={handleActivateUserWithBonus}
        onToggleSuspendUser={handleToggleSuspendUser}
        onAdminUpdateUser={handleAdminUpdateUser}
        onReviewKyc={handleReviewKyc}
        onReviewVideoCampaign={handleReviewVideoCampaign}
        onReviewCustomTask={handleReviewCustomTask}
        onReviewTaskSubmission={handleReviewTaskSubmission}
        onReviewLoan={handleReviewLoan}
        onReviewWithdrawal={handleReviewWithdrawal}
        onAddPromotion={handleAddPromotion}
        onTogglePromotion={handleTogglePromotion}
        onDeletePromotion={handleDeletePromotion}
        onUpdateSettings={handleUpdateSettings}
        onSaveGitHubConfig={handleSaveGitHubConfig}
        onSignOut={handleSignOut}
      />
    );
  }

  if (store.session.type === 'user' && currentUser) {
    return (
      <UserDashboard
        user={currentUser}
        settings={store.settings}
        savingsGoals={store.savingsGoals}
        loans={store.loans}
        withdrawals={store.withdrawals}
        videoCampaigns={store.videoCampaigns}
        customTasks={store.customTasks}
        taskSubmissions={store.taskSubmissions}
        transactions={store.transactions}
        githubConfig={store.githubConfig}
        onSubmitActivationPayment={handleSubmitActivationPayment}
        onDailyCheckIn={handleDailyCheckIn}
        onSubmitKyc={handleSubmitKyc}
        onCreateSavingsGoal={handleCreateSavingsGoal}
        onDepositToSavings={handleDepositToSavings}
        onWithdrawFromSavings={handleWithdrawFromSavings}
        onRequestLoan={handleRequestLoan}
        onRepayLoan={handleRepayLoan}
        onRequestWithdrawal={handleRequestWithdrawal}
        onWatchVideoComplete={handleWatchVideoComplete}
        onCreateVideoCampaign={handleCreateVideoCampaign}
        onSubmitTaskProof={handleSubmitTaskProof}
        onCreateCustomTask={handleCreateCustomTask}
        onSaveGitHubConfig={handleSaveGitHubConfig}
        onSignOut={handleSignOut}
      />
    );
  }

  if (publicGitHubOpen) {
    return (
      <div className="min-h-screen bg-shifting-soft text-slate-900">
        <header className="h-16 bg-white/95 border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPublicGitHubOpen(false)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#071B38]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to E-Finance Rwanda</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="h-9 px-4 bg-[#071B38] text-white text-xs font-semibold rounded-lg"
            >
              Sign In
            </button>
          </div>
        </header>
        <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
          <GitHubHostModule config={store.githubConfig} onSaveConfig={handleSaveGitHubConfig} />
        </main>
      </div>
    );
  }

  return (
    <>
      <LandingView
        promotions={store.promotions}
        settings={store.settings}
        totalActiveVideos={store.videoCampaigns.filter((v) => v.status === 'active').length}
        totalActiveTasks={store.customTasks.filter((t) => t.status === 'active').length}
        onOpenLogin={() => setLoginOpen(true)}
        onOpenRegister={() => setRegisterOpen(true)}
        onOpenGitHubPublic={() => setPublicGitHubOpen(true)}
      />

      <RegisterWizard
        isOpen={registerOpen}
        existingEmails={store.users.map((u) => u.email)}
        onClose={() => setRegisterOpen(false)}
        onComplete={handleRegisterComplete}
        onSwitchToLogin={() => {
          setRegisterOpen(false);
          setLoginOpen(true);
        }}
      />

      <LoginModal
        isOpen={loginOpen}
        users={store.users}
        onClose={() => setLoginOpen(false)}
        onLoginUser={handleLoginUser}
        onLoginAdmin={handleLoginAdmin}
        onSwitchToRegister={() => {
          setLoginOpen(false);
          setRegisterOpen(true);
        }}
      />
    </>
  );
}

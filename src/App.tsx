import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { LandingView } from './components/LandingView';
import { LoginModal } from './components/LoginModal';
import { RegisterWizard } from './components/RegisterWizard';
import { SplashScreen } from './components/SplashScreen';
import { UserDashboard } from './components/UserDashboard';
import { INITIAL_PLATFORM_STATE } from './data/platformStore';
import { ApiError, apiClient } from './services/apiClient';
import {
  BetSession,
  FxExchangeRecord,
  InvestmentPlanTier,
  PlatformStoreState,
  RegisteredUser,
  RwandaKycData,
  SavingsGoal,
  SystemSettings,
  UsdtRequest,
  WalletAddressRecord,
} from './types/finance';

export default function App() {
  // Auth token kept strictly in JS/React memory (never localStorage or sessionStorage)
  // so closing or refreshing the tab returns cleanly to Home.
  const [authToken, setAuthToken] = useState<string | null>(null);
  const authTokenRef = useRef<string | null>(null);
  authTokenRef.current = authToken;

  const [store, setStore] = useState<PlatformStoreState>(INITIAL_PLATFORM_STATE);
  const [referredUsersCount, setReferredUsersCount] = useState(0);
  const [publicStats, setPublicStats] = useState({ totalActiveVideos: 0, totalActiveTasks: 0 });
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  // Initial platform brand splash only
  const [showSplash, setShowSplash] = useState(true);

  const handleSignOut = useCallback(() => {
    const token = authTokenRef.current;
    if (token) {
      void apiClient.logout(token).catch(() => {});
    }
    setAuthToken(null);
    authTokenRef.current = null;
    setReferredUsersCount(0);
    setStore((prev) => ({
      ...INITIAL_PLATFORM_STATE,
      settings: prev.settings,
      promotions: prev.promotions,
      session: { type: 'guest' },
    }));
  }, []);

  const refreshPublicBootstrap = useCallback(async () => {
    try {
      const data = await apiClient.getPublicBootstrap();
      setPublicStats({
        totalActiveVideos: data.totalActiveVideos,
        totalActiveTasks: data.totalActiveTasks,
      });
      setStore((prev) => ({
        ...prev,
        settings: data.settings,
        promotions: data.promotions,
      }));
    } catch {
      // Retain current public settings on transient network failure
    }
  }, []);

  const refreshMemberState = useCallback(
    async (explicitToken?: string) => {
      const token = explicitToken ?? authTokenRef.current;
      if (!token) return;
      try {
        const data = await apiClient.getMemberState(token);
        setReferredUsersCount(data.referredUsersCount);
        setStore((prev) => ({
          ...prev,
          users: [data.user],
          settings: data.settings,
          savingsGoals: data.savingsGoals,
          loans: data.loans,
          investments: data.investments,
          spinHistory: data.spinHistory,
          withdrawals: data.withdrawals,
          videoCampaigns: data.videoCampaigns,
          customTasks: data.customTasks,
          taskSubmissions: data.taskSubmissions,
          betSessions: data.betSessions,
          airtimeRequests: data.airtimeRequests,
          p2pTransfers: data.p2pTransfers,
          fxExchanges: data.fxExchanges,
          usdtRequests: data.usdtRequests,
          transactions: data.transactions,
          session: { type: 'user', userId: data.user.id },
        }));
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          handleSignOut();
        }
      }
    },
    [handleSignOut],
  );

  const refreshAdminState = useCallback(
    async (explicitToken?: string) => {
      const token = explicitToken ?? authTokenRef.current;
      if (!token) return;
      try {
        const data = await apiClient.getAdminState(token);
        setStore((prev) => ({
          ...prev,
          settings: data.settings,
          users: data.users,
          savingsGoals: data.savingsGoals,
          loans: data.loans,
          investments: data.investments,
          spinHistory: data.spinHistory,
          withdrawals: data.withdrawals,
          videoCampaigns: data.videoCampaigns,
          customTasks: data.customTasks,
          taskSubmissions: data.taskSubmissions,
          betSessions: data.betSessions,
          airtimeRequests: data.airtimeRequests,
          p2pTransfers: data.p2pTransfers,
          fxExchanges: data.fxExchanges,
          usdtRequests: data.usdtRequests,
          transactions: data.transactions,
          promotions: data.promotions,
          session: { type: 'admin' },
        }));
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          handleSignOut();
        }
      }
    },
    [handleSignOut],
  );

  // Sync active workspace or public landing data from SQL backend
  useEffect(() => {
    if (store.session.type === 'guest') {
      void refreshPublicBootstrap();
      const id = window.setInterval(() => {
        void refreshPublicBootstrap();
      }, 20000);
      return () => window.clearInterval(id);
    }

    if (store.session.type === 'user' && authToken) {
      const id = window.setInterval(() => {
        void refreshMemberState(authToken);
      }, 10000);
      return () => window.clearInterval(id);
    }

    if (store.session.type === 'admin' && authToken) {
      const id = window.setInterval(() => {
        void refreshAdminState(authToken);
      }, 10000);
      return () => window.clearInterval(id);
    }
  }, [store.session.type, authToken, refreshPublicBootstrap, refreshMemberState, refreshAdminState]);

  const currentUser =
    store.session.type === 'user'
      ? store.users.find((u) => u.id === (store.session as { type: 'user'; userId: string }).userId) ?? null
      : null;

  /* ------------------------------------------------------------------------ */
  /* Authentication & 3-Step Registration (SQL Backend)                       */
  /* ------------------------------------------------------------------------ */
  const handleAuthenticate = async (
    identifier: string,
    password: string,
  ): Promise<{ error: string | null; needsAdminSetup?: boolean }> => {
    try {
      const res = await apiClient.login(identifier, password);
      setAuthToken(res.token);
      authTokenRef.current = res.token;

      if (res.role === 'admin') {
        setStore((prev) => ({
          ...prev,
          session: { type: 'admin' },
        }));
        await refreshAdminState(res.token);
      } else {
        setStore((prev) => ({
          ...prev,
          users: [res.user],
          session: { type: 'user', userId: res.user.id },
        }));
        await refreshMemberState(res.token);
      }
      setLoginOpen(false);
      return { error: null };
    } catch (err) {
      if (err instanceof ApiError) {
        return {
          error: err.message,
          needsAdminSetup: Boolean(err.data?.needsAdminSetup),
        };
      }
      return { error: 'Unable to reach server. Please try again.' };
    }
  };

  const handleClaimAdminPassword = async (
    email: string,
    password: string,
  ): Promise<string | null> => {
    try {
      const res = await apiClient.claimAdminPassword(email, password);
      setAuthToken(res.token);
      authTokenRef.current = res.token;
      setStore((prev) => ({
        ...prev,
        session: { type: 'admin' },
      }));
      await refreshAdminState(res.token);
      setLoginOpen(false);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to save admin password.';
    }
  };

  const handleRegisterComplete = async (
    newUser: RegisteredUser,
    rawPassword: string,
    referralCodeInput: string,
  ): Promise<string | null> => {
    try {
      const res = await apiClient.register({
        firstName: newUser.firstName,
        secondName: newUser.secondName,
        email: newUser.email,
        phone: newUser.phone,
        gender: newUser.gender,
        dateOfBirth: newUser.dateOfBirth,
        idNumber: newUser.idNumber,
        photoDataUrl: newUser.photoDataUrl,
        education: newUser.education,
        residence: newUser.residence,
        rawPassword,
        referralCodeInput,
      });
      setAuthToken(res.token);
      authTokenRef.current = res.token;
      setStore((prev) => ({
        ...prev,
        users: [res.user],
        session: { type: 'user', userId: res.user.id },
      }));
      await refreshMemberState(res.token);
      setRegisterOpen(false);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Registration failed. Please try again.';
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Member Financial & Interactive Handlers                                  */
  /* ------------------------------------------------------------------------ */
  const handleSubmitActivationPayment = async (phone: string, ref: string) => {
    if (!authTokenRef.current) return;
    await apiClient.submitActivation(authTokenRef.current, phone, ref).catch(() => {});
    await refreshMemberState();
  };

  const handleDailyCheckIn = async () => {
    if (!authTokenRef.current) return;
    await apiClient.dailyCheckIn(authTokenRef.current).catch(() => {});
    await refreshMemberState();
  };

  const handleSubmitKyc = async (data: RwandaKycData) => {
    if (!authTokenRef.current) return;
    await apiClient.submitKyc(authTokenRef.current, data).catch(() => {});
    await refreshMemberState();
  };

  const handleCreateSavingsGoal = async (
    title: string,
    planType: SavingsGoal['planType'],
    targetRwf: number,
    targetDate: string,
  ) => {
    if (!authTokenRef.current) return;
    await apiClient
      .createSavingsGoal(authTokenRef.current, { title, planType, targetRwf, targetDate })
      .catch(() => {});
    await refreshMemberState();
  };

  const handleDepositToSavings = async (goalId: string, amountRwf: number) => {
    if (!authTokenRef.current) return;
    await apiClient.depositSavings(authTokenRef.current, goalId, amountRwf).catch(() => {});
    await refreshMemberState();
  };

  const handleWithdrawFromSavings = async (goalId: string, amountRwf: number) => {
    if (!authTokenRef.current) return;
    await apiClient.withdrawSavings(authTokenRef.current, goalId, amountRwf).catch(() => {});
    await refreshMemberState();
  };

  const handleRequestLoan = async (payload: {
    product: string;
    reason: string;
    principalRwf: number;
    termMonths: number;
    annualRatePercent: number;
    monthlyPaymentRwf: number;
    totalRepayableRwf: number;
  }) => {
    if (!authTokenRef.current) return;
    await apiClient.requestLoan(authTokenRef.current, payload).catch(() => {});
    await refreshMemberState();
  };

  const handleRepayLoan = async (loanId: string, amountRwf: number) => {
    if (!authTokenRef.current) return;
    await apiClient.repayLoan(authTokenRef.current, loanId, amountRwf).catch(() => {});
    await refreshMemberState();
  };

  const handlePurchasePlan = async (tier: InvestmentPlanTier, paymentRef: string) => {
    if (!authTokenRef.current) return;
    await apiClient.purchaseInvestment(authTokenRef.current, tier.id, paymentRef).catch(() => {});
    await refreshMemberState();
  };

  const handleCompleteSpin = async (rewardRwf: number) => {
    if (!authTokenRef.current) return;
    await apiClient.completeSpin(authTokenRef.current, rewardRwf).catch(() => {});
    await refreshMemberState();
  };

  const handleStartQuizBet = async (stakeRwf: number) => {
    if (!authTokenRef.current) return;
    await apiClient.startQuizBet(authTokenRef.current, stakeRwf).catch(() => {});
    await refreshMemberState();
  };

  const handleFinishQuizBet = async (session: BetSession) => {
    if (!authTokenRef.current) return;
    await apiClient.finishQuizBet(authTokenRef.current, session).catch(() => {});
    await refreshMemberState();
  };

  const handleRequestAirtime = async (payload: {
    network: 'MTN Rwanda' | 'Airtel Rwanda';
    serviceType: 'Airtime' | 'Internet Bundle';
    phoneNumber: string;
    amountRwf: number;
    bundleLabel?: string;
  }) => {
    if (!authTokenRef.current) return;
    await apiClient.requestAirtime(authTokenRef.current, payload).catch(() => {});
    await refreshMemberState();
  };

  const handleLookupWalletAddress = async (
    address: string,
  ): Promise<WalletAddressRecord | null> => {
    if (!authTokenRef.current) return null;
    return apiClient.lookupWalletAddress(authTokenRef.current, address);
  };

  const handleSendP2P = async (payload: {
    receiverId: string;
    receiverName: string;
    receiverAddress: string;
    grossAmountRwf: number;
    note?: string;
  }): Promise<string | null> => {
    if (!authTokenRef.current) return 'Not signed in.';
    try {
      await apiClient.sendP2P(authTokenRef.current, {
        receiverAddress: payload.receiverAddress,
        grossAmountRwf: payload.grossAmountRwf,
        note: payload.note,
      });
      await refreshMemberState();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Transfer failed.';
    }
  };

  const handleFxExchange = async (
    direction: FxExchangeRecord['direction'],
    fromAmount: number,
  ): Promise<string | null> => {
    if (!authTokenRef.current) return 'Not signed in.';
    try {
      await apiClient.fxExchange(authTokenRef.current, direction, fromAmount);
      await refreshMemberState();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Currency exchange failed.';
    }
  };

  const handleUsdtSavingsMove = async (
    action: 'deposit' | 'withdraw',
    amountUsdt: number,
  ): Promise<string | null> => {
    if (!authTokenRef.current) return 'Not signed in.';
    try {
      await apiClient.usdtSavingsMove(authTokenRef.current, action, amountUsdt);
      await refreshMemberState();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'USDT savings update failed.';
    }
  };

  const handleCreateUsdtRequest = async (payload: {
    actionType: UsdtRequest['actionType'];
    amountUsdt: number;
    network: UsdtRequest['network'];
    destinationOrTxRef: string;
    note?: string;
  }): Promise<string | null> => {
    if (!authTokenRef.current) return 'Not signed in.';
    try {
      await apiClient.createUsdtRequest(authTokenRef.current, payload);
      await refreshMemberState();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'USDT request failed.';
    }
  };

  const handleRequestWithdrawal = async (payload: {
    network: 'MTN Rwanda' | 'Airtel / Tigo Rwanda';
    destinationType: 'Phone Number' | 'MoMo Pay Code';
    destinationValue: string;
    accountRegisteredNames: string;
    grossAmountRwf: number;
    feePercent: number;
    feeRwf: number;
    netAmountRwf: number;
    isFirstBonusWithdrawal: boolean;
  }) => {
    if (!authTokenRef.current) return;
    await apiClient
      .requestWithdrawal(authTokenRef.current, {
        network: payload.network,
        destinationType: payload.destinationType,
        destinationValue: payload.destinationValue,
        accountRegisteredNames: payload.accountRegisteredNames,
        grossAmountRwf: payload.grossAmountRwf,
      })
      .catch(() => {});
    await refreshMemberState();
  };

  const handleWatchVideoComplete = async (campaignId: string) => {
    if (!authTokenRef.current) return;
    await apiClient.watchVideoComplete(authTokenRef.current, campaignId).catch(() => {});
    await refreshMemberState();
  };

  const handleCreateVideoCampaign = async (payload: {
    title: string;
    description: string;
    videoUrl: string;
    rewardPerViewRwf: number;
    targetViewers: number;
    paymentRef: string;
  }) => {
    if (!authTokenRef.current) return;
    await apiClient.createVideoCampaign(authTokenRef.current, payload).catch(() => {});
    await refreshMemberState();
  };

  const handleSubmitTaskProof = async (payload: {
    taskId: string;
    proofText: string;
    proofUrl?: string;
  }) => {
    if (!authTokenRef.current) return;
    await apiClient.submitTaskProof(authTokenRef.current, payload).catch(() => {});
    await refreshMemberState();
  };

  const handleCreateCustomTask = async (payload: {
    title: string;
    requirements: string;
    rewardPerCompletionRwf: number;
    targetCompletions: number;
    paymentRef: string;
  }) => {
    if (!authTokenRef.current) return;
    await apiClient.createCustomTask(authTokenRef.current, payload).catch(() => {});
    await refreshMemberState();
  };

  /* ------------------------------------------------------------------------ */
  /* Admin Control Handlers (SQL Backend)                                     */
  /* ------------------------------------------------------------------------ */
  const handleApproveUserRegistration = async (userId: string) => {
    if (!authTokenRef.current) return;
    await apiClient.adminApproveUser(authTokenRef.current, userId).catch(() => {});
    await refreshAdminState();
  };

  const handleActivateUserWithBonus = async (userId: string) => {
    if (!authTokenRef.current) return;
    await apiClient.adminActivateUser(authTokenRef.current, userId).catch(() => {});
    await refreshAdminState();
  };

  const handleToggleSuspendUser = async (userId: string) => {
    if (!authTokenRef.current) return;
    await apiClient.adminToggleSuspend(authTokenRef.current, userId).catch(() => {});
    await refreshAdminState();
  };

  const handleAdminUpdateUser = async (updated: RegisteredUser) => {
    if (!authTokenRef.current) return;
    await apiClient.adminUpdateUser(authTokenRef.current, updated).catch(() => {});
    await refreshAdminState();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!authTokenRef.current) return;
    await apiClient.adminDeleteUser(authTokenRef.current, userId).catch(() => {});
    await refreshAdminState();
  };

  const handleReviewKyc = async (
    userId: string,
    decision: 'approved' | 'rejected',
    note?: string,
  ) => {
    if (!authTokenRef.current) return;
    await apiClient.adminReviewKyc(authTokenRef.current, userId, decision, note).catch(() => {});
    await refreshAdminState();
  };

  const handleAdminCreateVideoCampaign = async (payload: {
    title: string;
    description: string;
    videoUrl: string;
    rewardPerViewRwf: number;
    targetViewers: number;
  }) => {
    if (!authTokenRef.current) return;
    await apiClient.adminCreateVideo(authTokenRef.current, payload).catch(() => {});
    await refreshAdminState();
  };

  const handleReviewVideoCampaign = async (
    campaignId: string,
    decision: 'active' | 'rejected',
  ) => {
    if (!authTokenRef.current) return;
    await apiClient.adminReviewVideo(authTokenRef.current, campaignId, decision).catch(() => {});
    await refreshAdminState();
  };

  const handleAdminCreateCustomTask = async (payload: {
    title: string;
    requirements: string;
    rewardPerCompletionRwf: number;
    targetCompletions: number;
  }) => {
    if (!authTokenRef.current) return;
    await apiClient.adminCreateTask(authTokenRef.current, payload).catch(() => {});
    await refreshAdminState();
  };

  const handleReviewCustomTask = async (taskId: string, decision: 'active' | 'rejected') => {
    if (!authTokenRef.current) return;
    await apiClient.adminReviewTask(authTokenRef.current, taskId, decision).catch(() => {});
    await refreshAdminState();
  };

  const handleReviewTaskSubmission = async (
    submissionId: string,
    decision: 'approved' | 'rejected',
    note?: string,
  ) => {
    if (!authTokenRef.current) return;
    await apiClient
      .adminReviewSubmission(authTokenRef.current, submissionId, decision, note)
      .catch(() => {});
    await refreshAdminState();
  };

  const handleReviewLoan = async (loanId: string, decision: 'approved' | 'rejected') => {
    if (!authTokenRef.current) return;
    await apiClient.adminReviewLoan(authTokenRef.current, loanId, decision).catch(() => {});
    await refreshAdminState();
  };

  const handleReviewInvestment = async (investmentId: string, decision: 'active' | 'rejected') => {
    if (!authTokenRef.current) return;
    await apiClient.adminReviewInvestment(authTokenRef.current, investmentId, decision).catch(() => {});
    await refreshAdminState();
  };

  const handleReviewWithdrawal = async (withdrawalId: string, decision: 'paid' | 'rejected') => {
    if (!authTokenRef.current) return;
    await apiClient.adminReviewWithdrawal(authTokenRef.current, withdrawalId, decision).catch(() => {});
    await refreshAdminState();
  };

  const handleReviewAirtime = async (requestId: string, decision: 'approved' | 'rejected') => {
    if (!authTokenRef.current) return;
    await apiClient.adminReviewAirtime(authTokenRef.current, requestId, decision).catch(() => {});
    await refreshAdminState();
  };

  const handleReviewUsdtRequest = async (requestId: string, decision: 'approved' | 'rejected') => {
    if (!authTokenRef.current) return;
    await apiClient.adminReviewUsdt(authTokenRef.current, requestId, decision).catch(() => {});
    await refreshAdminState();
  };

  const handleAddPromotion = async (title: string, category: string, summary: string) => {
    if (!authTokenRef.current) return;
    await apiClient.adminAddPromotion(authTokenRef.current, title, category, summary).catch(() => {});
    await refreshAdminState();
  };

  const handleTogglePromotion = async (promoId: string) => {
    if (!authTokenRef.current) return;
    await apiClient.adminTogglePromotion(authTokenRef.current, promoId).catch(() => {});
    await refreshAdminState();
  };

  const handleDeletePromotion = async (promoId: string) => {
    if (!authTokenRef.current) return;
    await apiClient.adminDeletePromotion(authTokenRef.current, promoId).catch(() => {});
    await refreshAdminState();
  };

  const handleUpdateSettings = async (next: SystemSettings) => {
    if (!authTokenRef.current) return;
    await apiClient.adminUpdateSettings(authTokenRef.current, next).catch(() => {});
    await refreshAdminState();
  };

  /* ------------------------------------------------------------------------ */
  /* Render Router                                                            */
  /* ------------------------------------------------------------------------ */
  const renderMainContent = () => {
    if (store.session.type === 'admin') {
      return (
        <AdminDashboard
          users={store.users}
          loans={store.loans}
          investments={store.investments}
          withdrawals={store.withdrawals}
          videoCampaigns={store.videoCampaigns}
          customTasks={store.customTasks}
          taskSubmissions={store.taskSubmissions}
          betSessions={store.betSessions}
          airtimeRequests={store.airtimeRequests}
          p2pTransfers={store.p2pTransfers}
          fxExchanges={store.fxExchanges}
          usdtRequests={store.usdtRequests}
          transactions={store.transactions}
          promotions={store.promotions}
          settings={store.settings}
          onApproveUserRegistration={handleApproveUserRegistration}
          onActivateUserWithBonus={handleActivateUserWithBonus}
          onToggleSuspendUser={handleToggleSuspendUser}
          onDeleteUser={handleDeleteUser}
          onAdminUpdateUser={handleAdminUpdateUser}
          onReviewKyc={handleReviewKyc}
          onReviewVideoCampaign={handleReviewVideoCampaign}
          onReviewCustomTask={handleReviewCustomTask}
          onAdminCreateVideoCampaign={handleAdminCreateVideoCampaign}
          onAdminCreateCustomTask={handleAdminCreateCustomTask}
          onReviewTaskSubmission={handleReviewTaskSubmission}
          onReviewLoan={handleReviewLoan}
          onReviewInvestment={handleReviewInvestment}
          onReviewWithdrawal={handleReviewWithdrawal}
          onReviewAirtime={handleReviewAirtime}
          onReviewUsdtRequest={handleReviewUsdtRequest}
          onAddPromotion={handleAddPromotion}
          onTogglePromotion={handleTogglePromotion}
          onDeletePromotion={handleDeletePromotion}
          onUpdateSettings={handleUpdateSettings}
          onSignOut={handleSignOut}
        />
      );
    }

    if (store.settings.maintenanceMode) {
      return (
        <div className="min-h-screen bg-shifting-aurora text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white text-slate-900 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
            <h1 className="font-display text-2xl font-bold text-[#071B38]">
              Scheduled System Maintenance
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              E-Finance Rwanda is currently undergoing scheduled maintenance to improve platform services. Please check back shortly.
            </p>
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="h-10 px-5 bg-[#071B38] text-white text-xs font-semibold rounded-lg"
            >
              Sign In
            </button>
            <LoginModal
              isOpen={loginOpen}
              onClose={() => setLoginOpen(false)}
              onAuthenticate={handleAuthenticate}
              onClaimAdminPassword={handleClaimAdminPassword}
              onSwitchToRegister={() => setLoginOpen(false)}
            />
          </div>
        </div>
      );
    }

    if (store.session.type === 'user' && currentUser) {
      return (
        <UserDashboard
          user={currentUser}
          referredUsersCount={referredUsersCount}
          settings={store.settings}
          savingsGoals={store.savingsGoals}
          loans={store.loans}
          investments={store.investments}
          spinHistory={store.spinHistory}
          withdrawals={store.withdrawals}
          videoCampaigns={store.videoCampaigns}
          customTasks={store.customTasks}
          taskSubmissions={store.taskSubmissions}
          betSessions={store.betSessions}
          airtimeRequests={store.airtimeRequests}
          p2pTransfers={store.p2pTransfers}
          fxExchanges={store.fxExchanges}
          usdtRequests={store.usdtRequests}
          transactions={store.transactions}
          onSubmitActivationPayment={handleSubmitActivationPayment}
          onDailyCheckIn={handleDailyCheckIn}
          onSubmitKyc={handleSubmitKyc}
          onCreateSavingsGoal={handleCreateSavingsGoal}
          onDepositToSavings={handleDepositToSavings}
          onWithdrawFromSavings={handleWithdrawFromSavings}
          onRequestLoan={handleRequestLoan}
          onRepayLoan={handleRepayLoan}
          onPurchasePlan={handlePurchasePlan}
          onCompleteSpin={handleCompleteSpin}
          onStartQuizBet={handleStartQuizBet}
          onFinishQuizBet={handleFinishQuizBet}
          onRequestAirtime={handleRequestAirtime}
          onLookupWalletAddress={handleLookupWalletAddress}
          onSendP2P={handleSendP2P}
          onFxExchange={handleFxExchange}
          onUsdtSavingsMove={handleUsdtSavingsMove}
          onCreateUsdtRequest={handleCreateUsdtRequest}
          onRequestWithdrawal={handleRequestWithdrawal}
          onWatchVideoComplete={handleWatchVideoComplete}
          onCreateVideoCampaign={handleCreateVideoCampaign}
          onSubmitTaskProof={handleSubmitTaskProof}
          onCreateCustomTask={handleCreateCustomTask}
          onSignOut={handleSignOut}
        />
      );
    }

    return (
      <>
        <LandingView
          promotions={store.promotions}
          settings={store.settings}
          totalActiveVideos={publicStats.totalActiveVideos}
          totalActiveTasks={publicStats.totalActiveTasks}
          onOpenLogin={() => setLoginOpen(true)}
          onOpenRegister={() => setRegisterOpen(true)}
        />

        <RegisterWizard
          isOpen={registerOpen}
          existingUsers={store.users}
          onClose={() => setRegisterOpen(false)}
          onComplete={handleRegisterComplete}
          onSwitchToLogin={() => {
            setRegisterOpen(false);
            setLoginOpen(true);
          }}
        />

        <LoginModal
          isOpen={loginOpen}
          onClose={() => setLoginOpen(false)}
          onAuthenticate={handleAuthenticate}
          onClaimAdminPassword={handleClaimAdminPassword}
          onSwitchToRegister={() => {
            setLoginOpen(false);
            setRegisterOpen(true);
          }}
        />
      </>
    );
  };

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      {renderMainContent()}
    </>
  );
}

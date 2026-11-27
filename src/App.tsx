import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { LandingView } from './components/LandingView';
import { LoginModal } from './components/LoginModal';
import { ProfileRecoveryView } from './components/ProfileRecoveryView';
import { RegisterWizard } from './components/RegisterWizard';
import { ResetPasswordView } from './components/ResetPasswordView';
import { SplashScreen } from './components/SplashScreen';
import { UserDashboard } from './components/UserDashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { firestoreService } from './services/firestoreService';
import type {
  BetSession,
  FxExchangeRecord,
  InvestmentPlanTier,
  RegisteredUser,
  RwandaKycData,
  SavingsGoal,
  SystemSettings,
  UsdtRequest,
  WalletAddressRecord,
} from './types/finance';

function AppContent() {
  const {
    firebaseUser,
    authUid,
    authStatus,
    profileStatus,
    profileError,
    role,
    store,
    videoWatchSessions,
    adminUsersMeta,
    currentUser,
    referredUsersCount,
    publicStats,
    actionError,
    setActionError,
    signInWithIdentifier,
    claimAdminWithEmailPassword,
    requestPasswordReset,
    registerMember,
    recoverProfile,
    retryProfileLoad,
    refreshAdminUsers,
    signOutUser,
    getIdToken,
  } = useAuth();

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginInitialView, setLoginInitialView] = useState<'login' | 'forgot'>('login');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [resetOobCode, setResetOobCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const code = params.get('oobCode');
    if (mode === 'resetPassword' && code) return code;
    if (window.location.pathname === '/reset-password' && code) return code;
    return null;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname === '/forgot-password') {
      setLoginInitialView('forgot');
      setLoginOpen(true);
    } else if (window.location.pathname === '/reset-password') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('oobCode');
      setResetOobCode(code ?? '');
    }
  }, []);

  const clearResetUrl = useCallback(() => {
    setResetOobCode(null);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleSignOut = useCallback(() => {
    void signOutUser();
  }, [signOutUser]);

  const handleAuthenticate = async (
    identifier: string,
    password: string,
  ): Promise<{ error: string | null; needsAdminSetup?: boolean }> => {
    const res = await signInWithIdentifier(identifier, password);
    if (!res.error) {
      setLoginOpen(false);
      setLoginInitialView('login');
    }
    return res;
  };

  const handleRegisterComplete = async (
    newUser: RegisteredUser,
    rawPassword: string,
    referralCodeInput: string,
  ): Promise<string | null> => {
    const err = await registerMember(newUser, rawPassword, referralCodeInput);
    if (!err) {
      setRegisterOpen(false);
    }
    return err;
  };

  const runAction = useCallback(
    async (fn: () => Promise<void>) => {
      setActionError(null);
      try {
        await fn();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Operation failed.');
      }
    },
    [setActionError],
  );

  /* ------------------------------------------------------------------------ */
  /* Member Financial & Interactive Handlers (Cloud Firestore)                */
  /* ------------------------------------------------------------------------ */
  const handleSubmitActivationPayment = async (phone: string, ref: string) => {
    if (!authUid) return;
    await runAction(() => firestoreService.submitActivation(authUid, phone, ref));
  };

  const handleDailyCheckIn = async () => {
    if (!authUid) return;
    await runAction(() => firestoreService.dailyCheckIn(authUid));
  };

  const handleSubmitKyc = async (data: RwandaKycData) => {
    if (!authUid) return;
    await runAction(() => firestoreService.submitKyc(authUid, data));
  };

  const handleCreateSavingsGoal = async (
    title: string,
    planType: SavingsGoal['planType'],
    targetRwf: number,
    targetDate: string,
  ) => {
    if (!authUid) return;
    await runAction(() =>
      firestoreService.createSavingsGoal(authUid, { title, planType, targetRwf, targetDate }),
    );
  };

  const handleDepositToSavings = async (goalId: string, amountRwf: number) => {
    if (!authUid) return;
    await runAction(() => firestoreService.depositSavings(authUid, goalId, amountRwf));
  };

  const handleWithdrawFromSavings = async (goalId: string, amountRwf: number) => {
    if (!authUid) return;
    await runAction(() => firestoreService.withdrawSavings(authUid, goalId, amountRwf));
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
    if (!authUid) return;
    await runAction(() => firestoreService.requestLoan(authUid, payload));
  };

  const handleRepayLoan = async (loanId: string, amountRwf: number) => {
    if (!authUid) return;
    await runAction(() => firestoreService.repayLoan(authUid, loanId, amountRwf));
  };

  const handlePurchasePlan = async (tier: InvestmentPlanTier, paymentRef: string) => {
    if (!authUid) return;
    await runAction(() => firestoreService.purchaseInvestment(authUid, tier.id, paymentRef));
  };

  const handleCompleteSpin = async (rewardRwf: number) => {
    if (!authUid) return;
    await runAction(() => firestoreService.completeSpin(authUid, rewardRwf));
  };

  const handleStartQuizBet = async (stakeRwf: number) => {
    if (!authUid) return;
    await runAction(() => firestoreService.startQuizBet(authUid, stakeRwf));
  };

  const handleFinishQuizBet = async (session: BetSession) => {
    if (!authUid) return;
    await runAction(() => firestoreService.finishQuizBet(authUid, session));
  };

  const handleRequestAirtime = async (payload: {
    network: 'MTN Rwanda' | 'Airtel Rwanda';
    serviceType: 'Airtime' | 'Internet Bundle';
    phoneNumber: string;
    amountRwf: number;
    bundleLabel?: string;
  }) => {
    if (!authUid) return;
    await runAction(() => firestoreService.requestAirtime(authUid, payload));
  };

  const handleLookupWalletAddress = async (
    address: string,
  ): Promise<WalletAddressRecord | null> => {
    if (!authUid) return null;
    return firestoreService.lookupWalletAddress(address);
  };

  const handleSendP2P = async (payload: {
    receiverId: string;
    receiverName: string;
    receiverAddress: string;
    grossAmountRwf: number;
    note?: string;
  }): Promise<string | null> => {
    if (!authUid) return 'Not signed in.';
    try {
      await firestoreService.sendP2P(authUid, {
        receiverAddress: payload.receiverAddress,
        grossAmountRwf: payload.grossAmountRwf,
        note: payload.note,
      });
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Transfer failed.';
    }
  };

  const handleFxExchange = async (
    direction: FxExchangeRecord['direction'],
    fromAmount: number,
  ): Promise<string | null> => {
    if (!authUid) return 'Not signed in.';
    try {
      await firestoreService.fxExchange(authUid, direction, fromAmount);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Currency exchange failed.';
    }
  };

  const handleUsdtSavingsMove = async (
    action: 'deposit' | 'withdraw',
    amountUsdt: number,
  ): Promise<string | null> => {
    if (!authUid) return 'Not signed in.';
    try {
      await firestoreService.usdtSavingsMove(authUid, action, amountUsdt);
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
    if (!authUid) return 'Not signed in.';
    try {
      await firestoreService.createUsdtRequest(authUid, payload);
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
    if (!authUid) return;
    await runAction(() =>
      firestoreService.requestWithdrawal(authUid, {
        network: payload.network,
        destinationType: payload.destinationType,
        destinationValue: payload.destinationValue,
        accountRegisteredNames: payload.accountRegisteredNames,
        grossAmountRwf: payload.grossAmountRwf,
      }),
    );
  };

  const handleWatchVideoComplete = async (
    campaignId: string,
    verificationSignature?: string,
  ): Promise<string | null> => {
    if (!authUid) return 'Sign in required.';
    setActionError(null);
    try {
      const token = (await getIdToken()) ?? undefined;
      await firestoreService.watchVideoComplete(authUid, campaignId, verificationSignature, token);
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to credit video reward.';
      setActionError(msg);
      return msg;
    }
  };

  const handleCreateVideoCampaign = async (payload: {
    title: string;
    description: string;
    videoUrl: string;
    videoFile?: File | null;
    requiredWatchSeconds: number;
    rewardPerViewRwf: number;
    targetViewers: number;
    paymentRef: string;
    onUploadProgress?: (percent: number, stage: string) => void;
  }): Promise<string | null> => {
    if (!authUid) return 'Sign in required.';
    setActionError(null);
    try {
      await firestoreService.createVideoCampaign(authUid, payload);
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Video campaign upload failed.';
      setActionError(msg);
      return msg;
    }
  };

  const handleSubmitTaskProof = async (payload: {
    taskId: string;
    proofText: string;
    proofUrl?: string;
    verificationSignature?: string;
  }): Promise<string | null> => {
    if (!authUid) return 'Sign in required.';
    setActionError(null);
    try {
      const token = (await getIdToken()) ?? undefined;
      await firestoreService.submitTaskProof(authUid, { ...payload, authToken: token });
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to submit task proof.';
      setActionError(msg);
      return msg;
    }
  };

  const handleCreateCustomTask = async (payload: {
    title: string;
    requirements: string;
    videoUrl?: string;
    videoFile?: File | null;
    requiredWatchSeconds?: number;
    rewardPerCompletionRwf: number;
    targetCompletions: number;
    paymentRef: string;
    onUploadProgress?: (percent: number, stage: string) => void;
  }): Promise<string | null> => {
    if (!authUid) return 'Sign in required.';
    setActionError(null);
    try {
      await firestoreService.createCustomTask(authUid, payload);
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to create task.';
      setActionError(msg);
      return msg;
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Admin Control Handlers (Cloud Firestore)                                 */
  /* ------------------------------------------------------------------------ */
  const handleApproveUserRegistration = async (userId: string) => {
    await runAction(() => firestoreService.adminApproveUser(userId));
  };

  const handleActivateUserWithBonus = async (userId: string) => {
    await runAction(() => firestoreService.adminActivateUser(userId));
  };

  const handleToggleSuspendUser = async (userId: string) => {
    await runAction(() => firestoreService.adminToggleSuspend(userId));
  };

  const handleAdminUpdateUser = async (updated: RegisteredUser) => {
    await runAction(() => firestoreService.adminUpdateUser(updated));
  };

  const handleDeleteUser = async (userId: string) => {
    await runAction(() => firestoreService.adminDeleteUser(userId));
  };

  const handleReviewKyc = async (
    userId: string,
    decision: 'approved' | 'rejected',
    note?: string,
  ) => {
    await runAction(() => firestoreService.adminReviewKyc(userId, decision, note));
  };

  const handleAdminCreateVideoCampaign = async (payload: {
    title: string;
    description: string;
    videoUrl: string;
    videoFile?: File | null;
    requiredWatchSeconds?: number;
    rewardPerViewRwf: number;
    targetViewers: number;
    onUploadProgress?: (percent: number, stage: string) => void;
  }): Promise<string | null> => {
    setActionError(null);
    try {
      await firestoreService.adminCreateVideo(payload);
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Admin video upload failed.';
      setActionError(msg);
      return msg;
    }
  };

  const handleReviewVideoCampaign = async (
    campaignId: string,
    decision: 'active' | 'rejected',
  ) => {
    await runAction(() => firestoreService.adminReviewVideo(campaignId, decision));
  };

  const handleAdminCreateCustomTask = async (payload: {
    title: string;
    requirements: string;
    videoUrl?: string;
    videoFile?: File | null;
    requiredWatchSeconds?: number;
    rewardPerCompletionRwf: number;
    targetCompletions: number;
    onUploadProgress?: (percent: number, stage: string) => void;
  }): Promise<string | null> => {
    setActionError(null);
    try {
      await firestoreService.adminCreateTask(payload);
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Admin task creation failed.';
      setActionError(msg);
      return msg;
    }
  };

  const handleReviewCustomTask = async (taskId: string, decision: 'active' | 'rejected') => {
    await runAction(() => firestoreService.adminReviewTask(taskId, decision));
  };

  const handleReviewTaskSubmission = async (
    submissionId: string,
    decision: 'approved' | 'rejected',
    note?: string,
  ) => {
    await runAction(() => firestoreService.adminReviewSubmission(submissionId, decision, note));
  };

  const handleReviewLoan = async (loanId: string, decision: 'approved' | 'rejected') => {
    await runAction(() => firestoreService.adminReviewLoan(loanId, decision));
  };

  const handleReviewInvestment = async (investmentId: string, decision: 'active' | 'rejected') => {
    await runAction(() => firestoreService.adminReviewInvestment(investmentId, decision));
  };

  const handleReviewWithdrawal = async (withdrawalId: string, decision: 'paid' | 'rejected') => {
    await runAction(() => firestoreService.adminReviewWithdrawal(withdrawalId, decision));
  };

  const handleReviewAirtime = async (requestId: string, decision: 'approved' | 'rejected') => {
    await runAction(() => firestoreService.adminReviewAirtime(requestId, decision));
  };

  const handleReviewUsdtRequest = async (requestId: string, decision: 'approved' | 'rejected') => {
    await runAction(() => firestoreService.adminReviewUsdt(requestId, decision));
  };

  const handleAddPromotion = async (title: string, category: string, summary: string) => {
    await runAction(() => firestoreService.adminAddPromotion(title, category, summary));
  };

  const handleTogglePromotion = async (promoId: string) => {
    await runAction(() => firestoreService.adminTogglePromotion(promoId));
  };

  const handleDeletePromotion = async (promoId: string) => {
    await runAction(() => firestoreService.adminDeletePromotion(promoId));
  };

  const handleUpdateSettings = async (next: SystemSettings) => {
    await runAction(() => firestoreService.adminUpdateSettings(next));
  };

  const handleMarkNotificationRead = async (id: string) => {
    await firestoreService.markNotificationRead(id).catch(() => {});
  };

  /* ------------------------------------------------------------------------ */
  /* Render Router (Waits for Auth + Firestore Profile Before Routing)        */
  /* ------------------------------------------------------------------------ */
  const renderMainContent = () => {
    if (resetOobCode !== null) {
      return (
        <ResetPasswordView
          oobCode={resetOobCode}
          onReturnToLogin={() => {
            clearResetUrl();
            setLoginInitialView('login');
            setLoginOpen(true);
          }}
          onRequestNewReset={() => {
            clearResetUrl();
            setLoginInitialView('forgot');
            setLoginOpen(true);
          }}
        />
      );
    }

    if (
      authStatus === 'initializing' ||
      (authStatus === 'authenticated' && role === 'user' && profileStatus === 'loading')
    ) {
      return (
        <div
          className="min-h-screen bg-shifting-aurora text-white flex items-center justify-center p-6"
          role="status"
          aria-live="polite"
        >
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-8 py-7 max-w-sm w-full text-center space-y-3 shadow-2xl">
            <div className="w-8 h-8 border-2 border-white/30 border-t-emerald-300 rounded-full animate-spin mx-auto" />
            <h1 className="font-display text-lg font-bold tracking-tight">
              {authStatus === 'initializing'
                ? 'Restoring E-Finance Session…'
                : 'Loading Member Workspace…'}
            </h1>
            <p className="text-xs text-slate-200 leading-relaxed">
              Verifying your Firebase session and loading your Firestore account records.
            </p>
          </div>
        </div>
      );
    }

    if (role === 'admin' && authStatus === 'authenticated') {
      return (
        <AdminDashboard
          users={store.users}
          adminUsersMeta={adminUsersMeta}
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
          notifications={store.notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
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
          onRefreshUsers={refreshAdminUsers}
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
              initialView={loginInitialView}
              onClose={() => {
                setLoginOpen(false);
                setLoginInitialView('login');
              }}
              onAuthenticate={handleAuthenticate}
              onClaimAdminPassword={claimAdminWithEmailPassword}
              onRequestPasswordReset={requestPasswordReset}
              onSwitchToRegister={() => setLoginOpen(false)}
            />
          </div>
        </div>
      );
    }

    if (
      authStatus === 'authenticated' &&
      role === 'user' &&
      authUid &&
      (profileStatus === 'missing' || profileStatus === 'error')
    ) {
      return (
        <ProfileRecoveryView
          uid={authUid}
          email={firebaseUser?.email ?? ''}
          mode={profileStatus}
          errorMessage={profileError}
          onRecover={recoverProfile}
          onRetry={retryProfileLoad}
          onSignOut={signOutUser}
        />
      );
    }

    if (authStatus === 'authenticated' && role === 'user' && currentUser) {
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
          videoWatchSessions={videoWatchSessions}
          getAuthToken={getIdToken}
          notifications={store.notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
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
          initialView={loginInitialView}
          onClose={() => {
            setLoginOpen(false);
            setLoginInitialView('login');
          }}
          onAuthenticate={handleAuthenticate}
          onClaimAdminPassword={claimAdminWithEmailPassword}
          onRequestPasswordReset={requestPasswordReset}
          onSwitchToRegister={() => {
            setLoginOpen(false);
            setLoginInitialView('login');
            setRegisterOpen(true);
          }}
        />
      </>
    );
  };

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      {actionError && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-md bg-red-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-start justify-between gap-3"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-200 hover:text-white font-bold shrink-0"
          >
            ✕
          </button>
        </div>
      )}
      {renderMainContent()}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

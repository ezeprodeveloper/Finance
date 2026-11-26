import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { LandingView } from './components/LandingView';
import { LoginModal } from './components/LoginModal';
import { RegisterWizard } from './components/RegisterWizard';
import { SplashScreen } from './components/SplashScreen';
import { UserDashboard } from './components/UserDashboard';
import { INITIAL_PLATFORM_STATE } from './data/platformStore';
import { firestoreService } from './services/firestoreService';
import type {
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
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [store, setStore] = useState<PlatformStoreState>(INITIAL_PLATFORM_STATE);
  const [referredUsersCount, setReferredUsersCount] = useState(0);
  const [publicStats, setPublicStats] = useState({ totalActiveVideos: 0, totalActiveTasks: 0 });
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  const handleSignOut = useCallback(() => {
    void firestoreService.signOutCurrent();
    setAuthUid(null);
    setReferredUsersCount(0);
    setActionError(null);
    setStore((prev) => ({
      ...INITIAL_PLATFORM_STATE,
      settings: prev.settings,
      promotions: prev.promotions,
      session: { type: 'guest' },
    }));
  }, []);

  // Verify Firestore network connectivity on startup & track Firebase Auth state
  useEffect(() => {
    void firestoreService.testConnection();
    void firestoreService.fetchPublicBootstrap().then((data) => {
      setPublicStats({
        totalActiveVideos: data.totalActiveVideos,
        totalActiveTasks: data.totalActiveTasks,
      });
      setStore((prev) => ({
        ...prev,
        settings: data.settings,
        promotions: data.promotions,
      }));
    });

    const unsubAuth = firestoreService.onAuthChanged(async (fbUser) => {
      if (!fbUser) {
        setAuthUid(null);
        setStore((prev) => ({
          ...INITIAL_PLATFORM_STATE,
          settings: prev.settings,
          promotions: prev.promotions,
          session: { type: 'guest' },
        }));
        setAuthReady(true);
        return;
      }

      const isAdmin = await firestoreService.isVerifiedAdminUser(fbUser);
      setAuthUid(fbUser.uid);
      if (isAdmin) {
        setStore((prev) => ({
          ...prev,
          session: { type: 'admin' },
        }));
      } else {
        setStore((prev) => ({
          ...prev,
          session: { type: 'user', userId: fbUser.uid },
        }));
      }
      setAuthReady(true);
    });

    return () => unsubAuth();
  }, []);

  // Real-time Firestore listener matching active session role
  useEffect(() => {
    if (!authReady) return;

    if (store.session.type === 'guest') {
      return firestoreService.subscribePublicBootstrap((data) => {
        setPublicStats({
          totalActiveVideos: data.totalActiveVideos,
          totalActiveTasks: data.totalActiveTasks,
        });
        setStore((prev) => ({
          ...prev,
          settings: data.settings,
          promotions: data.promotions,
        }));
      });
    }

    if (store.session.type === 'user' && authUid) {
      return firestoreService.subscribeMemberWorkspace(
        authUid,
        (snapshot) => {
          setReferredUsersCount(snapshot.referredUsersCount);
          setStore((prev) => ({
            ...prev,
            users: snapshot.user ? [snapshot.user] : [],
            settings: snapshot.settings,
            savingsGoals: snapshot.savingsGoals,
            loans: snapshot.loans,
            investments: snapshot.investments,
            spinHistory: snapshot.spinHistory,
            withdrawals: snapshot.withdrawals,
            videoCampaigns: snapshot.videoCampaigns,
            customTasks: snapshot.customTasks,
            taskSubmissions: snapshot.taskSubmissions,
            betSessions: snapshot.betSessions,
            airtimeRequests: snapshot.airtimeRequests,
            p2pTransfers: snapshot.p2pTransfers,
            fxExchanges: snapshot.fxExchanges,
            usdtRequests: snapshot.usdtRequests,
            transactions: snapshot.transactions,
            notifications: snapshot.notifications,
            session: { type: 'user', userId: authUid },
          }));
        },
        (err) => setActionError(err.message),
      );
    }

    if (store.session.type === 'admin' && authUid) {
      return firestoreService.subscribeAdminWorkspace(
        (snapshot) => {
          setStore((prev) => ({
            ...prev,
            settings: snapshot.settings,
            users: snapshot.users,
            savingsGoals: snapshot.savingsGoals,
            loans: snapshot.loans,
            investments: snapshot.investments,
            spinHistory: snapshot.spinHistory,
            withdrawals: snapshot.withdrawals,
            videoCampaigns: snapshot.videoCampaigns,
            customTasks: snapshot.customTasks,
            taskSubmissions: snapshot.taskSubmissions,
            betSessions: snapshot.betSessions,
            airtimeRequests: snapshot.airtimeRequests,
            p2pTransfers: snapshot.p2pTransfers,
            fxExchanges: snapshot.fxExchanges,
            usdtRequests: snapshot.usdtRequests,
            transactions: snapshot.transactions,
            promotions: snapshot.promotions,
            notifications: snapshot.notifications,
            session: { type: 'admin' },
          }));
        },
        (err) => setActionError(err.message),
      );
    }
  }, [authReady, store.session.type, authUid]);

  const currentUser =
    store.session.type === 'user'
      ? store.users.find((u) => u.id === (store.session as { type: 'user'; userId: string }).userId) ?? null
      : null;

  /* ------------------------------------------------------------------------ */
  /* Firebase Authentication & 3-Step Registration                            */
  /* ------------------------------------------------------------------------ */
  const handleAuthenticate = async (
    identifier: string,
    password: string,
  ): Promise<{ error: string | null; needsAdminSetup?: boolean }> => {
    try {
      const res = await firestoreService.signInWithIdentifier(identifier, password);
      setAuthUid(res.uid);
      setStore((prev) => ({
        ...prev,
        session: res.role === 'admin' ? { type: 'admin' } : { type: 'user', userId: res.uid },
      }));
      setLoginOpen(false);
      return { error: null };
    } catch (err) {
      const e = err as Error & { needsAdminSetup?: boolean };
      return {
        error: e.message || 'Sign-in failed. Please verify your credentials.',
        needsAdminSetup: Boolean(e.needsAdminSetup),
      };
    }
  };

  const handleClaimAdminPassword = async (
    email: string,
    password: string,
  ): Promise<string | null> => {
    try {
      await firestoreService.claimAdminWithEmailPassword(email, password);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to create Admin account.';
    }
  };

  const handleGoogleSignIn = async (): Promise<string | null> => {
    try {
      const res = await firestoreService.signInWithGoogle();
      setAuthUid(res.uid);
      setStore((prev) => ({
        ...prev,
        session: res.role === 'admin' ? { type: 'admin' } : { type: 'user', userId: res.uid },
      }));
      setLoginOpen(false);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Google sign-in failed.';
    }
  };

  const handleRegisterComplete = async (
    newUser: RegisteredUser,
    rawPassword: string,
    referralCodeInput: string,
  ): Promise<string | null> => {
    try {
      const created = await firestoreService.registerMember({
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
      setAuthUid(created.id);
      setStore((prev) => ({
        ...prev,
        users: [created],
        session: { type: 'user', userId: created.id },
      }));
      setRegisterOpen(false);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Registration failed. Please try again.';
    }
  };

  const runAction = useCallback(async (fn: () => Promise<void>) => {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Operation failed.');
    }
  }, []);

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

  const handleWatchVideoComplete = async (campaignId: string) => {
    if (!authUid) return;
    await runAction(() => firestoreService.watchVideoComplete(authUid, campaignId));
  };

  const handleCreateVideoCampaign = async (payload: {
    title: string;
    description: string;
    videoUrl: string;
    rewardPerViewRwf: number;
    targetViewers: number;
    paymentRef: string;
  }) => {
    if (!authUid) return;
    await runAction(() => firestoreService.createVideoCampaign(authUid, payload));
  };

  const handleSubmitTaskProof = async (payload: {
    taskId: string;
    proofText: string;
    proofUrl?: string;
  }) => {
    if (!authUid) return;
    await runAction(() => firestoreService.submitTaskProof(authUid, payload));
  };

  const handleCreateCustomTask = async (payload: {
    title: string;
    requirements: string;
    rewardPerCompletionRwf: number;
    targetCompletions: number;
    paymentRef: string;
  }) => {
    if (!authUid) return;
    await runAction(() => firestoreService.createCustomTask(authUid, payload));
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
    rewardPerViewRwf: number;
    targetViewers: number;
  }) => {
    await runAction(() => firestoreService.adminCreateVideo(payload));
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
    rewardPerCompletionRwf: number;
    targetCompletions: number;
  }) => {
    await runAction(() => firestoreService.adminCreateTask(payload));
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
              onGoogleSignIn={handleGoogleSignIn}
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
          onClose={() => setLoginOpen(false)}
          onAuthenticate={handleAuthenticate}
          onClaimAdminPassword={handleClaimAdminPassword}
          onGoogleSignIn={handleGoogleSignIn}
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

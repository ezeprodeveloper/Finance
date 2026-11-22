import { useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { AdminDashboard } from './components/AdminDashboard';
import { LandingView } from './components/LandingView';
import { LoginModal } from './components/LoginModal';
import { RegisterWizard } from './components/RegisterWizard';
import { SplashScreen } from './components/SplashScreen';
import { UserDashboard } from './components/UserDashboard';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD_SHA256,
  INVESTMENT_PLAN_TIERS,
  loadPlatformState,
  savePlatformState,
} from './data/platformStore';
import { auth } from './firebase';
import {
  cloudCreateUser,
  cloudDeleteDoc,
  cloudSaveSettings,
  cloudSetDoc,
  cloudUpdateDoc,
  cloudUpdateUser,
  fetchUserProfileFromCloud,
  sanitizeDocId,
  subscribeAdminCloud,
  subscribeMemberCloud,
  subscribePublicPlatform,
} from './services/firestoreStore';
import {
  InvestmentPlanTier,
  PlatformStoreState,
  RegisteredUser,
  RwandaKycData,
  SavingsGoal,
  SystemSettings,
  TransactionRecord,
} from './types/finance';
import {
  buildUssdFullCode,
  generateReference,
  hashPassword,
} from './utils/formatters';

const ALLOWED_ADMIN_EMAILS = [ADMIN_EMAIL, 'hbmgshzchl@gmail.com'];

function isVerifiedAdminUser(fbUser: FirebaseUser | null): boolean {
  if (!fbUser || !fbUser.emailVerified || !fbUser.email) return false;
  return ALLOWED_ADMIN_EMAILS.includes(fbUser.email.toLowerCase());
}

export default function App() {
  const [store, setStore] = useState<PlatformStoreState>(() => loadPlatformState());
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  // Initial platform brand splash only
  const [showSplash, setShowSplash] = useState(true);

  // Firebase Auth state
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => auth.currentUser);

  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    savePlatformState(store);
  }, [store]);

  const isCloudAdmin = isVerifiedAdminUser(firebaseUser);

  // Real-time public platform subscription (settings + active promotions)
  useEffect(() => {
    const unsub = subscribePublicPlatform(
      (cloudSettings) => {
        setStore((prev) => ({
          ...prev,
          settings: { ...prev.settings, ...cloudSettings },
        }));
      },
      (cloudPromotions) => {
        setStore((prev) => ({
          ...prev,
          promotions: cloudPromotions,
        }));
      },
      isCloudAdmin || store.session.type === 'admin',
    );
    return () => unsub();
  }, [isCloudAdmin, store.session.type]);

  // Firebase Auth listener & cross-device real-time cloud subscriptions
  useEffect(() => {
    let unsubCloud: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (unsubCloud) {
        unsubCloud();
        unsubCloud = null;
      }

      setFirebaseUser(fbUser);

      if (!fbUser) {
        return;
      }

      if (isVerifiedAdminUser(fbUser)) {
        setStore((prev) => ({
          ...prev,
          session: { type: 'admin' },
        }));
        unsubCloud = subscribeAdminCloud({
          onUsers: (users) => setStore((prev) => ({ ...prev, users })),
          onSavingsGoals: (savingsGoals) => setStore((prev) => ({ ...prev, savingsGoals })),
          onLoans: (loans) => setStore((prev) => ({ ...prev, loans })),
          onInvestments: (investments) => setStore((prev) => ({ ...prev, investments })),
          onSpins: (spinHistory) => setStore((prev) => ({ ...prev, spinHistory })),
          onWithdrawals: (withdrawals) => setStore((prev) => ({ ...prev, withdrawals })),
          onVideoCampaigns: (videoCampaigns) => setStore((prev) => ({ ...prev, videoCampaigns })),
          onCustomTasks: (customTasks) => setStore((prev) => ({ ...prev, customTasks })),
          onTaskSubmissions: (taskSubmissions) => setStore((prev) => ({ ...prev, taskSubmissions })),
          onTransactions: (transactions) => setStore((prev) => ({ ...prev, transactions })),
        });
        return;
      }

      const fbEmail = (fbUser.email || '').toLowerCase();
      if (ALLOWED_ADMIN_EMAILS.includes(fbEmail)) {
        return;
      }

      const safeUid = sanitizeDocId(fbUser.uid);
      unsubCloud = subscribeMemberCloud(safeUid, {
        onUser: (cloudUser) => {
          if (!cloudUser) return;
          setStore((prev) => {
            const exists = prev.users.some((u) => u.id === cloudUser.id);
            const nextUsers = exists
              ? prev.users.map((u) => (u.id === cloudUser.id ? cloudUser : u))
              : [cloudUser, ...prev.users];
            return {
              ...prev,
              users: nextUsers,
              session: prev.session.type === 'guest' ? { type: 'user', userId: cloudUser.id } : prev.session,
            };
          });
        },
        onSavingsGoals: (savingsGoals) => setStore((prev) => ({ ...prev, savingsGoals })),
        onLoans: (loans) => setStore((prev) => ({ ...prev, loans })),
        onInvestments: (investments) => setStore((prev) => ({ ...prev, investments })),
        onSpins: (spinHistory) => setStore((prev) => ({ ...prev, spinHistory })),
        onWithdrawals: (withdrawals) => setStore((prev) => ({ ...prev, withdrawals })),
        onVideoCampaigns: (videoCampaigns) => setStore((prev) => ({ ...prev, videoCampaigns })),
        onCustomTasks: (customTasks) => setStore((prev) => ({ ...prev, customTasks })),
        onTaskSubmissions: (taskSubmissions) => setStore((prev) => ({ ...prev, taskSubmissions })),
        onTransactions: (transactions) => setStore((prev) => ({ ...prev, transactions })),
      });
    });

    return () => {
      if (unsubCloud) unsubCloud();
      unsubAuth();
    };
  }, []);

  // Automated 24-hour Investment ROI distribution engine
  useEffect(() => {
    const processDailyRoi = () => {
      const now = Date.now();
      const dayMs = 86400000;
      const prev = storeRef.current;

      let changed = false;
      const userCredits: Record<string, number> = {};
      const newTransactions: TransactionRecord[] = [];
      const updatedInvSync: Array<{
        id: string;
        userId: string;
        totalEarnedRwf: number;
        lastRoiCreditedAt: string | null;
        status: 'active' | 'completed';
      }> = [];

      const nextInvestments = prev.investments.map((inv) => {
        if (inv.status !== 'active' || !inv.lastRoiCreditedAt) return inv;
        const lastMs = Date.parse(inv.lastRoiCreditedAt);
        if (Number.isNaN(lastMs)) return inv;

        const daysDue = Math.floor((now - lastMs) / dayMs);
        if (daysDue < 1) return inv;

        const tier = INVESTMENT_PLAN_TIERS.find((t) => t.id === inv.tierId);
        const maxTotal = (tier?.durationDays ?? 30) * inv.dailyReturnRwf;
        const daysCreditedSoFar = Math.floor(inv.totalEarnedRwf / inv.dailyReturnRwf);
        const remainingDays = Math.max(0, (tier?.durationDays ?? 30) - daysCreditedSoFar);
        const actualDays = Math.min(daysDue, remainingDays);

        if (actualDays <= 0) {
          changed = true;
          updatedInvSync.push({
            id: inv.id,
            userId: inv.userId,
            totalEarnedRwf: inv.totalEarnedRwf,
            lastRoiCreditedAt: inv.lastRoiCreditedAt,
            status: 'completed',
          });
          return { ...inv, status: 'completed' as const };
        }

        changed = true;
        const payout = actualDays * inv.dailyReturnRwf;
        const nextEarned = Math.min(maxTotal, inv.totalEarnedRwf + payout);
        const completed = nextEarned >= maxTotal;
        const creditIso = new Date(lastMs + actualDays * dayMs).toISOString();

        userCredits[inv.userId] = (userCredits[inv.userId] ?? 0) + payout;
        newTransactions.push({
          id: `tx-roi-${Date.now()}-${inv.id}`,
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

        updatedInvSync.push({
          id: inv.id,
          userId: inv.userId,
          totalEarnedRwf: nextEarned,
          lastRoiCreditedAt: creditIso,
          status: completed ? 'completed' : 'active',
        });

        return {
          ...inv,
          totalEarnedRwf: nextEarned,
          lastRoiCreditedAt: creditIso,
          status: completed ? ('completed' as const) : ('active' as const),
        };
      });

      if (!changed) return;

      setStore((curr) => ({
        ...curr,
        users: curr.users.map((u) =>
          userCredits[u.id]
            ? { ...u, walletBalanceRwf: u.walletBalanceRwf + userCredits[u.id] }
            : u,
        ),
        investments: nextInvestments,
        transactions: [...newTransactions, ...curr.transactions],
      }));

      // Mirror authorized ROI updates to Firestore outside React state updater
      const fbUser = auth.currentUser;
      if (fbUser) {
        const adminAuth = isVerifiedAdminUser(fbUser);
        const fbUid = sanitizeDocId(fbUser.uid);

        updatedInvSync.forEach((item) => {
          if (adminAuth || item.userId === fbUid) {
            void cloudUpdateDoc('investments', item.id, {
              totalEarnedRwf: item.totalEarnedRwf,
              lastRoiCreditedAt: item.lastRoiCreditedAt,
              status: item.status,
              updatedAt: new Date().toISOString(),
            }).catch((err) => console.warn('ROI investment sync notice:', err));
          }
        });

        Object.entries(userCredits).forEach(([uid, credit]) => {
          const target = prev.users.find((u) => u.id === uid);
          if (!target) return;
          if (adminAuth || (uid === fbUid && credit <= 5000)) {
            void cloudUpdateUser(uid, {
              walletBalanceRwf: target.walletBalanceRwf + credit,
            }).catch((err) => console.warn('ROI balance sync notice:', err));
          }
        });

        newTransactions.forEach((tx) => {
          if (adminAuth || tx.userId === fbUid) {
            void cloudSetDoc('transactions', tx).catch((err) =>
              console.warn('ROI transaction sync notice:', err),
            );
          }
        });
      }
    };

    processDailyRoi();
    const timer = window.setInterval(processDailyRoi, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const currentUser =
    store.session.type === 'user'
      ? store.users.find((u) => u.id === (store.session as { type: 'user'; userId: string }).userId) ?? null
      : null;

  const canWriteMemberCloud = Boolean(
    currentUser &&
      firebaseUser &&
      sanitizeDocId(firebaseUser.uid) === currentUser.id,
  );

  /* ------------------------------------------------------------------------ */
  /* Registration & Authentication (Silent Email/Password + Local Fallback)   */
  /* ------------------------------------------------------------------------ */
  const handleAuthenticate = async (
    identifier: string,
    password: string,
  ): Promise<string | null> => {
    const cleanId = identifier.trim();
    const normalized = cleanId.toLowerCase();
    if (!cleanId || !password) {
      return 'Enter your email or phone number and password.';
    }

    const enteredHash = await hashPassword(password);

    // Unified Admin login path (silent Firebase Email/Password sync)
    if (normalized === ADMIN_EMAIL.toLowerCase()) {
      if (enteredHash !== ADMIN_PASSWORD_SHA256) {
        return 'Invalid email/phone or password.';
      }
      try {
        await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
          try {
            await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, password);
          } catch {
            // Local admin session remains functional even if Email/Password is not enabled in Firebase Console
          }
        }
      }
      setStore((prev) => ({
        ...prev,
        session: { type: 'admin' },
      }));
      setLoginOpen(false);
      return null;
    }

    // Member login path
    const phoneDigits = cleanId.replace(/[\s-]/g, '');
    const matchedLocal = storeRef.current.users.find(
      (u) =>
        u.email.toLowerCase() === normalized ||
        u.phone.replace(/[\s-]/g, '') === phoneDigits,
    );

    const emailToTry = matchedLocal?.email ?? (cleanId.includes('@') ? normalized : null);

    if (emailToTry) {
      try {
        const cred = await signInWithEmailAndPassword(auth, emailToTry, password);
        const safeUid = sanitizeDocId(cred.user.uid);
        let cloudProfile: RegisteredUser | null = null;
        try {
          cloudProfile = await fetchUserProfileFromCloud(safeUid);
        } catch {
          cloudProfile = null;
        }

        if (cloudProfile) {
          if (cloudProfile.accountStatus === 'suspended') {
            await signOut(auth);
            return 'This account has been suspended by E-Finance Admin.';
          }
          setStore((prev) => {
            const exists = prev.users.some((u) => u.id === cloudProfile.id);
            return {
              ...prev,
              users: exists
                ? prev.users.map((u) => (u.id === cloudProfile.id ? cloudProfile : u))
                : [cloudProfile, ...prev.users],
              session: { type: 'user', userId: cloudProfile.id },
            };
          });
          setLoginOpen(false);
          return null;
        }

        if (matchedLocal) {
          if (matchedLocal.accountStatus === 'suspended') {
            await signOut(auth);
            return 'This account has been suspended by E-Finance Admin.';
          }
          let finalLocal = matchedLocal;
          if (matchedLocal.accountStatus === 'pending_approval') {
            finalLocal = { ...matchedLocal, id: safeUid };
            try {
              await cloudCreateUser(finalLocal);
              setStore((prev) => ({
                ...prev,
                users: prev.users.map((u) => (u.id === matchedLocal.id ? finalLocal : u)),
              }));
            } catch {
              finalLocal = matchedLocal;
            }
          }
          setStore((prev) => ({
            ...prev,
            session: { type: 'user', userId: finalLocal.id },
          }));
          setLoginOpen(false);
          return null;
        }
      } catch (err) {
        const code = (err as { code?: string })?.code;

        if (code === 'auth/too-many-requests') {
          return 'Too many failed sign-in attempts. Please wait a moment and try again.';
        }

        if (matchedLocal) {
          if (matchedLocal.passwordHash !== enteredHash) {
            return 'Incorrect password. Please check and try again.';
          }
          if (matchedLocal.accountStatus === 'suspended') {
            return 'This account has been suspended by E-Finance Admin.';
          }

          let finalLocal = matchedLocal;
          if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
            try {
              const created = await createUserWithEmailAndPassword(auth, matchedLocal.email, password);
              const safeUid = sanitizeDocId(created.user.uid);
              if (matchedLocal.accountStatus === 'pending_approval') {
                const migrated: RegisteredUser = { ...matchedLocal, id: safeUid };
                await cloudCreateUser(migrated);
                finalLocal = migrated;
                setStore((prev) => ({
                  ...prev,
                  users: prev.users.map((u) => (u.id === matchedLocal.id ? migrated : u)),
                }));
              }
            } catch {
              // Silent fallback to local account
            }
          }

          setStore((prev) => ({
            ...prev,
            session: { type: 'user', userId: finalLocal.id },
          }));
          setLoginOpen(false);
          return null;
        }

        if (code === 'auth/wrong-password') {
          return 'Incorrect password. Please check and try again.';
        }
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
          return 'No matching account found, or incorrect password.';
        }
        if (code === 'auth/operation-not-allowed') {
          return 'No matching account found on this device. Please create a 3-step account first.';
        }
        return 'Unable to sign in right now. Please verify your credentials and try again.';
      }
    }

    return 'No matching account found, or incorrect password.';
  };

  const handleRegisterComplete = async (
    newUser: RegisteredUser,
    rawPassword: string,
  ): Promise<string | null> => {
    let finalUser = newUser;

    try {
      const cred = await createUserWithEmailAndPassword(auth, newUser.email, rawPassword);
      const safeUid = sanitizeDocId(cred.user.uid);
      finalUser = {
        ...newUser,
        id: safeUid,
      };
      try {
        await cloudCreateUser(finalUser);
      } catch (cloudErr) {
        console.warn('Cloud user creation notice:', cloudErr);
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/email-already-in-use') {
        return 'An account with this email already exists. Please sign in instead.';
      }
      if (code === 'auth/invalid-email') {
        return 'Please enter a valid email address.';
      }
      if (code === 'auth/weak-password') {
        return 'Create a login password with at least 8 characters.';
      }
      if (code !== 'auth/operation-not-allowed' && code !== 'auth/network-request-failed') {
        console.warn('Firebase registration notice:', err);
      }
    }

    setStore((prev) => ({
      ...prev,
      users: [finalUser, ...prev.users.filter((u) => u.id !== finalUser.id)],
      session: { type: 'user', userId: finalUser.id },
    }));
    setRegisterOpen(false);
    return null;
  };

  const handleSignOut = () => {
    if (auth.currentUser) {
      void signOut(auth);
    }
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
    const actTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      userId: currentUser.id,
      reference: generateReference('ACT'),
      title: `System Activation Fee (${store.settings.activationFeeRwf} RWF)`,
      category: 'Activation',
      channel: `${store.settings.momoPayCode}*${store.settings.activationFeeRwf}# · Ref ${ref}`,
      amountRwf: store.settings.activationFeeRwf,
      direction: 'debit',
      status: 'Pending Review',
      timestamp: new Date().toISOString(),
    };

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
      transactions: [actTx, ...prev.transactions],
    }));

    if (canWriteMemberCloud) {
      void cloudUpdateUser(currentUser.id, {
        accountStatus: 'payment_submitted',
        activationPaidPhone: phone,
        activationPaymentRef: ref,
      });
      void cloudSetDoc('transactions', actTx);
    }
  };

  const handleDailyCheckIn = () => {
    if (!currentUser) return;
    const now = Date.now();
    if (currentUser.lastCheckInAt) {
      const lastMs = Date.parse(currentUser.lastCheckInAt);
      if (!Number.isNaN(lastMs) && now - lastMs < 86400000) return;
    }

    const nowIso = new Date(now).toISOString();
    const reward = store.settings.dailyCheckInRwf;
    const chkTx: TransactionRecord = {
      id: `tx-${now}`,
      userId: currentUser.id,
      reference: generateReference('CHK'),
      title: 'Daily 24h Check-In Reward',
      category: 'Check-In',
      channel: 'E-Finance Daily Check-In',
      amountRwf: reward,
      direction: 'credit',
      status: 'Completed',
      timestamp: nowIso,
    };

    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              walletBalanceRwf: u.walletBalanceRwf + reward,
              lastCheckInAt: nowIso,
              checkInStreak: u.checkInStreak + 1,
            }
          : u,
      ),
      transactions: [chkTx, ...prev.transactions],
    }));

    if (canWriteMemberCloud) {
      void cloudUpdateUser(currentUser.id, {
        walletBalanceRwf: currentUser.walletBalanceRwf + reward,
        lastCheckInAt: nowIso,
        checkInStreak: currentUser.checkInStreak + 1,
      });
      void cloudSetDoc('transactions', chkTx);
    }
  };

  const handleSubmitKyc = (data: RwandaKycData) => {
    if (!currentUser) return;
    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id ? { ...u, kycStatus: 'pending', kycData: data } : u,
      ),
    }));

    if (canWriteMemberCloud) {
      void cloudUpdateUser(currentUser.id, {
        kycStatus: 'pending',
        kycData: data,
      });
    }
  };

  const handleCreateSavingsGoal = (
    title: string,
    planType: SavingsGoal['planType'],
    targetRwf: number,
    targetDate: string,
  ) => {
    if (!currentUser || currentUser.kycStatus !== 'approved') return;
    const newGoal: SavingsGoal = {
      id: `sav-${Date.now()}`,
      userId: currentUser.id,
      title,
      planType,
      targetRwf,
      currentRwf: 0,
      targetDate,
      createdAt: new Date().toISOString(),
    };

    setStore((prev) => ({
      ...prev,
      savingsGoals: [newGoal, ...prev.savingsGoals],
    }));

    if (canWriteMemberCloud) {
      void cloudSetDoc('savingsGoals', newGoal);
    }
  };

  const handleDepositToSavings = (goalId: string, amountRwf: number) => {
    if (!currentUser || currentUser.kycStatus !== 'approved') return;
    if (amountRwf > currentUser.walletBalanceRwf || amountRwf <= 0) return;

    const goal = store.savingsGoals.find((g) => g.id === goalId && g.userId === currentUser.id);
    if (!goal) return;

    const nowIso = new Date().toISOString();
    const savTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      userId: currentUser.id,
      reference: generateReference('SAV'),
      title: `Saved to ${goal.title}`,
      category: 'Savings',
      channel: `Smart Savings · ${goal.planType}`,
      amountRwf,
      direction: 'debit',
      status: 'Completed',
      timestamp: nowIso,
    };

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
      transactions: [savTx, ...prev.transactions],
    }));

    if (canWriteMemberCloud) {
      void cloudUpdateUser(currentUser.id, {
        walletBalanceRwf: currentUser.walletBalanceRwf - amountRwf,
        savingsBalanceRwf: currentUser.savingsBalanceRwf + amountRwf,
      });
      void cloudUpdateDoc('savingsGoals', goalId, {
        currentRwf: goal.currentRwf + amountRwf,
        updatedAt: nowIso,
      });
      void cloudSetDoc('transactions', savTx);
    }
  };

  const handleWithdrawFromSavings = (goalId: string, amountRwf: number) => {
    if (!currentUser || currentUser.kycStatus !== 'approved') return;
    const goal = store.savingsGoals.find((g) => g.id === goalId && g.userId === currentUser.id);
    if (!goal || amountRwf > goal.currentRwf || amountRwf > currentUser.savingsBalanceRwf || amountRwf <= 0) return;

    const nowIso = new Date().toISOString();
    const savTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      userId: currentUser.id,
      reference: generateReference('SAV'),
      title: `Moved from ${goal.title} to Wallet`,
      category: 'Savings',
      channel: 'Smart Savings Retrieval',
      amountRwf,
      direction: 'credit',
      status: 'Completed',
      timestamp: nowIso,
    };

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
      transactions: [savTx, ...prev.transactions],
    }));

    if (canWriteMemberCloud) {
      void cloudUpdateUser(currentUser.id, {
        walletBalanceRwf: currentUser.walletBalanceRwf + amountRwf,
        savingsBalanceRwf: Math.max(0, currentUser.savingsBalanceRwf - amountRwf),
      });
      void cloudUpdateDoc('savingsGoals', goalId, {
        currentRwf: goal.currentRwf - amountRwf,
        updatedAt: nowIso,
      });
      void cloudSetDoc('transactions', savTx);
    }
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
    const nowIso = new Date().toISOString();
    const newLoan = {
      id: `loan-${Date.now()}`,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.secondName}`,
      ...payload,
      repaidRwf: 0,
      status: 'pending_admin' as const,
      createdAt: nowIso,
    };
    const lnTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      userId: currentUser.id,
      reference: generateReference('LN'),
      title: `Loan Request: ${payload.product}`,
      category: 'Loan',
      channel: `${payload.termMonths} months · ${payload.reason}`,
      amountRwf: payload.principalRwf,
      direction: 'credit',
      status: 'Pending Review',
      timestamp: nowIso,
    };

    setStore((prev) => ({
      ...prev,
      loans: [newLoan, ...prev.loans],
      transactions: [lnTx, ...prev.transactions],
    }));

    if (canWriteMemberCloud) {
      void cloudSetDoc('loans', newLoan);
      void cloudSetDoc('transactions', lnTx);
    }
  };

  const handleRepayLoan = (loanId: string, amountRwf: number) => {
    if (!currentUser || amountRwf <= 0 || amountRwf > currentUser.walletBalanceRwf) return;
    const loan = store.loans.find((l) => l.id === loanId && l.userId === currentUser.id);
    if (!loan) return;

    const nowIso = new Date().toISOString();
    const nextRepaid = loan.repaidRwf + amountRwf;
    const isFullyRepaid = nextRepaid >= loan.totalRepayableRwf;
    const repTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      userId: currentUser.id,
      reference: generateReference('REP'),
      title: `Loan Repayment: ${loan.product}`,
      category: 'Loan',
      channel: 'Wallet Repayment',
      amountRwf,
      direction: 'debit',
      status: 'Completed',
      timestamp: nowIso,
    };

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
      transactions: [repTx, ...prev.transactions],
    }));

    if (canWriteMemberCloud) {
      void cloudUpdateUser(currentUser.id, {
        walletBalanceRwf: currentUser.walletBalanceRwf - amountRwf,
      });
      void cloudUpdateDoc('loans', loanId, {
        repaidRwf: nextRepaid,
        status: isFullyRepaid ? 'repaid' : loan.status,
        updatedAt: nowIso,
      });
      void cloudSetDoc('transactions', repTx);
    }
  };

  const handlePurchasePlan = (tier: InvestmentPlanTier, paymentRef: string) => {
    if (!currentUser) return;
    const nowIso = new Date().toISOString();
    const payCode = buildUssdFullCode(store.settings.momoPayCode, tier.depositRwf);
    const newInv = {
      id: `inv-${Date.now()}`,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.secondName}`,
      tierId: tier.id,
      planName: tier.name,
      depositRwf: tier.depositRwf,
      dailyReturnRwf: tier.dailyReturnRwf,
      paymentCode: payCode,
      paymentRef,
      status: 'pending_admin' as const,
      totalEarnedRwf: 0,
      lastRoiCreditedAt: null,
      createdAt: nowIso,
    };
    const invTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      userId: currentUser.id,
      reference: generateReference('INV'),
      title: `Investment Plan Deposit: ${tier.name}`,
      category: 'Investment Deposit',
      channel: `${payCode} · Ref ${paymentRef}`,
      amountRwf: tier.depositRwf,
      direction: 'debit',
      status: 'Pending Review',
      timestamp: nowIso,
    };

    setStore((prev) => ({
      ...prev,
      investments: [newInv, ...prev.investments],
      transactions: [invTx, ...prev.transactions],
    }));

    if (canWriteMemberCloud) {
      void cloudSetDoc('investments', newInv);
      void cloudSetDoc('transactions', invTx);
    }
  };

  const handleCompleteSpin = (rewardRwf: number) => {
    if (!currentUser || currentUser.spinCredits <= 0) return;
    const safeReward = Math.max(0, Math.min(200, Math.round(rewardRwf)));
    const nowIso = new Date().toISOString();
    const spinRec = {
      id: `sp-${Date.now()}`,
      userId: currentUser.id,
      rewardRwf: safeReward,
      spunAt: nowIso,
    };
    const spinTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      userId: currentUser.id,
      reference: generateReference('SPN'),
      title: `Lucky Spin Wheel Reward (${safeReward} RWF)`,
      category: 'Spin Win',
      channel: 'E-Finance Lucky Wheel',
      amountRwf: safeReward,
      direction: 'credit',
      status: 'Completed',
      timestamp: nowIso,
    };

    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              spinCredits: Math.max(0, u.spinCredits - 1),
              walletBalanceRwf: u.walletBalanceRwf + safeReward,
            }
          : u,
      ),
      spinHistory: [spinRec, ...prev.spinHistory],
      transactions: [spinTx, ...prev.transactions],
    }));

    if (canWriteMemberCloud) {
      void cloudUpdateUser(currentUser.id, {
        spinCredits: Math.max(0, currentUser.spinCredits - 1),
        walletBalanceRwf: currentUser.walletBalanceRwf + safeReward,
      });
      void cloudSetDoc('spinHistory', spinRec);
      void cloudSetDoc('transactions', spinTx);
    }
  };

  const handleRequestWithdrawal = (payload: {
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
    if (!currentUser || currentUser.kycStatus !== 'approved') return;
    if (payload.grossAmountRwf > currentUser.walletBalanceRwf || payload.grossAmountRwf <= 0) return;

    const nowIso = new Date().toISOString();
    const newWd = {
      id: `wd-${Date.now()}`,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.secondName}`,
      ...payload,
      status: 'pending_admin' as const,
      createdAt: nowIso,
    };
    const wdTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      userId: currentUser.id,
      reference: generateReference('WDR'),
      title: `Withdrawal (${payload.network}) — Net ${payload.netAmountRwf} RWF`,
      category: 'Withdrawal',
      channel: `${payload.network} · ${payload.destinationType}: ${payload.destinationValue} (${payload.accountRegisteredNames}) · ${payload.feePercent}% fee`,
      amountRwf: payload.grossAmountRwf,
      feeRwf: payload.feeRwf,
      direction: 'debit',
      status: 'Pending Review',
      timestamp: nowIso,
    };

    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? { ...u, walletBalanceRwf: u.walletBalanceRwf - payload.grossAmountRwf }
          : u,
      ),
      withdrawals: [newWd, ...prev.withdrawals],
      transactions: [wdTx, ...prev.transactions],
    }));

    if (canWriteMemberCloud) {
      void cloudUpdateUser(currentUser.id, {
        walletBalanceRwf: currentUser.walletBalanceRwf - payload.grossAmountRwf,
      });
      void cloudSetDoc('withdrawals', newWd);
      void cloudSetDoc('transactions', wdTx);
    }
  };

  const handleWatchVideoComplete = (campaignId: string) => {
    if (!currentUser) return;
    const camp = store.videoCampaigns.find((c) => c.id === campaignId);
    if (!camp || camp.status !== 'active') return;
    if (camp.watchedByUserIds.includes(currentUser.id)) return;
    if (camp.watchedByUserIds.length >= camp.targetViewers) return;

    const nowIso = new Date().toISOString();
    const updatedWatchers = [...camp.watchedByUserIds, currentUser.id];
    const completed = updatedWatchers.length >= camp.targetViewers;
    const vidTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      userId: currentUser.id,
      reference: generateReference('VID'),
      title: `Short Video Reward: ${camp.title}`,
      category: 'Video Reward',
      channel: 'Watch-to-Earn',
      amountRwf: camp.rewardPerViewRwf,
      direction: 'credit',
      status: 'Completed',
      timestamp: nowIso,
    };

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
      transactions: [vidTx, ...prev.transactions],
    }));

    if (canWriteMemberCloud) {
      void cloudUpdateUser(currentUser.id, {
        walletBalanceRwf: currentUser.walletBalanceRwf + camp.rewardPerViewRwf,
      });
      void cloudUpdateDoc('videoCampaigns', campaignId, {
        watchedByUserIds: updatedWatchers,
        status: completed ? 'completed' : camp.status,
        updatedAt: nowIso,
      });
      void cloudSetDoc('transactions', vidTx);
    }
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
    const nowIso = new Date().toISOString();
    const totalBudgetRwf = payload.rewardPerViewRwf * payload.targetViewers;
    const paymentCode = buildUssdFullCode(store.settings.momoPayCode, totalBudgetRwf);

    const newCamp = {
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
      status: 'pending_admin' as const,
      createdAt: nowIso,
    };
    const cmpTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      userId: currentUser.id,
      reference: generateReference('CMP'),
      title: `Video Campaign Deposit: ${payload.title}`,
      category: 'Campaign Payment',
      channel: `${paymentCode} · Ref ${payload.paymentRef}`,
      amountRwf: totalBudgetRwf,
      direction: 'debit',
      status: 'Pending Review',
      timestamp: nowIso,
    };

    setStore((prev) => ({
      ...prev,
      videoCampaigns: [newCamp, ...prev.videoCampaigns],
      transactions: [cmpTx, ...prev.transactions],
    }));

    if (canWriteMemberCloud) {
      void cloudSetDoc('videoCampaigns', newCamp);
      void cloudSetDoc('transactions', cmpTx);
    }
  };

  const handleSubmitTaskProof = (payload: {
    taskId: string;
    proofText: string;
    proofUrl?: string;
  }) => {
    if (!currentUser) return;
    const task = store.customTasks.find((t) => t.id === payload.taskId && t.status === 'active');
    if (!task) return;
    const already = store.taskSubmissions.some(
      (s) => s.taskId === task.id && s.workerId === currentUser.id,
    );
    if (already) return;

    const cleanProofUrl = payload.proofUrl?.trim();
    const newSub = {
      id: `sub-${Date.now()}`,
      taskId: task.id,
      taskTitle: task.title,
      workerId: currentUser.id,
      workerName: `${currentUser.firstName} ${currentUser.secondName}`,
      proofText: payload.proofText,
      proofUrl: cleanProofUrl && cleanProofUrl.length >= 4 ? cleanProofUrl : undefined,
      rewardRwf: task.rewardPerCompletionRwf,
      status: 'pending_admin' as const,
      submittedAt: new Date().toISOString(),
    };

    setStore((prev) => ({
      ...prev,
      taskSubmissions: [newSub, ...prev.taskSubmissions],
    }));

    if (canWriteMemberCloud) {
      void cloudSetDoc('taskSubmissions', newSub);
    }
  };

  const handleCreateCustomTask = (payload: {
    title: string;
    requirements: string;
    rewardPerCompletionRwf: number;
    targetCompletions: number;
    paymentRef: string;
  }) => {
    if (!currentUser) return;
    const nowIso = new Date().toISOString();
    const totalBudgetRwf = payload.rewardPerCompletionRwf * payload.targetCompletions;
    const paymentCode = buildUssdFullCode(store.settings.momoPayCode, totalBudgetRwf);

    const newTask = {
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
      status: 'pending_admin' as const,
      createdAt: nowIso,
    };
    const tskTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      userId: currentUser.id,
      reference: generateReference('TSK'),
      title: `Custom Task Funding: ${payload.title}`,
      category: 'Campaign Payment',
      channel: `${paymentCode} · Ref ${payload.paymentRef}`,
      amountRwf: totalBudgetRwf,
      direction: 'debit',
      status: 'Pending Review',
      timestamp: nowIso,
    };

    setStore((prev) => ({
      ...prev,
      customTasks: [newTask, ...prev.customTasks],
      transactions: [tskTx, ...prev.transactions],
    }));

    if (canWriteMemberCloud) {
      void cloudSetDoc('customTasks', newTask);
      void cloudSetDoc('transactions', tskTx);
    }
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

    if (isCloudAdmin) {
      void cloudUpdateUser(userId, { accountStatus: 'awaiting_payment' });
    }
  };

  const handleActivateUserWithBonus = (userId: string) => {
    const targetUser = store.users.find((u) => u.id === userId);
    if (!targetUser) return;

    const bonus = store.settings.welcomeBonusRwf;
    const referrerId = targetUser.referredByUserId;
    const referrer = referrerId ? store.users.find((u) => u.id === referrerId) : undefined;
    const referralCommRwf = Math.round(
      (store.settings.activationFeeRwf * store.settings.referralCommissionPercent) / 100,
    );
    const nowIso = new Date().toISOString();

    const extraTx: TransactionRecord[] = [
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
        timestamp: nowIso,
      },
    ];

    if (referrer) {
      extraTx.push({
        id: `tx-ref-${Date.now()}`,
        userId: referrer.id,
        reference: generateReference('REF'),
        title: `Referral Bonus +1 Spin (${targetUser.firstName} activated)`,
        category: 'Referral Commission',
        channel: `${store.settings.referralCommissionPercent}% Activation Commission`,
        amountRwf: referralCommRwf,
        direction: 'credit',
        status: 'Completed',
        timestamp: nowIso,
      });
    }

    const pendingActTxIds = store.transactions
      .filter((t) => t.userId === userId && t.category === 'Activation' && t.status === 'Pending Review')
      .map((t) => t.id);

    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            accountStatus: 'active',
            walletBalanceRwf: u.walletBalanceRwf + bonus,
            bonusBalanceRwf: u.bonusBalanceRwf + bonus,
          };
        }
        if (referrer && u.id === referrer.id) {
          return {
            ...u,
            spinCredits: u.spinCredits + 1,
            walletBalanceRwf: u.walletBalanceRwf + referralCommRwf,
          };
        }
        return u;
      }),
      transactions: [
        ...extraTx,
        ...prev.transactions.map((t) =>
          pendingActTxIds.includes(t.id) ? { ...t, status: 'Completed' as const } : t,
        ),
      ],
    }));

    if (isCloudAdmin) {
      void cloudUpdateUser(userId, {
        accountStatus: 'active',
        walletBalanceRwf: targetUser.walletBalanceRwf + bonus,
        bonusBalanceRwf: targetUser.bonusBalanceRwf + bonus,
      });
      if (referrer) {
        void cloudUpdateUser(referrer.id, {
          spinCredits: referrer.spinCredits + 1,
          walletBalanceRwf: referrer.walletBalanceRwf + referralCommRwf,
        });
      }
      extraTx.forEach((tx) => void cloudSetDoc('transactions', tx));
      pendingActTxIds.forEach((txId) =>
        void cloudUpdateDoc('transactions', txId, { status: 'Completed' }),
      );
    }
  };

  const handleToggleSuspendUser = (userId: string) => {
    const target = store.users.find((u) => u.id === userId);
    if (!target) return;
    const nextStatus = target.accountStatus === 'suspended' ? 'active' : 'suspended';

    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === userId ? { ...u, accountStatus: nextStatus } : u)),
    }));

    if (isCloudAdmin) {
      void cloudUpdateUser(userId, { accountStatus: nextStatus });
    }
  };

  const handleAdminUpdateUser = (updated: RegisteredUser) => {
    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === updated.id ? updated : u)),
    }));

    if (isCloudAdmin) {
      void cloudUpdateUser(updated.id, updated);
    }
  };

  const handleReviewKyc = (userId: string, decision: 'approved' | 'rejected', note?: string) => {
    const target = store.users.find((u) => u.id === userId);
    if (!target) return;
    const nextKycData = target.kycData
      ? {
          ...target.kycData,
          ...(note?.trim() ? { reviewNote: note.trim() } : {}),
        }
      : undefined;

    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId ? { ...u, kycStatus: decision, kycData: nextKycData } : u,
      ),
    }));

    if (isCloudAdmin) {
      void cloudUpdateUser(userId, {
        kycStatus: decision,
        ...(nextKycData ? { kycData: nextKycData } : {}),
      });
    }
  };

  const handleReviewVideoCampaign = (campaignId: string, decision: 'active' | 'rejected') => {
    setStore((prev) => ({
      ...prev,
      videoCampaigns: prev.videoCampaigns.map((c) =>
        c.id === campaignId ? { ...c, status: decision } : c,
      ),
    }));

    if (isCloudAdmin) {
      void cloudUpdateDoc('videoCampaigns', campaignId, {
        status: decision,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleReviewCustomTask = (taskId: string, decision: 'active' | 'rejected') => {
    setStore((prev) => ({
      ...prev,
      customTasks: prev.customTasks.map((t) => (t.id === taskId ? { ...t, status: decision } : t)),
    }));

    if (isCloudAdmin) {
      void cloudUpdateDoc('customTasks', taskId, {
        status: decision,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleReviewTaskSubmission = (
    submissionId: string,
    decision: 'approved' | 'rejected',
    note?: string,
  ) => {
    const sub = store.taskSubmissions.find((s) => s.id === submissionId);
    if (!sub || sub.status !== 'pending_admin') return;

    const nowIso = new Date().toISOString();
    const worker = decision === 'approved' ? store.users.find((u) => u.id === sub.workerId) : undefined;
    const parentTask =
      decision === 'approved' ? store.customTasks.find((t) => t.id === sub.taskId) : undefined;
    const approvedList =
      parentTask && decision === 'approved'
        ? parentTask.approvedWorkerIds.includes(sub.workerId)
          ? parentTask.approvedWorkerIds
          : [...parentTask.approvedWorkerIds, sub.workerId]
        : [];
    const nextTaskStatus =
      parentTask && approvedList.length >= parentTask.targetCompletions ? 'completed' : parentTask?.status;

    const rewardTx: TransactionRecord | null =
      decision === 'approved'
        ? {
            id: `tx-${Date.now()}`,
            userId: sub.workerId,
            reference: generateReference('TSK'),
            title: `Task Approved: ${sub.taskTitle}`,
            category: 'Task Reward',
            channel: 'Admin Verified Completion',
            amountRwf: sub.rewardRwf,
            direction: 'credit',
            status: 'Completed',
            timestamp: nowIso,
          }
        : null;

    setStore((prev) => ({
      ...prev,
      users:
        decision === 'approved'
          ? prev.users.map((u) =>
              u.id === sub.workerId
                ? { ...u, walletBalanceRwf: u.walletBalanceRwf + sub.rewardRwf }
                : u,
            )
          : prev.users,
      customTasks:
        decision === 'approved' && parentTask
          ? prev.customTasks.map((t) =>
              t.id === parentTask.id
                ? {
                    ...t,
                    approvedWorkerIds: approvedList,
                    status: nextTaskStatus ?? t.status,
                  }
                : t,
            )
          : prev.customTasks,
      taskSubmissions: prev.taskSubmissions.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              status: decision,
              adminNote: note?.trim() || undefined,
              reviewedAt: nowIso,
            }
          : s,
      ),
      transactions: rewardTx ? [rewardTx, ...prev.transactions] : prev.transactions,
    }));

    if (isCloudAdmin) {
      void cloudUpdateDoc('taskSubmissions', submissionId, {
        status: decision,
        ...(note?.trim() ? { adminNote: note.trim() } : {}),
        reviewedAt: nowIso,
      });
      if (decision === 'approved') {
        if (worker) {
          void cloudUpdateUser(worker.id, {
            walletBalanceRwf: worker.walletBalanceRwf + sub.rewardRwf,
          });
        }
        if (parentTask) {
          void cloudUpdateDoc('customTasks', parentTask.id, {
            approvedWorkerIds: approvedList,
            status: nextTaskStatus ?? parentTask.status,
            updatedAt: nowIso,
          });
        }
        if (rewardTx) {
          void cloudSetDoc('transactions', rewardTx);
        }
      }
    }
  };

  const handleReviewLoan = (loanId: string, decision: 'approved' | 'rejected') => {
    const loan = store.loans.find((l) => l.id === loanId);
    if (!loan || loan.status !== 'pending_admin') return;

    const borrower = decision === 'approved' ? store.users.find((u) => u.id === loan.userId) : undefined;
    const pendingTxIds = store.transactions
      .filter(
        (t) =>
          t.userId === loan.userId &&
          t.category === 'Loan' &&
          t.status === 'Pending Review' &&
          t.amountRwf === loan.principalRwf,
      )
      .map((t) => t.id);

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
        pendingTxIds.includes(t.id)
          ? { ...t, status: decision === 'approved' ? 'Completed' : 'Rejected' }
          : t,
      ),
    }));

    if (isCloudAdmin) {
      void cloudUpdateDoc('loans', loanId, {
        status: decision,
        updatedAt: new Date().toISOString(),
      });
      if (borrower && decision === 'approved') {
        void cloudUpdateUser(borrower.id, {
          walletBalanceRwf: borrower.walletBalanceRwf + loan.principalRwf,
        });
      }
      pendingTxIds.forEach((txId) =>
        void cloudUpdateDoc('transactions', txId, {
          status: decision === 'approved' ? 'Completed' : 'Rejected',
        }),
      );
    }
  };

  const handleReviewInvestment = (investmentId: string, decision: 'active' | 'rejected') => {
    const inv = store.investments.find((i) => i.id === investmentId);
    if (!inv || inv.status !== 'pending_admin') return;

    const nowIso = new Date().toISOString();
    const investor = store.users.find((u) => u.id === inv.userId);
    const referrer =
      decision === 'active' && investor?.referredByUserId
        ? store.users.find((u) => u.id === investor.referredByUserId)
        : undefined;
    const commRwf = referrer
      ? Math.round((inv.depositRwf * store.settings.referralCommissionPercent) / 100)
      : 0;

    const refTx: TransactionRecord | null =
      referrer && commRwf > 0
        ? {
            id: `tx-refinv-${Date.now()}`,
            userId: referrer.id,
            reference: generateReference('REF'),
            title: `10% Investment Commission (${inv.userName})`,
            category: 'Referral Commission',
            channel: `${inv.planName} Referral Commission`,
            amountRwf: commRwf,
            direction: 'credit',
            status: 'Completed',
            timestamp: nowIso,
          }
        : null;

    const pendingInvTxIds = store.transactions
      .filter(
        (t) =>
          t.userId === inv.userId &&
          t.category === 'Investment Deposit' &&
          t.status === 'Pending Review' &&
          t.amountRwf === inv.depositRwf,
      )
      .map((t) => t.id);

    setStore((prev) => {
      const updatedTransactions = prev.transactions.map((t) =>
        pendingInvTxIds.includes(t.id)
          ? { ...t, status: decision === 'active' ? ('Completed' as const) : ('Rejected' as const) }
          : t,
      );
      if (refTx) updatedTransactions.unshift(refTx);

      return {
        ...prev,
        users:
          referrer && commRwf > 0
            ? prev.users.map((u) =>
                u.id === referrer.id ? { ...u, walletBalanceRwf: u.walletBalanceRwf + commRwf } : u,
              )
            : prev.users,
        investments: prev.investments.map((i) =>
          i.id === investmentId
            ? {
                ...i,
                status: decision,
                lastRoiCreditedAt: decision === 'active' ? nowIso : null,
              }
            : i,
        ),
        transactions: updatedTransactions,
      };
    });

    if (isCloudAdmin) {
      void cloudUpdateDoc('investments', investmentId, {
        status: decision,
        lastRoiCreditedAt: decision === 'active' ? nowIso : null,
        updatedAt: nowIso,
      });
      if (referrer && commRwf > 0) {
        void cloudUpdateUser(referrer.id, {
          walletBalanceRwf: referrer.walletBalanceRwf + commRwf,
        });
      }
      if (refTx) {
        void cloudSetDoc('transactions', refTx);
      }
      pendingInvTxIds.forEach((txId) =>
        void cloudUpdateDoc('transactions', txId, {
          status: decision === 'active' ? 'Completed' : 'Rejected',
        }),
      );
    }
  };

  const handleReviewWithdrawal = (withdrawalId: string, decision: 'paid' | 'rejected') => {
    const wd = store.withdrawals.find((w) => w.id === withdrawalId);
    if (!wd || wd.status !== 'pending_admin') return;

    const targetUser = store.users.find((u) => u.id === wd.userId);
    const pendingWdTxIds = store.transactions
      .filter(
        (t) =>
          t.userId === wd.userId &&
          t.category === 'Withdrawal' &&
          t.status === 'Pending Review' &&
          t.amountRwf === wd.grossAmountRwf,
      )
      .map((t) => t.id);

    setStore((prev) => ({
      ...prev,
      users: prev.users.map((u) => {
        if (u.id !== wd.userId) return u;
        if (decision === 'rejected') {
          return { ...u, walletBalanceRwf: u.walletBalanceRwf + wd.grossAmountRwf };
        }
        return { ...u, hasCompletedFirstWithdrawal: true };
      }),
      withdrawals: prev.withdrawals.map((w) =>
        w.id === withdrawalId ? { ...w, status: decision } : w,
      ),
      transactions: prev.transactions.map((t) =>
        pendingWdTxIds.includes(t.id)
          ? { ...t, status: decision === 'paid' ? 'Completed' : 'Rejected' }
          : t,
      ),
    }));

    if (isCloudAdmin) {
      void cloudUpdateDoc('withdrawals', withdrawalId, {
        status: decision,
        updatedAt: new Date().toISOString(),
      });
      if (targetUser) {
        if (decision === 'rejected') {
          void cloudUpdateUser(targetUser.id, {
            walletBalanceRwf: targetUser.walletBalanceRwf + wd.grossAmountRwf,
          });
        } else {
          void cloudUpdateUser(targetUser.id, {
            hasCompletedFirstWithdrawal: true,
          });
        }
      }
      pendingWdTxIds.forEach((txId) =>
        void cloudUpdateDoc('transactions', txId, {
          status: decision === 'paid' ? 'Completed' : 'Rejected',
        }),
      );
    }
  };

  const handleAddPromotion = (title: string, category: string, summary: string) => {
    const newPromo = {
      id: `promo-${Date.now()}`,
      title,
      category,
      summary,
      active: true,
      createdAt: new Date().toISOString(),
    };

    setStore((prev) => ({
      ...prev,
      promotions: [newPromo, ...prev.promotions],
    }));

    if (isCloudAdmin) {
      void cloudSetDoc('promotions', newPromo);
    }
  };

  const handleTogglePromotion = (promoId: string) => {
    const existing = store.promotions.find((p) => p.id === promoId);
    if (!existing) return;

    setStore((prev) => ({
      ...prev,
      promotions: prev.promotions.map((p) =>
        p.id === promoId ? { ...p, active: !p.active } : p,
      ),
    }));

    if (isCloudAdmin) {
      void cloudUpdateDoc('promotions', promoId, { active: !existing.active });
    }
  };

  const handleDeletePromotion = (promoId: string) => {
    setStore((prev) => ({
      ...prev,
      promotions: prev.promotions.filter((p) => p.id !== promoId),
    }));

    if (isCloudAdmin) {
      void cloudDeleteDoc('promotions', promoId);
    }
  };

  const handleUpdateSettings = (next: SystemSettings) => {
    setStore((prev) => ({
      ...prev,
      settings: next,
    }));

    if (isCloudAdmin) {
      void cloudSaveSettings(next);
    }
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
          promotions={store.promotions}
          settings={store.settings}
          onApproveUserRegistration={handleApproveUserRegistration}
          onActivateUserWithBonus={handleActivateUserWithBonus}
          onToggleSuspendUser={handleToggleSuspendUser}
          onAdminUpdateUser={handleAdminUpdateUser}
          onReviewKyc={handleReviewKyc}
          onReviewVideoCampaign={handleReviewVideoCampaign}
          onReviewCustomTask={handleReviewCustomTask}
          onReviewTaskSubmission={handleReviewTaskSubmission}
          onReviewLoan={handleReviewLoan}
          onReviewInvestment={handleReviewInvestment}
          onReviewWithdrawal={handleReviewWithdrawal}
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
            <h1 className="font-display text-2xl font-bold text-[#071B38]">Scheduled System Maintenance</h1>
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
              onSwitchToRegister={() => setLoginOpen(false)}
            />
          </div>
        </div>
      );
    }

    if (store.session.type === 'user' && currentUser) {
      const referredUsersCount = store.users.filter(
        (u) => u.referredByUserId === currentUser.id && u.accountStatus === 'active',
      ).length;

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
          totalActiveVideos={store.videoCampaigns.filter((v) => v.status === 'active').length}
          totalActiveTasks={store.customTasks.filter((t) => t.status === 'active').length}
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

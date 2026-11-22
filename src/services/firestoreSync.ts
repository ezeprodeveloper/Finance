import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  isAdminCloudEmail,
  OperationType,
} from '../firebase';
import {
  AdminPromotion,
  CustomTask,
  LoanRequest,
  PlatformStoreState,
  RegisteredUser,
  SavingsGoal,
  ShortVideoCampaign,
  SpinHistoryRecord,
  SystemSettings,
  TaskSubmission,
  TransactionRecord,
  UserInvestment,
  WithdrawalRequest,
} from '../types/finance';
import { hashPassword } from '../utils/formatters';

function tsToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  return new Date().toISOString();
}

function cleanUserPayload(
  user: RegisteredUser,
  ownerUid: string,
  includeCreatedTimestamp: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: user.id,
    ownerUid: user.ownerUid || ownerUid,
    accountNumber: user.accountNumber,
    firstName: user.firstName,
    secondName: user.secondName,
    email: user.email,
    phone: user.phone,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth,
    idNumber: user.idNumber,
    photoDataUrl: user.photoDataUrl,
    education: user.education,
    residence: user.residence,
    passwordHash: user.passwordHash,
    referralCode: user.referralCode,
    referredByUserId: user.referredByUserId ?? null,
    spinCredits: Math.max(0, Math.round(user.spinCredits)),
    hasCompletedFirstWithdrawal: Boolean(user.hasCompletedFirstWithdrawal),
    accountStatus: user.accountStatus,
    activationPaidPhone: user.activationPaidPhone ?? null,
    activationPaymentRef: user.activationPaymentRef ?? null,
    walletBalanceRwf: Number(user.walletBalanceRwf) || 0,
    bonusBalanceRwf: Number(user.bonusBalanceRwf) || 0,
    savingsBalanceRwf: Number(user.savingsBalanceRwf) || 0,
    kycStatus: user.kycStatus,
    kycData: user.kycData ?? null,
    lastCheckInAt: user.lastCheckInAt ?? null,
    checkInStreak: Math.max(0, Math.round(user.checkInStreak)),
    updatedAt: serverTimestamp(),
  };

  if (includeCreatedTimestamp) {
    payload.createdAt = serverTimestamp();
  }
  return payload;
}

export async function syncRegisterUserToFirestore(
  user: RegisteredUser,
  ownerUid: string,
): Promise<void> {
  try {
    const payload = cleanUserPayload(user, ownerUid, true);
    await setDoc(doc(db, 'users', user.id), payload);

    const emailHash = await hashPassword(`email:${user.email.trim().toLowerCase()}`);
    const phoneHash = await hashPassword(`phone:${user.phone.replace(/[\s-]+/g, '')}`);
    const idHash = await hashPassword(`id:${user.idNumber.replace(/\s+/g, '')}`);

    await Promise.all([
      setDoc(doc(db, 'uniqueKeys', emailHash), {
        ownerUid,
        keyType: 'email',
        createdAt: serverTimestamp(),
      }),
      setDoc(doc(db, 'uniqueKeys', phoneHash), {
        ownerUid,
        keyType: 'phone',
        createdAt: serverTimestamp(),
      }),
      setDoc(doc(db, 'uniqueKeys', idHash), {
        ownerUid,
        keyType: 'idNumber',
        createdAt: serverTimestamp(),
      }),
      setDoc(doc(db, 'referralCodes', user.referralCode.toUpperCase()), {
        ownerUserId: user.id,
        ownerUid,
        referralCode: user.referralCode.toUpperCase(),
        createdAt: serverTimestamp(),
      }),
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${user.id}`);
  }
}

export async function lookupReferralOwnerInFirestore(
  code: string,
): Promise<string | undefined> {
  const clean = code.trim().toUpperCase();
  if (!clean) return undefined;
  try {
    const snap = await getDoc(doc(db, 'referralCodes', clean));
    if (snap.exists()) {
      const data = snap.data();
      return typeof data.ownerUserId === 'string' ? data.ownerUserId : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function syncUserUpdateToFirestore(
  userId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }
}

export async function syncAdminFullUserToFirestore(
  user: RegisteredUser,
  fallbackOwnerUid: string,
): Promise<void> {
  try {
    const payload = cleanUserPayload(user, fallbackOwnerUid, false);
    await updateDoc(doc(db, 'users', user.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
  }
}

export async function syncCreateSavingsGoal(
  goal: SavingsGoal,
  ownerUid: string,
): Promise<void> {
  try {
    await setDoc(doc(db, 'savingsGoals', goal.id), {
      id: goal.id,
      userId: goal.userId,
      ownerUid: goal.ownerUid || ownerUid,
      title: goal.title,
      planType: goal.planType,
      targetRwf: goal.targetRwf,
      currentRwf: goal.currentRwf,
      targetDate: goal.targetDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `savingsGoals/${goal.id}`);
  }
}

export async function syncUpdateSavingsGoal(
  goalId: string,
  currentRwf: number,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'savingsGoals', goalId), {
      currentRwf,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `savingsGoals/${goalId}`);
  }
}

export async function syncCreateLoan(
  loan: LoanRequest,
  ownerUid: string,
): Promise<void> {
  try {
    await setDoc(doc(db, 'loans', loan.id), {
      id: loan.id,
      userId: loan.userId,
      ownerUid: loan.ownerUid || ownerUid,
      userName: loan.userName,
      product: loan.product,
      reason: loan.reason,
      principalRwf: loan.principalRwf,
      termMonths: Math.round(loan.termMonths),
      annualRatePercent: loan.annualRatePercent,
      monthlyPaymentRwf: loan.monthlyPaymentRwf,
      totalRepayableRwf: loan.totalRepayableRwf,
      repaidRwf: loan.repaidRwf,
      status: loan.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `loans/${loan.id}`);
  }
}

export async function syncUpdateLoan(
  loanId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'loans', loanId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `loans/${loanId}`);
  }
}

export async function syncCreateInvestment(
  inv: UserInvestment,
  ownerUid: string,
): Promise<void> {
  try {
    await setDoc(doc(db, 'investments', inv.id), {
      id: inv.id,
      userId: inv.userId,
      ownerUid: inv.ownerUid || ownerUid,
      userName: inv.userName,
      tierId: inv.tierId,
      planName: inv.planName,
      depositRwf: inv.depositRwf,
      dailyReturnRwf: inv.dailyReturnRwf,
      paymentCode: inv.paymentCode,
      paymentRef: inv.paymentRef,
      status: inv.status,
      totalEarnedRwf: inv.totalEarnedRwf,
      lastRoiCreditedAt: inv.lastRoiCreditedAt ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `investments/${inv.id}`);
  }
}

export async function syncUpdateInvestment(
  investmentId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'investments', investmentId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `investments/${investmentId}`);
  }
}

export async function syncCreateSpinRecord(
  spin: SpinHistoryRecord,
  ownerUid: string,
): Promise<void> {
  try {
    await setDoc(doc(db, 'spinHistory', spin.id), {
      id: spin.id,
      userId: spin.userId,
      ownerUid: spin.ownerUid || ownerUid,
      rewardRwf: spin.rewardRwf,
      spunAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `spinHistory/${spin.id}`);
  }
}

export async function syncCreateWithdrawal(
  wd: WithdrawalRequest,
  ownerUid: string,
): Promise<void> {
  try {
    await setDoc(doc(db, 'withdrawals', wd.id), {
      id: wd.id,
      userId: wd.userId,
      ownerUid: wd.ownerUid || ownerUid,
      userName: wd.userName,
      network: wd.network,
      destinationType: wd.destinationType,
      destinationValue: wd.destinationValue,
      accountRegisteredNames: wd.accountRegisteredNames,
      amountRwf: wd.grossAmountRwf,
      feePercent: wd.feePercent,
      feeRwf: wd.feeRwf,
      netAmountRwf: wd.netAmountRwf,
      isFirstBonusWithdrawal: Boolean(wd.isFirstBonusWithdrawal),
      status: wd.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `withdrawals/${wd.id}`);
  }
}

export async function syncUpdateWithdrawal(
  withdrawalId: string,
  status: WithdrawalRequest['status'],
): Promise<void> {
  try {
    await updateDoc(doc(db, 'withdrawals', withdrawalId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `withdrawals/${withdrawalId}`);
  }
}

export async function syncCreateVideoCampaign(
  camp: ShortVideoCampaign,
  ownerUid: string,
): Promise<void> {
  if (camp.videoUrl.length > 440000) {
    console.warn('Video data URL exceeds Firestore document limit; keeping local copy.');
    return;
  }
  try {
    await setDoc(doc(db, 'videoCampaigns', camp.id), {
      id: camp.id,
      creatorId: camp.creatorId,
      ownerUid: camp.ownerUid || ownerUid,
      creatorName: camp.creatorName,
      title: camp.title,
      description: camp.description,
      videoUrl: camp.videoUrl,
      rewardPerViewRwf: camp.rewardPerViewRwf,
      targetViewers: Math.round(camp.targetViewers),
      totalBudgetRwf: camp.totalBudgetRwf,
      paymentCode: camp.paymentCode,
      paymentRef: camp.paymentRef,
      watchedByUserIds: camp.watchedByUserIds,
      status: camp.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `videoCampaigns/${camp.id}`);
  }
}

export async function syncUpdateVideoCampaign(
  campaignId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'videoCampaigns', campaignId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `videoCampaigns/${campaignId}`);
  }
}

export async function syncCreateCustomTask(
  task: CustomTask,
  ownerUid: string,
): Promise<void> {
  try {
    await setDoc(doc(db, 'customTasks', task.id), {
      id: task.id,
      creatorId: task.creatorId,
      ownerUid: task.ownerUid || ownerUid,
      creatorName: task.creatorName,
      title: task.title,
      requirements: task.requirements,
      rewardPerCompletionRwf: task.rewardPerCompletionRwf,
      targetCompletions: Math.round(task.targetCompletions),
      totalBudgetRwf: task.totalBudgetRwf,
      paymentCode: task.paymentCode,
      paymentRef: task.paymentRef,
      approvedWorkerIds: task.approvedWorkerIds,
      status: task.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `customTasks/${task.id}`);
  }
}

export async function syncUpdateCustomTask(
  taskId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'customTasks', taskId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `customTasks/${taskId}`);
  }
}

export async function syncCreateTaskSubmission(
  sub: TaskSubmission,
  ownerUid: string,
): Promise<void> {
  try {
    await setDoc(doc(db, 'taskSubmissions', sub.id), {
      id: sub.id,
      taskId: sub.taskId,
      taskTitle: sub.taskTitle,
      workerId: sub.workerId,
      ownerUid: sub.ownerUid || ownerUid,
      workerName: sub.workerName,
      proofText: sub.proofText,
      proofUrl: sub.proofUrl ?? null,
      rewardRwf: sub.rewardRwf,
      status: sub.status,
      adminNote: sub.adminNote ?? null,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `taskSubmissions/${sub.id}`);
  }
}

export async function syncUpdateTaskSubmission(
  submissionId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'taskSubmissions', submissionId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `taskSubmissions/${submissionId}`);
  }
}

export async function syncCreateTransaction(
  tx: TransactionRecord,
  ownerUid: string,
): Promise<void> {
  try {
    await setDoc(doc(db, 'transactions', tx.id), {
      id: tx.id,
      userId: tx.userId,
      ownerUid: tx.ownerUid || ownerUid,
      reference: tx.reference,
      title: tx.title,
      category: tx.category,
      channel: tx.channel,
      amountRwf: tx.amountRwf,
      feeRwf: tx.feeRwf ?? null,
      direction: tx.direction,
      status: tx.status,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `transactions/${tx.id}`);
  }
}

export async function syncUpdateTransactionStatus(
  txId: string,
  status: TransactionRecord['status'],
): Promise<void> {
  try {
    await updateDoc(doc(db, 'transactions', txId), { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `transactions/${txId}`);
  }
}

export async function syncPromotion(
  promo: AdminPromotion,
  isCreate: boolean,
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      id: promo.id,
      title: promo.title,
      category: promo.category,
      summary: promo.summary,
      active: promo.active,
      updatedAt: serverTimestamp(),
    };
    if (isCreate) {
      payload.createdAt = serverTimestamp();
      await setDoc(doc(db, 'promotions', promo.id), payload);
    } else {
      await updateDoc(doc(db, 'promotions', promo.id), payload);
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isCreate ? OperationType.CREATE : OperationType.UPDATE,
      `promotions/${promo.id}`,
    );
  }
}

export async function syncDeletePromotion(promoId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'promotions', promoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `promotions/${promoId}`);
  }
}

export async function syncSystemSettings(settings: SystemSettings): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'platform'), {
      ...settings,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/platform');
  }
}

export async function flushLocalUsersToCloud(
  localUsers: RegisteredUser[],
  firebaseUser: User,
): Promise<string[]> {
  if (!firebaseUser.emailVerified) return [];
  const uploadedIds: string[] = [];
  for (const user of localUsers) {
    if (!user.ownerUid) {
      try {
        const existingSnap = await getDoc(doc(db, 'users', user.id));
        if (!existingSnap.exists()) {
          await syncRegisterUserToFirestore(
            { ...user, ownerUid: firebaseUser.uid },
            firebaseUser.uid,
          );
          uploadedIds.push(user.id);
        }
      } catch {
        // Skip silently if permission/duplicate check prevents overwrite
      }
    }
  }
  return uploadedIds;
}

export function subscribePublicData(
  onPatch: (patch: Partial<PlatformStoreState>) => void,
): Unsubscribe {
  const promoQuery = query(collection(db, 'promotions'), where('active', '==', true));
  const unsubPromos = onSnapshot(
    promoQuery,
    (snap) => {
      if (snap.empty) return;
      const promos: AdminPromotion[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          title: String(data.title || ''),
          category: String(data.category || ''),
          summary: String(data.summary || ''),
          active: Boolean(data.active),
          createdAt: tsToIso(data.createdAt),
        };
      });
      onPatch({ promotions: promos });
    },
    () => {
      // Ignore public read failure if rules require reload
    },
  );

  const unsubSettings = onSnapshot(
    doc(db, 'settings', 'platform'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      onPatch({
        settings: {
          activationFeeRwf: Number(data.activationFeeRwf ?? 200),
          welcomeBonusRwf: Number(data.welcomeBonusRwf ?? 200),
          dailyCheckInRwf: Number(data.dailyCheckInRwf ?? 20),
          withdrawalFeePercent: Number(data.withdrawalFeePercent ?? 25),
          subsequentMinWithdrawalRwf: Number(data.subsequentMinWithdrawalRwf ?? 1000),
          subsequentMaxWithdrawalRwf: Number(data.subsequentMaxWithdrawalRwf ?? 5000),
          referralCommissionPercent: Number(data.referralCommissionPercent ?? 10),
          minVideoRewardRwf: Number(data.minVideoRewardRwf ?? 50),
          momoPayCode: String(data.momoPayCode ?? '1880554'),
          platformTagline: String(data.platformTagline ?? ''),
          maintenanceMode: Boolean(data.maintenanceMode),
        },
      });
    },
    () => {
      // Ignore optional public settings read error
    },
  );

  return () => {
    unsubPromos();
    unsubSettings();
  };
}

export function subscribeAuthenticatedData(
  firebaseUser: User,
  onPatch: (patch: Partial<PlatformStoreState>) => void,
): Unsubscribe {
  const uid = firebaseUser.uid;
  const adminMode = isAdminCloudEmail(firebaseUser.email) && firebaseUser.emailVerified;
  const unsubs: Unsubscribe[] = [];

  const usersQ = adminMode
    ? query(collection(db, 'users'))
    : query(collection(db, 'users'), where('ownerUid', '==', uid));
  unsubs.push(
    onSnapshot(
      usersQ,
      (snap) => {
        const users: RegisteredUser[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            ownerUid: String(data.ownerUid || ''),
            firstName: String(data.firstName || ''),
            secondName: String(data.secondName || ''),
            email: String(data.email || ''),
            phone: String(data.phone || ''),
            gender: (data.gender as RegisteredUser['gender']) || 'Male',
            dateOfBirth: String(data.dateOfBirth || ''),
            idNumber: String(data.idNumber || ''),
            photoDataUrl: String(data.photoDataUrl || ''),
            education: data.education as RegisteredUser['education'],
            residence: data.residence as RegisteredUser['residence'],
            passwordHash: String(data.passwordHash || ''),
            accountNumber: String(data.accountNumber || ''),
            referralCode: String(data.referralCode || ''),
            referredByUserId: data.referredByUserId || undefined,
            spinCredits: Number(data.spinCredits ?? 0),
            hasCompletedFirstWithdrawal: Boolean(data.hasCompletedFirstWithdrawal),
            accountStatus: (data.accountStatus as RegisteredUser['accountStatus']) || 'pending_approval',
            activationPaidPhone: data.activationPaidPhone || undefined,
            activationPaymentRef: data.activationPaymentRef || undefined,
            walletBalanceRwf: Number(data.walletBalanceRwf ?? 0),
            bonusBalanceRwf: Number(data.bonusBalanceRwf ?? 0),
            savingsBalanceRwf: Number(data.savingsBalanceRwf ?? 0),
            lastCheckInAt: data.lastCheckInAt || null,
            checkInStreak: Number(data.checkInStreak ?? 0),
            kycStatus: (data.kycStatus as RegisteredUser['kycStatus']) || 'not_submitted',
            kycData: data.kycData || undefined,
            createdAt: tsToIso(data.createdAt),
          };
        });
        onPatch({ users });
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users'),
    ),
  );

  const goalsQ = adminMode
    ? query(collection(db, 'savingsGoals'))
    : query(collection(db, 'savingsGoals'), where('ownerUid', '==', uid));
  unsubs.push(
    onSnapshot(
      goalsQ,
      (snap) => {
        const savingsGoals: SavingsGoal[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            userId: String(data.userId || ''),
            ownerUid: String(data.ownerUid || ''),
            title: String(data.title || ''),
            planType: (data.planType as SavingsGoal['planType']) || 'Flexible',
            targetRwf: Number(data.targetRwf ?? 0),
            currentRwf: Number(data.currentRwf ?? 0),
            targetDate: String(data.targetDate || ''),
            createdAt: tsToIso(data.createdAt),
          };
        });
        onPatch({ savingsGoals });
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'savingsGoals'),
    ),
  );

  const loansQ = adminMode
    ? query(collection(db, 'loans'))
    : query(collection(db, 'loans'), where('ownerUid', '==', uid));
  unsubs.push(
    onSnapshot(
      loansQ,
      (snap) => {
        const loans: LoanRequest[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            userId: String(data.userId || ''),
            ownerUid: String(data.ownerUid || ''),
            userName: String(data.userName || ''),
            product: String(data.product || ''),
            reason: String(data.reason || ''),
            principalRwf: Number(data.principalRwf ?? 0),
            termMonths: Number(data.termMonths ?? 1),
            annualRatePercent: Number(data.annualRatePercent ?? 12),
            monthlyPaymentRwf: Number(data.monthlyPaymentRwf ?? 0),
            totalRepayableRwf: Number(data.totalRepayableRwf ?? 0),
            repaidRwf: Number(data.repaidRwf ?? 0),
            status: (data.status as LoanRequest['status']) || 'pending_admin',
            createdAt: tsToIso(data.createdAt),
          };
        });
        onPatch({ loans });
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'loans'),
    ),
  );

  const invQ = adminMode
    ? query(collection(db, 'investments'))
    : query(collection(db, 'investments'), where('ownerUid', '==', uid));
  unsubs.push(
    onSnapshot(
      invQ,
      (snap) => {
        const investments: UserInvestment[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            userId: String(data.userId || ''),
            ownerUid: String(data.ownerUid || ''),
            userName: String(data.userName || ''),
            tierId: String(data.tierId || ''),
            planName: String(data.planName || ''),
            depositRwf: Number(data.depositRwf ?? 0),
            dailyReturnRwf: Number(data.dailyReturnRwf ?? 0),
            paymentCode: String(data.paymentCode || ''),
            paymentRef: String(data.paymentRef || ''),
            status: (data.status as UserInvestment['status']) || 'pending_admin',
            totalEarnedRwf: Number(data.totalEarnedRwf ?? 0),
            lastRoiCreditedAt: data.lastRoiCreditedAt || null,
            createdAt: tsToIso(data.createdAt),
          };
        });
        onPatch({ investments });
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'investments'),
    ),
  );

  const spinQ = adminMode
    ? query(collection(db, 'spinHistory'))
    : query(collection(db, 'spinHistory'), where('ownerUid', '==', uid));
  unsubs.push(
    onSnapshot(
      spinQ,
      (snap) => {
        const spinHistory: SpinHistoryRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            userId: String(data.userId || ''),
            ownerUid: String(data.ownerUid || ''),
            rewardRwf: Number(data.rewardRwf ?? 0),
            spunAt: tsToIso(data.spunAt),
          };
        });
        onPatch({ spinHistory });
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'spinHistory'),
    ),
  );

  const wdQ = adminMode
    ? query(collection(db, 'withdrawals'))
    : query(collection(db, 'withdrawals'), where('ownerUid', '==', uid));
  unsubs.push(
    onSnapshot(
      wdQ,
      (snap) => {
        const withdrawals: WithdrawalRequest[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            userId: String(data.userId || ''),
            ownerUid: String(data.ownerUid || ''),
            userName: String(data.userName || ''),
            network: (data.network as WithdrawalRequest['network']) || 'MTN Rwanda',
            destinationType: (data.destinationType as WithdrawalRequest['destinationType']) || 'Phone Number',
            destinationValue: String(data.destinationValue || ''),
            accountRegisteredNames: String(data.accountRegisteredNames || ''),
            grossAmountRwf: Number(data.amountRwf ?? 0),
            feePercent: Number(data.feePercent ?? 25),
            feeRwf: Number(data.feeRwf ?? 0),
            netAmountRwf: Number(data.netAmountRwf ?? 0),
            isFirstBonusWithdrawal: Boolean(data.isFirstBonusWithdrawal),
            status: (data.status as WithdrawalRequest['status']) || 'pending_admin',
            createdAt: tsToIso(data.createdAt),
          };
        });
        onPatch({ withdrawals });
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'withdrawals'),
    ),
  );

  const subQ = adminMode
    ? query(collection(db, 'taskSubmissions'))
    : query(collection(db, 'taskSubmissions'), where('ownerUid', '==', uid));
  unsubs.push(
    onSnapshot(
      subQ,
      (snap) => {
        const taskSubmissions: TaskSubmission[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            taskId: String(data.taskId || ''),
            taskTitle: String(data.taskTitle || ''),
            workerId: String(data.workerId || ''),
            ownerUid: String(data.ownerUid || ''),
            workerName: String(data.workerName || ''),
            proofText: String(data.proofText || ''),
            proofUrl: data.proofUrl || undefined,
            rewardRwf: Number(data.rewardRwf ?? 0),
            status: (data.status as TaskSubmission['status']) || 'pending_admin',
            adminNote: data.adminNote || undefined,
            submittedAt: tsToIso(data.submittedAt),
          };
        });
        onPatch({ taskSubmissions });
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'taskSubmissions'),
    ),
  );

  const txQ = adminMode
    ? query(collection(db, 'transactions'))
    : query(collection(db, 'transactions'), where('ownerUid', '==', uid));
  unsubs.push(
    onSnapshot(
      txQ,
      (snap) => {
        const transactions: TransactionRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            userId: String(data.userId || ''),
            ownerUid: String(data.ownerUid || ''),
            reference: String(data.reference || ''),
            title: String(data.title || ''),
            category: data.category as TransactionRecord['category'],
            channel: String(data.channel || ''),
            amountRwf: Number(data.amountRwf ?? 0),
            feeRwf: data.feeRwf != null ? Number(data.feeRwf) : undefined,
            direction: (data.direction as TransactionRecord['direction']) || 'credit',
            status: (data.status as TransactionRecord['status']) || 'Completed',
            timestamp: tsToIso(data.timestamp),
          };
        });
        onPatch({ transactions });
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'),
    ),
  );

  const vidQ = adminMode
    ? query(collection(db, 'videoCampaigns'))
    : query(collection(db, 'videoCampaigns'), where('status', '==', 'active'));
  unsubs.push(
    onSnapshot(
      vidQ,
      (snap) => {
        const videoCampaigns: ShortVideoCampaign[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            creatorId: String(data.creatorId || ''),
            ownerUid: String(data.ownerUid || ''),
            creatorName: String(data.creatorName || ''),
            title: String(data.title || ''),
            description: String(data.description || ''),
            videoUrl: String(data.videoUrl || ''),
            rewardPerViewRwf: Number(data.rewardPerViewRwf ?? 50),
            targetViewers: Number(data.targetViewers ?? 1),
            totalBudgetRwf: Number(data.totalBudgetRwf ?? 50),
            paymentCode: String(data.paymentCode || ''),
            paymentRef: String(data.paymentRef || ''),
            watchedByUserIds: Array.isArray(data.watchedByUserIds) ? data.watchedByUserIds : [],
            status: (data.status as ShortVideoCampaign['status']) || 'pending_admin',
            createdAt: tsToIso(data.createdAt),
          };
        });
        onPatch({ videoCampaigns });
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'videoCampaigns'),
    ),
  );

  const taskQ = adminMode
    ? query(collection(db, 'customTasks'))
    : query(collection(db, 'customTasks'), where('status', '==', 'active'));
  unsubs.push(
    onSnapshot(
      taskQ,
      (snap) => {
        const customTasks: CustomTask[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            creatorId: String(data.creatorId || ''),
            ownerUid: String(data.ownerUid || ''),
            creatorName: String(data.creatorName || ''),
            title: String(data.title || ''),
            requirements: String(data.requirements || ''),
            rewardPerCompletionRwf: Number(data.rewardPerCompletionRwf ?? 20),
            targetCompletions: Number(data.targetCompletions ?? 1),
            totalBudgetRwf: Number(data.totalBudgetRwf ?? 20),
            paymentCode: String(data.paymentCode || ''),
            paymentRef: String(data.paymentRef || ''),
            approvedWorkerIds: Array.isArray(data.approvedWorkerIds) ? data.approvedWorkerIds : [],
            status: (data.status as CustomTask['status']) || 'pending_admin',
            createdAt: tsToIso(data.createdAt),
          };
        });
        onPatch({ customTasks });
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'customTasks'),
    ),
  );

  if (adminMode) {
    unsubs.push(
      onSnapshot(
        query(collection(db, 'promotions')),
        (snap) => {
          const promos: AdminPromotion[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              title: String(data.title || ''),
              category: String(data.category || ''),
              summary: String(data.summary || ''),
              active: Boolean(data.active),
              createdAt: tsToIso(data.createdAt),
            };
          });
          if (promos.length > 0) {
            onPatch({ promotions: promos });
          }
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'promotions'),
      ),
    );
  }

  return () => {
    unsubs.forEach((fn) => fn());
  };
}

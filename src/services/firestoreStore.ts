import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AdminPromotion,
  CustomTask,
  LoanRequest,
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

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = stripUndefined(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
  }
  return result as T;
}

export function sanitizeDocId(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  return clean.length >= 2 ? clean : `id-${Date.now()}`;
}

export async function fetchUserProfileFromCloud(uid: string): Promise<RegisteredUser | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as RegisteredUser;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function cloudCreateUser(user: RegisteredUser): Promise<void> {
  const safeId = sanitizeDocId(user.id);
  const path = `users/${safeId}`;
  const payload = stripUndefined({
    ...user,
    id: safeId,
    photoDataUrl: user.photoDataUrl.slice(0, 449000),
    updatedAt: new Date().toISOString(),
  });
  try {
    await setDoc(doc(db, 'users', safeId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function cloudUpdateUser(userId: string, partial: Partial<RegisteredUser>): Promise<void> {
  const safeId = sanitizeDocId(userId);
  const path = `users/${safeId}`;
  const payload = stripUndefined({
    ...partial,
    ...(partial.photoDataUrl ? { photoDataUrl: partial.photoDataUrl.slice(0, 449000) } : {}),
    updatedAt: new Date().toISOString(),
  });
  try {
    await updateDoc(doc(db, 'users', safeId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function cloudSetDoc<T extends { id: string }>(
  collectionName: string,
  item: T,
): Promise<void> {
  const safeId = sanitizeDocId(item.id);
  const path = `${collectionName}/${safeId}`;
  const payload = stripUndefined({ ...item, id: safeId });
  try {
    await setDoc(doc(db, collectionName, safeId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function cloudUpdateDoc(
  collectionName: string,
  docId: string,
  partial: Record<string, unknown>,
): Promise<void> {
  const safeId = sanitizeDocId(docId);
  const path = `${collectionName}/${safeId}`;
  try {
    await updateDoc(doc(db, collectionName, safeId), stripUndefined(partial));
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function cloudDeleteDoc(collectionName: string, docId: string): Promise<void> {
  const safeId = sanitizeDocId(docId);
  const path = `${collectionName}/${safeId}`;
  try {
    await deleteDoc(doc(db, collectionName, safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function cloudSaveSettings(settings: SystemSettings): Promise<void> {
  const path = 'settings/platform';
  try {
    await setDoc(
      doc(db, 'settings', 'platform'),
      stripUndefined({ ...settings, updatedAt: new Date().toISOString() }),
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribePublicPlatform(
  onSettings: (settings: SystemSettings) => void,
  onPromotions: (promotions: AdminPromotion[]) => void,
  isAdminMode = false,
): Unsubscribe {
  const unsubSettings = onSnapshot(
    doc(db, 'settings', 'platform'),
    (snap) => {
      if (snap.exists()) {
        onSettings(snap.data() as SystemSettings);
      }
    },
    (err) => {
      console.warn('Settings sync notice:', err.message);
    },
  );

  const promoSource = isAdminMode
    ? collection(db, 'promotions')
    : query(collection(db, 'promotions'), where('active', '==', true));

  const unsubPromos = onSnapshot(
    promoSource,
    (snap) => {
      const items = snap.docs
        .map((d) => d.data() as AdminPromotion)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onPromotions(items);
    },
    (err) => {
      console.warn('Promotions sync notice:', err.message);
    },
  );

  return () => {
    unsubSettings();
    unsubPromos();
  };
}

export interface MemberCloudHandlers {
  onUser: (user: RegisteredUser | null) => void;
  onSavingsGoals: (items: SavingsGoal[]) => void;
  onLoans: (items: LoanRequest[]) => void;
  onInvestments: (items: UserInvestment[]) => void;
  onSpins: (items: SpinHistoryRecord[]) => void;
  onWithdrawals: (items: WithdrawalRequest[]) => void;
  onVideoCampaigns: (items: ShortVideoCampaign[]) => void;
  onCustomTasks: (items: CustomTask[]) => void;
  onTaskSubmissions: (items: TaskSubmission[]) => void;
  onTransactions: (items: TransactionRecord[]) => void;
}

export function subscribeMemberCloud(uid: string, handlers: MemberCloudHandlers): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        handlers.onUser(snap.exists() ? (snap.data() as RegisteredUser) : null);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`),
    ),
  );

  const bindUserList = <T extends { createdAt?: string; spunAt?: string; submittedAt?: string; timestamp?: string }>(
    colName: string,
    field: string,
    cb: (items: T[]) => void,
    dateKey: 'createdAt' | 'spunAt' | 'submittedAt' | 'timestamp' = 'createdAt',
  ) => {
    unsubs.push(
      onSnapshot(
        query(collection(db, colName), where(field, '==', uid)),
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as T)
            .sort((a, b) => String(b[dateKey] || '').localeCompare(String(a[dateKey] || '')));
          cb(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, colName),
      ),
    );
  };

  bindUserList<SavingsGoal>('savingsGoals', 'userId', handlers.onSavingsGoals, 'createdAt');
  bindUserList<LoanRequest>('loans', 'userId', handlers.onLoans, 'createdAt');
  bindUserList<UserInvestment>('investments', 'userId', handlers.onInvestments, 'createdAt');
  bindUserList<SpinHistoryRecord>('spinHistory', 'userId', handlers.onSpins, 'spunAt');
  bindUserList<WithdrawalRequest>('withdrawals', 'userId', handlers.onWithdrawals, 'createdAt');
  bindUserList<TaskSubmission>('taskSubmissions', 'workerId', handlers.onTaskSubmissions, 'submittedAt');
  bindUserList<TransactionRecord>('transactions', 'userId', handlers.onTransactions, 'timestamp');

  let activeVideos: ShortVideoCampaign[] = [];
  let myVideos: ShortVideoCampaign[] = [];
  const mergeVideos = () => {
    const map = new Map<string, ShortVideoCampaign>();
    [...activeVideos, ...myVideos].forEach((v) => map.set(v.id, v));
    handlers.onVideoCampaigns(
      Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  };

  unsubs.push(
    onSnapshot(
      query(collection(db, 'videoCampaigns'), where('status', '==', 'active')),
      (snap) => {
        activeVideos = snap.docs.map((d) => d.data() as ShortVideoCampaign);
        mergeVideos();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'videoCampaigns'),
    ),
  );
  unsubs.push(
    onSnapshot(
      query(collection(db, 'videoCampaigns'), where('creatorId', '==', uid)),
      (snap) => {
        myVideos = snap.docs.map((d) => d.data() as ShortVideoCampaign);
        mergeVideos();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'videoCampaigns'),
    ),
  );

  let activeTasks: CustomTask[] = [];
  let myTasks: CustomTask[] = [];
  const mergeTasks = () => {
    const map = new Map<string, CustomTask>();
    [...activeTasks, ...myTasks].forEach((t) => map.set(t.id, t));
    handlers.onCustomTasks(
      Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  };

  unsubs.push(
    onSnapshot(
      query(collection(db, 'customTasks'), where('status', '==', 'active')),
      (snap) => {
        activeTasks = snap.docs.map((d) => d.data() as CustomTask);
        mergeTasks();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'customTasks'),
    ),
  );
  unsubs.push(
    onSnapshot(
      query(collection(db, 'customTasks'), where('creatorId', '==', uid)),
      (snap) => {
        myTasks = snap.docs.map((d) => d.data() as CustomTask);
        mergeTasks();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'customTasks'),
    ),
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}

export interface AdminCloudHandlers {
  onUsers: (items: RegisteredUser[]) => void;
  onSavingsGoals: (items: SavingsGoal[]) => void;
  onLoans: (items: LoanRequest[]) => void;
  onInvestments: (items: UserInvestment[]) => void;
  onSpins: (items: SpinHistoryRecord[]) => void;
  onWithdrawals: (items: WithdrawalRequest[]) => void;
  onVideoCampaigns: (items: ShortVideoCampaign[]) => void;
  onCustomTasks: (items: CustomTask[]) => void;
  onTaskSubmissions: (items: TaskSubmission[]) => void;
  onTransactions: (items: TransactionRecord[]) => void;
}

export function subscribeAdminCloud(handlers: AdminCloudHandlers): Unsubscribe {
  const unsubs: Unsubscribe[] = [];
  const bindAll = <T>(
    colName: string,
    cb: (items: T[]) => void,
    sortField?: keyof T,
  ) => {
    unsubs.push(
      onSnapshot(
        collection(db, colName),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as T);
          if (sortField) {
            list.sort((a, b) => String(b[sortField] || '').localeCompare(String(a[sortField] || '')));
          }
          cb(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, colName),
      ),
    );
  };

  bindAll<RegisteredUser>('users', handlers.onUsers, 'createdAt');
  bindAll<SavingsGoal>('savingsGoals', handlers.onSavingsGoals, 'createdAt');
  bindAll<LoanRequest>('loans', handlers.onLoans, 'createdAt');
  bindAll<UserInvestment>('investments', handlers.onInvestments, 'createdAt');
  bindAll<SpinHistoryRecord>('spinHistory', handlers.onSpins, 'spunAt');
  bindAll<WithdrawalRequest>('withdrawals', handlers.onWithdrawals, 'createdAt');
  bindAll<ShortVideoCampaign>('videoCampaigns', handlers.onVideoCampaigns, 'createdAt');
  bindAll<CustomTask>('customTasks', handlers.onCustomTasks, 'createdAt');
  bindAll<TaskSubmission>('taskSubmissions', handlers.onTaskSubmissions, 'submittedAt');
  bindAll<TransactionRecord>('transactions', handlers.onTransactions, 'timestamp');

  return () => {
    unsubs.forEach((u) => u());
  };
}

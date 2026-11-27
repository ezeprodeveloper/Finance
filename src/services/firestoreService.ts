import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  verifyPasswordResetCode,
  type ActionCodeSettings,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  ADMIN_EMAIL,
  DEFAULT_SYSTEM_SETTINGS,
  INITIAL_PLATFORM_STATE,
  INVESTMENT_PLAN_TIERS,
} from '../data/platformStore';
import {
  auth,
  db,
  ensureAuthPersistence,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../lib/firebase';
import { uploadPersistentDataUrl, uploadPersistentVideo } from './storageService';
import type {
  AdminPromotion,
  AirtimeRequest,
  BetSession,
  CustomTask,
  FxExchangeRecord,
  LoanRequest,
  P2PTransfer,
  PlatformNotification,
  RegisteredUser,
  RwandaKycData,
  SavingsGoal,
  ShortVideoCampaign,
  SpinHistoryRecord,
  SystemSettings,
  TaskSubmission,
  TransactionRecord,
  UsdtRequest,
  UserInvestment,
  VideoWatchSessionRecord,
  WalletAddressRecord,
  WithdrawalRequest,
} from '../types/finance';
import {
  buildMomoPayCode,
  generateAccountNumber,
  generateReference,
  generateReferralCode,
  isValidRwandaId,
  isValidRwandaPhone,
} from '../utils/formatters';

export interface PublicBootstrapData {
  settings: SystemSettings;
  promotions: AdminPromotion[];
  totalActiveVideos: number;
  totalActiveTasks: number;
}

export interface MemberWorkspaceSnapshot {
  user: RegisteredUser | null;
  userDocLoaded: boolean;
  referredUsersCount: number;
  settings: SystemSettings;
  savingsGoals: SavingsGoal[];
  loans: LoanRequest[];
  investments: UserInvestment[];
  spinHistory: SpinHistoryRecord[];
  withdrawals: WithdrawalRequest[];
  videoCampaigns: ShortVideoCampaign[];
  customTasks: CustomTask[];
  taskSubmissions: TaskSubmission[];
  betSessions: BetSession[];
  airtimeRequests: AirtimeRequest[];
  p2pTransfers: P2PTransfer[];
  fxExchanges: FxExchangeRecord[];
  usdtRequests: UsdtRequest[];
  transactions: TransactionRecord[];
  notifications: PlatformNotification[];
  videoWatchSessions: VideoWatchSessionRecord[];
}

export interface AdminWorkspaceSnapshot {
  settings: SystemSettings;
  users: RegisteredUser[];
  savingsGoals: SavingsGoal[];
  loans: LoanRequest[];
  investments: UserInvestment[];
  spinHistory: SpinHistoryRecord[];
  withdrawals: WithdrawalRequest[];
  videoCampaigns: ShortVideoCampaign[];
  customTasks: CustomTask[];
  taskSubmissions: TaskSubmission[];
  betSessions: BetSession[];
  airtimeRequests: AirtimeRequest[];
  p2pTransfers: P2PTransfer[];
  fxExchanges: FxExchangeRecord[];
  usdtRequests: UsdtRequest[];
  transactions: TransactionRecord[];
  promotions: AdminPromotion[];
  notifications: PlatformNotification[];
}

export function generateSafeId(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'doc';
  const rand = Math.random().toString(36).slice(2, 8);
  return `${cleanPrefix}-${Date.now()}-${rand}`;
}

export function normalizePhoneKey(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('250') && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+250${digits.slice(1)}`;
  }
  if (digits.length === 9 && digits.startsWith('7')) {
    return `+250${digits}`;
  }
  return `+${digits}`;
}

function omitUndefined<T extends object>(obj: T): T {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        clean[k] = omitUndefined(v as Record<string, unknown>);
      } else {
        clean[k] = v;
      }
    }
  }
  return clean as T;
}

function sortDesc<T>(items: T[], getDate: (item: T) => string): T[] {
  return [...items].sort((a, b) => (Date.parse(getDate(b)) || 0) - (Date.parse(getDate(a)) || 0));
}

function mergeById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of a) map.set(item.id, item);
  for (const item of b) map.set(item.id, item);
  return Array.from(map.values());
}

export interface MemberProfileDraft {
  firstName: string;
  secondName: string;
  email: string;
  phone: string;
  gender: RegisteredUser['gender'];
  dateOfBirth: string;
  idNumber: string;
  photoDataUrl: string;
  education: RegisteredUser['education'];
  residence: RegisteredUser['residence'];
  referralCodeInput: string;
}

const PENDING_DRAFT_STORAGE_KEY = 'efinance_pending_profile_draft';
let pendingRegistrationUid: string | null = null;
let pendingProfileDraft: MemberProfileDraft | null = null;

function savePendingProfileDraft(draft: MemberProfileDraft | null): void {
  pendingProfileDraft = draft;
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    if (draft) {
      window.sessionStorage.setItem(PENDING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } else {
      window.sessionStorage.removeItem(PENDING_DRAFT_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

function loadPendingProfileDraft(): MemberProfileDraft | null {
  if (pendingProfileDraft) return pendingProfileDraft;
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MemberProfileDraft;
    if (parsed && typeof parsed.email === 'string' && typeof parsed.firstName === 'string') {
      pendingProfileDraft = parsed;
      return parsed;
    }
  } catch {
    // Ignore malformed draft
  }
  return null;
}

function mapFirebaseAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in Firebase Console. Open Firebase Console (e-finance-2026) → Authentication → Sign-in method → enable Email/Password.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Sign in with your password to access or recover your profile.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 8 characters long.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email/phone or password. Please check your credentials.';
    case 'auth/expired-action-code':
      return 'This password reset link has expired. Please request a new password reset email.';
    case 'auth/invalid-action-code':
      return 'This password reset link is invalid or has already been used. Please request a new password reset email.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact E-Finance Rwanda Administration.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network connection interrupted. Please check your internet and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Firebase Auth. Add this domain under Firebase Console → Authentication → Settings → Authorized domains.';
    default:
      return err instanceof Error ? err.message : 'Authentication failed. Please try again.';
  }
}

function getPasswordResetActionCodeSettings(): ActionCodeSettings | undefined {
  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_APP_URL
      ? String(import.meta.env.VITE_PUBLIC_APP_URL).trim()
      : '';
  const browserOrigin =
    typeof window !== 'undefined' && window.location?.origin?.startsWith('http')
      ? window.location.origin
      : '';
  const baseUrl = envUrl.startsWith('http') ? envUrl : browserOrigin;
  if (!baseUrl) return undefined;
  return {
    url: `${baseUrl.replace(/\/+$/, '')}/reset-password`,
    handleCodeInApp: true,
  };
}

function isSafeHttpUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https?:\/\/.+/i.test(trimmed) && trimmed.length <= 2000;
}

function isSafeMediaOrHttpUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 500000) return false;
  return (
    (/^https?:\/\/.+/i.test(trimmed) && trimmed.length <= 2000) ||
    /^data:video\/.+/.test(trimmed) ||
    /^data:image\/.+/.test(trimmed) ||
    /^efinance-video:\/\/[a-zA-Z0-9_-]+$/.test(trimmed)
  );
}

function coerceIsoTimestamp(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    try {
      return ((value as { toDate: () => Date }).toDate()).toISOString();
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/**
 * Pure in-memory read-only normalizer so existing Firestore user documents with
 * legacy, partial, or Timestamp-based fields always render safely in Admin
 * without modifying or overwriting any stored document.
 */
function normalizeUserFromDoc(docId: string, raw: Record<string, unknown>): RegisteredUser {
  const rawEdu =
    typeof raw.education === 'object' && raw.education !== null
      ? (raw.education as Partial<RegisteredUser['education']>)
      : {};
  const rawRes =
    typeof raw.residence === 'object' && raw.residence !== null
      ? (raw.residence as Partial<RegisteredUser['residence']>)
      : {};

  const statusVal = String(raw.accountStatus ?? 'pending_approval');
  const accountStatus: RegisteredUser['accountStatus'] =
    statusVal === 'pending_approval' ||
    statusVal === 'awaiting_payment' ||
    statusVal === 'payment_submitted' ||
    statusVal === 'active' ||
    statusVal === 'suspended'
      ? statusVal
      : 'pending_approval';

  const kycVal = String(raw.kycStatus ?? 'not_submitted');
  const kycStatus: RegisteredUser['kycStatus'] =
    kycVal === 'not_submitted' ||
    kycVal === 'pending' ||
    kycVal === 'approved' ||
    kycVal === 'rejected'
      ? kycVal
      : 'not_submitted';

  const genderVal = String(raw.gender ?? 'Other');
  const gender: RegisteredUser['gender'] =
    genderVal === 'Male' || genderVal === 'Female' || genderVal === 'Other' ? genderVal : 'Other';

  const eduTypeVal = String(rawEdu.type ?? 'University');
  const eduType: RegisteredUser['education']['type'] =
    eduTypeVal === 'A-Level' ? 'A-Level' : 'University';

  return {
    ...(raw as Partial<RegisteredUser>),
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : docId,
    firstName: typeof raw.firstName === 'string' ? raw.firstName : '',
    secondName: typeof raw.secondName === 'string' ? raw.secondName : '',
    email: typeof raw.email === 'string' ? raw.email : '',
    phone: typeof raw.phone === 'string' ? raw.phone : '',
    gender,
    dateOfBirth: typeof raw.dateOfBirth === 'string' ? raw.dateOfBirth : '',
    idNumber: typeof raw.idNumber === 'string' ? raw.idNumber : '',
    photoDataUrl: typeof raw.photoDataUrl === 'string' ? raw.photoDataUrl : '',
    education: {
      type: eduType,
      institutionName: typeof rawEdu.institutionName === 'string' ? rawEdu.institutionName : '',
      levelOrClass: typeof rawEdu.levelOrClass === 'string' ? rawEdu.levelOrClass : '',
      facultyOrCombination:
        typeof rawEdu.facultyOrCombination === 'string' ? rawEdu.facultyOrCombination : '',
    },
    residence: {
      placeOfBirth: typeof rawRes.placeOfBirth === 'string' ? rawRes.placeOfBirth : '',
      province: typeof rawRes.province === 'string' ? rawRes.province : undefined,
      akarere: typeof rawRes.akarere === 'string' ? rawRes.akarere : undefined,
      umurenge: typeof rawRes.umurenge === 'string' ? rawRes.umurenge : undefined,
      akagari: typeof rawRes.akagari === 'string' ? rawRes.akagari : undefined,
      umudugudu: typeof rawRes.umudugudu === 'string' ? rawRes.umudugudu : undefined,
    },
    accountNumber: typeof raw.accountNumber === 'string' ? raw.accountNumber : docId,
    referralCode: typeof raw.referralCode === 'string' ? raw.referralCode : '',
    spinCredits: Number(raw.spinCredits) || 0,
    hasCompletedFirstWithdrawal: Boolean(raw.hasCompletedFirstWithdrawal),
    accountStatus,
    walletBalanceRwf: Number(raw.walletBalanceRwf) || 0,
    bonusBalanceRwf: Number(raw.bonusBalanceRwf) || 0,
    savingsBalanceRwf: Number(raw.savingsBalanceRwf) || 0,
    walletBalanceUsd: Number(raw.walletBalanceUsd) || 0,
    usdtBalance: Number(raw.usdtBalance) || 0,
    usdtSavingsBalance: Number(raw.usdtSavingsBalance) || 0,
    lastCheckInAt: raw.lastCheckInAt ? coerceIsoTimestamp(raw.lastCheckInAt, '') || null : null,
    checkInStreak: Number(raw.checkInStreak) || 0,
    kycStatus,
    createdAt: coerceIsoTimestamp(raw.createdAt, ''),
  };
}

async function getCurrentSettings(): Promise<SystemSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'platform'));
    if (!snap.exists()) return DEFAULT_SYSTEM_SETTINGS;
    return {
      ...DEFAULT_SYSTEM_SETTINGS,
      ...(snap.data() as Partial<SystemSettings>),
    };
  } catch {
    return DEFAULT_SYSTEM_SETTINGS;
  }
}

async function ensureAdminBootstrap(fbUser: FirebaseUser): Promise<void> {
  if (!fbUser.email || fbUser.email.toLowerCase() !== ADMIN_EMAIL || !fbUser.emailVerified) {
    return;
  }
  const nowIso = new Date().toISOString();
  const adminRef = doc(db, 'admins', fbUser.uid);
  const adminSnap = await getDoc(adminRef);
  if (!adminSnap.exists()) {
    await setDoc(adminRef, {
      uid: fbUser.uid,
      email: fbUser.email.toLowerCase(),
      role: 'super_admin',
      createdAt: nowIso,
    });
  }

  const settingsRef = doc(db, 'settings', 'platform');
  const settingsSnap = await getDoc(settingsRef);
  if (!settingsSnap.exists()) {
    await setDoc(settingsRef, {
      ...DEFAULT_SYSTEM_SETTINGS,
      updatedAt: nowIso,
    });
  }

  const statsRef = doc(db, 'publicStats', 'overview');
  const statsSnap = await getDoc(statsRef);
  if (!statsSnap.exists()) {
    await setDoc(statsRef, {
      totalActiveVideos: 0,
      totalActiveTasks: 0,
      updatedAt: nowIso,
    });
  }

  const promosSnap = await getDocs(collection(db, 'promotions'));
  if (promosSnap.empty) {
    const batch = writeBatch(db);
    for (const promo of INITIAL_PLATFORM_STATE.promotions) {
      batch.set(doc(db, 'promotions', promo.id), promo);
    }
    await batch.commit();
  }
}

async function syncPublicStatsCounts(): Promise<void> {
  try {
    const [vidsSnap, tasksSnap] = await Promise.all([
      getDocs(query(collection(db, 'videoCampaigns'), where('status', '==', 'active'))),
      getDocs(query(collection(db, 'customTasks'), where('status', '==', 'active'))),
    ]);
    await setDoc(doc(db, 'publicStats', 'overview'), {
      totalActiveVideos: vidsSnap.size,
      totalActiveTasks: tasksSnap.size,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Non-fatal if caller is non-admin
  }
}

function buildTransactionRecord(params: {
  idPrefix: string;
  userId: string;
  refPrefix: string;
  title: string;
  category: TransactionRecord['category'];
  channel: string;
  amountRwf: number;
  feeRwf?: number;
  direction: 'credit' | 'debit';
  status: TransactionRecord['status'];
  timestamp: string;
}): TransactionRecord {
  return omitUndefined({
    id: generateSafeId(params.idPrefix),
    userId: params.userId,
    reference: generateReference(params.refPrefix),
    title: params.title,
    category: params.category,
    channel: params.channel,
    amountRwf: Math.max(0, Math.round(params.amountRwf)),
    feeRwf: params.feeRwf !== undefined ? Math.max(0, Math.round(params.feeRwf)) : undefined,
    direction: params.direction,
    status: params.status,
    timestamp: params.timestamp,
  });
}

export const firestoreService = {
  testConnection,

  onAuthChanged: (cb: (user: FirebaseUser | null) => void): Unsubscribe => {
    return onAuthStateChanged(auth, cb);
  },

  isRegistrationPending: (uid?: string): boolean => {
    if (!pendingRegistrationUid) return false;
    if (pendingRegistrationUid === '__creating__') return true;
    return uid ? pendingRegistrationUid === uid : true;
  },

  getPendingProfileDraft: (): MemberProfileDraft | null => loadPendingProfileDraft(),

  getMemberProfileByUid: async (uid: string): Promise<RegisteredUser | null> => {
    try {
      const serverSnap = await getDocFromServer(doc(db, 'users', uid));
      return serverSnap.exists()
        ? normalizeUserFromDoc(serverSnap.id, serverSnap.data() as Record<string, unknown>)
        : null;
    } catch {
      const cachedSnap = await getDoc(doc(db, 'users', uid));
      return cachedSnap.exists()
        ? normalizeUserFromDoc(cachedSnap.id, cachedSnap.data() as Record<string, unknown>)
        : null;
    }
  },

  fetchAllUsersFromServer: async (): Promise<RegisteredUser[]> => {
    try {
      const serverSnap = await getDocsFromServer(collection(db, 'users'));
      return sortDesc(
        serverSnap.docs.map((d) => normalizeUserFromDoc(d.id, d.data() as Record<string, unknown>)),
        (u) => u.createdAt,
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
      return [];
    }
  },

  fetchAdminMergedUsers: async (authToken: string): Promise<{
    authLookupAvailable: boolean;
    reason?: string;
    totalAuthUsers?: number;
    authUsers: Array<{
      uid: string;
      authExists: boolean;
      firestoreExists: boolean;
      email: string;
      displayName: string;
      phone: string;
      emailVerified: boolean;
      disabled: boolean;
      authCreatedAt: string;
      lastSignInAt: string;
      profile: RegisteredUser | null;
    }>;
  }> => {
    try {
      const resp = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!resp.ok) {
        return {
          authLookupAvailable: false,
          reason: `Server Auth lookup returned HTTP ${resp.status}.`,
          authUsers: [],
        };
      }
      const data = (await resp.json()) as {
        authLookupAvailable?: boolean;
        reason?: string;
        totalAuthUsers?: number;
        users?: Array<{
          uid: string;
          authExists: boolean;
          firestoreExists: boolean;
          email: string;
          displayName: string;
          phone: string;
          emailVerified: boolean;
          disabled: boolean;
          authCreatedAt: string;
          lastSignInAt: string;
          profile: Record<string, unknown> | null;
        }>;
      };
      if (!data.authLookupAvailable || !Array.isArray(data.users)) {
        return {
          authLookupAvailable: false,
          reason: data.reason,
          authUsers: [],
        };
      }
      return {
        authLookupAvailable: true,
        totalAuthUsers: data.totalAuthUsers,
        authUsers: data.users.map((entry) => ({
          ...entry,
          profile: entry.profile ? normalizeUserFromDoc(entry.uid, entry.profile) : null,
        })),
      };
    } catch {
      return {
        authLookupAvailable: false,
        reason: 'Could not reach server admin user directory.',
        authUsers: [],
      };
    }
  },

  isVerifiedAdminUser: async (fbUser: FirebaseUser | null): Promise<boolean> => {
    if (!fbUser || !fbUser.emailVerified) return false;
    if (fbUser.email?.toLowerCase() === ADMIN_EMAIL) {
      await ensureAdminBootstrap(fbUser).catch(() => {});
      return true;
    }
    try {
      const snap = await getDoc(doc(db, 'admins', fbUser.uid));
      return snap.exists();
    } catch {
      return false;
    }
  },

  fetchPublicBootstrap: async (): Promise<PublicBootstrapData> => {
    const [settings, promoSnap, statsSnap] = await Promise.all([
      getCurrentSettings(),
      getDocs(query(collection(db, 'promotions'), where('active', '==', true))).catch(() => null),
      getDoc(doc(db, 'publicStats', 'overview')).catch(() => null),
    ]);

    const promotions = promoSnap
      ? sortDesc(
          promoSnap.docs.map((d) => d.data() as AdminPromotion),
          (p) => p.createdAt,
        )
      : INITIAL_PLATFORM_STATE.promotions;

    const statsData = statsSnap?.exists()
      ? (statsSnap.data() as { totalActiveVideos?: number; totalActiveTasks?: number })
      : {};

    return {
      settings,
      promotions,
      totalActiveVideos: Number(statsData.totalActiveVideos ?? 0),
      totalActiveTasks: Number(statsData.totalActiveTasks ?? 0),
    };
  },

  subscribePublicBootstrap: (cb: (data: PublicBootstrapData) => void): Unsubscribe => {
    let latestSettings = DEFAULT_SYSTEM_SETTINGS;
    let latestPromos = INITIAL_PLATFORM_STATE.promotions;
    let latestStats = { totalActiveVideos: 0, totalActiveTasks: 0 };

    const emit = () => {
      cb({
        settings: latestSettings,
        promotions: latestPromos,
        totalActiveVideos: latestStats.totalActiveVideos,
        totalActiveTasks: latestStats.totalActiveTasks,
      });
    };

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'platform'),
      (snap) => {
        if (snap.exists()) {
          latestSettings = { ...DEFAULT_SYSTEM_SETTINGS, ...(snap.data() as Partial<SystemSettings>) };
          emit();
        }
      },
      () => {},
    );

    const unsubPromos = onSnapshot(
      query(collection(db, 'promotions'), where('active', '==', true)),
      (snap) => {
        if (!snap.empty) {
          latestPromos = sortDesc(
            snap.docs.map((d) => d.data() as AdminPromotion),
            (p) => p.createdAt,
          );
          emit();
        }
      },
      () => {},
    );

    const unsubStats = onSnapshot(
      doc(db, 'publicStats', 'overview'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as { totalActiveVideos?: number; totalActiveTasks?: number };
          latestStats = {
            totalActiveVideos: Number(d.totalActiveVideos ?? 0),
            totalActiveTasks: Number(d.totalActiveTasks ?? 0),
          };
          emit();
        }
      },
      () => {},
    );

    return () => {
      unsubSettings();
      unsubPromos();
      unsubStats();
    };
  },

  signInWithIdentifier: async (
    identifier: string,
    password: string,
  ): Promise<{ role: 'admin' | 'user'; uid: string; profileExists: boolean }> => {
    const raw = identifier.trim();
    if (!raw || !password) {
      throw new Error('Enter your email or phone number and password.');
    }

    await ensureAuthPersistence();

    let loginEmail = raw.toLowerCase();
    if (!raw.includes('@')) {
      const phoneKey = normalizePhoneKey(raw);
      const phoneSnap = await getDoc(doc(db, 'phoneDirectory', phoneKey));
      if (!phoneSnap.exists()) {
        throw new Error(
          'No phone directory entry matches that number. If you already registered, please sign in using your email address and password.',
        );
      }
      const dir = phoneSnap.data() as { email: string };
      loginEmail = dir.email.toLowerCase();
    }

    let cred;
    try {
      cred = await signInWithEmailAndPassword(auth, loginEmail, password);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (
        loginEmail === ADMIN_EMAIL &&
        (code === 'auth/user-not-found' || code === 'auth/invalid-credential')
      ) {
        const errorWithSetup = new Error(
          'If this is your first deployment, create your Admin Firebase Auth account below (ezeprodeveloper@gmail.com).',
        ) as Error & { needsAdminSetup?: boolean };
        errorWithSetup.needsAdminSetup = true;
        throw errorWithSetup;
      }
      throw new Error(mapFirebaseAuthError(err));
    }

    if (cred.user.email?.toLowerCase() === ADMIN_EMAIL) {
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user).catch(() => {});
        await signOut(auth);
        throw new Error(
          'Admin verification email sent to ezeprodeveloper@gmail.com. Please verify your inbox link before signing in.',
        );
      }
      await ensureAdminBootstrap(cred.user);
      return { role: 'admin', uid: cred.user.uid, profileExists: true };
    }

    const adminSnap = await getDoc(doc(db, 'admins', cred.user.uid)).catch(() => null);
    if (adminSnap?.exists() && cred.user.emailVerified) {
      return { role: 'admin', uid: cred.user.uid, profileExists: true };
    }

    try {
      const userSnap = await getDocFromServer(doc(db, 'users', cred.user.uid));
      if (!userSnap.exists()) {
        // Keep the Firebase Auth session active so AuthContext can safely recover the profile
        return { role: 'user', uid: cred.user.uid, profileExists: false };
      }
      const profile = userSnap.data() as RegisteredUser;
      if (profile.accountStatus === 'suspended') {
        await signOut(auth);
        throw new Error('Your account is currently suspended. Contact E-Finance Rwanda Admin.');
      }
      return { role: 'user', uid: cred.user.uid, profileExists: true };
    } catch (err) {
      if (err instanceof Error && err.message.includes('suspended')) {
        throw err;
      }
      // Keep authenticated session intact; AuthContext will load/retry the Firestore profile
      return { role: 'user', uid: cred.user.uid, profileExists: true };
    }
  },

  claimAdminWithEmailPassword: async (email: string, password: string): Promise<void> => {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail !== ADMIN_EMAIL) {
      throw new Error(`Administrator email must be ${ADMIN_EMAIL}.`);
    }
    if (password.length < 8) {
      throw new Error('Choose an admin password with at least 8 characters.');
    }
    await ensureAuthPersistence();
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await sendEmailVerification(cred.user).catch(() => {});
      await signOut(auth);
      throw new Error(
        'Admin Firebase account created. A verification link was sent to ezeprodeveloper@gmail.com — click the link to verify and enter the Admin console.',
      );
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }
  },

  requestPasswordReset: async (email: string): Promise<void> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Enter a valid email address.');
    }

    const actionCodeSettings = getPasswordResetActionCodeSettings();
    try {
      if (actionCodeSettings) {
        await sendPasswordResetEmail(auth, cleanEmail, actionCodeSettings);
      } else {
        await sendPasswordResetEmail(auth, cleanEmail);
      }
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      // Anti-enumeration: never disclose whether an email address is unregistered
      if (code === 'auth/user-not-found') {
        return;
      }
      // If current preview/custom domain is not yet allowlisted in Authorized Domains,
      // fall back to Firebase's default authorized reset link so email delivery still works.
      if (code === 'auth/unauthorized-continue-uri' || code === 'auth/invalid-continue-uri') {
        try {
          await sendPasswordResetEmail(auth, cleanEmail);
          return;
        } catch (fallbackErr) {
          const fbCode =
            typeof fallbackErr === 'object' && fallbackErr !== null && 'code' in fallbackErr
              ? String((fallbackErr as { code: unknown }).code)
              : '';
          if (fbCode === 'auth/user-not-found') return;
          throw new Error(mapFirebaseAuthError(fallbackErr));
        }
      }
      throw new Error(mapFirebaseAuthError(err));
    }
  },

  verifyResetCode: async (oobCode: string): Promise<string> => {
    const cleanCode = oobCode.trim();
    if (!cleanCode) {
      throw new Error('Missing password reset verification code.');
    }
    try {
      return await verifyPasswordResetCode(auth, cleanCode);
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }
  },

  confirmResetPassword: async (oobCode: string, newPassword: string): Promise<void> => {
    const cleanCode = oobCode.trim();
    if (!cleanCode) {
      throw new Error('Missing password reset verification code.');
    }
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }
    try {
      await confirmPasswordReset(auth, cleanCode, newPassword);
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }
  },

  persistMemberProfileForUid: async (
    uid: string,
    payload: MemberProfileDraft,
  ): Promise<RegisteredUser> => {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanPhone = payload.phone.trim();
    const phoneKey = normalizePhoneKey(cleanPhone);
    const cleanId = payload.idNumber.replace(/\s/g, '');

    if (cleanEmail === ADMIN_EMAIL) {
      throw new Error('This email address is reserved for E-Finance Administration.');
    }
    if (!isValidRwandaPhone(cleanPhone)) {
      throw new Error('Enter a valid Rwanda phone number.');
    }
    if (!isValidRwandaId(cleanId)) {
      throw new Error('Enter a valid 16-digit Rwanda National ID.');
    }
    if (!payload.photoDataUrl || payload.photoDataUrl.length < 20) {
      throw new Error('Upload a clear profile identification photo.');
    }

    // Do not overwrite an already-persisted user document
    const existingUserSnap = await getDocFromServer(doc(db, 'users', uid)).catch(() => null);
    if (existingUserSnap?.exists()) {
      return existingUserSnap.data() as RegisteredUser;
    }

    // Upload photo to Firebase Storage if available, otherwise keep compressed Firestore payload within rule bounds
    const uploadedPhoto = await uploadPersistentDataUrl({
      ownerUid: uid,
      folder: 'users',
      filePrefix: 'profile-id',
      dataUrlOrHttpUrl: payload.photoDataUrl,
    });
    if (uploadedPhoto.url.length > 450000) {
      throw new Error('Compressed identification photo exceeds 450 KB. Please choose a smaller image.');
    }

    const existingPhoneSnap = await getDoc(doc(db, 'phoneDirectory', phoneKey)).catch(() => null);
    let writePhoneDir = true;
    if (existingPhoneSnap?.exists()) {
      const existingOwner = String((existingPhoneSnap.data() as { userId?: string }).userId ?? '');
      if (existingOwner && existingOwner !== uid) {
        throw new Error('An account with this phone number already exists.');
      }
      if (existingOwner === uid) {
        writePhoneDir = false;
      }
    }

    let referredByUserId: string | undefined;
    const cleanRef = payload.referralCodeInput.trim().toUpperCase();
    if (cleanRef && /^[a-zA-Z0-9_-]{3,32}$/.test(cleanRef)) {
      const refSnap = await getDoc(doc(db, 'referralDirectory', cleanRef)).catch(() => null);
      if (refSnap?.exists()) {
        const refOwner = String((refSnap.data() as { userId?: string }).userId ?? '');
        if (refOwner && refOwner !== uid) {
          referredByUserId = refOwner;
        }
      }
    }

    let accountNumber = generateAccountNumber();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wSnap = await getDoc(doc(db, 'walletDirectory', accountNumber)).catch(() => null);
      if (!wSnap?.exists()) break;
      accountNumber = generateAccountNumber();
    }

    let referralCode = generateReferralCode(payload.firstName);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existingRefSnap = await getDoc(doc(db, 'referralDirectory', referralCode)).catch(() => null);
      if (!existingRefSnap?.exists()) break;
      referralCode = `${generateReferralCode(payload.firstName)}${Math.floor(10 + Math.random() * 89)}`;
    }

    const nowIso = new Date().toISOString();
    const rawUser: RegisteredUser = {
      id: uid,
      firstName: payload.firstName.trim(),
      secondName: payload.secondName.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      gender: payload.gender,
      dateOfBirth: payload.dateOfBirth,
      idNumber: cleanId,
      photoDataUrl: uploadedPhoto.url,
      photoMetadata: uploadedPhoto.metadata,
      education: {
        type: payload.education.type,
        institutionName: payload.education.institutionName.trim(),
        levelOrClass: payload.education.levelOrClass.trim(),
        facultyOrCombination: payload.education.facultyOrCombination.trim(),
      },
      residence: omitUndefined({
        placeOfBirth: payload.residence.placeOfBirth.trim(),
        province: payload.residence.province?.trim() || undefined,
        akarere: payload.residence.akarere?.trim() || undefined,
        umurenge: payload.residence.umurenge?.trim() || undefined,
        akagari: payload.residence.akagari?.trim() || undefined,
        umudugudu: payload.residence.umudugudu?.trim() || undefined,
      }),
      accountNumber,
      referralCode,
      referredByUserId,
      spinCredits: 0,
      hasCompletedFirstWithdrawal: false,
      accountStatus: 'pending_approval',
      walletBalanceRwf: 0,
      bonusBalanceRwf: 0,
      savingsBalanceRwf: 0,
      walletBalanceUsd: 0,
      usdtBalance: 0,
      usdtSavingsBalance: 0,
      lastCheckInAt: null,
      checkInStreak: 0,
      kycStatus: 'not_submitted',
      createdAt: nowIso,
    };
    const userDoc: RegisteredUser = omitUndefined(rawUser);

    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid), userDoc);
    if (writePhoneDir) {
      batch.set(doc(db, 'phoneDirectory', phoneKey), {
        email: cleanEmail,
        userId: uid,
      });
    }
    batch.set(doc(db, 'referralDirectory', referralCode), {
      referralCode,
      userId: uid,
    });
    batch.set(doc(db, 'walletDirectory', accountNumber), {
      address: accountNumber,
      userId: uid,
      fullName: `${userDoc.firstName} ${userDoc.secondName}`,
      createdAt: nowIso,
    });

    const notifId = generateSafeId('ntf-reg');
    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      recipientId: 'admin',
      title: 'New Member Registration',
      message: `${userDoc.firstName} ${userDoc.secondName} (${userDoc.phone}) registered and awaits approval.`,
      category: 'Registration',
      read: false,
      createdAt: nowIso,
    });

    await batch.commit();

    // Explicitly verify the Firestore document exists on the server before reporting success
    const verifiedSnap = await getDocFromServer(doc(db, 'users', uid));
    if (!verifiedSnap.exists()) {
      throw new Error('Account profile write could not be verified in Firestore. Please retry profile sync.');
    }
    savePendingProfileDraft(null);
    return normalizeUserFromDoc(verifiedSnap.id, verifiedSnap.data() as Record<string, unknown>);
  },

  registerMember: async (payload: {
    firstName: string;
    secondName: string;
    email: string;
    phone: string;
    gender: RegisteredUser['gender'];
    dateOfBirth: string;
    idNumber: string;
    photoDataUrl: string;
    education: RegisteredUser['education'];
    residence: RegisteredUser['residence'];
    rawPassword: string;
    referralCodeInput: string;
  }): Promise<RegisteredUser> => {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanPhone = payload.phone.trim();
    const phoneKey = normalizePhoneKey(cleanPhone);
    const cleanId = payload.idNumber.replace(/\s/g, '');

    if (cleanEmail === ADMIN_EMAIL) {
      throw new Error('This email address is reserved for E-Finance Administration.');
    }
    if (!isValidRwandaPhone(cleanPhone)) {
      throw new Error('Enter a valid Rwanda phone number.');
    }
    if (!isValidRwandaId(cleanId)) {
      throw new Error('Enter a valid 16-digit Rwanda National ID.');
    }
    if (!payload.photoDataUrl || payload.photoDataUrl.length < 20 || payload.photoDataUrl.length > 450000) {
      throw new Error('Upload a clear profile identification photo under 450 KB.');
    }
    if (payload.rawPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    await ensureAuthPersistence();

    const currentFbUser = auth.currentUser;
    const isResumingCurrentAuth =
      Boolean(currentFbUser) && currentFbUser?.email?.toLowerCase() === cleanEmail;

    const existingPhoneSnap = await getDoc(doc(db, 'phoneDirectory', phoneKey)).catch(() => null);
    if (existingPhoneSnap?.exists()) {
      const phoneOwner = String((existingPhoneSnap.data() as { userId?: string }).userId ?? '');
      if (!isResumingCurrentAuth || phoneOwner !== currentFbUser?.uid) {
        throw new Error('An account with this phone number already exists.');
      }
    }

    const draft: MemberProfileDraft = {
      firstName: payload.firstName,
      secondName: payload.secondName,
      email: cleanEmail,
      phone: cleanPhone,
      gender: payload.gender,
      dateOfBirth: payload.dateOfBirth,
      idNumber: cleanId,
      photoDataUrl: payload.photoDataUrl,
      education: payload.education,
      residence: payload.residence,
      referralCodeInput: payload.referralCodeInput,
    };

    // Set before Auth creation so onAuthStateChanged never tears down RegisterWizard mid-flight
    pendingRegistrationUid = isResumingCurrentAuth && currentFbUser ? currentFbUser.uid : '__creating__';
    savePendingProfileDraft(draft);

    try {
      let authUser = currentFbUser;
      if (isResumingCurrentAuth && authUser) {
        const existingProfile = await getDocFromServer(doc(db, 'users', authUser.uid)).catch(() => null);
        if (existingProfile?.exists()) {
          throw new Error('An account with this email address already exists. Sign in with your password.');
        }
      } else {
        try {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, payload.rawPassword);
          authUser = cred.user;
        } catch (err) {
          throw new Error(mapFirebaseAuthError(err));
        }
      }

      if (!authUser) {
        throw new Error('Authentication session could not be initialized.');
      }

      const uid = authUser.uid;
      pendingRegistrationUid = uid;

      try {
        const savedUser = await firestoreService.persistMemberProfileForUid(uid, draft);
        await sendEmailVerification(authUser).catch(() => {});
        return savedUser;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Your Firebase login account was created, but saving your Firestore profile failed (${reason}). Use "Sync Saved Profile" to finish saving without losing your account.`,
        );
      }
    } finally {
      pendingRegistrationUid = null;
    }
  },

  recoverMemberProfile: async (
    uid: string,
    draft: MemberProfileDraft,
  ): Promise<RegisteredUser> => {
    pendingRegistrationUid = uid;
    savePendingProfileDraft(draft);
    try {
      return await firestoreService.persistMemberProfileForUid(uid, draft);
    } finally {
      pendingRegistrationUid = null;
    }
  },

  signOutCurrent: async (): Promise<void> => {
    pendingRegistrationUid = null;
    savePendingProfileDraft(null);
    await signOut(auth).catch(() => {});
  },

  /* ---------------------------------------------------------------------- */
  /* Real-Time Member Workspace Subscription & Background Engines           */
  /* ---------------------------------------------------------------------- */
  subscribeMemberWorkspace: (
    uid: string,
    onUpdate: (snapshot: MemberWorkspaceSnapshot) => void,
    onError: (err: Error) => void,
  ): Unsubscribe => {
    const state: MemberWorkspaceSnapshot = {
      user: null,
      userDocLoaded: false,
      referredUsersCount: 0,
      settings: DEFAULT_SYSTEM_SETTINGS,
      savingsGoals: [],
      loans: [],
      investments: [],
      spinHistory: [],
      withdrawals: [],
      videoCampaigns: [],
      customTasks: [],
      taskSubmissions: [],
      betSessions: [],
      airtimeRequests: [],
      p2pTransfers: [],
      fxExchanges: [],
      usdtRequests: [],
      transactions: [],
      notifications: [],
      videoWatchSessions: [],
    };

    let activeVideos: ShortVideoCampaign[] = [];
    let myVideos: ShortVideoCampaign[] = [];
    let activeTasks: CustomTask[] = [];
    let myTasks: CustomTask[] = [];
    let sentP2P: P2PTransfer[] = [];
    let receivedP2P: P2PTransfer[] = [];
    let roiBusy = false;
    let p2pClaimBusy = false;

    const emit = () => {
      state.videoCampaigns = sortDesc(mergeById(activeVideos, myVideos), (v) => v.createdAt);
      state.customTasks = sortDesc(mergeById(activeTasks, myTasks), (t) => t.createdAt);
      state.p2pTransfers = sortDesc(mergeById(sentP2P, receivedP2P), (p) => p.createdAt);
      onUpdate({ ...state });
    };

    const claimPendingP2P = async (transfers: P2PTransfer[]) => {
      if (p2pClaimBusy) return;
      const unclaimed = transfers.filter((t) => t.receiverId === uid && !t.claimedByReceiver);
      if (unclaimed.length === 0) return;
      p2pClaimBusy = true;
      try {
        for (const transfer of unclaimed) {
          await runTransaction(db, async (tx) => {
            const p2pRef = doc(db, 'p2pTransfers', transfer.id);
            const userRef = doc(db, 'users', uid);
            const [p2pSnap, userSnap] = await Promise.all([tx.get(p2pRef), tx.get(userRef)]);
            if (!p2pSnap.exists() || !userSnap.exists()) return;
            const liveTransfer = p2pSnap.data() as P2PTransfer;
            const liveUser = userSnap.data() as RegisteredUser;
            if (liveTransfer.claimedByReceiver || liveUser.accountStatus !== 'active') return;
            const nowIso = new Date().toISOString();

            tx.update(p2pRef, { claimedByReceiver: true });
            tx.update(userRef, {
              walletBalanceRwf: liveUser.walletBalanceRwf + liveTransfer.netAmountRwf,
              lastTxId: liveTransfer.id,
              updatedAt: nowIso,
            });
            const txRec = buildTransactionRecord({
              idPrefix: 'tx-rcv',
              userId: uid,
              refPrefix: 'RCV',
              title: `Received from ${liveTransfer.senderName} (${liveTransfer.senderAddress})`,
              category: 'Transfer Received',
              channel: `P2P Wallet Transfer (${liveTransfer.taxPercent}% tax paid by sender)`,
              amountRwf: liveTransfer.netAmountRwf,
              direction: 'credit',
              status: 'Completed',
              timestamp: nowIso,
            });
            tx.set(doc(db, 'transactions', txRec.id), txRec);
            const notifId = generateSafeId('ntf-rcv');
            tx.set(doc(db, 'notifications', notifId), {
              id: notifId,
              recipientId: uid,
              title: 'P2P Transfer Received',
              message: `You received ${liveTransfer.netAmountRwf.toLocaleString('en-US')} RWF from ${liveTransfer.senderName}.`,
              category: 'Transfer',
              read: false,
              createdAt: nowIso,
            });
          });
        }
      } catch {
        // Retry automatically on next snapshot if conflict
      } finally {
        p2pClaimBusy = false;
      }
    };

    const processDueRoi = async (investments: UserInvestment[]) => {
      if (roiBusy) return;
      const now = Date.now();
      const dayMs = 86400000;
      const due = investments.filter(
        (inv) =>
          inv.status === 'active' &&
          inv.lastRoiCreditedAt &&
          !Number.isNaN(Date.parse(inv.lastRoiCreditedAt)) &&
          Math.floor((now - Date.parse(inv.lastRoiCreditedAt)) / dayMs) >= 1,
      );
      if (due.length === 0) return;
      roiBusy = true;
      try {
        for (const inv of due) {
          await runTransaction(db, async (tx) => {
            const invRef = doc(db, 'investments', inv.id);
            const userRef = doc(db, 'users', uid);
            const [invSnap, userSnap] = await Promise.all([tx.get(invRef), tx.get(userRef)]);
            if (!invSnap.exists() || !userSnap.exists()) return;
            const liveInv = invSnap.data() as UserInvestment;
            const liveUser = userSnap.data() as RegisteredUser;
            if (liveInv.status !== 'active' || !liveInv.lastRoiCreditedAt || liveUser.accountStatus !== 'active') {
              return;
            }
            const lastMs = Date.parse(liveInv.lastRoiCreditedAt);
            const daysDue = Math.floor((Date.now() - lastMs) / dayMs);
            if (daysDue < 1) return;

            const tier = INVESTMENT_PLAN_TIERS.find((t) => t.id === liveInv.tierId);
            const durationDays = tier?.durationDays ?? 60;
            const maxTotal = durationDays * liveInv.dailyReturnRwf;
            const daysCreditedSoFar = Math.floor(liveInv.totalEarnedRwf / liveInv.dailyReturnRwf);
            const remainingDays = Math.max(0, durationDays - daysCreditedSoFar);
            const actualDays = Math.min(daysDue, remainingDays);
            if (actualDays <= 0) return;

            const payout = actualDays * liveInv.dailyReturnRwf;
            const nextEarned = Math.min(maxTotal, liveInv.totalEarnedRwf + payout);
            const completed = nextEarned >= maxTotal;
            const creditIso = new Date(lastMs + actualDays * dayMs).toISOString();
            const nowIso = new Date().toISOString();

            tx.update(invRef, {
              totalEarnedRwf: nextEarned,
              lastRoiCreditedAt: creditIso,
              status: completed ? 'completed' : 'active',
              updatedAt: nowIso,
            });
            tx.update(userRef, {
              walletBalanceRwf: liveUser.walletBalanceRwf + payout,
              lastTxId: liveInv.id,
              updatedAt: nowIso,
            });
            const txRec = buildTransactionRecord({
              idPrefix: 'tx-roi',
              userId: uid,
              refPrefix: 'ROI',
              title: `Daily Plan Return (${liveInv.planName} × ${actualDays}d)`,
              category: 'Investment ROI',
              channel: 'Automated 24h Yield Engine',
              amountRwf: payout,
              direction: 'credit',
              status: 'Completed',
              timestamp: creditIso,
            });
            tx.set(doc(db, 'transactions', txRec.id), txRec);
            const notifId = generateSafeId('ntf-roi');
            tx.set(doc(db, 'notifications', notifId), {
              id: notifId,
              recipientId: uid,
              title: 'Daily Investment Return Credited',
              message: `${payout.toLocaleString('en-US')} RWF from ${liveInv.planName} was added to your wallet.`,
              category: 'Investment',
              read: false,
              createdAt: nowIso,
            });
          });
        }
      } catch {
        // Retry cleanly on next update
      } finally {
        roiBusy = false;
      }
    };

    const fail = (path: string) => (err: unknown) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    };

    const unsubs: Unsubscribe[] = [
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          state.user = snap.exists()
            ? normalizeUserFromDoc(snap.id, snap.data() as Record<string, unknown>)
            : null;
          state.userDocLoaded = true;
          emit();
        },
        fail(`users/${uid}`),
      ),
      onSnapshot(
        doc(db, 'settings', 'platform'),
        (snap) => {
          if (snap.exists()) {
            state.settings = { ...DEFAULT_SYSTEM_SETTINGS, ...(snap.data() as Partial<SystemSettings>) };
            emit();
          }
        },
        () => {},
      ),
      onSnapshot(
        query(collection(db, 'savingsGoals'), where('userId', '==', uid)),
        (snap) => {
          state.savingsGoals = sortDesc(
            snap.docs.map((d) => d.data() as SavingsGoal),
            (s) => s.createdAt,
          );
          emit();
        },
        fail('savingsGoals'),
      ),
      onSnapshot(
        query(collection(db, 'loans'), where('userId', '==', uid)),
        (snap) => {
          state.loans = sortDesc(
            snap.docs.map((d) => d.data() as LoanRequest),
            (l) => l.createdAt,
          );
          emit();
        },
        fail('loans'),
      ),
      onSnapshot(
        query(collection(db, 'investments'), where('userId', '==', uid)),
        (snap) => {
          state.investments = sortDesc(
            snap.docs.map((d) => d.data() as UserInvestment),
            (i) => i.createdAt,
          );
          emit();
          void processDueRoi(state.investments);
        },
        fail('investments'),
      ),
      onSnapshot(
        query(collection(db, 'spinHistory'), where('userId', '==', uid)),
        (snap) => {
          state.spinHistory = sortDesc(
            snap.docs.map((d) => d.data() as SpinHistoryRecord),
            (s) => s.spunAt,
          );
          emit();
        },
        fail('spinHistory'),
      ),
      onSnapshot(
        query(collection(db, 'withdrawals'), where('userId', '==', uid)),
        (snap) => {
          state.withdrawals = sortDesc(
            snap.docs.map((d) => d.data() as WithdrawalRequest),
            (w) => w.createdAt,
          );
          emit();
        },
        fail('withdrawals'),
      ),
      onSnapshot(
        query(collection(db, 'videoCampaigns'), where('status', '==', 'active')),
        (snap) => {
          activeVideos = snap.docs.map((d) => d.data() as ShortVideoCampaign);
          emit();
        },
        fail('videoCampaigns'),
      ),
      onSnapshot(
        query(collection(db, 'videoCampaigns'), where('creatorId', '==', uid)),
        (snap) => {
          myVideos = snap.docs.map((d) => d.data() as ShortVideoCampaign);
          emit();
        },
        fail('videoCampaigns'),
      ),
      onSnapshot(
        query(collection(db, 'customTasks'), where('status', '==', 'active')),
        (snap) => {
          activeTasks = snap.docs.map((d) => d.data() as CustomTask);
          emit();
        },
        fail('customTasks'),
      ),
      onSnapshot(
        query(collection(db, 'customTasks'), where('creatorId', '==', uid)),
        (snap) => {
          myTasks = snap.docs.map((d) => d.data() as CustomTask);
          emit();
        },
        fail('customTasks'),
      ),
      onSnapshot(
        query(collection(db, 'taskSubmissions'), where('workerId', '==', uid)),
        (snap) => {
          state.taskSubmissions = sortDesc(
            snap.docs.map((d) => d.data() as TaskSubmission),
            (s) => s.submittedAt,
          );
          emit();
        },
        fail('taskSubmissions'),
      ),
      onSnapshot(
        query(collection(db, 'betSessions'), where('userId', '==', uid)),
        (snap) => {
          state.betSessions = sortDesc(
            snap.docs.map((d) => d.data() as BetSession),
            (b) => b.createdAt,
          );
          emit();
        },
        fail('betSessions'),
      ),
      onSnapshot(
        query(collection(db, 'airtimeRequests'), where('userId', '==', uid)),
        (snap) => {
          state.airtimeRequests = sortDesc(
            snap.docs.map((d) => d.data() as AirtimeRequest),
            (a) => a.createdAt,
          );
          emit();
        },
        fail('airtimeRequests'),
      ),
      onSnapshot(
        query(collection(db, 'p2pTransfers'), where('senderId', '==', uid)),
        (snap) => {
          sentP2P = snap.docs.map((d) => d.data() as P2PTransfer);
          emit();
        },
        fail('p2pTransfers'),
      ),
      onSnapshot(
        query(collection(db, 'p2pTransfers'), where('receiverId', '==', uid)),
        (snap) => {
          receivedP2P = snap.docs.map((d) => d.data() as P2PTransfer);
          emit();
          void claimPendingP2P(receivedP2P);
        },
        fail('p2pTransfers'),
      ),
      onSnapshot(
        query(collection(db, 'fxExchanges'), where('userId', '==', uid)),
        (snap) => {
          state.fxExchanges = sortDesc(
            snap.docs.map((d) => d.data() as FxExchangeRecord),
            (f) => f.createdAt,
          );
          emit();
        },
        fail('fxExchanges'),
      ),
      onSnapshot(
        query(collection(db, 'usdtRequests'), where('userId', '==', uid)),
        (snap) => {
          state.usdtRequests = sortDesc(
            snap.docs.map((d) => d.data() as UsdtRequest),
            (u) => u.createdAt,
          );
          emit();
        },
        fail('usdtRequests'),
      ),
      onSnapshot(
        query(collection(db, 'transactions'), where('userId', '==', uid)),
        (snap) => {
          const txList = sortDesc(
            snap.docs.map((d) => d.data() as TransactionRecord),
            (t) => t.timestamp,
          );
          state.transactions = txList;
          state.referredUsersCount = txList.filter(
            (t) => t.category === 'Referral Commission' && t.title.includes('activated'),
          ).length;
          emit();
        },
        fail('transactions'),
      ),
      onSnapshot(
        query(collection(db, 'notifications'), where('recipientId', '==', uid)),
        (snap) => {
          state.notifications = sortDesc(
            snap.docs.map((d) => d.data() as PlatformNotification),
            (n) => n.createdAt,
          );
          emit();
        },
        fail('notifications'),
      ),
      onSnapshot(
        query(collection(db, 'videoWatchSessions'), where('userId', '==', uid)),
        (snap) => {
          state.videoWatchSessions = snap.docs.map((d) => d.data() as VideoWatchSessionRecord);
          emit();
        },
        () => {},
      ),
    ];

    return () => {
      for (const unsub of unsubs) unsub();
    };
  },

  /* ---------------------------------------------------------------------- */
  /* Real-Time Admin Workspace Subscription                                 */
  /* ---------------------------------------------------------------------- */
  subscribeAdminWorkspace: (
    onUpdate: (snapshot: AdminWorkspaceSnapshot) => void,
    onError: (err: Error) => void,
  ): Unsubscribe => {
    const state: AdminWorkspaceSnapshot = {
      settings: DEFAULT_SYSTEM_SETTINGS,
      users: [],
      savingsGoals: [],
      loans: [],
      investments: [],
      spinHistory: [],
      withdrawals: [],
      videoCampaigns: [],
      customTasks: [],
      taskSubmissions: [],
      betSessions: [],
      airtimeRequests: [],
      p2pTransfers: [],
      fxExchanges: [],
      usdtRequests: [],
      transactions: [],
      promotions: [],
      notifications: [],
    };

    const emit = () => onUpdate({ ...state });
    const fail = (path: string) => (err: unknown) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    };

    const unsubs: Unsubscribe[] = [
      onSnapshot(
        doc(db, 'settings', 'platform'),
        (snap) => {
          if (snap.exists()) {
            state.settings = { ...DEFAULT_SYSTEM_SETTINGS, ...(snap.data() as Partial<SystemSettings>) };
            emit();
          }
        },
        fail('settings/platform'),
      ),
      onSnapshot(
        collection(db, 'users'),
        (snap) => {
          state.users = sortDesc(
            snap.docs.map((d) => normalizeUserFromDoc(d.id, d.data() as Record<string, unknown>)),
            (u) => u.createdAt,
          );
          emit();
        },
        fail('users'),
      ),
      onSnapshot(
        collection(db, 'savingsGoals'),
        (snap) => {
          state.savingsGoals = sortDesc(
            snap.docs.map((d) => d.data() as SavingsGoal),
            (s) => s.createdAt,
          );
          emit();
        },
        fail('savingsGoals'),
      ),
      onSnapshot(
        collection(db, 'loans'),
        (snap) => {
          state.loans = sortDesc(
            snap.docs.map((d) => d.data() as LoanRequest),
            (l) => l.createdAt,
          );
          emit();
        },
        fail('loans'),
      ),
      onSnapshot(
        collection(db, 'investments'),
        (snap) => {
          state.investments = sortDesc(
            snap.docs.map((d) => d.data() as UserInvestment),
            (i) => i.createdAt,
          );
          emit();
        },
        fail('investments'),
      ),
      onSnapshot(
        collection(db, 'spinHistory'),
        (snap) => {
          state.spinHistory = sortDesc(
            snap.docs.map((d) => d.data() as SpinHistoryRecord),
            (s) => s.spunAt,
          );
          emit();
        },
        fail('spinHistory'),
      ),
      onSnapshot(
        collection(db, 'withdrawals'),
        (snap) => {
          state.withdrawals = sortDesc(
            snap.docs.map((d) => d.data() as WithdrawalRequest),
            (w) => w.createdAt,
          );
          emit();
        },
        fail('withdrawals'),
      ),
      onSnapshot(
        collection(db, 'videoCampaigns'),
        (snap) => {
          state.videoCampaigns = sortDesc(
            snap.docs.map((d) => d.data() as ShortVideoCampaign),
            (v) => v.createdAt,
          );
          emit();
        },
        fail('videoCampaigns'),
      ),
      onSnapshot(
        collection(db, 'customTasks'),
        (snap) => {
          state.customTasks = sortDesc(
            snap.docs.map((d) => d.data() as CustomTask),
            (t) => t.createdAt,
          );
          emit();
        },
        fail('customTasks'),
      ),
      onSnapshot(
        collection(db, 'taskSubmissions'),
        (snap) => {
          state.taskSubmissions = sortDesc(
            snap.docs.map((d) => d.data() as TaskSubmission),
            (s) => s.submittedAt,
          );
          emit();
        },
        fail('taskSubmissions'),
      ),
      onSnapshot(
        collection(db, 'betSessions'),
        (snap) => {
          state.betSessions = sortDesc(
            snap.docs.map((d) => d.data() as BetSession),
            (b) => b.createdAt,
          );
          emit();
        },
        fail('betSessions'),
      ),
      onSnapshot(
        collection(db, 'airtimeRequests'),
        (snap) => {
          state.airtimeRequests = sortDesc(
            snap.docs.map((d) => d.data() as AirtimeRequest),
            (a) => a.createdAt,
          );
          emit();
        },
        fail('airtimeRequests'),
      ),
      onSnapshot(
        collection(db, 'p2pTransfers'),
        (snap) => {
          state.p2pTransfers = sortDesc(
            snap.docs.map((d) => d.data() as P2PTransfer),
            (p) => p.createdAt,
          );
          emit();
        },
        fail('p2pTransfers'),
      ),
      onSnapshot(
        collection(db, 'fxExchanges'),
        (snap) => {
          state.fxExchanges = sortDesc(
            snap.docs.map((d) => d.data() as FxExchangeRecord),
            (f) => f.createdAt,
          );
          emit();
        },
        fail('fxExchanges'),
      ),
      onSnapshot(
        collection(db, 'usdtRequests'),
        (snap) => {
          state.usdtRequests = sortDesc(
            snap.docs.map((d) => d.data() as UsdtRequest),
            (u) => u.createdAt,
          );
          emit();
        },
        fail('usdtRequests'),
      ),
      onSnapshot(
        collection(db, 'transactions'),
        (snap) => {
          state.transactions = sortDesc(
            snap.docs.map((d) => d.data() as TransactionRecord),
            (t) => t.timestamp,
          );
          emit();
        },
        fail('transactions'),
      ),
      onSnapshot(
        collection(db, 'promotions'),
        (snap) => {
          state.promotions = sortDesc(
            snap.docs.map((d) => d.data() as AdminPromotion),
            (p) => p.createdAt,
          );
          emit();
        },
        fail('promotions'),
      ),
      onSnapshot(
        collection(db, 'notifications'),
        (snap) => {
          state.notifications = sortDesc(
            snap.docs.map((d) => d.data() as PlatformNotification),
            (n) => n.createdAt,
          );
          emit();
        },
        fail('notifications'),
      ),
    ];

    return () => {
      for (const unsub of unsubs) unsub();
    };
  },

  /* ---------------------------------------------------------------------- */
  /* Member Operations                                                      */
  /* ---------------------------------------------------------------------- */
  markNotificationRead: async (notificationId: string): Promise<void> => {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  },

  submitActivation: async (uid: string, phone: string, ref: string): Promise<void> => {
    const cleanPhone = phone.trim();
    const cleanRef = ref.trim();
    if (!cleanPhone || cleanRef.length < 3) {
      throw new Error('Provide a valid payment phone and Mobile Money reference.');
    }
    const settings = await getCurrentSettings();
    const nowIso = new Date().toISOString();
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', uid), {
      accountStatus: 'payment_submitted',
      activationPaidPhone: cleanPhone,
      activationPaymentRef: cleanRef,
      updatedAt: nowIso,
    });
    const txRec = buildTransactionRecord({
      idPrefix: 'tx-act',
      userId: uid,
      refPrefix: 'ACT',
      title: `System Activation Fee (${settings.activationFeeRwf} RWF)`,
      category: 'Activation',
      channel: `${buildMomoPayCode(settings.momoPayCode, settings.activationFeeRwf)} · Ref ${cleanRef}`,
      amountRwf: settings.activationFeeRwf,
      direction: 'debit',
      status: 'Pending Review',
      timestamp: nowIso,
    });
    batch.set(doc(db, 'transactions', txRec.id), txRec);
    const notifId = generateSafeId('ntf-act');
    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      recipientId: 'admin',
      title: 'Activation Payment Submitted',
      message: `Member submitted activation Ref ${cleanRef} from ${cleanPhone}.`,
      category: 'Activation',
      read: false,
      createdAt: nowIso,
    });
    await batch.commit();
  },

  dailyCheckIn: async (uid: string): Promise<void> => {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('Account not found.');
      const user = userSnap.data() as RegisteredUser;
      if (user.accountStatus !== 'active') throw new Error('Account must be active.');
      const now = Date.now();
      if (user.lastCheckInAt) {
        const lastMs = Date.parse(user.lastCheckInAt);
        if (!Number.isNaN(lastMs) && now - lastMs < 86400000) {
          throw new Error('Daily check-in already claimed within the last 24 hours.');
        }
      }
      const settings = await getCurrentSettings();
      const reward = settings.dailyCheckInRwf;
      const nowIso = new Date(now).toISOString();

      tx.update(userRef, {
        walletBalanceRwf: user.walletBalanceRwf + reward,
        lastCheckInAt: nowIso,
        checkInStreak: user.checkInStreak + 1,
        updatedAt: nowIso,
      });
      const txRec = buildTransactionRecord({
        idPrefix: 'tx-chk',
        userId: uid,
        refPrefix: 'CHK',
        title: 'Daily 24h Check-In Reward',
        category: 'Check-In',
        channel: 'E-Finance Daily Check-In',
        amountRwf: reward,
        direction: 'credit',
        status: 'Completed',
        timestamp: nowIso,
      });
      tx.set(doc(db, 'transactions', txRec.id), txRec);
    });
  },

  submitKyc: async (uid: string, data: RwandaKycData): Promise<void> => {
    if (!isValidRwandaId(data.nationalId) || !isValidRwandaPhone(data.nextOfKinPhone)) {
      throw new Error('Provide a valid 16-digit National ID and Next-of-Kin Rwanda phone.');
    }
    const nowIso = new Date().toISOString();
    const uploadedDoc = await uploadPersistentDataUrl({
      ownerUid: uid,
      folder: 'users',
      filePrefix: 'kyc-id',
      dataUrlOrHttpUrl: data.idDocumentPhotoDataUrl,
    });
    const uploadedSelfie = data.selfiePhotoDataUrl
      ? await uploadPersistentDataUrl({
          ownerUid: uid,
          folder: 'users',
          filePrefix: 'kyc-selfie',
          dataUrlOrHttpUrl: data.selfiePhotoDataUrl,
        })
      : null;

    const kycPayload: RwandaKycData = omitUndefined({
      ...data,
      nationalId: data.nationalId.replace(/\s/g, ''),
      idDocumentPhotoDataUrl: uploadedDoc.url,
      selfiePhotoDataUrl: uploadedSelfie?.url,
      submittedAt: data.submittedAt || nowIso,
    });

    const batch = writeBatch(db);
    batch.update(doc(db, 'users', uid), {
      kycStatus: 'pending',
      kycData: kycPayload,
      updatedAt: nowIso,
    });
    const notifId = generateSafeId('ntf-kyc');
    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      recipientId: 'admin',
      title: 'Rwanda KYC Submitted',
      message: `New Rwanda KYC submission awaiting review (ID ${kycPayload.nationalId}).`,
      category: 'KYC',
      read: false,
      createdAt: nowIso,
    });
    await batch.commit();
  },

  createSavingsGoal: async (
    uid: string,
    payload: { title: string; planType: SavingsGoal['planType']; targetRwf: number; targetDate: string },
  ): Promise<void> => {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists() || (userSnap.data() as RegisteredUser).kycStatus !== 'approved') {
      throw new Error('Complete Rwanda KYC approval before creating savings goals.');
    }
    const cleanTitle = payload.title.trim();
    const targetRwf = Math.round(Number(payload.targetRwf));
    if (cleanTitle.length < 2 || !Number.isFinite(targetRwf) || targetRwf <= 0) {
      throw new Error('Provide a valid goal title and target amount.');
    }
    const nowIso = new Date().toISOString();
    const id = generateSafeId('sav');
    const goal: SavingsGoal = {
      id,
      userId: uid,
      title: cleanTitle,
      planType: payload.planType,
      targetRwf,
      currentRwf: 0,
      targetDate: payload.targetDate,
      createdAt: nowIso,
    };
    await setDoc(doc(db, 'savingsGoals', id), { ...goal, updatedAt: nowIso });
  },

  depositSavings: async (uid: string, goalId: string, rawAmountRwf: number): Promise<void> => {
    const amountRwf = Math.round(Number(rawAmountRwf));
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const goalRef = doc(db, 'savingsGoals', goalId);
      const [userSnap, goalSnap] = await Promise.all([tx.get(userRef), tx.get(goalRef)]);
      if (!userSnap.exists() || !goalSnap.exists()) throw new Error('Savings goal or account not found.');
      const user = userSnap.data() as RegisteredUser;
      const goal = goalSnap.data() as SavingsGoal;
      if (user.kycStatus !== 'approved' || user.accountStatus !== 'active') {
        throw new Error('Active account and approved Rwanda KYC required.');
      }
      if (amountRwf <= 0 || amountRwf > user.walletBalanceRwf) {
        throw new Error('Invalid amount or insufficient wallet balance.');
      }
      const nowIso = new Date().toISOString();
      tx.update(userRef, {
        walletBalanceRwf: user.walletBalanceRwf - amountRwf,
        savingsBalanceRwf: user.savingsBalanceRwf + amountRwf,
        updatedAt: nowIso,
      });
      tx.update(goalRef, {
        currentRwf: goal.currentRwf + amountRwf,
        updatedAt: nowIso,
      });
      const txRec = buildTransactionRecord({
        idPrefix: 'tx-sav',
        userId: uid,
        refPrefix: 'SAV',
        title: `Saved to ${goal.title}`,
        category: 'Savings',
        channel: `Smart Savings · ${goal.planType}`,
        amountRwf,
        direction: 'debit',
        status: 'Completed',
        timestamp: nowIso,
      });
      tx.set(doc(db, 'transactions', txRec.id), txRec);
    });
  },

  withdrawSavings: async (uid: string, goalId: string, rawAmountRwf: number): Promise<void> => {
    const amountRwf = Math.round(Number(rawAmountRwf));
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const goalRef = doc(db, 'savingsGoals', goalId);
      const [userSnap, goalSnap] = await Promise.all([tx.get(userRef), tx.get(goalRef)]);
      if (!userSnap.exists() || !goalSnap.exists()) throw new Error('Savings goal not found.');
      const user = userSnap.data() as RegisteredUser;
      const goal = goalSnap.data() as SavingsGoal;
      if (user.kycStatus !== 'approved' || user.accountStatus !== 'active') {
        throw new Error('Approved Rwanda KYC required.');
      }
      if (amountRwf <= 0 || amountRwf > goal.currentRwf || amountRwf > user.savingsBalanceRwf) {
        throw new Error('Amount exceeds savings balance.');
      }
      const nowIso = new Date().toISOString();
      tx.update(userRef, {
        walletBalanceRwf: user.walletBalanceRwf + amountRwf,
        savingsBalanceRwf: user.savingsBalanceRwf - amountRwf,
        updatedAt: nowIso,
      });
      tx.update(goalRef, {
        currentRwf: goal.currentRwf - amountRwf,
        updatedAt: nowIso,
      });
      const txRec = buildTransactionRecord({
        idPrefix: 'tx-sav',
        userId: uid,
        refPrefix: 'SAV',
        title: `Moved from ${goal.title} to Wallet`,
        category: 'Savings',
        channel: 'Smart Savings Retrieval',
        amountRwf,
        direction: 'credit',
        status: 'Completed',
        timestamp: nowIso,
      });
      tx.set(doc(db, 'transactions', txRec.id), txRec);
    });
  },

  requestLoan: async (
    uid: string,
    payload: {
      product: string;
      reason: string;
      principalRwf: number;
      termMonths: number;
      annualRatePercent: number;
      monthlyPaymentRwf: number;
      totalRepayableRwf: number;
    },
  ): Promise<void> => {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) throw new Error('User not found.');
    const user = userSnap.data() as RegisteredUser;
    const principalRwf = Math.round(Number(payload.principalRwf));
    if (principalRwf <= 0 || !payload.product.trim() || !payload.reason.trim()) {
      throw new Error('Complete all loan fields.');
    }
    if (user.savingsBalanceRwf <= principalRwf) {
      throw new Error(
        `Loan denied: Your savings balance (${user.savingsBalanceRwf} RWF) must exceed ${principalRwf} RWF.`,
      );
    }

    const nowIso = new Date().toISOString();
    const loanId = generateSafeId('loan');
    const loan: LoanRequest & { updatedAt: string } = {
      id: loanId,
      userId: uid,
      userName: `${user.firstName} ${user.secondName}`,
      product: payload.product.trim(),
      reason: payload.reason.trim(),
      principalRwf,
      termMonths: Math.max(1, Math.round(payload.termMonths)),
      annualRatePercent: Number(payload.annualRatePercent),
      monthlyPaymentRwf: Math.round(payload.monthlyPaymentRwf),
      totalRepayableRwf: Math.max(principalRwf, Math.round(payload.totalRepayableRwf)),
      repaidRwf: 0,
      status: 'pending_admin',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'loans', loanId), loan);
    const txRec = buildTransactionRecord({
      idPrefix: 'tx-ln',
      userId: uid,
      refPrefix: 'LN',
      title: `Loan Request: ${loan.product}`,
      category: 'Loan',
      channel: `${loan.termMonths} months · ${loan.reason}`,
      amountRwf: principalRwf,
      direction: 'credit',
      status: 'Pending Review',
      timestamp: nowIso,
    });
    batch.set(doc(db, 'transactions', txRec.id), txRec);
    const notifId = generateSafeId('ntf-ln');
    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      recipientId: 'admin',
      title: 'New Loan Request',
      message: `${loan.userName} requested ${principalRwf.toLocaleString('en-US')} RWF (${loan.product}).`,
      category: 'Loan',
      read: false,
      createdAt: nowIso,
    });
    await batch.commit();
  },

  repayLoan: async (uid: string, loanId: string, rawAmountRwf: number): Promise<void> => {
    const amountRwf = Math.round(Number(rawAmountRwf));
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const loanRef = doc(db, 'loans', loanId);
      const [userSnap, loanSnap] = await Promise.all([tx.get(userRef), tx.get(loanRef)]);
      if (!userSnap.exists() || !loanSnap.exists()) throw new Error('Loan not found.');
      const user = userSnap.data() as RegisteredUser;
      const loan = loanSnap.data() as LoanRequest;
      if (loan.status !== 'approved') throw new Error('Only approved loans can be repaid.');
      if (amountRwf <= 0 || amountRwf > user.walletBalanceRwf) {
        throw new Error('Insufficient wallet balance.');
      }
      const nowIso = new Date().toISOString();
      const nextRepaid = loan.repaidRwf + amountRwf;
      const isFullyRepaid = nextRepaid >= loan.totalRepayableRwf;

      tx.update(userRef, {
        walletBalanceRwf: user.walletBalanceRwf - amountRwf,
        updatedAt: nowIso,
      });
      tx.update(loanRef, {
        repaidRwf: nextRepaid,
        status: isFullyRepaid ? 'repaid' : 'approved',
        updatedAt: nowIso,
      });
      const txRec = buildTransactionRecord({
        idPrefix: 'tx-rep',
        userId: uid,
        refPrefix: 'REP',
        title: `Loan Repayment: ${loan.product}`,
        category: 'Loan',
        channel: 'Wallet Repayment',
        amountRwf,
        direction: 'debit',
        status: 'Completed',
        timestamp: nowIso,
      });
      tx.set(doc(db, 'transactions', txRec.id), txRec);
    });
  },

  purchaseInvestment: async (uid: string, tierId: string, paymentRef: string): Promise<void> => {
    const cleanRef = paymentRef.trim();
    const tier = INVESTMENT_PLAN_TIERS.find((t) => t.id === tierId);
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!tier || !userSnap.exists() || cleanRef.length < 3) {
      throw new Error('Valid investment tier and payment reference required.');
    }
    const user = userSnap.data() as RegisteredUser;
    const settings = await getCurrentSettings();
    const payCode = `*182*8*1*${settings.momoPayCode}*${tier.depositRwf}#`;
    const nowIso = new Date().toISOString();
    const invId = generateSafeId('inv');

    const batch = writeBatch(db);
    batch.set(doc(db, 'investments', invId), {
      id: invId,
      userId: uid,
      userName: `${user.firstName} ${user.secondName}`,
      tierId: tier.id,
      planName: tier.name,
      depositRwf: tier.depositRwf,
      dailyReturnRwf: tier.dailyReturnRwf,
      paymentCode: payCode,
      paymentRef: cleanRef,
      status: 'pending_admin',
      totalEarnedRwf: 0,
      lastRoiCreditedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    const txRec = buildTransactionRecord({
      idPrefix: 'tx-inv',
      userId: uid,
      refPrefix: 'INV',
      title: `Investment Plan Deposit: ${tier.name}`,
      category: 'Investment Deposit',
      channel: `${payCode} · Ref ${cleanRef}`,
      amountRwf: tier.depositRwf,
      direction: 'debit',
      status: 'Pending Review',
      timestamp: nowIso,
    });
    batch.set(doc(db, 'transactions', txRec.id), txRec);
    const notifId = generateSafeId('ntf-inv');
    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      recipientId: 'admin',
      title: 'New Investment Plan Deposit',
      message: `${user.firstName} ${user.secondName} submitted ${tier.name} (Ref ${cleanRef}).`,
      category: 'Investment',
      read: false,
      createdAt: nowIso,
    });
    await batch.commit();
  },

  completeSpin: async (uid: string, rawRewardRwf: number): Promise<void> => {
    const safeReward = Math.max(0, Math.min(200, Math.round(Number(rawRewardRwf))));
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found.');
      const user = userSnap.data() as RegisteredUser;
      if (user.spinCredits <= 0) throw new Error('No spin credits remaining.');
      const nowIso = new Date().toISOString();
      const spinId = generateSafeId('sp');

      tx.update(userRef, {
        spinCredits: user.spinCredits - 1,
        walletBalanceRwf: user.walletBalanceRwf + safeReward,
        updatedAt: nowIso,
      });
      tx.set(doc(db, 'spinHistory', spinId), {
        id: spinId,
        userId: uid,
        rewardRwf: safeReward,
        spunAt: nowIso,
      });
      const txRec = buildTransactionRecord({
        idPrefix: 'tx-spn',
        userId: uid,
        refPrefix: 'SPN',
        title: `Lucky Spin Wheel Reward (${safeReward} RWF)`,
        category: 'Spin Win',
        channel: 'E-Finance Lucky Wheel',
        amountRwf: safeReward,
        direction: 'credit',
        status: 'Completed',
        timestamp: nowIso,
      });
      tx.set(doc(db, 'transactions', txRec.id), txRec);
    });
  },

  requestWithdrawal: async (
    uid: string,
    payload: {
      network: 'MTN Rwanda' | 'Airtel / Tigo Rwanda';
      destinationType: 'Phone Number' | 'MoMo Pay Code';
      destinationValue: string;
      accountRegisteredNames: string;
      grossAmountRwf: number;
    },
  ): Promise<void> => {
    const settings = await getCurrentSettings();
    const grossAmountRwf = Math.round(Number(payload.grossAmountRwf));
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found.');
      const user = userSnap.data() as RegisteredUser;
      if (user.kycStatus !== 'approved') {
        throw new Error('Rwanda KYC approval is required before withdrawing.');
      }
      if (
        grossAmountRwf <= 0 ||
        grossAmountRwf > user.walletBalanceRwf ||
        !payload.destinationValue.trim() ||
        !payload.accountRegisteredNames.trim()
      ) {
        throw new Error('Invalid withdrawal details or insufficient balance.');
      }

      const isFirstBonusWithdrawal = !user.hasCompletedFirstWithdrawal;
      const minSubsequent = settings.subsequentMinWithdrawalRwf ?? 1000;
      const maxSubsequent = settings.subsequentMaxWithdrawalRwf ?? 5000;
      if (isFirstBonusWithdrawal) {
        if (grossAmountRwf < 100) {
          throw new Error('First bonus withdrawal minimum is 100 RWF.');
        }
      } else {
        if (grossAmountRwf < minSubsequent) {
          throw new Error(`Minimum withdrawal is ${minSubsequent.toLocaleString('en-US')} RWF.`);
        }
        if (grossAmountRwf > maxSubsequent) {
          throw new Error(`Maximum withdrawal per transaction is ${maxSubsequent.toLocaleString('en-US')} RWF.`);
        }
      }

      const feePercent = isFirstBonusWithdrawal ? (settings.withdrawalFeePercent ?? 25) : 0;
      const feeRwf = Math.round((grossAmountRwf * feePercent) / 100);
      const netAmountRwf = Math.max(0, grossAmountRwf - feeRwf);
      const nowIso = new Date().toISOString();
      const wdId = generateSafeId('wd');

      tx.update(userRef, {
        walletBalanceRwf: user.walletBalanceRwf - grossAmountRwf,
        updatedAt: nowIso,
      });
      tx.set(doc(db, 'withdrawals', wdId), {
        id: wdId,
        userId: uid,
        userName: `${user.firstName} ${user.secondName}`,
        network: payload.network,
        destinationType: payload.destinationType,
        destinationValue: payload.destinationValue.trim(),
        accountRegisteredNames: payload.accountRegisteredNames.trim(),
        grossAmountRwf,
        feePercent,
        feeRwf,
        netAmountRwf,
        isFirstBonusWithdrawal,
        status: 'pending_admin',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      const txRec = buildTransactionRecord({
        idPrefix: 'tx-wd',
        userId: uid,
        refPrefix: 'WDR',
        title: `Withdrawal (${payload.network}) — Net ${netAmountRwf} RWF`,
        category: 'Withdrawal',
        channel: `${payload.network} · ${payload.destinationType}: ${payload.destinationValue.trim()} (${payload.accountRegisteredNames.trim()}) · ${feePercent}% fee`,
        amountRwf: grossAmountRwf,
        feeRwf,
        direction: 'debit',
        status: 'Pending Review',
        timestamp: nowIso,
      });
      tx.set(doc(db, 'transactions', txRec.id), txRec);
      const notifId = generateSafeId('ntf-wd');
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientId: 'admin',
        title: 'Withdrawal Payout Request',
        message: `${user.firstName} ${user.secondName} requested ${netAmountRwf.toLocaleString('en-US')} RWF net (${payload.network}).`,
        category: 'Withdrawal',
        read: false,
        createdAt: nowIso,
      });
    });
  },

  startWatchSession: async (params: {
    uid: string;
    targetType: 'video' | 'task';
    targetId: string;
    requiredSeconds: number;
    authToken: string;
  }): Promise<{
    sessionId: string;
    sessionToken: string;
    requiredSeconds: number;
  }> => {
    const resp = await fetch('/api/video-sessions/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.authToken}`,
      },
      body: JSON.stringify({
        targetType: params.targetType,
        targetId: params.targetId,
        requiredSeconds: params.requiredSeconds,
      }),
    });
    const body = (await resp.json().catch(() => ({}))) as {
      error?: string;
      sessionId?: string;
      sessionToken?: string;
      startedAtMs?: number;
      requiredSeconds?: number;
    };
    if (!resp.ok || !body.sessionId || !body.sessionToken) {
      throw new Error(body.error || 'Unable to start verified video watch session.');
    }

    const sessionRef = doc(db, 'videoWatchSessions', body.sessionId);
    const existingSnap = await getDoc(sessionRef).catch(() => null);
    if (existingSnap?.exists()) {
      const existingData = existingSnap.data() as Partial<VideoWatchSessionRecord>;
      if (existingData.status === 'claimed') {
        throw new Error('You have already claimed the reward for this video.');
      }
      // Reset any incomplete / previous session cleanly so refreshes never leave stale partial progress
      await deleteDoc(sessionRef);
    }

    const startedAtMs = Math.min(body.startedAtMs ?? Date.now(), Date.now());
    const requiredSeconds = body.requiredSeconds ?? Math.max(5, Math.min(600, params.requiredSeconds));
    await setDoc(sessionRef, {
      id: body.sessionId,
      userId: params.uid,
      targetType: params.targetType,
      targetId: params.targetId,
      requiredSeconds,
      accumulatedSeconds: 0,
      heartbeatCount: 0,
      status: 'watching',
      startedAtMs,
      lastHeartbeatAtMs: startedAtMs,
      serverStartedAt: serverTimestamp(),
      updatedAt: new Date().toISOString(),
    });

    return {
      sessionId: body.sessionId,
      sessionToken: body.sessionToken,
      requiredSeconds,
    };
  },

  heartbeatWatchSession: async (params: {
    sessionId: string;
    sessionToken: string;
    isPlaying: boolean;
    isVisible: boolean;
    authToken: string;
    lastFirestoreSyncSec: number;
  }): Promise<{
    accumulatedSeconds: number;
    requiredSeconds: number;
    completed: boolean;
    syncedSec: number;
  }> => {
    const resp = await fetch('/api/video-sessions/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.authToken}`,
      },
      body: JSON.stringify({
        sessionToken: params.sessionToken,
        isPlaying: params.isPlaying,
        isVisible: params.isVisible,
      }),
    });
    const body = (await resp.json().catch(() => ({}))) as {
      error?: string;
      accumulatedSeconds?: number;
      requiredSeconds?: number;
      completed?: boolean;
    };
    if (!resp.ok) {
      throw new Error(body.error || 'Watch session heartbeat failed.');
    }

    const acc = Number(body.accumulatedSeconds ?? 0);
    const required = Number(body.requiredSeconds ?? 15);
    let syncedSec = params.lastFirestoreSyncSec;

    // Keep Firestore accumulatedSeconds within rule delta (+10 max per update)
    if (params.isPlaying && params.isVisible && acc - params.lastFirestoreSyncSec >= 2) {
      const nextSyncVal = Math.min(acc, params.lastFirestoreSyncSec + 9);
      try {
        await updateDoc(doc(db, 'videoWatchSessions', params.sessionId), {
          accumulatedSeconds: Number(nextSyncVal.toFixed(2)),
          heartbeatCount: Math.max(1, Math.round(nextSyncVal)),
          lastHeartbeatAtMs: Date.now(),
          updatedAt: new Date().toISOString(),
        });
        syncedSec = nextSyncVal;
      } catch {
        // Keep lastFirestoreSyncSec unchanged on transient error so delta stays accurate
      }
    }

    return {
      accumulatedSeconds: acc,
      requiredSeconds: required,
      completed: Boolean(body.completed),
      syncedSec,
    };
  },

  completeWatchSession: async (params: {
    sessionId: string;
    sessionToken: string;
    authToken: string;
  }): Promise<{ verificationSignature: string; requiredSeconds: number }> => {
    const resp = await fetch('/api/video-sessions/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.authToken}`,
      },
      body: JSON.stringify({ sessionToken: params.sessionToken }),
    });
    const body = (await resp.json().catch(() => ({}))) as {
      error?: string;
      verified?: boolean;
      verificationSignature?: string;
      accumulatedSeconds?: number;
      requiredSeconds?: number;
    };
    if (!resp.ok || !body.verified || !body.verificationSignature) {
      throw new Error(body.error || 'Video watch completion verification failed.');
    }

    const reqSec = Number(body.requiredSeconds ?? 15);
    const accSec = Math.max(reqSec, Number(body.accumulatedSeconds ?? reqSec));
    const applyComplete = async () => {
      await updateDoc(doc(db, 'videoWatchSessions', params.sessionId), {
        status: 'completed',
        accumulatedSeconds: accSec,
        lastHeartbeatAtMs: Date.now(),
        completedAtMs: Date.now(),
        verificationSignature: body.verificationSignature,
        updatedAt: new Date().toISOString(),
      });
    };

    try {
      await applyComplete();
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        await applyComplete();
      } catch {
        await new Promise((r) => setTimeout(r, 1500));
        await applyComplete();
      }
    }

    return {
      verificationSignature: body.verificationSignature,
      requiredSeconds: reqSec,
    };
  },

  watchVideoComplete: async (
    uid: string,
    campaignId: string,
    verificationSignature?: string,
    authToken?: string,
  ): Promise<void> => {
    const sessionId = `${uid}__video_${campaignId}`;
    let sig = verificationSignature?.trim() || '';

    if (!sig) {
      const sessSnap = await getDoc(doc(db, 'videoWatchSessions', sessionId));
      if (sessSnap.exists()) {
        const sData = sessSnap.data() as VideoWatchSessionRecord;
        if (sData.status === 'completed' && sData.verificationSignature) {
          sig = sData.verificationSignature;
        }
      }
    }

    if (!sig) {
      throw new Error('Please watch the video inside the in-app player for the full required duration before claiming.');
    }

    let token = authToken || '';
    if (!token && auth.currentUser) {
      token = await auth.currentUser.getIdToken();
    }
    if (!token) {
      throw new Error('Authentication session expired. Please sign in again.');
    }

    const claimResp = await fetch('/api/video-sessions/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        targetType: 'video',
        targetId: campaignId,
        verificationSignature: sig,
      }),
    });
    const claimBody = (await claimResp.json().catch(() => ({}))) as {
      error?: string;
      serverVerified?: boolean;
      creditedByServer?: boolean;
      useClientAtomicTx?: boolean;
    };

    if (!claimResp.ok || !claimBody.serverVerified) {
      throw new Error(claimBody.error || 'Server rejected unverified video claim.');
    }

    if (claimBody.creditedByServer) {
      return;
    }

    await runTransaction(db, async (tx) => {
      const vidRef = doc(db, 'videoCampaigns', campaignId);
      const userRef = doc(db, 'users', uid);
      const sessionRef = doc(db, 'videoWatchSessions', sessionId);
      const [vidSnap, userSnap, sessSnap] = await Promise.all([
        tx.get(vidRef),
        tx.get(userRef),
        tx.get(sessionRef),
      ]);
      if (!vidSnap.exists() || !userSnap.exists()) throw new Error('Video campaign not found.');
      if (!sessSnap.exists()) {
        throw new Error('Watch verification session not found. Please watch the video completely.');
      }
      const sess = sessSnap.data() as VideoWatchSessionRecord;
      if (sess.status === 'claimed') {
        throw new Error('You have already claimed this video reward.');
      }
      if (sess.status !== 'completed' && sess.accumulatedSeconds < sess.requiredSeconds) {
        throw new Error('Required watch duration is not yet completed.');
      }

      const camp = vidSnap.data() as ShortVideoCampaign;
      const user = userSnap.data() as RegisteredUser;

      if (camp.status !== 'active') throw new Error('Video campaign is not active.');
      if (camp.watchedByUserIds.includes(uid)) throw new Error('You already watched this video.');
      if (camp.watchedByUserIds.length >= camp.targetViewers) {
        throw new Error('Video campaign view target has been reached.');
      }

      const nowIso = new Date().toISOString();
      const updatedWatchers = [...camp.watchedByUserIds, uid];
      const completed = updatedWatchers.length >= camp.targetViewers;

      tx.update(sessionRef, {
        status: 'claimed',
        claimedAtMs: Date.now(),
        updatedAt: nowIso,
      });
      tx.update(vidRef, {
        watchedByUserIds: updatedWatchers,
        status: completed ? 'completed' : 'active',
        updatedAt: nowIso,
      });
      tx.update(userRef, {
        walletBalanceRwf: user.walletBalanceRwf + camp.rewardPerViewRwf,
        lastTxId: campaignId,
        updatedAt: nowIso,
      });
      const txRec = buildTransactionRecord({
        idPrefix: 'tx-vid',
        userId: uid,
        refPrefix: 'VID',
        title: `Short Video Reward: ${camp.title}`,
        category: 'Video Reward',
        channel: 'Watch-to-Earn',
        amountRwf: camp.rewardPerViewRwf,
        direction: 'credit',
        status: 'Completed',
        timestamp: nowIso,
      });
      tx.set(doc(db, 'transactions', txRec.id), txRec);
    });
  },

  createVideoCampaign: async (
    uid: string,
    payload: {
      title: string;
      description: string;
      videoUrl: string;
      videoFile?: File | null;
      requiredWatchSeconds?: number;
      rewardPerViewRwf: number;
      targetViewers: number;
      paymentRef: string;
      onUploadProgress?: (percent: number, stage: string) => void;
    },
  ): Promise<void> => {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) throw new Error('User not found.');
    const user = normalizeUserFromDoc(userSnap.id, userSnap.data() as Record<string, unknown>);
    const settings = await getCurrentSettings();

    const title = payload.title.trim();
    const description = payload.description.trim();
    const rawVideoUrl = payload.videoUrl.trim();
    const requiredWatchSeconds = Math.max(
      5,
      Math.min(600, Math.round(Number(payload.requiredWatchSeconds) || 15)),
    );
    const rewardPerViewRwf = Math.round(Number(payload.rewardPerViewRwf));
    const targetViewers = Math.round(Number(payload.targetViewers));
    const paymentRef = payload.paymentRef.trim();

    if (!title || targetViewers < 1 || paymentRef.length < 3) {
      throw new Error('Valid campaign title, target viewers, and payment reference required.');
    }
    if (!payload.videoFile && !isSafeMediaOrHttpUrl(rawVideoUrl)) {
      throw new Error('Upload a valid short video file or paste a valid https:// video URL.');
    }
    if (rewardPerViewRwf < settings.minVideoRewardRwf) {
      throw new Error(`Minimum reward per view is ${settings.minVideoRewardRwf} RWF.`);
    }

    const vidId = generateSafeId('vid');
    const uploadedVideo = await uploadPersistentVideo({
      ownerUid: uid,
      videoId: vidId,
      file: payload.videoFile,
      videoUrl: rawVideoUrl,
      onProgress: payload.onUploadProgress,
    });
    const videoUrl = uploadedVideo.url;

    const nowIso = new Date().toISOString();
    const totalBudgetRwf = rewardPerViewRwf * targetViewers;
    const paymentCode = `*182*8*1*${settings.momoPayCode}*${totalBudgetRwf}#`;

    const batch = writeBatch(db);
    batch.set(doc(db, 'videoCampaigns', vidId), {
      id: vidId,
      creatorId: uid,
      creatorName: `${user.firstName} ${user.secondName}`,
      title,
      description,
      videoUrl,
      requiredWatchSeconds,
      rewardPerViewRwf,
      targetViewers,
      totalBudgetRwf,
      paymentCode,
      paymentRef,
      watchedByUserIds: [],
      status: 'pending_admin',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    const txRec = buildTransactionRecord({
      idPrefix: 'tx-cmp',
      userId: uid,
      refPrefix: 'CMP',
      title: `Video Campaign Deposit: ${title}`,
      category: 'Campaign Payment',
      channel: `${paymentCode} · Ref ${paymentRef}`,
      amountRwf: totalBudgetRwf,
      direction: 'debit',
      status: 'Pending Review',
      timestamp: nowIso,
    });
    batch.set(doc(db, 'transactions', txRec.id), txRec);
    const notifId = generateSafeId('ntf-vid');
    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      recipientId: 'admin',
      title: 'Video Campaign Pending Approval',
      message: `${user.firstName} ${user.secondName} uploaded "${title}" (${requiredWatchSeconds}s · Ref ${paymentRef}).`,
      category: 'Video',
      read: false,
      createdAt: nowIso,
    });
    await batch.commit();
  },

  submitTaskProof: async (
    uid: string,
    payload: {
      taskId: string;
      proofText: string;
      proofUrl?: string;
      verificationSignature?: string;
      authToken?: string;
    },
  ): Promise<void> => {
    const proofText = payload.proofText.trim();
    const rawUrl = payload.proofUrl?.trim() ?? '';
    const proofUrl = rawUrl.length >= 4 ? rawUrl : undefined;
    if (proofUrl && !isSafeHttpUrl(proofUrl)) {
      throw new Error('Proof URL must start with http:// or https://.');
    }

    const deterministicSubId = `sub-${payload.taskId}__${uid}`;
    const sessionId = `${uid}__task_${payload.taskId}`;

    const [taskSnap, userSnap, existingSubs, detSubSnap, sessSnap] = await Promise.all([
      getDoc(doc(db, 'customTasks', payload.taskId)),
      getDoc(doc(db, 'users', uid)),
      getDocs(query(collection(db, 'taskSubmissions'), where('workerId', '==', uid))),
      getDoc(doc(db, 'taskSubmissions', deterministicSubId)),
      getDoc(doc(db, 'videoWatchSessions', sessionId)).catch(() => null),
    ]);

    if (!taskSnap.exists() || !userSnap.exists() || proofText.length < 3) {
      throw new Error('Active task and completion proof required.');
    }
    const task = taskSnap.data() as CustomTask;
    const user = normalizeUserFromDoc(userSnap.id, userSnap.data() as Record<string, unknown>);
    if (task.status !== 'active') throw new Error('This task is no longer active.');
    if (task.approvedWorkerIds.includes(uid)) {
      throw new Error('You have already earned the reward for this task.');
    }

    const duplicate =
      detSubSnap.exists() || existingSubs.docs.some((d) => (d.data() as TaskSubmission).taskId === task.id);
    if (duplicate) throw new Error('You already submitted proof for this task.');

    // If this task has a required video, enforce server-side + Firestore watch completion first
    if (task.videoUrl && task.videoUrl.trim().length > 0) {
      const sessData = sessSnap?.exists() ? (sessSnap.data() as VideoWatchSessionRecord) : null;
      const sig = payload.verificationSignature?.trim() || sessData?.verificationSignature || '';
      if (!sessData || (sessData.status !== 'completed' && sessData.status !== 'claimed') || !sig) {
        throw new Error(
          `Watch the required task video for ${task.requiredWatchSeconds ?? 15}s inside E-Finance before submitting your claim.`,
        );
      }

      let token = payload.authToken || '';
      if (!token && auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
      if (!token) {
        throw new Error('Sign in session expired. Please refresh or sign in again.');
      }
      const claimResp = await fetch('/api/video-sessions/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType: 'task',
          targetId: task.id,
          verificationSignature: sig,
        }),
      });
      const claimBody = (await claimResp.json().catch(() => ({}))) as { error?: string; serverVerified?: boolean };
      if (!claimResp.ok || !claimBody.serverVerified) {
        throw new Error(claimBody.error || 'Task video watch verification failed on server.');
      }

      if (sessData.status === 'completed') {
        await updateDoc(doc(db, 'videoWatchSessions', sessionId), {
          status: 'claimed',
          claimedAtMs: Date.now(),
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    }

    const nowIso = new Date().toISOString();
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'taskSubmissions', deterministicSubId),
      omitUndefined({
        id: deterministicSubId,
        taskId: task.id,
        taskTitle: task.title,
        workerId: uid,
        workerName: `${user.firstName} ${user.secondName}`,
        proofText,
        proofUrl,
        rewardRwf: task.rewardPerCompletionRwf,
        status: 'pending_admin',
        submittedAt: nowIso,
      }),
    );
    const notifId = generateSafeId('ntf-sub');
    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      recipientId: 'admin',
      title: 'Task Proof Submitted',
      message: `${user.firstName} ${user.secondName} submitted proof for "${task.title}".`,
      category: 'Task',
      read: false,
      createdAt: nowIso,
    });
    await batch.commit();
  },

  createCustomTask: async (
    uid: string,
    payload: {
      title: string;
      requirements: string;
      videoUrl?: string;
      videoFile?: File | null;
      requiredWatchSeconds?: number;
      rewardPerCompletionRwf: number;
      targetCompletions: number;
      paymentRef: string;
      onUploadProgress?: (percent: number, stage: string) => void;
    },
  ): Promise<void> => {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) throw new Error('User not found.');
    const user = normalizeUserFromDoc(userSnap.id, userSnap.data() as Record<string, unknown>);
    const settings = await getCurrentSettings();

    const title = payload.title.trim();
    const requirements = payload.requirements.trim();
    const rawVideoUrl = payload.videoUrl?.trim() ?? '';
    const rewardPerCompletionRwf = Math.round(Number(payload.rewardPerCompletionRwf));
    const targetCompletions = Math.round(Number(payload.targetCompletions));
    const paymentRef = payload.paymentRef.trim();

    if (!title || !requirements || rewardPerCompletionRwf < 20 || targetCompletions < 1 || paymentRef.length < 3) {
      throw new Error('Valid task details and payment reference required.');
    }
    if (rawVideoUrl && !payload.videoFile && !isSafeMediaOrHttpUrl(rawVideoUrl)) {
      throw new Error('Task video link must be a valid https:// video URL or uploaded video file.');
    }

    const nowIso = new Date().toISOString();
    const totalBudgetRwf = rewardPerCompletionRwf * targetCompletions;
    const paymentCode = `*182*8*1*${settings.momoPayCode}*${totalBudgetRwf}#`;
    const taskId = generateSafeId('tsk');

    let finalVideoUrl: string | undefined;
    let requiredWatchSeconds: number | undefined;
    if (payload.videoFile || rawVideoUrl) {
      const uploaded = await uploadPersistentVideo({
        ownerUid: uid,
        videoId: taskId,
        file: payload.videoFile,
        videoUrl: rawVideoUrl,
        onProgress: payload.onUploadProgress,
      });
      finalVideoUrl = uploaded.url;
      requiredWatchSeconds = Math.max(
        5,
        Math.min(600, Math.round(Number(payload.requiredWatchSeconds) || 15)),
      );
    }

    const batch = writeBatch(db);
    batch.set(
      doc(db, 'customTasks', taskId),
      omitUndefined({
        id: taskId,
        creatorId: uid,
        creatorName: `${user.firstName} ${user.secondName}`,
        title,
        requirements,
        videoUrl: finalVideoUrl,
        requiredWatchSeconds,
        rewardPerCompletionRwf,
        targetCompletions,
        totalBudgetRwf,
        paymentCode,
        paymentRef,
        approvedWorkerIds: [],
        status: 'pending_admin',
        createdAt: nowIso,
        updatedAt: nowIso,
      }),
    );
    const txRec = buildTransactionRecord({
      idPrefix: 'tx-tsk',
      userId: uid,
      refPrefix: 'TSK',
      title: `Custom Task Funding: ${title}`,
      category: 'Campaign Payment',
      channel: `${paymentCode} · Ref ${paymentRef}`,
      amountRwf: totalBudgetRwf,
      direction: 'debit',
      status: 'Pending Review',
      timestamp: nowIso,
    });
    batch.set(doc(db, 'transactions', txRec.id), txRec);
    const notifId = generateSafeId('ntf-tsk');
    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      recipientId: 'admin',
      title: 'Custom Task Pending Approval',
      message: `${user.firstName} ${user.secondName} posted task "${title}" (Ref ${paymentRef}).`,
      category: 'Task',
      read: false,
      createdAt: nowIso,
    });
    await batch.commit();
  },

  startQuizBet: async (uid: string, rawStakeRwf: number): Promise<void> => {
    const stakeRwf = Math.round(Number(rawStakeRwf));
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found.');
      const user = userSnap.data() as RegisteredUser;
      if (stakeRwf < 100 || stakeRwf > user.walletBalanceRwf) {
        throw new Error('Minimum bet stake is 100 RWF and must not exceed wallet balance.');
      }
      const nowIso = new Date().toISOString();
      tx.update(userRef, {
        walletBalanceRwf: user.walletBalanceRwf - stakeRwf,
        updatedAt: nowIso,
      });
      const txRec = buildTransactionRecord({
        idPrefix: 'tx-bet',
        userId: uid,
        refPrefix: 'BET',
        title: `Quiz Bet Stake (${stakeRwf} RWF)`,
        category: 'Quiz Bet',
        channel: '10s Quiz Bet Arena',
        amountRwf: stakeRwf,
        direction: 'debit',
        status: 'Completed',
        timestamp: nowIso,
      });
      tx.set(doc(db, 'transactions', txRec.id), txRec);
    });
  },

  finishQuizBet: async (uid: string, session: BetSession): Promise<void> => {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found.');
      const user = userSnap.data() as RegisteredUser;

      const questionsAnswered = Math.max(0, Math.min(20, Math.round(Number(session.questionsAnswered))));
      const stakeRwf = Math.max(100, Math.round(Number(session.stakeRwf)));
      const multiplier = Math.max(0, Math.min(10, Number(session.multiplier)));
      const won = session.status === 'won_cashed_out';
      const payoutRwf = won
        ? Math.max(0, Math.min(stakeRwf * 10, Math.round(Number(session.payoutRwf))))
        : 0;
      const createdAt = session.createdAt || new Date().toISOString();
      const betId = generateSafeId('bet');

      tx.set(doc(db, 'betSessions', betId), {
        id: betId,
        userId: uid,
        userName: `${user.firstName} ${user.secondName}`,
        category: session.category || 'mixed',
        stakeRwf,
        questionsAnswered,
        multiplier,
        payoutRwf,
        status: won ? 'won_cashed_out' : 'lost',
        endedReason: String(session.endedReason || ''),
        createdAt,
      });

      if (won && payoutRwf > 0) {
        tx.update(userRef, {
          walletBalanceRwf: user.walletBalanceRwf + payoutRwf,
          lastTxId: betId,
          updatedAt: new Date().toISOString(),
        });
        const txRec = buildTransactionRecord({
          idPrefix: 'tx-win',
          userId: uid,
          refPrefix: 'WIN',
          title: `Quiz Bet Cashout (${questionsAnswered} Qs · ${multiplier}x)`,
          category: 'Quiz Win',
          channel: '10s Quiz Bet Arena',
          amountRwf: payoutRwf,
          direction: 'credit',
          status: 'Completed',
          timestamp: createdAt,
        });
        tx.set(doc(db, 'transactions', txRec.id), txRec);
      }
    });
  },

  requestAirtime: async (
    uid: string,
    payload: {
      network: 'MTN Rwanda' | 'Airtel Rwanda';
      serviceType: 'Airtime' | 'Internet Bundle';
      phoneNumber: string;
      amountRwf: number;
      bundleLabel?: string;
    },
  ): Promise<void> => {
    const amountRwf = Math.round(Number(payload.amountRwf));
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found.');
      const user = userSnap.data() as RegisteredUser;
      if (!payload.phoneNumber.trim() || amountRwf < 100 || amountRwf > user.walletBalanceRwf) {
        throw new Error('Valid phone number, minimum 100 RWF, and sufficient balance required.');
      }

      const nowIso = new Date().toISOString();
      const airId = generateSafeId('air');
      tx.update(userRef, {
        walletBalanceRwf: user.walletBalanceRwf - amountRwf,
        updatedAt: nowIso,
      });
      tx.set(
        doc(db, 'airtimeRequests', airId),
        omitUndefined({
          id: airId,
          userId: uid,
          userName: `${user.firstName} ${user.secondName}`,
          network: payload.network,
          serviceType: payload.serviceType,
          phoneNumber: payload.phoneNumber.trim(),
          amountRwf,
          bundleLabel: payload.bundleLabel?.trim() || undefined,
          status: 'pending_admin',
          createdAt: nowIso,
          updatedAt: nowIso,
        }),
      );
      const txRec = buildTransactionRecord({
        idPrefix: 'tx-air',
        userId: uid,
        refPrefix: 'AIR',
        title: `${payload.network} ${payload.serviceType}: ${payload.phoneNumber.trim()}`,
        category: 'Airtime & Data',
        channel: payload.bundleLabel ? `${payload.network} · ${payload.bundleLabel}` : payload.network,
        amountRwf,
        direction: 'debit',
        status: 'Pending Review',
        timestamp: nowIso,
      });
      tx.set(doc(db, 'transactions', txRec.id), txRec);
      const notifId = generateSafeId('ntf-air');
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientId: 'admin',
        title: `${payload.network} ${payload.serviceType} Order`,
        message: `${user.firstName} ${user.secondName} ordered ${amountRwf.toLocaleString('en-US')} RWF for ${payload.phoneNumber.trim()}.`,
        category: 'Airtime',
        read: false,
        createdAt: nowIso,
      });
    });
  },

  lookupWalletAddress: async (address: string): Promise<WalletAddressRecord | null> => {
    const clean = address.trim().toUpperCase();
    if (clean.length < 4 || !/^[a-zA-Z0-9_-]+$/.test(clean)) return null;
    try {
      const snap = await getDoc(doc(db, 'walletDirectory', clean));
      return snap.exists() ? (snap.data() as WalletAddressRecord) : null;
    } catch {
      return null;
    }
  },

  sendP2P: async (
    uid: string,
    payload: { receiverAddress: string; grossAmountRwf: number; note?: string },
  ): Promise<void> => {
    const cleanAddr = payload.receiverAddress.trim().toUpperCase();
    const grossAmountRwf = Math.round(Number(payload.grossAmountRwf));
    const settings = await getCurrentSettings();

    const receiverDirSnap = await getDoc(doc(db, 'walletDirectory', cleanAddr));
    if (!receiverDirSnap.exists()) {
      throw new Error('Receiver wallet address not found.');
    }
    const receiverDir = receiverDirSnap.data() as WalletAddressRecord;
    if (receiverDir.userId === uid) {
      throw new Error('Cannot send funds to your own wallet address.');
    }

    await runTransaction(db, async (tx) => {
      const senderRef = doc(db, 'users', uid);
      const senderSnap = await tx.get(senderRef);
      if (!senderSnap.exists()) throw new Error('Sender account not found.');
      const sender = senderSnap.data() as RegisteredUser;
      if (grossAmountRwf < 100 || grossAmountRwf > sender.walletBalanceRwf) {
        throw new Error('Minimum transfer is 100 RWF and cannot exceed wallet balance.');
      }

      const taxPercent = settings.sendMoneyTaxPercent ?? 10;
      const taxRwf = Math.round((grossAmountRwf * taxPercent) / 100);
      const netAmountRwf = Math.max(0, grossAmountRwf - taxRwf);
      const nowIso = new Date().toISOString();
      const senderFullName = `${sender.firstName} ${sender.secondName}`;
      const p2pId = generateSafeId('p2p');

      tx.update(senderRef, {
        walletBalanceRwf: sender.walletBalanceRwf - grossAmountRwf,
        updatedAt: nowIso,
      });
      tx.set(
        doc(db, 'p2pTransfers', p2pId),
        omitUndefined({
          id: p2pId,
          senderId: uid,
          senderName: senderFullName,
          senderAddress: sender.accountNumber,
          receiverId: receiverDir.userId,
          receiverName: receiverDir.fullName,
          receiverAddress: receiverDir.address,
          grossAmountRwf,
          taxPercent,
          taxRwf,
          netAmountRwf,
          note: payload.note?.trim() || undefined,
          status: 'completed',
          claimedByReceiver: false,
          createdAt: nowIso,
        }),
      );
      const txRec = buildTransactionRecord({
        idPrefix: 'tx-snd',
        userId: uid,
        refPrefix: 'SND',
        title: `Sent to ${receiverDir.fullName} (${receiverDir.address})`,
        category: 'Transfer Sent',
        channel: `${taxPercent}% system tax (${taxRwf} RWF) · Net ${netAmountRwf} RWF`,
        amountRwf: grossAmountRwf,
        feeRwf: taxRwf,
        direction: 'debit',
        status: 'Completed',
        timestamp: nowIso,
      });
      tx.set(doc(db, 'transactions', txRec.id), txRec);
    });
  },

  fxExchange: async (
    uid: string,
    direction: FxExchangeRecord['direction'],
    rawFromAmount: number,
  ): Promise<void> => {
    const settings = await getCurrentSettings();
    const rate = Math.max(100, settings.rwfPerUsdRate || 1380);
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found.');
      const user = userSnap.data() as RegisteredUser;

      const usdBal = user.walletBalanceUsd ?? 0;
      const usdtBal = user.usdtBalance ?? 0;
      let nextRwf = user.walletBalanceRwf;
      let nextUsd = usdBal;
      let nextUsdt = usdtBal;
      let fromAmount = Number(rawFromAmount);
      let toAmount = 0;
      let rateApplied = 1;
      let rwfEquivalent = 0;

      if (direction === 'RWF_TO_USD') {
        fromAmount = Math.round(fromAmount);
        if (fromAmount < 100) throw new Error('Minimum RWF exchange is 100 RWF.');
        if (fromAmount > user.walletBalanceRwf) throw new Error('Insufficient RWF wallet balance.');
        toAmount = Number((fromAmount / rate).toFixed(2));
        if (toAmount <= 0) throw new Error('Amount too small for USD conversion.');
        nextRwf = user.walletBalanceRwf - fromAmount;
        nextUsd = Number((usdBal + toAmount).toFixed(2));
        rateApplied = rate;
        rwfEquivalent = fromAmount;
      } else if (direction === 'USD_TO_RWF') {
        if (!Number.isFinite(fromAmount) || fromAmount <= 0 || fromAmount > usdBal) {
          throw new Error('Insufficient USD wallet balance.');
        }
        toAmount = Math.round(fromAmount * rate);
        nextUsd = Number((usdBal - fromAmount).toFixed(2));
        nextRwf = user.walletBalanceRwf + toAmount;
        rateApplied = rate;
        rwfEquivalent = toAmount;
      } else if (direction === 'USD_TO_USDT') {
        if (!Number.isFinite(fromAmount) || fromAmount <= 0 || fromAmount > usdBal) {
          throw new Error('Insufficient USD wallet balance.');
        }
        toAmount = Number(fromAmount.toFixed(2));
        nextUsd = Number((usdBal - fromAmount).toFixed(2));
        nextUsdt = Number((usdtBal + toAmount).toFixed(2));
        rwfEquivalent = Math.round(toAmount * rate);
      } else if (direction === 'USDT_TO_USD') {
        if (!Number.isFinite(fromAmount) || fromAmount <= 0 || fromAmount > usdtBal) {
          throw new Error('Insufficient USDT wallet balance.');
        }
        toAmount = Number(fromAmount.toFixed(2));
        nextUsdt = Number((usdtBal - fromAmount).toFixed(2));
        nextUsd = Number((usdBal + toAmount).toFixed(2));
        rwfEquivalent = Math.round(toAmount * rate);
      } else {
        throw new Error('Invalid conversion direction.');
      }

      const nowIso = new Date().toISOString();
      const fxId = generateSafeId('fx');

      tx.set(doc(db, 'fxExchanges', fxId), {
        id: fxId,
        userId: uid,
        userName: `${user.firstName} ${user.secondName}`,
        direction,
        fromAmount,
        toAmount,
        rateApplied,
        createdAt: nowIso,
      });
      tx.update(userRef, {
        walletBalanceRwf: nextRwf,
        walletBalanceUsd: nextUsd,
        usdtBalance: nextUsdt,
        lastTxId: fxId,
        updatedAt: nowIso,
      });
      const txRec = buildTransactionRecord({
        idPrefix: 'tx-fx',
        userId: uid,
        refPrefix: 'FX',
        title: `FX ${direction.replace(/_/g, ' ')}: ${fromAmount} → ${toAmount}`,
        category: 'Currency Exchange',
        channel: `Rate ${rateApplied}`,
        amountRwf: rwfEquivalent,
        direction: direction === 'USD_TO_RWF' ? 'credit' : 'debit',
        status: 'Completed',
        timestamp: nowIso,
      });
      tx.set(doc(db, 'transactions', txRec.id), txRec);
    });
  },

  usdtSavingsMove: async (
    uid: string,
    action: 'deposit' | 'withdraw',
    rawAmountUsdt: number,
  ): Promise<void> => {
    const amountUsdt = Number(rawAmountUsdt);
    const settings = await getCurrentSettings();
    const rate = Math.max(100, settings.rwfPerUsdRate || 1380);
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found.');
      const user = userSnap.data() as RegisteredUser;
      const usdtBal = user.usdtBalance ?? 0;
      const usdtSav = user.usdtSavingsBalance ?? 0;

      if (!Number.isFinite(amountUsdt) || amountUsdt <= 0) {
        throw new Error('Enter a valid USDT amount.');
      }
      if (action === 'deposit' && amountUsdt > usdtBal) {
        throw new Error('Insufficient USDT wallet balance.');
      }
      if (action === 'withdraw' && amountUsdt > usdtSav) {
        throw new Error('Amount exceeds USDT Savings Vault balance.');
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

      tx.update(userRef, {
        usdtBalance: nextUsdt,
        usdtSavingsBalance: nextSav,
        updatedAt: nowIso,
      });
      const txRec = buildTransactionRecord({
        idPrefix: 'tx-usav',
        userId: uid,
        refPrefix: 'USAV',
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
      tx.set(doc(db, 'transactions', txRec.id), txRec);
    });
  },

  createUsdtRequest: async (
    uid: string,
    payload: {
      actionType: UsdtRequest['actionType'];
      amountUsdt: number;
      network: UsdtRequest['network'];
      destinationOrTxRef: string;
      note?: string;
    },
  ): Promise<void> => {
    const amountUsdt = Number(Number(payload.amountUsdt).toFixed(2));
    const dest = payload.destinationOrTxRef.trim();
    if (!Number.isFinite(amountUsdt) || amountUsdt < 1 || dest.length < 4) {
      throw new Error('Minimum 1.00 USDT and valid Binance Pay ID / Address / TxHash required.');
    }
    const settings = await getCurrentSettings();
    const rate = Math.max(100, settings.rwfPerUsdRate || 1380);

    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', uid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found.');
      const user = userSnap.data() as RegisteredUser;
      const usdtBal = user.usdtBalance ?? 0;
      const isDebit = payload.actionType === 'withdraw' || payload.actionType === 'send_binance';
      if (isDebit && amountUsdt > usdtBal) {
        throw new Error(`Insufficient USDT balance (${usdtBal.toFixed(2)} USDT available).`);
      }

      const nowIso = new Date().toISOString();
      const usdtId = generateSafeId('usdt');
      if (isDebit) {
        tx.update(userRef, {
          usdtBalance: Number((usdtBal - amountUsdt).toFixed(2)),
          updatedAt: nowIso,
        });
      }
      tx.set(
        doc(db, 'usdtRequests', usdtId),
        omitUndefined({
          id: usdtId,
          userId: uid,
          userName: `${user.firstName} ${user.secondName}`,
          actionType: payload.actionType,
          amountUsdt,
          network: payload.network,
          destinationOrTxRef: dest,
          note: payload.note?.trim() || undefined,
          status: 'pending_admin',
          createdAt: nowIso,
          updatedAt: nowIso,
        }),
      );
      const txRec = buildTransactionRecord({
        idPrefix: 'tx-usdt',
        userId: uid,
        refPrefix: 'USDT',
        title:
          payload.actionType === 'deposit'
            ? `USDT Deposit (${amountUsdt.toFixed(2)} USDT)`
            : payload.actionType === 'send_binance'
              ? `Send ${amountUsdt.toFixed(2)} USDT to Binance`
              : `Withdraw ${amountUsdt.toFixed(2)} USDT`,
        category: payload.actionType === 'deposit' ? 'USDT Deposit' : 'USDT Send / Withdraw',
        channel: `${payload.network} · ${dest}`,
        amountRwf: Math.round(amountUsdt * rate),
        direction: payload.actionType === 'deposit' ? 'credit' : 'debit',
        status: 'Pending Review',
        timestamp: nowIso,
      });
      tx.set(doc(db, 'transactions', txRec.id), txRec);
      const notifId = generateSafeId('ntf-usdt');
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientId: 'admin',
        title: 'USDT / Binance Request',
        message: `${user.firstName} ${user.secondName} submitted ${payload.actionType} (${amountUsdt.toFixed(2)} USDT).`,
        category: 'USDT',
        read: false,
        createdAt: nowIso,
      });
    });
  },

  /* ---------------------------------------------------------------------- */
  /* Admin Operations                                                       */
  /* ---------------------------------------------------------------------- */
  adminApproveUser: async (userId: string): Promise<void> => {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found.');
      const targetUser = userSnap.data() as RegisteredUser;
      if (targetUser.accountStatus !== 'pending_approval') {
        throw new Error(`User is already ${targetUser.accountStatus.replace(/_/g, ' ')}.`);
      }
      const nowIso = new Date().toISOString();
      tx.update(userRef, {
        accountStatus: 'awaiting_payment',
        updatedAt: nowIso,
      });
      const notifId = generateSafeId('ntf-apv');
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientId: userId,
        title: 'Registration Approved',
        message: 'Your E-Finance profile was approved. Complete activation payment to unlock your dashboard.',
        category: 'Account',
        read: false,
        createdAt: nowIso,
      });
    });
  },

  adminActivateUser: async (userId: string): Promise<void> => {
    const settings = await getCurrentSettings();
    const bonus = settings.welcomeBonusRwf;

    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found.');
      const targetUser = userSnap.data() as RegisteredUser;
      if (targetUser.accountStatus === 'active') {
        throw new Error('Account is already active.');
      }
      if (targetUser.accountStatus === 'suspended') {
        throw new Error('Suspended accounts cannot be activated with welcome bonus. Unsuspend first.');
      }
      const nowIso = new Date().toISOString();

      let refUserSnap = null;
      if (targetUser.referredByUserId) {
        refUserSnap = await tx.get(doc(db, 'users', targetUser.referredByUserId));
      }

      tx.update(userRef, {
        accountStatus: 'active',
        walletBalanceRwf: targetUser.walletBalanceRwf + bonus,
        bonusBalanceRwf: targetUser.bonusBalanceRwf + bonus,
        updatedAt: nowIso,
      });

      const bnsTx = buildTransactionRecord({
        idPrefix: 'tx-bns',
        userId,
        refPrefix: 'BNS',
        title: `Welcome Bonus (${bonus} RWF)`,
        category: 'Bonus',
        channel: 'E-Finance System Activation',
        amountRwf: bonus,
        direction: 'credit',
        status: 'Completed',
        timestamp: nowIso,
      });
      tx.set(doc(db, 'transactions', bnsTx.id), bnsTx);

      const notifId = generateSafeId('ntf-actv');
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientId: userId,
        title: 'Account Activated',
        message: `Your E-Finance account is now active with a ${bonus.toLocaleString('en-US')} RWF welcome bonus.`,
        category: 'Account',
        read: false,
        createdAt: nowIso,
      });

      if (refUserSnap?.exists()) {
        const refUser = refUserSnap.data() as RegisteredUser;
        const referralCommRwf = Math.round(
          (settings.activationFeeRwf * settings.referralCommissionPercent) / 100,
        );
        tx.update(doc(db, 'users', refUser.id), {
          spinCredits: refUser.spinCredits + 1,
          walletBalanceRwf: refUser.walletBalanceRwf + referralCommRwf,
          updatedAt: nowIso,
        });
        const refTx = buildTransactionRecord({
          idPrefix: 'tx-ref',
          userId: refUser.id,
          refPrefix: 'REF',
          title: `Referral Bonus +1 Spin (${targetUser.firstName} activated)`,
          category: 'Referral Commission',
          channel: `${settings.referralCommissionPercent}% Activation Commission`,
          amountRwf: referralCommRwf,
          direction: 'credit',
          status: 'Completed',
          timestamp: nowIso,
        });
        tx.set(doc(db, 'transactions', refTx.id), refTx);
        const refNotifId = generateSafeId('ntf-ref');
        tx.set(doc(db, 'notifications', refNotifId), {
          id: refNotifId,
          recipientId: refUser.id,
          title: 'Referral Reward Credited',
          message: `You earned ${referralCommRwf.toLocaleString('en-US')} RWF + 1 Spin Credit from ${targetUser.firstName}'s activation.`,
          category: 'Referral',
          read: false,
          createdAt: nowIso,
        });
      }
    });

    const pendingActTxSnap = await getDocs(
      query(collection(db, 'transactions'), where('userId', '==', userId)),
    );
    const batch = writeBatch(db);
    let hasUpdates = false;
    for (const d of pendingActTxSnap.docs) {
      const txItem = d.data() as TransactionRecord;
      if (txItem.category === 'Activation' && txItem.status === 'Pending Review') {
        batch.update(d.ref, { status: 'Completed' });
        hasUpdates = true;
      }
    }
    if (hasUpdates) await batch.commit();
  },

  adminToggleSuspend: async (userId: string): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) throw new Error('User not found.');
    const user = snap.data() as RegisteredUser;
    const nextStatus = user.accountStatus === 'suspended' ? 'active' : 'suspended';
    await updateDoc(userRef, {
      accountStatus: nextStatus,
      updatedAt: new Date().toISOString(),
    });
  },

  adminUpdateUser: async (user: RegisteredUser): Promise<void> => {
    const nowIso = new Date().toISOString();
    await setDoc(
      doc(db, 'users', user.id),
      omitUndefined({
        ...user,
        email: user.email.toLowerCase(),
        updatedAt: nowIso,
      }),
      { merge: true },
    );
  },

  adminDeleteUser: async (userId: string): Promise<void> => {
    const userSnap = await getDoc(doc(db, 'users', userId));
    const user = userSnap.exists() ? (userSnap.data() as RegisteredUser) : null;

    const collectionsToClear: Array<{ col: string; field: string }> = [
      { col: 'savingsGoals', field: 'userId' },
      { col: 'loans', field: 'userId' },
      { col: 'investments', field: 'userId' },
      { col: 'spinHistory', field: 'userId' },
      { col: 'withdrawals', field: 'userId' },
      { col: 'taskSubmissions', field: 'workerId' },
      { col: 'betSessions', field: 'userId' },
      { col: 'airtimeRequests', field: 'userId' },
      { col: 'fxExchanges', field: 'userId' },
      { col: 'usdtRequests', field: 'userId' },
      { col: 'transactions', field: 'userId' },
      { col: 'notifications', field: 'recipientId' },
    ];

    const snaps = await Promise.all(
      collectionsToClear.map(({ col, field }) =>
        getDocs(query(collection(db, col), where(field, '==', userId))),
      ),
    );

    const batch = writeBatch(db);
    for (const snap of snaps) {
      for (const d of snap.docs) {
        batch.delete(d.ref);
      }
    }
    if (user) {
      batch.delete(doc(db, 'phoneDirectory', normalizePhoneKey(user.phone)));
      batch.delete(doc(db, 'referralDirectory', user.referralCode));
      batch.delete(doc(db, 'walletDirectory', user.accountNumber));
    }
    batch.delete(doc(db, 'users', userId));
    await batch.commit();
  },

  adminReviewKyc: async (
    userId: string,
    decision: 'approved' | 'rejected',
    note?: string,
  ): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) throw new Error('User not found.');
    const user = snap.data() as RegisteredUser;
    if (user.kycStatus === decision) {
      throw new Error(`KYC is already ${decision}.`);
    }
    const nowIso = new Date().toISOString();
    const nextKycData = user.kycData
      ? omitUndefined({
          ...user.kycData,
          reviewNote: note?.trim() || user.kycData.reviewNote,
        })
      : undefined;

    const batch = writeBatch(db);
    batch.update(
      userRef,
      omitUndefined({
        kycStatus: decision,
        kycData: nextKycData,
        updatedAt: nowIso,
      }),
    );
    const notifId = generateSafeId('ntf-kyc');
    batch.set(doc(db, 'notifications', notifId), {
      id: notifId,
      recipientId: userId,
      title: decision === 'approved' ? 'Rwanda KYC Approved' : 'Rwanda KYC Rejected',
      message:
        decision === 'approved'
          ? 'Your Rwanda KYC verification is approved. Smart Savings and Mobile Money withdrawals are now unlocked.'
          : `Your Rwanda KYC submission was rejected.${note?.trim() ? ` Reason: ${note.trim()}` : ''}`,
      category: 'KYC',
      read: false,
      createdAt: nowIso,
    });
    await batch.commit();
  },

  adminCreateVideo: async (payload: {
    title: string;
    description: string;
    videoUrl: string;
    videoFile?: File | null;
    requiredWatchSeconds?: number;
    rewardPerViewRwf: number;
    targetViewers: number;
    onUploadProgress?: (percent: number, stage: string) => void;
  }): Promise<void> => {
    const title = payload.title.trim();
    const description = payload.description.trim();
    const rawVideoUrl = payload.videoUrl.trim();
    const requiredWatchSeconds = Math.max(
      5,
      Math.min(600, Math.round(Number(payload.requiredWatchSeconds) || 15)),
    );
    const rewardPerViewRwf = Math.round(Number(payload.rewardPerViewRwf));
    const targetViewers = Math.round(Number(payload.targetViewers));
    if (!title || rewardPerViewRwf < 1 || targetViewers < 1) {
      throw new Error('Provide valid title, reward per view, and target viewers.');
    }
    if (!payload.videoFile && !isSafeMediaOrHttpUrl(rawVideoUrl)) {
      throw new Error('Upload a valid video file or paste a valid https:// video URL (MP4, YouTube, Vimeo, or Google Drive).');
    }

    const nowIso = new Date().toISOString();
    const vidId = generateSafeId('vid');
    const uploadedVideo = await uploadPersistentVideo({
      ownerUid: 'admin',
      videoId: vidId,
      file: payload.videoFile,
      videoUrl: rawVideoUrl,
      onProgress: payload.onUploadProgress,
    });

    await setDoc(doc(db, 'videoCampaigns', vidId), {
      id: vidId,
      creatorId: 'admin',
      creatorName: 'E-Finance Admin',
      title,
      description,
      videoUrl: uploadedVideo.url,
      requiredWatchSeconds,
      rewardPerViewRwf,
      targetViewers,
      totalBudgetRwf: rewardPerViewRwf * targetViewers,
      paymentCode: 'ADMIN-DIRECT',
      paymentRef: 'ADMIN-PUBLISHED',
      watchedByUserIds: [],
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await syncPublicStatsCounts();
  },

  adminReviewVideo: async (id: string, decision: 'active' | 'rejected'): Promise<void> => {
    const vidRef = doc(db, 'videoCampaigns', id);
    const snap = await getDoc(vidRef);
    if (!snap.exists()) throw new Error('Video campaign not found.');
    const vid = snap.data() as ShortVideoCampaign;
    if (vid.status !== 'pending_admin') {
      throw new Error('Video campaign has already been reviewed.');
    }
    const nowIso = new Date().toISOString();
    const batch = writeBatch(db);
    batch.update(vidRef, { status: decision, updatedAt: nowIso });
    if (vid.creatorId !== 'admin') {
      const notifId = generateSafeId('ntf-vid');
      batch.set(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientId: vid.creatorId,
        title: decision === 'active' ? 'Video Campaign Approved' : 'Video Campaign Rejected',
        message: `Your video campaign "${vid.title}" was ${decision === 'active' ? 'approved and published' : 'rejected'}.`,
        category: 'Video',
        read: false,
        createdAt: nowIso,
      });
    }
    await batch.commit();
    await syncPublicStatsCounts();
  },

  adminCreateTask: async (payload: {
    title: string;
    requirements: string;
    videoUrl?: string;
    videoFile?: File | null;
    requiredWatchSeconds?: number;
    rewardPerCompletionRwf: number;
    targetCompletions: number;
    onUploadProgress?: (percent: number, stage: string) => void;
  }): Promise<void> => {
    const title = payload.title.trim();
    const requirements = payload.requirements.trim();
    const rawVideoUrl = payload.videoUrl?.trim() ?? '';
    const rewardPerCompletionRwf = Math.round(Number(payload.rewardPerCompletionRwf));
    const targetCompletions = Math.round(Number(payload.targetCompletions));
    if (!title || !requirements || rewardPerCompletionRwf < 1 || targetCompletions < 1) {
      throw new Error('Provide valid task title, requirements, reward, and target.');
    }
    if (rawVideoUrl && !payload.videoFile && !isSafeMediaOrHttpUrl(rawVideoUrl)) {
      throw new Error('Task video link must be a valid https:// video URL or uploaded video file.');
    }

    const nowIso = new Date().toISOString();
    const taskId = generateSafeId('tsk');

    let finalVideoUrl: string | undefined;
    let requiredWatchSeconds: number | undefined;
    if (payload.videoFile || rawVideoUrl) {
      const uploaded = await uploadPersistentVideo({
        ownerUid: 'admin',
        videoId: taskId,
        file: payload.videoFile,
        videoUrl: rawVideoUrl,
        onProgress: payload.onUploadProgress,
      });
      finalVideoUrl = uploaded.url;
      requiredWatchSeconds = Math.max(
        5,
        Math.min(600, Math.round(Number(payload.requiredWatchSeconds) || 15)),
      );
    }

    await setDoc(
      doc(db, 'customTasks', taskId),
      omitUndefined({
        id: taskId,
        creatorId: 'admin',
        creatorName: 'E-Finance Admin',
        title,
        requirements,
        videoUrl: finalVideoUrl,
        requiredWatchSeconds,
        rewardPerCompletionRwf,
        targetCompletions,
        totalBudgetRwf: rewardPerCompletionRwf * targetCompletions,
        paymentCode: 'ADMIN-DIRECT',
        paymentRef: 'ADMIN-PUBLISHED',
        approvedWorkerIds: [],
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      }),
    );
    await syncPublicStatsCounts();
  },

  adminReviewTask: async (id: string, decision: 'active' | 'rejected'): Promise<void> => {
    const taskRef = doc(db, 'customTasks', id);
    const snap = await getDoc(taskRef);
    if (!snap.exists()) throw new Error('Custom task not found.');
    const task = snap.data() as CustomTask;
    if (task.status !== 'pending_admin') {
      throw new Error('Custom task has already been reviewed.');
    }
    const nowIso = new Date().toISOString();
    const batch = writeBatch(db);
    batch.update(taskRef, { status: decision, updatedAt: nowIso });
    if (task.creatorId !== 'admin') {
      const notifId = generateSafeId('ntf-tsk');
      batch.set(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientId: task.creatorId,
        title: decision === 'active' ? 'Custom Task Approved' : 'Custom Task Rejected',
        message: `Your task "${task.title}" was ${decision === 'active' ? 'approved and published' : 'rejected'}.`,
        category: 'Task',
        read: false,
        createdAt: nowIso,
      });
    }
    await batch.commit();
    await syncPublicStatsCounts();
  },

  adminReviewSubmission: async (
    submissionId: string,
    decision: 'approved' | 'rejected',
    note?: string,
  ): Promise<void> => {
    await runTransaction(db, async (tx) => {
      const subRef = doc(db, 'taskSubmissions', submissionId);
      const subSnap = await tx.get(subRef);
      if (!subSnap.exists()) throw new Error('Submission not found.');
      const sub = subSnap.data() as TaskSubmission;
      if (sub.status !== 'pending_admin') throw new Error('Submission already reviewed.');

      const workerRef = doc(db, 'users', sub.workerId);
      const taskRef = doc(db, 'customTasks', sub.taskId);
      const [workerSnap, taskSnap] = await Promise.all([tx.get(workerRef), tx.get(taskRef)]);
      const nowIso = new Date().toISOString();

      tx.update(
        subRef,
        omitUndefined({
          status: decision,
          adminNote: note?.trim() || undefined,
          reviewedAt: nowIso,
        }),
      );

      if (decision === 'approved' && workerSnap.exists()) {
        const worker = workerSnap.data() as RegisteredUser;
        tx.update(workerRef, {
          walletBalanceRwf: worker.walletBalanceRwf + sub.rewardRwf,
          updatedAt: nowIso,
        });
        if (taskSnap.exists()) {
          const task = taskSnap.data() as CustomTask;
          const approvedList = task.approvedWorkerIds.includes(sub.workerId)
            ? task.approvedWorkerIds
            : [...task.approvedWorkerIds, sub.workerId];
          const nextStatus =
            approvedList.length >= task.targetCompletions ? 'completed' : task.status;
          tx.update(taskRef, {
            approvedWorkerIds: approvedList,
            status: nextStatus,
            updatedAt: nowIso,
          });
        }
        const txRec = buildTransactionRecord({
          idPrefix: 'tx-tsk',
          userId: sub.workerId,
          refPrefix: 'TSK',
          title: `Task Approved: ${sub.taskTitle}`,
          category: 'Task Reward',
          channel: 'Admin Verified Completion',
          amountRwf: sub.rewardRwf,
          direction: 'credit',
          status: 'Completed',
          timestamp: nowIso,
        });
        tx.set(doc(db, 'transactions', txRec.id), txRec);
      }

      const notifId = generateSafeId('ntf-sub');
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientId: sub.workerId,
        title: decision === 'approved' ? 'Task Proof Approved' : 'Task Proof Rejected',
        message:
          decision === 'approved'
            ? `Your submission for "${sub.taskTitle}" earned ${sub.rewardRwf.toLocaleString('en-US')} RWF.`
            : `Your submission for "${sub.taskTitle}" was rejected.${note?.trim() ? ` Note: ${note.trim()}` : ''}`,
        category: 'Task',
        read: false,
        createdAt: nowIso,
      });
    });
    await syncPublicStatsCounts();
  },

  adminReviewLoan: async (loanId: string, decision: 'approved' | 'rejected'): Promise<void> => {
    let targetUserId = '';
    let principal = 0;
    await runTransaction(db, async (tx) => {
      const loanRef = doc(db, 'loans', loanId);
      const loanSnap = await tx.get(loanRef);
      if (!loanSnap.exists()) throw new Error('Loan not found.');
      const loan = loanSnap.data() as LoanRequest;
      if (loan.status !== 'pending_admin') throw new Error('Loan already reviewed.');
      targetUserId = loan.userId;
      principal = loan.principalRwf;

      const userRef = doc(db, 'users', loan.userId);
      const userSnap = await tx.get(userRef);
      const nowIso = new Date().toISOString();

      tx.update(loanRef, { status: decision, updatedAt: nowIso });
      if (decision === 'approved' && userSnap.exists()) {
        const user = userSnap.data() as RegisteredUser;
        tx.update(userRef, {
          walletBalanceRwf: user.walletBalanceRwf + loan.principalRwf,
          updatedAt: nowIso,
        });
      }
      const notifId = generateSafeId('ntf-ln');
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientId: loan.userId,
        title: decision === 'approved' ? 'Loan Approved & Disbursed' : 'Loan Request Rejected',
        message:
          decision === 'approved'
            ? `${loan.principalRwf.toLocaleString('en-US')} RWF (${loan.product}) was credited to your wallet.`
            : `Your loan request for ${loan.principalRwf.toLocaleString('en-US')} RWF was declined.`,
        category: 'Loan',
        read: false,
        createdAt: nowIso,
      });
    });

    const txSnap = await getDocs(query(collection(db, 'transactions'), where('userId', '==', targetUserId)));
    const batch = writeBatch(db);
    let dirty = false;
    for (const d of txSnap.docs) {
      const t = d.data() as TransactionRecord;
      if (t.category === 'Loan' && t.status === 'Pending Review' && t.amountRwf === principal) {
        batch.update(d.ref, { status: decision === 'approved' ? 'Completed' : 'Rejected' });
        dirty = true;
      }
    }
    if (dirty) await batch.commit();
  },

  adminReviewInvestment: async (invId: string, decision: 'active' | 'rejected'): Promise<void> => {
    const settings = await getCurrentSettings();
    let investorId = '';
    let depositRwf = 0;

    await runTransaction(db, async (tx) => {
      const invRef = doc(db, 'investments', invId);
      const invSnap = await tx.get(invRef);
      if (!invSnap.exists()) throw new Error('Investment not found.');
      const inv = invSnap.data() as UserInvestment;
      if (inv.status !== 'pending_admin') throw new Error('Investment already reviewed.');
      investorId = inv.userId;
      depositRwf = inv.depositRwf;

      const userSnap = await tx.get(doc(db, 'users', inv.userId));
      const investor = userSnap.exists() ? (userSnap.data() as RegisteredUser) : null;
      let refUserSnap = null;
      if (decision === 'active' && investor?.referredByUserId) {
        refUserSnap = await tx.get(doc(db, 'users', investor.referredByUserId));
      }

      const nowIso = new Date().toISOString();
      tx.update(invRef, {
        status: decision,
        lastRoiCreditedAt: decision === 'active' ? nowIso : null,
        updatedAt: nowIso,
      });

      const notifId = generateSafeId('ntf-inv');
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientId: inv.userId,
        title: decision === 'active' ? 'Investment Plan Activated' : 'Investment Deposit Rejected',
        message:
          decision === 'active'
            ? `Your ${inv.planName} is now active and earning ${inv.dailyReturnRwf.toLocaleString('en-US')} RWF every 24h.`
            : `Your ${inv.planName} deposit verification was rejected.`,
        category: 'Investment',
        read: false,
        createdAt: nowIso,
      });

      if (decision === 'active' && refUserSnap?.exists()) {
        const refUser = refUserSnap.data() as RegisteredUser;
        const commRwf = Math.round((inv.depositRwf * settings.referralCommissionPercent) / 100);
        if (commRwf > 0) {
          tx.update(doc(db, 'users', refUser.id), {
            walletBalanceRwf: refUser.walletBalanceRwf + commRwf,
            updatedAt: nowIso,
          });
          const refTx = buildTransactionRecord({
            idPrefix: 'tx-refinv',
            userId: refUser.id,
            refPrefix: 'REF',
            title: `10% Investment Commission (${inv.userName})`,
            category: 'Referral Commission',
            channel: `${inv.planName} Referral Commission`,
            amountRwf: commRwf,
            direction: 'credit',
            status: 'Completed',
            timestamp: nowIso,
          });
          tx.set(doc(db, 'transactions', refTx.id), refTx);
        }
      }
    });

    const txSnap = await getDocs(query(collection(db, 'transactions'), where('userId', '==', investorId)));
    const batch = writeBatch(db);
    let dirty = false;
    for (const d of txSnap.docs) {
      const t = d.data() as TransactionRecord;
      if (t.category === 'Investment Deposit' && t.status === 'Pending Review' && t.amountRwf === depositRwf) {
        batch.update(d.ref, { status: decision === 'active' ? 'Completed' : 'Rejected' });
        dirty = true;
      }
    }
    if (dirty) await batch.commit();
  },

  adminReviewWithdrawal: async (wdId: string, decision: 'paid' | 'rejected'): Promise<void> => {
    let targetUserId = '';
    let grossAmount = 0;

    await runTransaction(db, async (tx) => {
      const wdRef = doc(db, 'withdrawals', wdId);
      const wdSnap = await tx.get(wdRef);
      if (!wdSnap.exists()) throw new Error('Withdrawal not found.');
      const wd = wdSnap.data() as WithdrawalRequest;
      if (wd.status !== 'pending_admin') throw new Error('Withdrawal already processed.');
      targetUserId = wd.userId;
      grossAmount = wd.grossAmountRwf;

      const userRef = doc(db, 'users', wd.userId);
      const userSnap = await tx.get(userRef);
      const nowIso = new Date().toISOString();

      tx.update(wdRef, { status: decision, updatedAt: nowIso });
      if (userSnap.exists()) {
        const user = userSnap.data() as RegisteredUser;
        if (decision === 'rejected') {
          tx.update(userRef, {
            walletBalanceRwf: user.walletBalanceRwf + wd.grossAmountRwf,
            updatedAt: nowIso,
          });
        } else {
          tx.update(userRef, {
            hasCompletedFirstWithdrawal: true,
            updatedAt: nowIso,
          });
        }
      }
      const notifId = generateSafeId('ntf-wd');
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientId: wd.userId,
        title: decision === 'paid' ? 'Mobile Money Withdrawal Paid' : 'Withdrawal Rejected & Refunded',
        message:
          decision === 'paid'
            ? `Your payout of ${wd.netAmountRwf.toLocaleString('en-US')} RWF to ${wd.destinationValue} has been sent.`
            : `Your withdrawal of ${wd.grossAmountRwf.toLocaleString('en-US')} RWF was declined and refunded to your wallet.`,
        category: 'Withdrawal',
        read: false,
        createdAt: nowIso,
      });
    });

    const txSnap = await getDocs(query(collection(db, 'transactions'), where('userId', '==', targetUserId)));
    const batch = writeBatch(db);
    let dirty = false;
    for (const d of txSnap.docs) {
      const t = d.data() as TransactionRecord;
      if (t.category === 'Withdrawal' && t.status === 'Pending Review' && t.amountRwf === grossAmount) {
        batch.update(d.ref, { status: decision === 'paid' ? 'Completed' : 'Rejected' });
        dirty = true;
      }
    }
    if (dirty) await batch.commit();
  },

  adminReviewAirtime: async (reqId: string, decision: 'approved' | 'rejected'): Promise<void> => {
    let targetUserId = '';
    let amountRwf = 0;

    await runTransaction(db, async (tx) => {
      const airRef = doc(db, 'airtimeRequests', reqId);
      const airSnap = await tx.get(airRef);
      if (!airSnap.exists()) throw new Error('Airtime request not found.');
      const air = airSnap.data() as AirtimeRequest;
      if (air.status !== 'pending_admin') throw new Error('Airtime request already processed.');
      targetUserId = air.userId;
      amountRwf = air.amountRwf;

      const userRef = doc(db, 'users', air.userId);
      const userSnap = await tx.get(userRef);
      const nowIso = new Date().toISOString();

      tx.update(airRef, { status: decision, updatedAt: nowIso });
      if (decision === 'rejected' && userSnap.exists()) {
        const user = userSnap.data() as RegisteredUser;
        tx.update(userRef, {
          walletBalanceRwf: user.walletBalanceRwf + air.amountRwf,
          updatedAt: nowIso,
        });
      }
      const notifId = generateSafeId('ntf-air');
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientId: air.userId,
        title: decision === 'approved' ? `${air.serviceType} Delivered` : `${air.serviceType} Rejected`,
        message:
          decision === 'approved'
            ? `Your ${air.network} ${air.serviceType} (${air.amountRwf.toLocaleString('en-US')} RWF) for ${air.phoneNumber} was delivered.`
            : `Your ${air.network} ${air.serviceType} order was rejected and refunded.`,
        category: 'Airtime',
        read: false,
        createdAt: nowIso,
      });
    });

    const txSnap = await getDocs(query(collection(db, 'transactions'), where('userId', '==', targetUserId)));
    const batch = writeBatch(db);
    let dirty = false;
    for (const d of txSnap.docs) {
      const t = d.data() as TransactionRecord;
      if (t.category === 'Airtime & Data' && t.status === 'Pending Review' && t.amountRwf === amountRwf) {
        batch.update(d.ref, { status: decision === 'approved' ? 'Completed' : 'Rejected' });
        dirty = true;
      }
    }
    if (dirty) await batch.commit();
  },

  adminReviewUsdt: async (reqId: string, decision: 'approved' | 'rejected'): Promise<void> => {
    let targetUserId = '';
    let targetCategory: TransactionRecord['category'] = 'USDT Deposit';

    await runTransaction(db, async (tx) => {
      const usdtRef = doc(db, 'usdtRequests', reqId);
      const usdtSnap = await tx.get(usdtRef);
      if (!usdtSnap.exists()) throw new Error('USDT request not found.');
      const usdtReq = usdtSnap.data() as UsdtRequest;
      if (usdtReq.status !== 'pending_admin') throw new Error('USDT request already processed.');
      targetUserId = usdtReq.userId;
      targetCategory = usdtReq.actionType === 'deposit' ? 'USDT Deposit' : 'USDT Send / Withdraw';

      const userRef = doc(db, 'users', usdtReq.userId);
      const userSnap = await tx.get(userRef);
      const nowIso = new Date().toISOString();

      tx.update(usdtRef, { status: decision, updatedAt: nowIso });
      const isDebit = usdtReq.actionType === 'withdraw' || usdtReq.actionType === 'send_binance';
      if (
        userSnap.exists() &&
        ((usdtReq.actionType === 'deposit' && decision === 'approved') || (isDebit && decision === 'rejected'))
      ) {
        const user = userSnap.data() as RegisteredUser;
        tx.update(userRef, {
          usdtBalance: Number(((user.usdtBalance ?? 0) + usdtReq.amountUsdt).toFixed(2)),
          updatedAt: nowIso,
        });
      }
      const notifId = generateSafeId('ntf-usdt');
      tx.set(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientId: usdtReq.userId,
        title: decision === 'approved' ? 'USDT Request Approved' : 'USDT Request Rejected',
        message: `Your ${usdtReq.actionType} of ${usdtReq.amountUsdt.toFixed(2)} USDT (${usdtReq.network}) was ${decision}.`,
        category: 'USDT',
        read: false,
        createdAt: nowIso,
      });
    });

    const txSnap = await getDocs(query(collection(db, 'transactions'), where('userId', '==', targetUserId)));
    const batch = writeBatch(db);
    let dirty = false;
    for (const d of txSnap.docs) {
      const t = d.data() as TransactionRecord;
      if (t.category === targetCategory && t.status === 'Pending Review') {
        batch.update(d.ref, { status: decision === 'approved' ? 'Completed' : 'Rejected' });
        dirty = true;
      }
    }
    if (dirty) await batch.commit();
  },

  adminAddPromotion: async (title: string, category: string, summary: string): Promise<void> => {
    const cleanTitle = title.trim();
    const cleanSummary = summary.trim();
    const cleanCategory = category.trim() || 'Official Announcement';
    if (!cleanTitle || !cleanSummary) {
      throw new Error('Promotion title and summary required.');
    }
    const id = generateSafeId('promo');
    await setDoc(doc(db, 'promotions', id), {
      id,
      title: cleanTitle,
      category: cleanCategory,
      summary: cleanSummary,
      active: true,
      createdAt: new Date().toISOString(),
    });
  },

  adminTogglePromotion: async (promoId: string): Promise<void> => {
    const ref = doc(db, 'promotions', promoId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Promotion not found.');
    const promo = snap.data() as AdminPromotion;
    await updateDoc(ref, { active: !promo.active });
  },

  adminDeletePromotion: async (promoId: string): Promise<void> => {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'promotions', promoId));
    await batch.commit();
  },

  adminUpdateSettings: async (settings: SystemSettings): Promise<void> => {
    await setDoc(doc(db, 'settings', 'platform'), {
      ...settings,
      updatedAt: new Date().toISOString(),
    });
  },
};

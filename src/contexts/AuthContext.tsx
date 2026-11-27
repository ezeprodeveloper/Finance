import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { INITIAL_PLATFORM_STATE } from '../data/platformStore';
import { authPersistenceReady } from '../lib/firebase';
import { firestoreService, type MemberProfileDraft } from '../services/firestoreService';
import type { PlatformStoreState, RegisteredUser, VideoWatchSessionRecord } from '../types/finance';

export type AuthLifecycleStatus = 'initializing' | 'authenticated' | 'unauthenticated';
export type ProfileLifecycleStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

export interface AdminMergedAuthEntry {
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
}

export interface AdminUsersDirectoryMeta {
  authLookupAvailable: boolean | null;
  totalAuthUsers: number;
  authUsers: AdminMergedAuthEntry[];
  reason?: string;
}

const EMPTY_ADMIN_USERS_META: AdminUsersDirectoryMeta = {
  authLookupAvailable: null,
  totalAuthUsers: 0,
  authUsers: [],
};

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  authUid: string | null;
  authStatus: AuthLifecycleStatus;
  profileStatus: ProfileLifecycleStatus;
  profileError: string | null;
  role: 'guest' | 'user' | 'admin';
  store: PlatformStoreState;
  videoWatchSessions: VideoWatchSessionRecord[];
  adminUsersMeta: AdminUsersDirectoryMeta;
  currentUser: RegisteredUser | null;
  referredUsersCount: number;
  publicStats: { totalActiveVideos: number; totalActiveTasks: number };
  actionError: string | null;
  setActionError: (msg: string | null) => void;
  signInWithIdentifier: (
    identifier: string,
    password: string,
  ) => Promise<{ error: string | null; needsAdminSetup?: boolean }>;
  claimAdminWithEmailPassword: (email: string, password: string) => Promise<string | null>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  registerMember: (
    newUser: RegisteredUser,
    rawPassword: string,
    referralCodeInput: string,
  ) => Promise<string | null>;
  recoverProfile: (draft: MemberProfileDraft) => Promise<string | null>;
  retryProfileLoad: () => Promise<void>;
  refreshAdminUsers: () => Promise<{ count: number; error: string | null }>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthLifecycleStatus>('initializing');
  const [profileStatus, setProfileStatus] = useState<ProfileLifecycleStatus>('idle');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [role, setRole] = useState<'guest' | 'user' | 'admin'>('guest');
  const [store, setStore] = useState<PlatformStoreState>(INITIAL_PLATFORM_STATE);
  const [videoWatchSessions, setVideoWatchSessions] = useState<VideoWatchSessionRecord[]>([]);
  const [adminUsersMeta, setAdminUsersMeta] = useState<AdminUsersDirectoryMeta>(EMPTY_ADMIN_USERS_META);
  const [referredUsersCount, setReferredUsersCount] = useState(0);
  const [publicStats, setPublicStats] = useState({ totalActiveVideos: 0, totalActiveTasks: 0 });
  const [actionError, setActionError] = useState<string | null>(null);
  const [workspaceGeneration, setWorkspaceGeneration] = useState(0);
  const verifyingMissingRef = useRef(false);

  const resetToGuest = useCallback(() => {
    setFirebaseUser(null);
    setAuthUid(null);
    setRole('guest');
    setProfileStatus('idle');
    setProfileError(null);
    setReferredUsersCount(0);
    setVideoWatchSessions([]);
    setAdminUsersMeta(EMPTY_ADMIN_USERS_META);
    setStore((prev) => ({
      ...INITIAL_PLATFORM_STATE,
      settings: prev.settings,
      promotions: prev.promotions,
      session: { type: 'guest' },
    }));
  }, []);

  const signOutUser = useCallback(async () => {
    await firestoreService.signOutCurrent();
    setActionError(null);
    resetToGuest();
    setAuthStatus('unauthenticated');
  }, [resetToGuest]);

  // Wait for browserLocalPersistence initialization, then subscribe to onAuthStateChanged
  useEffect(() => {
    let cancelled = false;
    let unsubAuth: (() => void) | undefined;

    void firestoreService.testConnection();
    void firestoreService.fetchPublicBootstrap().then((data) => {
      if (cancelled) return;
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

    void authPersistenceReady.finally(() => {
      if (cancelled) return;
      unsubAuth = firestoreService.onAuthChanged(async (fbUser) => {
        if (cancelled) return;
        if (!fbUser) {
          resetToGuest();
          setAuthStatus('unauthenticated');
          return;
        }

        setFirebaseUser(fbUser);
        setAuthUid(fbUser.uid);
        setAuthStatus('authenticated');
        setProfileError(null);

        const isAdmin = await firestoreService.isVerifiedAdminUser(fbUser);
        if (cancelled) return;

        if (isAdmin) {
          setRole('admin');
          setProfileStatus('ready');
          setStore((prev) => ({
            ...prev,
            session: { type: 'admin' },
          }));
        } else {
          setRole('user');
          setProfileStatus('loading');
          setStore((prev) => ({
            ...prev,
            session: { type: 'user', userId: fbUser.uid },
          }));
        }
      });
    });

    return () => {
      cancelled = true;
      if (unsubAuth) unsubAuth();
    };
  }, [resetToGuest]);

  // Real-time Firestore listener matching active session role
  useEffect(() => {
    if (authStatus === 'initializing') return;

    if (authStatus === 'unauthenticated' || role === 'guest') {
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

    if (role === 'user' && authUid) {
      return firestoreService.subscribeMemberWorkspace(
        authUid,
        (snapshot) => {
          setReferredUsersCount(snapshot.referredUsersCount);
          setVideoWatchSessions(snapshot.videoWatchSessions);
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

          if (!snapshot.userDocLoaded || firestoreService.isRegistrationPending(authUid)) {
            setProfileStatus('loading');
            return;
          }

          if (snapshot.user) {
            if (snapshot.user.accountStatus === 'suspended') {
              setActionError('Your account is currently suspended. Contact E-Finance Rwanda Admin.');
              void signOutUser();
              return;
            }
            setProfileError(null);
            setProfileStatus('ready');
            return;
          }

          // Double-check against Firestore server before declaring profile missing
          if (!verifyingMissingRef.current) {
            verifyingMissingRef.current = true;
            void firestoreService
              .getMemberProfileByUid(authUid)
              .then((serverProfile) => {
                if (serverProfile) {
                  setStore((prev) => ({
                    ...prev,
                    users: [serverProfile],
                    session: { type: 'user', userId: authUid },
                  }));
                  setProfileStatus('ready');
                } else {
                  setProfileStatus('missing');
                }
              })
              .catch((err) => {
                setProfileError(err instanceof Error ? err.message : 'Unable to reach Firestore.');
                setProfileStatus('error');
              })
              .finally(() => {
                verifyingMissingRef.current = false;
              });
          }
        },
        (err) => {
          setProfileError(err.message);
          setProfileStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
          setActionError(err.message);
        },
      );
    }

    if (role === 'admin' && authUid) {
      if (firebaseUser) {
        void firebaseUser
          .getIdToken()
          .then((token) => firestoreService.fetchAdminMergedUsers(token))
          .then((merged) => {
            setAdminUsersMeta({
              authLookupAvailable: merged.authLookupAvailable,
              totalAuthUsers: merged.totalAuthUsers ?? merged.authUsers.length,
              authUsers: merged.authUsers,
              reason: merged.reason,
            });
          })
          .catch(() => {});
      }

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
  }, [authStatus, role, authUid, firebaseUser, workspaceGeneration, signOutUser]);

  const currentUser =
    role === 'user' && authUid
      ? store.users.find((u) => u.id === authUid) ?? null
      : null;

  const signInWithIdentifier = async (
    identifier: string,
    password: string,
  ): Promise<{ error: string | null; needsAdminSetup?: boolean }> => {
    try {
      const res = await firestoreService.signInWithIdentifier(identifier, password);
      setAuthUid(res.uid);
      setAuthStatus('authenticated');
      if (res.role === 'admin') {
        setRole('admin');
        setProfileStatus('ready');
        setStore((prev) => ({ ...prev, session: { type: 'admin' } }));
      } else {
        setRole('user');
        setProfileStatus(res.profileExists ? 'loading' : 'missing');
        setStore((prev) => ({ ...prev, session: { type: 'user', userId: res.uid } }));
      }
      return { error: null };
    } catch (err) {
      const e = err as Error & { needsAdminSetup?: boolean };
      return {
        error: e.message || 'Sign-in failed. Please verify your credentials.',
        needsAdminSetup: Boolean(e.needsAdminSetup),
      };
    }
  };

  const claimAdminWithEmailPassword = async (
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

  const requestPasswordReset = async (email: string): Promise<string | null> => {
    try {
      await firestoreService.requestPasswordReset(email);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to send password reset email.';
    }
  };

  const registerMember = async (
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
      setAuthStatus('authenticated');
      setRole('user');
      setProfileStatus('ready');
      setProfileError(null);
      setStore((prev) => ({
        ...prev,
        users: [created],
        session: { type: 'user', userId: created.id },
      }));
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Registration failed. Please try again.';
    }
  };

  const recoverProfile = async (draft: MemberProfileDraft): Promise<string | null> => {
    if (!authUid) return 'You must be signed in to recover your profile.';
    try {
      const recovered = await firestoreService.recoverMemberProfile(authUid, draft);
      setProfileError(null);
      setProfileStatus('ready');
      setStore((prev) => ({
        ...prev,
        users: [recovered],
        session: { type: 'user', userId: recovered.id },
      }));
      setWorkspaceGeneration((g) => g + 1);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to save member profile.';
    }
  };

  const retryProfileLoad = useCallback(async () => {
    if (!authUid) return;
    setProfileStatus('loading');
    setProfileError(null);
    try {
      const serverProfile = await firestoreService.getMemberProfileByUid(authUid);
      if (serverProfile) {
        setStore((prev) => ({
          ...prev,
          users: [serverProfile],
          session: { type: 'user', userId: authUid },
        }));
        setProfileStatus('ready');
        setWorkspaceGeneration((g) => g + 1);
      } else {
        setProfileStatus('missing');
      }
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Unable to load your profile.');
      setProfileStatus('error');
    }
  }, [authUid]);

  const refreshAdminUsers = useCallback(async (): Promise<{ count: number; error: string | null }> => {
    try {
      const serverUsers = await firestoreService.fetchAllUsersFromServer();
      let mergedCount = serverUsers.length;
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken().catch(() => null);
        if (token) {
          const merged = await firestoreService.fetchAdminMergedUsers(token);
          setAdminUsersMeta({
            authLookupAvailable: merged.authLookupAvailable,
            totalAuthUsers: merged.totalAuthUsers ?? merged.authUsers.length,
            authUsers: merged.authUsers,
            reason: merged.reason,
          });
          if (merged.authLookupAvailable) {
            const seenUids = new Set(serverUsers.map((u) => u.id));
            const authOnlyCount = merged.authUsers.filter((a) => !seenUids.has(a.uid)).length;
            mergedCount = serverUsers.length + authOnlyCount;
          }
        }
      }
      setStore((prev) => ({
        ...prev,
        users: serverUsers,
      }));
      return { count: mergedCount, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to fetch users from Firestore.';
      return { count: store.users.length, error: msg };
    }
  }, [firebaseUser, store.users.length]);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!firebaseUser) return null;
    try {
      return await firebaseUser.getIdToken();
    } catch {
      return null;
    }
  }, [firebaseUser]);

  return (
    <AuthContext.Provider
      value={{
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return ctx;
}

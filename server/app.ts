import crypto from 'node:crypto';
import express from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import {
  getAdminAuth,
  getAdminFirestore,
  hasServiceAccountCredentials,
} from './firebaseAdmin.ts';
import {
  type AuthRequest,
  getConfiguredAdminEmail,
  requireAdmin,
  requireMember,
} from './middleware.ts';

interface ServerWatchSession {
  key: string;
  uid: string;
  targetType: 'video' | 'task';
  targetId: string;
  requiredSeconds: number;
  accumulatedSeconds: number;
  heartbeatCount: number;
  status: 'watching' | 'completed' | 'claimed';
  serverStartedAtMs: number;
  lastTickMs: number;
  completedAtMs?: number;
  nonce: string;
}

const SESSION_HMAC_KEY = crypto
  .createHash('sha256')
  .update(
    process.env.SESSION_SIGNING_SECRET ||
      process.env.FIREBASE_SERVICE_ACCOUNT ||
      `efinance-2026-watch-${process.pid}`,
  )
  .digest();

const activeWatchSessions = new Map<string, ServerWatchSession>();
const claimedWatchKeys = new Set<string>();

function signWatchPayload(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_HMAC_KEY).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyWatchPayload<T extends Record<string, unknown>>(token: string): T | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_HMAC_KEY).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function clampRequiredSeconds(raw: unknown, fallback = 15): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(5, Math.min(600, Math.round(num)));
}

function isValidTargetId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
}

export function createApiApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', async (_req, res) => {
    const adminConfigured = hasServiceAccountCredentials();
    let firestoreConnected = false;

    if (adminConfigured) {
      try {
        await getAdminFirestore().doc('settings/platform').get();
        firestoreConnected = true;
      } catch {
        firestoreConnected = false;
      }
    }

    res.json({
      ok: true,
      backend: 'firebase',
      projectId: 'e-finance-2026',
      adminSdkCredentialsConfigured: adminConfigured,
      adminFirestoreConnected: firestoreConnected,
      adminEmail: getConfiguredAdminEmail(),
    });
  });

  // Verify Firebase ID token and return authenticated caller identity (never trusts body UID/role)
  app.get('/api/auth/session', requireMember, (req: AuthRequest, res) => {
    res.json({
      authenticated: true,
      uid: req.auth!.userId,
      email: req.auth!.email,
      emailVerified: req.auth!.emailVerified,
      role: req.auth!.role,
    });
  });

  // Protected member profile lookup using verified Firebase UID
  app.get('/api/member/profile', requireMember, async (req: AuthRequest, res) => {
    if (!hasServiceAccountCredentials()) {
      res.status(503).json({
        error:
          'FIREBASE_SERVICE_ACCOUNT is not configured on the server; client Firestore SDK handles direct profile persistence.',
      });
      return;
    }

    try {
      const uid = req.auth!.userId;
      const snap = await getAdminFirestore().doc(`users/${uid}`).get();
      if (!snap.exists) {
        res.status(404).json({ error: 'Member profile document not found in Firestore.', uid });
        return;
      }
      res.json({ uid, profile: snap.data() });
    } catch (err) {
      console.error('Admin SDK member profile fetch error:', err);
      res.status(500).json({ error: 'Failed to load verified member profile.' });
    }
  });

  // ------------------------------------------------------------------------
  // Secure Server-Side Video Watch Progress & Claim Verification Endpoints
  // ------------------------------------------------------------------------
  app.post('/api/video-sessions/start', requireMember, async (req: AuthRequest, res) => {
    const uid = req.auth!.userId;
    const { targetType, targetId, requiredSeconds: clientSeconds } = req.body ?? {};

    if ((targetType !== 'video' && targetType !== 'task') || !isValidTargetId(targetId)) {
      res.status(400).json({ error: 'Invalid targetType or targetId.' });
      return;
    }

    const sessionKey = `${uid}__${targetType}_${targetId}`;
    let requiredSeconds = clampRequiredSeconds(clientSeconds, 15);

    // Attempt authoritative Firestore check when Admin Firestore access is available
    try {
      const adminDb = getAdminFirestore();
      const collectionName = targetType === 'video' ? 'videoCampaigns' : 'customTasks';
      const targetSnap = await adminDb.doc(`${collectionName}/${targetId}`).get();
      if (targetSnap.exists) {
        const data = targetSnap.data() as Record<string, unknown>;
        if (data.status !== 'active') {
          res.status(409).json({ error: 'This campaign or task is no longer active.' });
          return;
        }
        if (data.requiredWatchSeconds !== undefined) {
          requiredSeconds = clampRequiredSeconds(data.requiredWatchSeconds, requiredSeconds);
        }
        if (
          targetType === 'video' &&
          Array.isArray(data.watchedByUserIds) &&
          data.watchedByUserIds.includes(uid)
        ) {
          res.status(409).json({ error: 'You have already watched and claimed this video.' });
          return;
        }
      }
    } catch {
      // Fallback to verified client-enforced rules + HMAC session timing
    }

    if (targetType === 'video' && claimedWatchKeys.has(sessionKey)) {
      res.status(409).json({ error: 'Reward already claimed for this video.' });
      return;
    }

    const now = Date.now();
    const nonce = crypto.randomBytes(12).toString('hex');
    const session: ServerWatchSession = {
      key: sessionKey,
      uid,
      targetType,
      targetId,
      requiredSeconds,
      accumulatedSeconds: 0,
      heartbeatCount: 0,
      status: 'watching',
      serverStartedAtMs: now,
      lastTickMs: now,
      nonce,
    };
    activeWatchSessions.set(sessionKey, session);

    const sessionToken = signWatchPayload({
      key: sessionKey,
      uid,
      targetType,
      targetId,
      requiredSeconds,
      startedAtMs: now,
      nonce,
    });

    res.json({
      sessionId: sessionKey,
      sessionToken,
      startedAtMs: now,
      requiredSeconds,
    });
  });

  app.post('/api/video-sessions/heartbeat', requireMember, (req: AuthRequest, res) => {
    const uid = req.auth!.userId;
    const { sessionToken, isPlaying, isVisible } = req.body ?? {};
    const parsed = verifyWatchPayload<{
      key: string;
      uid: string;
      nonce: string;
    }>(sessionToken);

    if (!parsed || parsed.uid !== uid) {
      res.status(401).json({ error: 'Invalid watch session token.' });
      return;
    }

    const session = activeWatchSessions.get(parsed.key);
    if (!session || session.nonce !== parsed.nonce) {
      res.status(409).json({
        error: 'Watch session expired or interrupted. Restart video playback from the beginning.',
      });
      return;
    }

    if (session.status === 'claimed') {
      res.status(409).json({ error: 'Reward already claimed.' });
      return;
    }

    const now = Date.now();
    const wallElapsedSeconds = Math.max(0, (now - session.serverStartedAtMs) / 1000);

    // Freeze progress on pause or hidden tab; advance lastTickMs so paused gap never counts on resume
    if (!isPlaying || !isVisible) {
      session.lastTickMs = now;
      res.json({
        accumulatedSeconds: session.accumulatedSeconds,
        requiredSeconds: session.requiredSeconds,
        wallElapsedSeconds: Number(wallElapsedSeconds.toFixed(1)),
        completed:
          session.accumulatedSeconds >= session.requiredSeconds &&
          wallElapsedSeconds >= session.requiredSeconds - 1,
      });
      return;
    }

    const gapSeconds = (now - session.lastTickMs) / 1000;
    if (gapSeconds >= 0.75) {
      const creditDelta = Math.min(3.0, gapSeconds);
      session.accumulatedSeconds = Math.min(
        session.requiredSeconds + 5,
        Number((session.accumulatedSeconds + creditDelta).toFixed(2)),
      );
      session.heartbeatCount += 1;
      session.lastTickMs = now;
    }

    const completed =
      session.accumulatedSeconds >= session.requiredSeconds &&
      wallElapsedSeconds >= session.requiredSeconds - 1;

    res.json({
      accumulatedSeconds: session.accumulatedSeconds,
      requiredSeconds: session.requiredSeconds,
      wallElapsedSeconds: Number(wallElapsedSeconds.toFixed(1)),
      completed,
    });
  });

  app.post('/api/video-sessions/complete', requireMember, (req: AuthRequest, res) => {
    const uid = req.auth!.userId;
    const { sessionToken } = req.body ?? {};
    const parsed = verifyWatchPayload<{
      key: string;
      uid: string;
      nonce: string;
    }>(sessionToken);

    if (!parsed || parsed.uid !== uid) {
      res.status(401).json({ error: 'Invalid watch session token.' });
      return;
    }

    const session = activeWatchSessions.get(parsed.key);
    if (!session || session.nonce !== parsed.nonce) {
      res.status(409).json({ error: 'Watch session interrupted. Please replay the video cleanly.' });
      return;
    }

    const now = Date.now();
    const wallElapsedSeconds = (now - session.serverStartedAtMs) / 1000;
    if (
      session.accumulatedSeconds < session.requiredSeconds ||
      wallElapsedSeconds < session.requiredSeconds - 1
    ) {
      const remainingSeconds = Math.max(
        1,
        Math.ceil(
          Math.max(
            session.requiredSeconds - session.accumulatedSeconds,
            session.requiredSeconds - wallElapsedSeconds,
          ),
        ),
      );
      res.status(400).json({
        error: `Please watch at least ${remainingSeconds} more second(s) in active playback before completing.`,
        remainingSeconds,
      });
      return;
    }

    session.status = 'completed';
    session.completedAtMs = now;

    const verificationSignature = signWatchPayload({
      key: session.key,
      uid,
      targetType: session.targetType,
      targetId: session.targetId,
      requiredSeconds: session.requiredSeconds,
      startedAtMs: session.serverStartedAtMs,
      completedAtMs: now,
      nonce: session.nonce,
    });

    res.json({
      verified: true,
      verificationSignature,
      accumulatedSeconds: session.accumulatedSeconds,
      requiredSeconds: session.requiredSeconds,
    });
  });

  app.post('/api/video-sessions/claim', requireMember, async (req: AuthRequest, res) => {
    const uid = req.auth!.userId;
    const { targetType, targetId, verificationSignature } = req.body ?? {};

    if ((targetType !== 'video' && targetType !== 'task') || !isValidTargetId(targetId)) {
      res.status(400).json({ error: 'Invalid claim target.' });
      return;
    }

    const parsedSig = verifyWatchPayload<{
      key: string;
      uid: string;
      targetType: 'video' | 'task';
      targetId: string;
      requiredSeconds: number;
      completedAtMs: number;
      nonce: string;
    }>(verificationSignature);

    if (
      !parsedSig ||
      parsedSig.uid !== uid ||
      parsedSig.targetType !== targetType ||
      parsedSig.targetId !== targetId
    ) {
      res.status(403).json({
        error: 'Watch verification signature missing or invalid. Please watch the video inside the player first.',
      });
      return;
    }

    const key = `${uid}__${targetType}_${targetId}`;
    if (claimedWatchKeys.has(key)) {
      res.status(409).json({ error: 'This reward has already been claimed.' });
      return;
    }

    // Attempt full server-side Admin SDK atomic transaction for video rewards when authorized
    if (targetType === 'video') {
      try {
        const adminDb = getAdminFirestore();
        const vidRef = adminDb.doc(`videoCampaigns/${targetId}`);
        const userRef = adminDb.doc(`users/${uid}`);
        const sessionRef = adminDb.doc(`videoWatchSessions/${key}`);

        await adminDb.runTransaction(async (tx) => {
          const [vidSnap, userSnap] = await Promise.all([tx.get(vidRef), tx.get(userRef)]);
          if (!vidSnap.exists || !userSnap.exists) {
            throw new Error('NOT_FOUND:Campaign or user account not found.');
          }
          const camp = vidSnap.data() as Record<string, unknown>;
          const user = userSnap.data() as Record<string, unknown>;
          const watched = Array.isArray(camp.watchedByUserIds)
            ? (camp.watchedByUserIds as string[])
            : [];

          if (camp.status !== 'active') throw new Error('CONFLICT:Video campaign is no longer active.');
          if (watched.includes(uid)) throw new Error('CONFLICT:You have already watched and claimed this video.');
          if (watched.length >= Number(camp.targetViewers || 0)) {
            throw new Error('CONFLICT:Video campaign view target has been reached.');
          }

          const nowIso = new Date().toISOString();
          const reward = Math.max(0, Math.round(Number(camp.rewardPerViewRwf || 0)));
          const updatedWatchers = [...watched, uid];
          const completed = updatedWatchers.length >= Number(camp.targetViewers || 0);

          tx.set(
            sessionRef,
            {
              id: key,
              userId: uid,
              targetType: 'video',
              targetId,
              requiredSeconds: parsedSig.requiredSeconds,
              accumulatedSeconds: parsedSig.requiredSeconds,
              heartbeatCount: Math.max(1, Math.round(parsedSig.requiredSeconds)),
              status: 'claimed',
              startedAtMs: parsedSig.completedAtMs - parsedSig.requiredSeconds * 1000,
              lastHeartbeatAtMs: parsedSig.completedAtMs,
              completedAtMs: parsedSig.completedAtMs,
              claimedAtMs: Date.now(),
              verificationSignature,
              serverStartedAt: FieldValue.serverTimestamp(),
              updatedAt: nowIso,
            },
            { merge: true },
          );
          tx.update(vidRef, {
            watchedByUserIds: updatedWatchers,
            status: completed ? 'completed' : 'active',
            updatedAt: nowIso,
          });
          tx.update(userRef, {
            walletBalanceRwf: Number(user.walletBalanceRwf || 0) + reward,
            lastTxId: targetId,
            updatedAt: nowIso,
          });
          const txId = `tx-vid-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
          tx.set(adminDb.doc(`transactions/${txId}`), {
            id: txId,
            userId: uid,
            reference: `VID-${Date.now().toString().slice(-6)}`,
            title: `Short Video Reward: ${String(camp.title || targetId)}`,
            category: 'Video Reward',
            channel: 'Verified In-App Watch-to-Earn',
            amountRwf: reward,
            direction: 'credit',
            status: 'Completed',
            timestamp: nowIso,
          });
        });

        claimedWatchKeys.add(key);
        const live = activeWatchSessions.get(key);
        if (live) live.status = 'claimed';

        res.json({
          serverVerified: true,
          creditedByServer: true,
          useClientAtomicTx: false,
        });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith('CONFLICT:')) {
          res.status(409).json({ error: msg.slice('CONFLICT:'.length) });
          return;
        }
        if (msg.startsWith('NOT_FOUND:')) {
          res.status(404).json({ error: msg.slice('NOT_FOUND:'.length) });
          return;
        }
        // Admin SDK lacks Firestore IAM in preview container -> allow rules-enforced client atomic tx
      }
    }

    claimedWatchKeys.add(key);
    const live = activeWatchSessions.get(key);
    if (live) live.status = 'claimed';

    res.json({
      serverVerified: true,
      creditedByServer: false,
      useClientAtomicTx: true,
      verificationSignature,
    });
  });

  // ------------------------------------------------------------------------
  // Admin User Directory: Merges ALL Firebase Auth Users + Firestore Profiles
  // ------------------------------------------------------------------------
  app.get('/api/admin/users', requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const authClient = getAdminAuth();
      const allAuthUsers: Array<{
        uid: string;
        email: string;
        displayName: string;
        phoneNumber: string;
        emailVerified: boolean;
        disabled: boolean;
        createdAt: string;
        lastSignInAt: string;
      }> = [];

      let nextPageToken: string | undefined;
      do {
        const page = await authClient.listUsers(1000, nextPageToken);
        for (const u of page.users) {
          allAuthUsers.push({
            uid: u.uid,
            email: u.email ?? '',
            displayName: u.displayName ?? '',
            phoneNumber: u.phoneNumber ?? '',
            emailVerified: u.emailVerified,
            disabled: u.disabled,
            createdAt: u.metadata.creationTime ?? '',
            lastSignInAt: u.metadata.lastSignInTime ?? '',
          });
        }
        nextPageToken = page.pageToken;
      } while (nextPageToken);

      const firestoreDocsMap = new Map<string, Record<string, unknown>>();
      try {
        const fsSnap = await getAdminFirestore().collection('users').get();
        for (const docSnap of fsSnap.docs) {
          firestoreDocsMap.set(docSnap.id, {
            ...(docSnap.data() as Record<string, unknown>),
            id: docSnap.id,
          });
        }
      } catch {
        // Client admin still reads full Firestore users collection directly; Auth records remain included
      }

      const authByUid = new Map(allAuthUsers.map((a) => [a.uid, a]));
      const mergedIds = new Set<string>([...authByUid.keys(), ...firestoreDocsMap.keys()]);

      const users = Array.from(mergedIds).map((uid) => {
        const authRec = authByUid.get(uid) ?? null;
        const fsProfile = firestoreDocsMap.get(uid) ?? null;
        return {
          uid,
          authExists: Boolean(authRec),
          firestoreExists: Boolean(fsProfile),
          email: (fsProfile?.email as string) || authRec?.email || '',
          displayName: authRec?.displayName || '',
          phone: (fsProfile?.phone as string) || authRec?.phoneNumber || '',
          emailVerified: authRec?.emailVerified ?? false,
          disabled: authRec?.disabled ?? false,
          authCreatedAt: authRec?.createdAt || '',
          lastSignInAt: authRec?.lastSignInAt || '',
          profile: fsProfile,
        };
      });

      res.json({
        authLookupAvailable: true,
        totalAuthUsers: allAuthUsers.length,
        totalFirestoreUsers: firestoreDocsMap.size,
        users,
      });
    } catch {
      res.json({
        authLookupAvailable: false,
        users: [],
        reason:
          'Firebase Admin SDK does not yet have Identity Toolkit Viewer permission in this server environment. Displaying all Cloud Firestore user records directly.',
      });
    }
  });

  // Protected administrator summary endpoint using verified Admin Firebase ID token
  app.get('/api/admin/overview', requireAdmin, async (req: AuthRequest, res) => {
    if (!hasServiceAccountCredentials()) {
      res.status(503).json({
        error:
          'FIREBASE_SERVICE_ACCOUNT is not configured on the server; client Admin workspace reads Firestore directly under security rules.',
      });
      return;
    }

    try {
      const db = getAdminFirestore();
      const [usersSnap, withdrawalsSnap, loansSnap] = await Promise.all([
        db.collection('users').count().get(),
        db.collection('withdrawals').where('status', '==', 'pending_admin').count().get(),
        db.collection('loans').where('status', '==', 'pending_admin').count().get(),
      ]);
      res.json({
        adminUid: req.auth!.userId,
        adminEmail: req.auth!.email,
        totalUsers: usersSnap.data().count,
        pendingWithdrawals: withdrawalsSnap.data().count,
        pendingLoans: loansSnap.data().count,
      });
    } catch (err) {
      console.error('Admin overview error:', err);
      res.status(500).json({ error: 'Unable to load admin overview.' });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  return app;
}


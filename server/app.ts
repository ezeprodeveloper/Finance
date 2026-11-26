import express from 'express';
import {
  getAdminFirestore,
  hasServiceAccountCredentials,
} from './firebaseAdmin.ts';
import {
  type AuthRequest,
  getConfiguredAdminEmail,
  requireAdmin,
  requireMember,
} from './middleware.ts';

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

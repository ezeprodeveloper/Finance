import type { NextFunction, Request, Response } from 'express';
import { ADMIN_EMAIL } from '../src/data/platformStore.ts';
import {
  getAdminFirestore,
  hasServiceAccountCredentials,
  verifyFirebaseBearerToken,
} from './firebaseAdmin.ts';

export interface AuthContext {
  token: string;
  role: 'user' | 'admin';
  userId: string;
  email: string;
  emailVerified: boolean;
}

export interface AuthRequest extends Request {
  auth?: AuthContext;
}

export function getConfiguredAdminEmail(): string {
  return (process.env.ADMIN_EMAIL || ADMIN_EMAIL).trim().toLowerCase();
}

export function getEnvAdminPasscode(): string {
  return (process.env.ADMIN_PASSCODE || '').trim();
}

async function resolveFirebaseAuth(req: Request): Promise<AuthContext | null> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;

  const decoded = await verifyFirebaseBearerToken(header);
  if (!decoded || !decoded.uid) return null;

  const email = (decoded.email || '').toLowerCase();
  const emailVerified = Boolean(decoded.email_verified);

  let isAdmin = emailVerified && email === getConfiguredAdminEmail();
  if (!isAdmin && emailVerified && hasServiceAccountCredentials()) {
    try {
      const adminSnap = await getAdminFirestore().doc(`admins/${decoded.uid}`).get();
      isAdmin = adminSnap.exists;
    } catch {
      isAdmin = false;
    }
  }

  return {
    token,
    role: isAdmin ? 'admin' : 'user',
    userId: decoded.uid,
    email,
    emailVerified,
  };
}

export async function requireMember(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ctx = await resolveFirebaseAuth(req);
    if (!ctx || !ctx.userId) {
      res.status(401).json({ error: 'Unauthorized: Valid Firebase ID token required.' });
      return;
    }
    req.auth = ctx;
    next();
  } catch (err) {
    console.error('Firebase token verification failed:', err);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired Firebase session token.' });
  }
}

export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ctx = await resolveFirebaseAuth(req);
    if (!ctx || ctx.role !== 'admin' || !ctx.emailVerified) {
      res.status(403).json({ error: 'Forbidden: Verified administrator Firebase ID token required.' });
      return;
    }
    req.auth = ctx;
    next();
  } catch (err) {
    console.error('Admin token verification failed:', err);
    res.status(403).json({ error: 'Forbidden: Invalid administrator token.' });
  }
}

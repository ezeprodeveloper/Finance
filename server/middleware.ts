import type { NextFunction, Request, Response } from 'express';
import { ADMIN_EMAIL } from '../src/data/platformStore.ts';
import { dbExecute, dbQueryOne } from './db.ts';
import { generateSessionToken } from './security.ts';

export interface AuthContext {
  token: string;
  role: 'user' | 'admin';
  userId: string | null;
  email: string;
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

export async function createSession(
  role: 'user' | 'admin',
  userId: string | null,
  email: string,
): Promise<string> {
  const token = generateSessionToken();
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await dbExecute(
    `INSERT INTO sessions (token, role, user_id, email, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [token, role, userId, email, expires.toISOString(), now.toISOString()],
  );
  return token;
}

async function resolveSessionFromRequest(req: Request): Promise<AuthContext | null> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;

  const row = await dbQueryOne<{
    token: string;
    role: string;
    user_id: string | null;
    email: string;
    expires_at: string;
  }>('SELECT token, role, user_id, email, expires_at FROM sessions WHERE token = $1', [token]);

  if (!row) return null;
  if (Date.parse(row.expires_at) < Date.now()) {
    await dbExecute('DELETE FROM sessions WHERE token = $1', [token]);
    return null;
  }

  return {
    token: row.token,
    role: row.role === 'admin' ? 'admin' : 'user',
    userId: row.user_id,
    email: row.email,
  };
}

export async function requireMember(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ctx = await resolveSessionFromRequest(req);
    if (!ctx || ctx.role !== 'user' || !ctx.userId) {
      res.status(401).json({ error: 'Unauthorized: Member sign-in required.' });
      return;
    }
    req.auth = ctx;
    next();
  } catch (err) {
    console.error('Auth verification error:', err);
    res.status(500).json({ error: 'Authentication verification failed.' });
  }
}

export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ctx = await resolveSessionFromRequest(req);
    if (!ctx || ctx.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: Administrator authorization required.' });
      return;
    }
    req.auth = ctx;
    next();
  } catch (err) {
    console.error('Admin verification error:', err);
    res.status(500).json({ error: 'Administrator verification failed.' });
  }
}

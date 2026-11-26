import { cert, getApp, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

function loadAppletConfig(): FirebaseAppletConfig {
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(import.meta.dirname ?? process.cwd(), '..', 'firebase-applet-config.json'),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as FirebaseAppletConfig;
      if (parsed?.projectId) return parsed;
    }
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || 'e-finance-2026',
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID,
  };
}

function parseServiceAccountFromEnv(): ServiceAccount | null {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) return null;
  try {
    const jsonStr = raw.startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const projectId = String(parsed.project_id || parsed.projectId || '');
    const clientEmail = String(parsed.client_email || parsed.clientEmail || '');
    const privateKeyRaw = String(parsed.private_key || parsed.privateKey || '');
    if (!projectId || !clientEmail || !privateKeyRaw) {
      return null;
    }
    return {
      projectId,
      clientEmail,
      privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
    };
  } catch {
    return null;
  }
}

export function hasServiceAccountCredentials(): boolean {
  return parseServiceAccountFromEnv() !== null;
}

export function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }
  const appletConfig = loadAppletConfig();
  const serviceAccount = parseServiceAccountFromEnv();

  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId || appletConfig.projectId,
    });
  }

  return initializeApp({
    projectId: appletConfig.projectId,
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminFirestore(): Firestore {
  const app = getFirebaseAdminApp();
  const appletConfig = loadAppletConfig();
  const dbId = appletConfig.firestoreDatabaseId?.trim();
  if (dbId && dbId !== '(default)') {
    return getFirestore(app, dbId);
  }
  return getFirestore(app);
}

export async function verifyFirebaseBearerToken(authHeader?: string): Promise<DecodedIdToken | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) return null;
  return getAdminAuth().verifyIdToken(idToken);
}

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Pool } from 'pg';
import { type MigrationRunSummary, runPendingMigrations } from './migrations.ts';

export type SqlEngine = 'postgres' | 'sqlite';

interface SqliteStatement {
  all: (...params: unknown[]) => unknown[];
  get: (...params: unknown[]) => unknown;
  run: (...params: unknown[]) => unknown;
}

interface SqliteDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
}

declare global {
  var _efinancePgPool: Pool | undefined;
  var _efinanceSqliteDb: SqliteDatabase | undefined;
  var _efinanceSchemaPromise: Promise<MigrationRunSummary> | undefined;
  var _efinanceMigrationSummary: MigrationRunSummary | undefined;
}

const POSTGRES_ENV_KEYS = [
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
  'POSTGRESQL_URL',
  'PRISMA_DATABASE_URL',
  'STORAGE_POSTGRES_URL',
  'STORAGE_URL',
  'NEON_DATABASE_URL',
  'SUPABASE_DB_URL',
  'NETLIFY_DATABASE_URL',
  'PG_CONNECTION_STRING',
  'PG_URL',
] as const;

export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL === '1' ||
      process.env.VERCEL_ENV ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME,
  );
}

function sanitizeConnectionString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.toLowerCase().startsWith('psql ')) {
    cleaned = cleaned.slice(5).trim();
  }
  return cleaned.replace(/^['"]+|['"]+$/g, '').trim();
}

export function getPostgresConnectionString(): string | null {
  for (const key of POSTGRES_ENV_KEYS) {
    const raw = process.env[key];
    if (!raw) continue;
    const val = sanitizeConnectionString(raw);
    if (val && (val.startsWith('postgres://') || val.startsWith('postgresql://'))) {
      return val;
    }
  }
  return null;
}

export function getSqlEngine(): SqlEngine {
  return getPostgresConnectionString() ? 'postgres' : 'sqlite';
}

function normalizePgUrlForPool(connStr: string): { url: string; useSsl: boolean } {
  try {
    const parsed = new URL(connStr);
    const host = parsed.hostname.toLowerCase();
    const sslmode = parsed.searchParams.get('sslmode')?.toLowerCase();
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    const useSsl = sslmode !== 'disable' && !isLocal;

    if (
      useSsl &&
      (sslmode === 'require' || sslmode === 'prefer' || sslmode === 'verify-ca') &&
      !parsed.searchParams.has('uselibpqcompat')
    ) {
      parsed.searchParams.set('uselibpqcompat', 'true');
    }
    return { url: parsed.toString(), useSsl };
  } catch {
    const isLocal = connStr.includes('localhost') || connStr.includes('127.0.0.1');
    return { url: connStr, useSsl: !isLocal && !connStr.includes('sslmode=disable') };
  }
}

function resetPgPool(): void {
  const existing = globalThis._efinancePgPool;
  globalThis._efinancePgPool = undefined;
  if (existing) {
    void existing.end().catch(() => {});
  }
}

function getPgPool(): Pool {
  if (!globalThis._efinancePgPool) {
    const rawConn = getPostgresConnectionString();
    if (!rawConn) {
      throw new Error('PostgreSQL connection URL is not configured.');
    }
    const { url, useSsl } = normalizePgUrlForPool(rawConn);
    const isServerless = isServerlessRuntime();
    const pool = new Pool({
      connectionString: url,
      max: isServerless ? 5 : 10,
      idleTimeoutMillis: isServerless ? 10000 : 30000,
      connectionTimeoutMillis: 15000,
      allowExitOnIdle: isServerless,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
      if (globalThis._efinancePgPool === pool) {
        globalThis._efinancePgPool = undefined;
      }
    });
    globalThis._efinancePgPool = pool;
  }
  return globalThis._efinancePgPool;
}

function isTransientPgConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as { code?: unknown }).code ?? '');
  const msg = String((err as { message?: unknown }).message ?? '');
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EPIPE' ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03' ||
    msg.includes('Connection terminated unexpectedly') ||
    msg.includes('Client has encountered a connection error')
  );
}

async function runPgQuery<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  try {
    return await fn(getPgPool());
  } catch (err) {
    if (isTransientPgConnectionError(err)) {
      resetPgPool();
      return await fn(getPgPool());
    }
    throw err;
  }
}

function resolveWritableSqlitePath(): string {
  if (isServerlessRuntime()) {
    throw new Error(
      'Ephemeral /tmp SQLite storage is disabled in serverless deployments. Use Cloud Firestore or configure POSTGRES_URL.',
    );
  }
  const localPath = path.resolve(process.cwd(), '.data', 'efinance.sqlite');
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.accessSync(path.dirname(localPath), fs.constants.W_OK);
  return localPath;
}

function getSqliteDb(): SqliteDatabase {
  if (!globalThis._efinanceSqliteDb) {
    const require = createRequire(import.meta.url);
    const { DatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (filename: string) => SqliteDatabase;
    };
    const dbPath = resolveWritableSqlitePath();
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    globalThis._efinanceSqliteDb = db;
  }
  return globalThis._efinanceSqliteDb;
}

function toSqliteQuery(sql: string, params: unknown[]): { sql: string; params: unknown[] } {
  const outParams: unknown[] = [];
  const converted = sql.replace(/\$(\d+)/g, (_, idxStr: string) => {
    const idx = Number(idxStr) - 1;
    const val = params[idx];
    outParams.push(val === undefined ? null : val);
    return '?';
  });
  return { sql: converted, params: outParams };
}

export async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (getSqlEngine() === 'postgres') {
    const normalizedParams = params.map((p) => (p === undefined ? null : p));
    const res = await runPgQuery((pool) => pool.query(sql, normalizedParams));
    return res.rows as T[];
  }
  const sqlite = getSqliteDb();
  const mapped = toSqliteQuery(sql, params);
  return sqlite.prepare(mapped.sql).all(...mapped.params) as T[];
}

export async function dbQueryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  if (getSqlEngine() === 'postgres') {
    const rows = await dbQuery<T>(sql, params);
    return rows[0] ?? null;
  }
  const sqlite = getSqliteDb();
  const mapped = toSqliteQuery(sql, params);
  const row = sqlite.prepare(mapped.sql).get(...mapped.params) as T | undefined;
  return row ?? null;
}

export async function dbExecute(sql: string, params: unknown[] = []): Promise<void> {
  if (getSqlEngine() === 'postgres') {
    const normalizedParams = params.map((p) => (p === undefined ? null : p));
    await runPgQuery((pool) => pool.query(sql, normalizedParams));
    return;
  }
  const sqlite = getSqliteDb();
  const mapped = toSqliteQuery(sql, params);
  sqlite.prepare(mapped.sql).run(...mapped.params);
}

export function ensureSchema(): Promise<MigrationRunSummary> {
  if (!globalThis._efinanceSchemaPromise) {
    globalThis._efinanceSchemaPromise = (async () => {
      const engine = getSqlEngine();
      const summary = await runPendingMigrations({
        engine,
        query: dbQuery,
        queryOne: dbQueryOne,
        execute: dbExecute,
      });
      globalThis._efinanceMigrationSummary = summary;
      return summary;
    })().catch((err) => {
      globalThis._efinanceSchemaPromise = undefined;
      throw err;
    });
  }
  return globalThis._efinanceSchemaPromise;
}

export async function checkDatabaseStatus(): Promise<{
  connected: boolean;
  engine: SqlEngine;
  migrationSummary: MigrationRunSummary | null;
  error: string | null;
}> {
  const engine = getSqlEngine();
  try {
    const migrationSummary = await ensureSchema();
    await dbQueryOne('SELECT 1 AS ok');
    return {
      connected: true,
      engine,
      migrationSummary,
      error: null,
    };
  } catch (err) {
    return {
      connected: false,
      engine,
      migrationSummary: null,
      error: err instanceof Error ? err.message : 'Database connectivity check failed.',
    };
  }
}

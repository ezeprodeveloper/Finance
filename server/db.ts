import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Pool } from 'pg';
import { type MigrationRunSummary, runPendingMigrations } from './migrations.ts';

export type SqlEngine = 'postgres' | 'sqlite';

export class DatabaseConfigurationError extends Error {
  code: 'MISSING_PRODUCTION_DATABASE';

  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigurationError';
    this.code = 'MISSING_PRODUCTION_DATABASE';
  }
}

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
  'PRISMA_DATABASE_URL',
  'STORAGE_POSTGRES_URL',
  'STORAGE_URL',
  'NEON_DATABASE_URL',
  'SUPABASE_DB_URL',
  'NETLIFY_DATABASE_URL',
] as const;

export function isServerlessProductionHost(): boolean {
  return Boolean(
    process.env.VERCEL === '1' ||
      process.env.VERCEL_ENV ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME,
  );
}

export function getPostgresConnectionString(): string | null {
  for (const key of POSTGRES_ENV_KEYS) {
    const val = process.env[key]?.trim();
    if (val && (val.startsWith('postgres://') || val.startsWith('postgresql://'))) {
      return val;
    }
  }
  return null;
}

export function getSqlEngine(): SqlEngine {
  if (getPostgresConnectionString()) {
    return 'postgres';
  }
  if (isServerlessProductionHost()) {
    throw new DatabaseConfigurationError(
      'Persistent PostgreSQL is not yet connected to this serverless deployment. Connect a Vercel Storage Postgres integration (Neon, Supabase, or Prisma Postgres) and redeploy — schema, indexes, migrations, and default settings will initialize automatically.',
    );
  }
  return 'sqlite';
}

function getPgPool(): Pool {
  if (!globalThis._efinancePgPool) {
    const connStr = getPostgresConnectionString();
    if (!connStr) {
      throw new DatabaseConfigurationError(
        'PostgreSQL connection URL is not configured.',
      );
    }
    const useSsl = !connStr.includes('localhost') && !connStr.includes('127.0.0.1');
    globalThis._efinancePgPool = new Pool({
      connectionString: connStr,
      max: 10,
      connectionTimeoutMillis: 15000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
    globalThis._efinancePgPool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });
  }
  return globalThis._efinancePgPool;
}

function getSqliteDb(): SqliteDatabase {
  if (isServerlessProductionHost()) {
    throw new DatabaseConfigurationError(
      'Local SQLite storage is disabled on serverless production hosts such as Vercel.',
    );
  }
  if (!globalThis._efinanceSqliteDb) {
    const require = createRequire(import.meta.url);
    const { DatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (filename: string) => SqliteDatabase;
    };
    const dbPath = path.resolve(process.cwd(), '.data', 'efinance.sqlite');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
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
    const pool = getPgPool();
    const res = await pool.query(sql, params.map((p) => (p === undefined ? null : p)));
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
    const pool = getPgPool();
    await pool.query(sql, params.map((p) => (p === undefined ? null : p)));
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
  engine: SqlEngine | 'unconfigured';
  migrationSummary: MigrationRunSummary | null;
  error: string | null;
  needsVercelPostgresStore: boolean;
}> {
  try {
    const engine = getSqlEngine();
    const migrationSummary = await ensureSchema();
    await dbQueryOne('SELECT 1 AS ok');
    return {
      connected: true,
      engine,
      migrationSummary,
      error: null,
      needsVercelPostgresStore: false,
    };
  } catch (err) {
    const isMissingProdDb = err instanceof DatabaseConfigurationError;
    return {
      connected: false,
      engine: isMissingProdDb ? 'unconfigured' : (getPostgresConnectionString() ? 'postgres' : 'sqlite'),
      migrationSummary: null,
      error: err instanceof Error ? err.message : 'Database connectivity check failed.',
      needsVercelPostgresStore: isMissingProdDb,
    };
  }
}

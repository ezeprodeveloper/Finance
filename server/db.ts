import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Pool } from 'pg';
import { DEFAULT_SYSTEM_SETTINGS, INITIAL_PLATFORM_STATE } from '../src/data/platformStore.ts';

type SqlEngine = 'postgres' | 'sqlite';

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
  var _efinanceSchemaPromise: Promise<void> | undefined;
}

function getPostgresConnectionString(): string | null {
  const raw =
    process.env.NETLIFY_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    '';
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getSqlEngine(): SqlEngine {
  return getPostgresConnectionString() ? 'postgres' : 'sqlite';
}

function getPgPool(): Pool {
  if (!globalThis._efinancePgPool) {
    const connStr = getPostgresConnectionString();
    if (!connStr) {
      throw new Error('PostgreSQL connection string is missing.');
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
  if (!globalThis._efinanceSqliteDb) {
    const require = createRequire(import.meta.url);
    const { DatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (filename: string) => SqliteDatabase;
    };
    const isServerless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const dbPath = isServerless
      ? '/tmp/efinance.sqlite'
      : path.resolve(process.cwd(), '.data', 'efinance.sqlite');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
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

const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS admin_credentials (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    user_id TEXT,
    email TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS promotions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    category TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    second_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL UNIQUE,
    gender TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    id_number TEXT NOT NULL UNIQUE,
    photo_data_url TEXT NOT NULL,
    education TEXT NOT NULL,
    residence TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    account_number TEXT NOT NULL UNIQUE,
    referral_code TEXT NOT NULL UNIQUE,
    referred_by_user_id TEXT,
    spin_credits INTEGER NOT NULL DEFAULT 0,
    has_completed_first_withdrawal INTEGER NOT NULL DEFAULT 0,
    account_status TEXT NOT NULL DEFAULT 'pending_approval',
    activation_payment_ref TEXT,
    activation_paid_phone TEXT,
    wallet_balance_rwf DOUBLE PRECISION NOT NULL DEFAULT 0,
    bonus_balance_rwf DOUBLE PRECISION NOT NULL DEFAULT 0,
    savings_balance_rwf DOUBLE PRECISION NOT NULL DEFAULT 0,
    wallet_balance_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
    usdt_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
    usdt_savings_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
    last_check_in_at TEXT,
    check_in_streak INTEGER NOT NULL DEFAULT 0,
    kyc_status TEXT NOT NULL DEFAULT 'not_submitted',
    kyc_data TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS savings_goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    plan_type TEXT NOT NULL,
    target_rwf DOUBLE PRECISION NOT NULL,
    current_rwf DOUBLE PRECISION NOT NULL DEFAULT 0,
    target_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    product TEXT NOT NULL,
    reason TEXT NOT NULL,
    principal_rwf DOUBLE PRECISION NOT NULL,
    term_months INTEGER NOT NULL,
    annual_rate_percent DOUBLE PRECISION NOT NULL,
    monthly_payment_rwf DOUBLE PRECISION NOT NULL,
    total_repayable_rwf DOUBLE PRECISION NOT NULL,
    repaid_rwf DOUBLE PRECISION NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS investments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    tier_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    deposit_rwf DOUBLE PRECISION NOT NULL,
    daily_return_rwf DOUBLE PRECISION NOT NULL,
    payment_code TEXT NOT NULL,
    payment_ref TEXT NOT NULL,
    status TEXT NOT NULL,
    total_earned_rwf DOUBLE PRECISION NOT NULL DEFAULT 0,
    last_roi_credited_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS spin_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    reward_rwf DOUBLE PRECISION NOT NULL,
    spun_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    network TEXT NOT NULL,
    destination_type TEXT NOT NULL,
    destination_value TEXT NOT NULL,
    account_registered_names TEXT NOT NULL,
    gross_amount_rwf DOUBLE PRECISION NOT NULL,
    fee_percent DOUBLE PRECISION NOT NULL,
    fee_rwf DOUBLE PRECISION NOT NULL,
    net_amount_rwf DOUBLE PRECISION NOT NULL,
    is_first_bonus_withdrawal INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS video_campaigns (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    creator_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    video_url TEXT NOT NULL,
    reward_per_view_rwf DOUBLE PRECISION NOT NULL,
    target_viewers INTEGER NOT NULL,
    total_budget_rwf DOUBLE PRECISION NOT NULL,
    payment_code TEXT NOT NULL,
    payment_ref TEXT NOT NULL,
    watched_by_user_ids TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS custom_tasks (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    creator_name TEXT NOT NULL,
    title TEXT NOT NULL,
    requirements TEXT NOT NULL,
    reward_per_completion_rwf DOUBLE PRECISION NOT NULL,
    target_completions INTEGER NOT NULL,
    total_budget_rwf DOUBLE PRECISION NOT NULL,
    payment_code TEXT NOT NULL,
    payment_ref TEXT NOT NULL,
    approved_worker_ids TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS task_submissions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    task_title TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    worker_name TEXT NOT NULL,
    proof_text TEXT NOT NULL,
    proof_url TEXT,
    reward_rwf DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL,
    admin_note TEXT,
    submitted_at TEXT NOT NULL,
    reviewed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS bet_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    category TEXT NOT NULL,
    stake_rwf DOUBLE PRECISION NOT NULL,
    questions_answered INTEGER NOT NULL,
    multiplier DOUBLE PRECISION NOT NULL,
    payout_rwf DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL,
    ended_reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS airtime_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    network TEXT NOT NULL,
    service_type TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    amount_rwf DOUBLE PRECISION NOT NULL,
    bundle_label TEXT,
    status TEXT NOT NULL,
    admin_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS p2p_transfers (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_address TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    receiver_name TEXT NOT NULL,
    receiver_address TEXT NOT NULL,
    gross_amount_rwf DOUBLE PRECISION NOT NULL,
    tax_percent DOUBLE PRECISION NOT NULL,
    tax_rwf DOUBLE PRECISION NOT NULL,
    net_amount_rwf DOUBLE PRECISION NOT NULL,
    note TEXT,
    status TEXT NOT NULL,
    claimed_by_receiver INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS fx_exchanges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    direction TEXT NOT NULL,
    from_amount DOUBLE PRECISION NOT NULL,
    to_amount DOUBLE PRECISION NOT NULL,
    rate_applied DOUBLE PRECISION NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS usdt_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    amount_usdt DOUBLE PRECISION NOT NULL,
    network TEXT NOT NULL,
    destination_or_tx_ref TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL,
    admin_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    reference TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    channel TEXT NOT NULL,
    amount_rwf DOUBLE PRECISION NOT NULL,
    fee_rwf DOUBLE PRECISION,
    direction TEXT NOT NULL,
    status TEXT NOT NULL,
    timestamp TEXT NOT NULL
  )`,
];

async function initSchemaAndDefaults(): Promise<void> {
  for (const stmt of SCHEMA_STATEMENTS) {
    await dbExecute(stmt);
  }

  const existingSettings = await dbQueryOne<{ key: string }>(
    'SELECT key FROM settings WHERE key = $1',
    ['platform'],
  );
  if (!existingSettings) {
    await dbExecute(
      'INSERT INTO settings (key, data, updated_at) VALUES ($1, $2, $3)',
      ['platform', JSON.stringify(DEFAULT_SYSTEM_SETTINGS), new Date().toISOString()],
    );
  }

  const existingPromos = await dbQueryOne<{ id: string }>(
    'SELECT id FROM promotions LIMIT 1',
  );
  if (!existingPromos) {
    for (const promo of INITIAL_PLATFORM_STATE.promotions) {
      await dbExecute(
        'INSERT INTO promotions (id, title, summary, category, active, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          promo.id,
          promo.title,
          promo.summary,
          promo.category,
          promo.active ? 1 : 0,
          promo.createdAt,
        ],
      );
    }
  }
}

export function ensureSchema(): Promise<void> {
  if (!globalThis._efinanceSchemaPromise) {
    globalThis._efinanceSchemaPromise = initSchemaAndDefaults().catch((err) => {
      globalThis._efinanceSchemaPromise = undefined;
      throw err;
    });
  }
  return globalThis._efinanceSchemaPromise;
}

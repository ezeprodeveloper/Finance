import { DEFAULT_SYSTEM_SETTINGS, INITIAL_PLATFORM_STATE } from '../src/data/platformStore.ts';

export interface MigrationContext {
  engine: 'postgres' | 'sqlite';
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
  queryOne: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T | null>;
  execute: (sql: string, params?: unknown[]) => Promise<void>;
}

export interface AppliedMigrationInfo {
  version: number;
  name: string;
  appliedAt: string;
}

export interface MigrationRunSummary {
  appliedVersions: number[];
  newlyApplied: number[];
  alreadyInitialized: boolean;
}

interface MigrationDefinition {
  version: number;
  name: string;
  up: (ctx: MigrationContext) => Promise<void>;
}

const MIGRATIONS: MigrationDefinition[] = [
  {
    version: 1,
    name: '001_initial_relational_schema',
    up: async (ctx) => {
      const statements = [
        `CREATE TABLE IF NOT EXISTS admin_credentials (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
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
          referred_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
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
        `CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          role TEXT NOT NULL,
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS savings_goals (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          reward_rwf DOUBLE PRECISION NOT NULL,
          spun_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS withdrawals (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
          task_id TEXT NOT NULL REFERENCES custom_tasks(id) ON DELETE CASCADE,
          task_title TEXT NOT NULL,
          worker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
          sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          sender_name TEXT NOT NULL,
          sender_address TEXT NOT NULL,
          receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_name TEXT NOT NULL,
          direction TEXT NOT NULL,
          from_amount DOUBLE PRECISION NOT NULL,
          to_amount DOUBLE PRECISION NOT NULL,
          rate_applied DOUBLE PRECISION NOT NULL,
          created_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS usdt_requests (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
      for (const stmt of statements) {
        await ctx.execute(stmt);
      }
    },
  },
  {
    version: 2,
    name: '002_performance_indexes',
    up: async (ctx) => {
      const indexStatements = [
        'CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status)',
        'CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status)',
        'CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_user_id)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)',
        'CREATE INDEX IF NOT EXISTS idx_savings_user_id ON savings_goals(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_loans_user_status ON loans(user_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_investments_user_status ON investments(user_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_spin_user_id ON spin_history(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status ON withdrawals(user_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_videos_status ON video_campaigns(status)',
        'CREATE INDEX IF NOT EXISTS idx_tasks_status ON custom_tasks(status)',
        'CREATE INDEX IF NOT EXISTS idx_submissions_task_worker ON task_submissions(task_id, worker_id)',
        'CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bet_sessions(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_airtime_user_status ON airtime_requests(user_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_p2p_sender_id ON p2p_transfers(sender_id)',
        'CREATE INDEX IF NOT EXISTS idx_p2p_receiver_id ON p2p_transfers(receiver_id)',
        'CREATE INDEX IF NOT EXISTS idx_fx_user_id ON fx_exchanges(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_usdt_user_status ON usdt_requests(user_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_tx_user_timestamp ON transactions(user_id, timestamp DESC)',
        'CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active, created_at DESC)',
      ];
      for (const stmt of indexStatements) {
        await ctx.execute(stmt);
      }
    },
  },
  {
    version: 3,
    name: '003_default_settings_and_promotions',
    up: async (ctx) => {
      const existingSettings = await ctx.queryOne<{ key: string }>(
        'SELECT key FROM settings WHERE key = $1',
        ['platform'],
      );
      if (!existingSettings) {
        await ctx.execute(
          'INSERT INTO settings (key, data, updated_at) VALUES ($1, $2, $3)',
          ['platform', JSON.stringify(DEFAULT_SYSTEM_SETTINGS), new Date().toISOString()],
        );
      }

      const existingPromo = await ctx.queryOne<{ id: string }>(
        'SELECT id FROM promotions LIMIT 1',
      );
      if (!existingPromo) {
        for (const promo of INITIAL_PLATFORM_STATE.promotions) {
          await ctx.execute(
            `INSERT INTO promotions (id, title, summary, category, active, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
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
    },
  },
];

export async function runPendingMigrations(ctx: MigrationContext): Promise<MigrationRunSummary> {
  if (ctx.engine === 'sqlite') {
    await ctx.execute('PRAGMA foreign_keys = ON');
  }

  await ctx.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`,
  );

  const appliedRows = await ctx.query<{ version: number; name: string; applied_at: string }>(
    'SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC',
  );
  const appliedSet = new Set(appliedRows.map((r) => Number(r.version)));
  const alreadyInitialized = appliedRows.length > 0;
  const newlyApplied: number[] = [];

  for (const migration of MIGRATIONS) {
    if (appliedSet.has(migration.version)) continue;
    await migration.up(ctx);
    await ctx.execute(
      `INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)`,
      [migration.version, migration.name, new Date().toISOString()],
    );
    appliedSet.add(migration.version);
    newlyApplied.push(migration.version);
  }

  return {
    appliedVersions: Array.from(appliedSet).sort((a, b) => a - b),
    newlyApplied,
    alreadyInitialized,
  };
}

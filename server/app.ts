import express from 'express';
import { createAdminRouter } from './adminRoutes.ts';
import {
  checkDatabaseStatus,
  DatabaseConfigurationError,
  dbExecute,
  dbQuery,
  dbQueryOne,
  ensureSchema,
} from './db.ts';
import { getPlatformSettings, mapPromotionRow, mapUserRow } from './mappers.ts';
import { createMemberRouter } from './memberRoutes.ts';
import { createSession, getConfiguredAdminEmail, getEnvAdminPasscode } from './middleware.ts';
import {
  constantTimeEqual,
  generateAccountNumber,
  generateReferralCode,
  generateSafeId,
  getRwandaPhoneVariants,
  hashSecret,
  isValidRwandaId,
  isValidRwandaPhone,
  verifySecret,
} from './security.ts';

export function createApiApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', async (_req, res) => {
    const dbStatus = await checkDatabaseStatus();
    if (!dbStatus.connected) {
      res.status(503).json({
        ok: false,
        connected: false,
        engine: dbStatus.engine,
        needsVercelPostgresStore: dbStatus.needsVercelPostgresStore,
        error: dbStatus.error,
      });
      return;
    }
    res.json({
      ok: true,
      connected: true,
      engine: dbStatus.engine,
      migrationsApplied: dbStatus.migrationSummary?.appliedVersions ?? [],
    });
  });

  app.get('/api/setup/status', async (_req, res) => {
    const dbStatus = await checkDatabaseStatus();
    if (!dbStatus.connected) {
      res.status(200).json({
        dbReady: false,
        engine: dbStatus.engine,
        needsVercelPostgresStore: dbStatus.needsVercelPostgresStore,
        error: dbStatus.error,
        adminConfigured: false,
        migrationsApplied: [],
        newlyApplied: [],
      });
      return;
    }

    let adminConfigured = Boolean(getEnvAdminPasscode());
    if (!adminConfigured) {
      const row = await dbQueryOne<{ id: string }>(
        'SELECT id FROM admin_credentials WHERE id = $1',
        ['primary'],
      ).catch(() => null);
      adminConfigured = Boolean(row);
    }

    const newlyApplied = dbStatus.migrationSummary?.newlyApplied ?? [];
    res.json({
      dbReady: true,
      engine: dbStatus.engine,
      needsVercelPostgresStore: false,
      error: null,
      adminConfigured,
      migrationsApplied: dbStatus.migrationSummary?.appliedVersions ?? [],
      newlyApplied,
      alreadyInitialized: dbStatus.migrationSummary?.alreadyInitialized ?? false,
      setupMessage:
        newlyApplied.length > 0
          ? `Database automatically initialized (${dbStatus.engine}) with ${dbStatus.migrationSummary?.appliedVersions.length ?? 0} schema migrations and default settings.`
          : `Database connected (${dbStatus.engine}) and existing data preserved.`,
    });
  });

  // Ensure SQL schema & pending migrations are applied lazily before all other /api routes
  app.use('/api', async (_req, res, next) => {
    try {
      await ensureSchema();
      next();
    } catch (err) {
      console.error('Database initialization error:', err);
      if (err instanceof DatabaseConfigurationError) {
        res.status(503).json({
          error: err.message,
          needsVercelPostgresStore: true,
        });
        return;
      }
      res.status(500).json({ error: 'Database initialization failed.' });
    }
  });

  app.get('/api/public/bootstrap', async (_req, res) => {
    try {
      const [settings, promoRows, vidCountRow, taskCountRow] = await Promise.all([
        getPlatformSettings(),
        dbQuery<Record<string, unknown>>(
          'SELECT * FROM promotions WHERE active = 1 ORDER BY created_at DESC',
        ),
        dbQueryOne<{ cnt: number | string }>(
          `SELECT COUNT(*) AS cnt FROM video_campaigns WHERE status = 'active'`,
        ),
        dbQueryOne<{ cnt: number | string }>(
          `SELECT COUNT(*) AS cnt FROM custom_tasks WHERE status = 'active'`,
        ),
      ]);

      res.json({
        settings,
        promotions: promoRows.map(mapPromotionRow),
        totalActiveVideos: Number(vidCountRow?.cnt ?? 0),
        totalActiveTasks: Number(taskCountRow?.cnt ?? 0),
      });
    } catch (err) {
      console.error('Public bootstrap error:', err);
      res.status(500).json({ error: 'Failed to load public platform info.' });
    }
  });

  app.get('/api/auth/admin-status', async (_req, res) => {
    try {
      const envPass = getEnvAdminPasscode();
      const row = await dbQueryOne<{ id: string }>(
        'SELECT id FROM admin_credentials WHERE id = $1',
        ['primary'],
      );
      res.json({
        adminEmail: getConfiguredAdminEmail(),
        configured: Boolean(envPass) || Boolean(row),
      });
    } catch (err) {
      console.error('Admin status check error:', err);
      res.status(500).json({ error: 'Unable to check admin status.' });
    }
  });

  app.post('/api/auth/admin-claim', async (req, res) => {
    try {
      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const password = String(req.body?.password ?? '');
      const expectedEmail = getConfiguredAdminEmail();

      if (email !== expectedEmail) {
        res.status(403).json({ error: 'Unauthorized email for administrator bootstrap.' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Administrator password must be at least 6 characters.' });
        return;
      }

      if (getEnvAdminPasscode()) {
        res.status(409).json({ error: 'Administrator passcode is already configured via environment secret.' });
        return;
      }

      const existing = await dbQueryOne<{ id: string }>(
        'SELECT id FROM admin_credentials WHERE id = $1',
        ['primary'],
      );
      if (existing) {
        res.status(409).json({ error: 'Administrator password is already claimed. Sign in normally.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const passwordHash = hashSecret(password);
      await dbExecute(
        'INSERT INTO admin_credentials (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4)',
        ['primary', expectedEmail, passwordHash, nowIso],
      );

      const token = await createSession('admin', null, expectedEmail);
      res.json({ token, role: 'admin' });
    } catch (err) {
      console.error('Admin claim error:', err);
      res.status(500).json({ error: 'Failed to initialize administrator credentials.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const identifier = String(req.body?.identifier ?? '').trim();
      const password = String(req.body?.password ?? '');
      const normalized = identifier.toLowerCase();

      if (!identifier || !password) {
        res.status(400).json({ error: 'Enter your email or phone number and password.' });
        return;
      }

      const adminEmail = getConfiguredAdminEmail();
      if (normalized === adminEmail) {
        const envPass = getEnvAdminPasscode();
        if (envPass) {
          if (!constantTimeEqual(password, envPass)) {
            res.status(401).json({ error: 'Invalid email/phone or password.' });
            return;
          }
          const token = await createSession('admin', null, adminEmail);
          res.json({ token, role: 'admin' });
          return;
        }

        const credRow = await dbQueryOne<{ password_hash: string }>(
          'SELECT password_hash FROM admin_credentials WHERE id = $1',
          ['primary'],
        );
        if (!credRow) {
          res.status(428).json({
            needsAdminSetup: true,
            error: 'First-run setup: create your administrator password to lock the Admin account.',
          });
          return;
        }
        if (!verifySecret(password, credRow.password_hash)) {
          res.status(401).json({ error: 'Invalid email/phone or password.' });
          return;
        }
        const token = await createSession('admin', null, adminEmail);
        res.json({ token, role: 'admin' });
        return;
      }

      const phoneVariants = getRwandaPhoneVariants(identifier);
      const pv0 = phoneVariants[0] ?? normalized;
      const pv1 = phoneVariants[1] ?? pv0;
      const pv2 = phoneVariants[2] ?? pv0;
      const pv3 = phoneVariants[3] ?? pv0;
      const userRow = await dbQueryOne<Record<string, unknown>>(
        `SELECT * FROM users
         WHERE LOWER(email) = $1
            OR REPLACE(REPLACE(phone, ' ', ''), '-', '') IN ($2, $3, $4, $5)
         LIMIT 1`,
        [normalized, pv0, pv1, pv2, pv3],
      );

      if (!userRow) {
        res.status(401).json({ error: 'No matching account found, or incorrect password.' });
        return;
      }

      const storedHash = String(userRow.password_hash ?? '');
      if (!verifySecret(password, storedHash)) {
        res.status(401).json({ error: 'Incorrect password. Please check and try again.' });
        return;
      }

      const user = mapUserRow(userRow);
      if (user.accountStatus === 'suspended') {
        res.status(403).json({ error: 'This account has been suspended by E-Finance Admin.' });
        return;
      }

      const token = await createSession('user', user.id, user.email);
      res.json({ token, role: 'user', user });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Unable to sign in right now. Please try again.' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const body = req.body ?? {};
      const firstName = String(body.firstName ?? '').trim();
      const secondName = String(body.secondName ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      const phone = String(body.phone ?? '').trim();
      const gender = String(body.gender ?? 'Male');
      const dateOfBirth = String(body.dateOfBirth ?? '').trim();
      const idNumber = String(body.idNumber ?? '').replace(/\s/g, '');
      const photoDataUrl = String(body.photoDataUrl ?? '');
      const education = body.education ?? {};
      const residence = body.residence ?? {};
      const password = String(body.rawPassword ?? '');
      const referralCodeInput = String(body.referralCodeInput ?? '').trim().toUpperCase();

      if (firstName.length < 2 || secondName.length < 2) {
        res.status(400).json({ error: 'Enter both first name and second name.' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Enter a valid email address.' });
        return;
      }
      if (!isValidRwandaPhone(phone)) {
        res.status(400).json({ error: 'Enter a valid Rwanda phone number.' });
        return;
      }
      if (!isValidRwandaId(idNumber)) {
        res.status(400).json({ error: 'Enter a valid 16-digit Rwanda National ID number.' });
        return;
      }
      if (!photoDataUrl.startsWith('data:image/')) {
        res.status(400).json({ error: 'Upload a valid profile photo.' });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters.' });
        return;
      }
      if (email === getConfiguredAdminEmail()) {
        res.status(400).json({ error: 'This email address is reserved.' });
        return;
      }

      const regVariants = getRwandaPhoneVariants(phone);
      const rv0 = regVariants[0] ?? phone.replace(/[\s-]/g, '');
      const rv1 = regVariants[1] ?? rv0;
      const rv2 = regVariants[2] ?? rv0;
      const rv3 = regVariants[3] ?? rv0;
      const dup = await dbQueryOne<{ email: string; id_number: string }>(
        `SELECT email, id_number FROM users
         WHERE LOWER(email) = $1
            OR REPLACE(REPLACE(phone, ' ', ''), '-', '') IN ($2, $3, $4, $5)
            OR id_number = $6
         LIMIT 1`,
        [email, rv0, rv1, rv2, rv3, idNumber],
      );
      if (dup) {
        if (dup.email.toLowerCase() === email) {
          res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
          return;
        }
        if (dup.id_number === idNumber) {
          res.status(409).json({ error: 'An account with this Rwanda National ID already exists.' });
          return;
        }
        res.status(409).json({ error: 'An account with this phone number already exists.' });
        return;
      }

      let referredByUserId: string | null = null;
      if (referralCodeInput) {
        const refRow = await dbQueryOne<{ id: string }>(
          'SELECT id FROM users WHERE UPPER(referral_code) = $1 LIMIT 1',
          [referralCodeInput],
        );
        referredByUserId = refRow?.id ?? null;
      }

      const id = generateSafeId('usr');
      const nowIso = new Date().toISOString();
      const accountNumber = generateAccountNumber();
      const referralCode = generateReferralCode(firstName);
      const passwordHash = hashSecret(password);

      await dbExecute(
        `INSERT INTO users (
          id, first_name, second_name, email, phone, gender, date_of_birth, id_number,
          photo_data_url, education, residence, password_hash, account_number, referral_code,
          referred_by_user_id, spin_credits, has_completed_first_withdrawal, account_status,
          wallet_balance_rwf, bonus_balance_rwf, savings_balance_rwf, wallet_balance_usd,
          usdt_balance, usdt_savings_balance, last_check_in_at, check_in_streak, kyc_status,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, 0, 0, 'pending_approval',
          0, 0, 0, 0,
          0, 0, NULL, 0, 'not_submitted',
          $16, $17
        )`,
        [
          id,
          firstName,
          secondName,
          email,
          phone,
          gender,
          dateOfBirth,
          idNumber,
          photoDataUrl.slice(0, 1500000),
          JSON.stringify(education),
          JSON.stringify(residence),
          passwordHash,
          accountNumber,
          referralCode,
          referredByUserId,
          nowIso,
          nowIso,
        ],
      );

      const createdRow = await dbQueryOne<Record<string, unknown>>(
        'SELECT * FROM users WHERE id = $1',
        [id],
      );
      const user = mapUserRow(createdRow!);
      const token = await createSession('user', user.id, user.email);

      res.status(201).json({ token, role: 'user', user });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Unable to complete registration right now.' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const header = req.headers.authorization;
      if (header && header.startsWith('Bearer ')) {
        const token = header.slice('Bearer '.length).trim();
        if (token) {
          await dbExecute('DELETE FROM sessions WHERE token = $1', [token]);
        }
      }
      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  });

  app.use('/api/member', createMemberRouter());
  app.use('/api/admin', createAdminRouter());
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  return app;
}

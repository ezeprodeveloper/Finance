/**
 * Phase 0 Adversarial Security Payload Verification Specification.
 * Documents and verifies the 12 Dirty Dozen payloads against E-Finance Firestore Rules invariants.
 */
export interface SecurityTestCase {
  id: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_PAYLOADS: SecurityTestCase[] = [
  {
    id: 'DD-01-ghost-field-self-credit',
    collection: 'users',
    operation: 'create',
    payload: {
      id: 'uid_attacker',
      accountStatus: 'active',
      walletBalanceRwf: 999999,
      isAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidUserCreate() enforces keys().hasOnly() + zero starting balances + pending_approval',
  },
  {
    id: 'DD-02-unverified-email-spoof',
    collection: 'settings',
    operation: 'update',
    payload: {
      authToken: { email: 'ezeprodeveloper@gmail.com', email_verified: false },
      activationFeeRwf: 0,
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isAdmin() mandates isVerifiedUser() (request.auth.token.email_verified == true)',
  },
  {
    id: 'DD-03-cross-user-pii-read',
    collection: 'users',
    operation: 'get',
    payload: { requesterUid: 'uid_b', targetDocId: 'uid_a' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'allow get restricts PII to request.auth.uid == userId || isAdmin()',
  },
  {
    id: 'DD-04-locked-photo-tamper',
    collection: 'users',
    operation: 'update',
    payload: { photoDataUrl: 'data:image/jpeg;base64,/9j/tampered' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'photoDataUrl is excluded from all non-admin affectedKeys().hasOnly() branches',
  },
  {
    id: 'DD-05-kyc-self-approve',
    collection: 'users',
    operation: 'update',
    payload: { kycStatus: 'approved', kycData: { nationalId: '1199000000000001' } },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'owner KYC update requires incoming().kycStatus == "pending"',
  },
  {
    id: 'DD-06-unbounded-wallet-mint',
    collection: 'users',
    operation: 'update',
    payload: { walletBalanceRwf: 5000000 },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'owner balance deltas strictly bounded per action branch',
  },
  {
    id: 'DD-07-id-poisoning',
    collection: 'savingsGoals',
    operation: 'create',
    payload: { docId: 'bad/id$with*chars_longer_than_128_' + 'x'.repeat(130) },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidId() checks size <= 128 and regex ^[a-zA-Z0-9_-]+$',
  },
  {
    id: 'DD-08-duplicate-video-claim',
    collection: 'videoCampaigns',
    operation: 'update',
    payload: { watchedByUserIds: ['uid_a', 'uid_a'] },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: '!(request.auth.uid in existing().watchedByUserIds) prevents duplicate claims',
  },
  {
    id: 'DD-09-spin-cap-exceeded',
    collection: 'spinHistory',
    operation: 'create',
    payload: { id: 'sp-1', userId: 'uid_a', rewardRwf: 500, spunAt: '2026-11-22T12:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidSpinCreate() enforces rewardRwf >= 0 && rewardRwf <= 200',
  },
  {
    id: 'DD-10-loan-self-approve',
    collection: 'loans',
    operation: 'create',
    payload: { id: 'ln-1', userId: 'uid_a', status: 'approved', principalRwf: 100000 },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'loan create enforces incoming().status == "pending_admin"',
  },
  {
    id: 'DD-11-withdrawal-status-escalation',
    collection: 'withdrawals',
    operation: 'update',
    payload: { status: 'paid' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'allow update on withdrawals restricted strictly to isAdmin()',
  },
  {
    id: 'DD-12-unauthorized-promo-write',
    collection: 'promotions',
    operation: 'create',
    payload: { id: 'pr-1', title: 'Fake Promo', active: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'allow create, update, delete on promotions restricted strictly to isAdmin()',
  },
];

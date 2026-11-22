# E-Finance Rwanda — Firestore Security Specification (Phase 0)

## 1. Core Data Invariants
1. **Master Gate & Verified Identity**: All user, savings, loan, investment, spin, withdrawal, submission, and transaction operations require an authenticated, email-verified Firebase user (`request.auth != null && request.auth.token.email_verified == true`).
2. **PII Isolation**: User documents contain National ID (`16` digits), phone numbers, DOB, and KYC photos. Only the document owner (`request.auth.uid == userId`) or a verified Admin may read/list a user document.
3. **Zero Client-Forged Balances or Approvals**: Newly created user profiles MUST start with `accountStatus == 'pending_approval'`, `kycStatus == 'not_submitted'`, `walletBalanceRwf == 0`, `bonusBalanceRwf == 0`, `savingsBalanceRwf == 0`, `spinCredits == 0`, and `hasCompletedFirstWithdrawal == false`.
4. **Immutable Locked Photo**: Members CANNOT modify `photoDataUrl` after registration; only a verified Admin can replace or adjust a member's profile photo.
5. **Single-Claim Video & Task Enforcement**: `watchedByUserIds` updates on `videoCampaigns` allow a verified user to append only `request.auth.uid` once (`!(request.auth.uid in existing().watchedByUserIds)`), bounded by array length limits.
6. **Spin Reward Cap**: Member-created `spinHistory` entries and member balance increments during spins are strictly capped at `<= 200 RWF` and require `existing().spinCredits >= 1`.
7. **Admin Bootstrapping**: Admin checks require BOTH email match (`ezeprodeveloper@gmail.com` or `hbmgshzchl@gmail.com`, or `/admins/$(request.auth.uid)`) AND `request.auth.token.email_verified == true`.
8. **Secure List Queries**: Every `allow list` on private collections enforces `resource.data.userId == request.auth.uid` (or `workerId`/`id == request.auth.uid`) or `isAdmin()`, never relying on client filters alone.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Be Rejected with PERMISSION_DENIED)
1. **Self-Admin Promotion / Ghost Field on User Create**: `{ "id": "uid1", ..., "isAdmin": true, "accountStatus": "active", "walletBalanceRwf": 50000 }` -> Rejected by `hasOnly(...)` + `accountStatus == 'pending_approval'` + `walletBalanceRwf == 0`.
2. **Unverified Admin Email Spoof**: Request with `auth.token.email == 'ezeprodeveloper@gmail.com'` and `auth.token.email_verified == false` -> Rejected by `isVerifiedUser()`.
3. **Cross-User PII Read**: Authenticated user `uid2` attempts `get(/users/uid1)` or `list(/users)` -> Rejected by `request.auth.uid == userId || isAdmin()`.
4. **Member Self-Modification of Locked Photo**: Owner `uid1` updates `photoDataUrl` on `/users/uid1` -> Rejected because `photoDataUrl` is absent from all owner `affectedKeys().hasOnly(...)` action branches.
5. **Member Self-Approval of KYC**: Owner `uid1` updates `kycStatus: 'approved'` on `/users/uid1` -> Rejected because owner KYC submission action enforces `incoming().kycStatus == 'pending'`.
6. **Unbounded Wallet Credit Spoof**: Owner `uid1` updates `walletBalanceRwf: 999999` on `/users/uid1` -> Rejected by bounded delta rules on each action branch.
7. **ID Poisoning Attack**: Create document at `/savingsGoals/<1500-char-junk>` or `/users/uid1;drop` -> Rejected by `isValidId()` regex `^[a-zA-Z0-9_-]+$` and `.size() <= 128`.
8. **Duplicate Video Watch Claim**: User `uid1` updates `watchedByUserIds` on `/videoCampaigns/vid1` when `uid1` is already in `watchedByUserIds` -> Rejected by `!(request.auth.uid in existing().watchedByUserIds)`.
9. **Exceeding Spin Cap (> 200 RWF)**: User `uid1` creates `/spinHistory/sp1` with `rewardRwf: 500` -> Rejected by `rewardRwf <= 200`.
10. **Loan Auto-Approval by Borrower**: User `uid1` creates `/loans/ln1` with `status: 'approved'` -> Rejected by `incoming().status == 'pending_admin'`.
11. **Terminal State Tampering**: User `uid1` updates `/withdrawals/wd1` from `paid` or `pending_admin` to `paid` -> Rejected because only `isAdmin()` can transition withdrawal statuses.
12. **Hidden Promotion Injection**: Non-admin user attempts `create` or `update` on `/promotions/p1` or `/settings/platform` -> Rejected by `isAdmin()`.

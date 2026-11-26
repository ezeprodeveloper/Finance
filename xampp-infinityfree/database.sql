-- E-Finance Rwanda — Standalone MySQL 5.7+ / MariaDB 10.3+ Schema
-- Safe to import via phpMyAdmin (optional: PHP auto-migrations create all of these automatically).
-- Clean production baseline: zero dummy users, zero hardcoded passwords.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `version` INT PRIMARY KEY,
  `name` VARCHAR(191) NOT NULL,
  `applied_at` VARCHAR(48) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_credentials` (
  `id` VARCHAR(100) PRIMARY KEY,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` VARCHAR(48) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settings` (
  `key` VARCHAR(100) PRIMARY KEY,
  `data` LONGTEXT NOT NULL,
  `updated_at` VARCHAR(48) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `promotions` (
  `id` VARCHAR(100) PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `summary` TEXT NOT NULL,
  `category` VARCHAR(120) NOT NULL,
  `active` TINYINT NOT NULL DEFAULT 1,
  `created_at` VARCHAR(48) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(100) PRIMARY KEY,
  `first_name` VARCHAR(120) NOT NULL,
  `second_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `phone` VARCHAR(48) NOT NULL UNIQUE,
  `gender` VARCHAR(24) NOT NULL,
  `date_of_birth` VARCHAR(48) NOT NULL,
  `id_number` VARCHAR(32) NOT NULL UNIQUE,
  `photo_data_url` LONGTEXT NOT NULL,
  `education` LONGTEXT NOT NULL,
  `residence` LONGTEXT NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `account_number` VARCHAR(48) NOT NULL UNIQUE,
  `referral_code` VARCHAR(48) NOT NULL UNIQUE,
  `referred_by_user_id` VARCHAR(100) NULL,
  `spin_credits` INT NOT NULL DEFAULT 0,
  `has_completed_first_withdrawal` TINYINT NOT NULL DEFAULT 0,
  `account_status` VARCHAR(48) NOT NULL DEFAULT 'pending_approval',
  `activation_payment_ref` VARCHAR(191) NULL,
  `activation_paid_phone` VARCHAR(48) NULL,
  `wallet_balance_rwf` DOUBLE NOT NULL DEFAULT 0,
  `bonus_balance_rwf` DOUBLE NOT NULL DEFAULT 0,
  `savings_balance_rwf` DOUBLE NOT NULL DEFAULT 0,
  `wallet_balance_usd` DOUBLE NOT NULL DEFAULT 0,
  `usdt_balance` DOUBLE NOT NULL DEFAULT 0,
  `usdt_savings_balance` DOUBLE NOT NULL DEFAULT 0,
  `last_check_in_at` VARCHAR(48) NULL,
  `check_in_streak` INT NOT NULL DEFAULT 0,
  `kyc_status` VARCHAR(48) NOT NULL DEFAULT 'not_submitted',
  `kyc_data` LONGTEXT NULL,
  `created_at` VARCHAR(48) NOT NULL,
  `updated_at` VARCHAR(48) NOT NULL,
  CONSTRAINT `fk_users_referred_by` FOREIGN KEY (`referred_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `token` VARCHAR(128) PRIMARY KEY,
  `role` VARCHAR(24) NOT NULL,
  `user_id` VARCHAR(100) NULL,
  `email` VARCHAR(191) NOT NULL,
  `expires_at` VARCHAR(48) NOT NULL,
  `created_at` VARCHAR(48) NOT NULL,
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `savings_goals` (
  `id` VARCHAR(100) PRIMARY KEY,
  `user_id` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `plan_type` VARCHAR(48) NOT NULL,
  `target_rwf` DOUBLE NOT NULL,
  `current_rwf` DOUBLE NOT NULL DEFAULT 0,
  `target_date` VARCHAR(48) NOT NULL,
  `created_at` VARCHAR(48) NOT NULL,
  `updated_at` VARCHAR(48) NOT NULL,
  CONSTRAINT `fk_savings_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `loans` (
  `id` VARCHAR(100) PRIMARY KEY,
  `user_id` VARCHAR(100) NOT NULL,
  `user_name` VARCHAR(255) NOT NULL,
  `product` VARCHAR(191) NOT NULL,
  `reason` TEXT NOT NULL,
  `principal_rwf` DOUBLE NOT NULL,
  `term_months` INT NOT NULL,
  `annual_rate_percent` DOUBLE NOT NULL,
  `monthly_payment_rwf` DOUBLE NOT NULL,
  `total_repayable_rwf` DOUBLE NOT NULL,
  `repaid_rwf` DOUBLE NOT NULL DEFAULT 0,
  `status` VARCHAR(48) NOT NULL,
  `created_at` VARCHAR(48) NOT NULL,
  `updated_at` VARCHAR(48) NOT NULL,
  CONSTRAINT `fk_loans_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `investments` (
  `id` VARCHAR(100) PRIMARY KEY,
  `user_id` VARCHAR(100) NOT NULL,
  `user_name` VARCHAR(255) NOT NULL,
  `tier_id` VARCHAR(64) NOT NULL,
  `plan_name` VARCHAR(191) NOT NULL,
  `deposit_rwf` DOUBLE NOT NULL,
  `daily_return_rwf` DOUBLE NOT NULL,
  `payment_code` VARCHAR(128) NOT NULL,
  `payment_ref` VARCHAR(191) NOT NULL,
  `status` VARCHAR(48) NOT NULL,
  `total_earned_rwf` DOUBLE NOT NULL DEFAULT 0,
  `last_roi_credited_at` VARCHAR(48) NULL,
  `created_at` VARCHAR(48) NOT NULL,
  `updated_at` VARCHAR(48) NOT NULL,
  CONSTRAINT `fk_investments_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `spin_history` (
  `id` VARCHAR(100) PRIMARY KEY,
  `user_id` VARCHAR(100) NOT NULL,
  `reward_rwf` DOUBLE NOT NULL,
  `spun_at` VARCHAR(48) NOT NULL,
  CONSTRAINT `fk_spin_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` VARCHAR(100) PRIMARY KEY,
  `user_id` VARCHAR(100) NOT NULL,
  `user_name` VARCHAR(255) NOT NULL,
  `network` VARCHAR(64) NOT NULL,
  `destination_type` VARCHAR(64) NOT NULL,
  `destination_value` VARCHAR(191) NOT NULL,
  `account_registered_names` VARCHAR(255) NOT NULL,
  `gross_amount_rwf` DOUBLE NOT NULL,
  `fee_percent` DOUBLE NOT NULL,
  `fee_rwf` DOUBLE NOT NULL,
  `net_amount_rwf` DOUBLE NOT NULL,
  `is_first_bonus_withdrawal` TINYINT NOT NULL DEFAULT 0,
  `status` VARCHAR(48) NOT NULL,
  `created_at` VARCHAR(48) NOT NULL,
  `updated_at` VARCHAR(48) NOT NULL,
  CONSTRAINT `fk_withdrawals_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `video_campaigns` (
  `id` VARCHAR(100) PRIMARY KEY,
  `creator_id` VARCHAR(100) NOT NULL,
  `creator_name` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `video_url` LONGTEXT NOT NULL,
  `reward_per_view_rwf` DOUBLE NOT NULL,
  `target_viewers` INT NOT NULL,
  `total_budget_rwf` DOUBLE NOT NULL,
  `payment_code` VARCHAR(128) NOT NULL,
  `payment_ref` VARCHAR(191) NOT NULL,
  `watched_by_user_ids` LONGTEXT NOT NULL,
  `status` VARCHAR(48) NOT NULL,
  `created_at` VARCHAR(48) NOT NULL,
  `updated_at` VARCHAR(48) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `custom_tasks` (
  `id` VARCHAR(100) PRIMARY KEY,
  `creator_id` VARCHAR(100) NOT NULL,
  `creator_name` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `requirements` TEXT NOT NULL,
  `reward_per_completion_rwf` DOUBLE NOT NULL,
  `target_completions` INT NOT NULL,
  `total_budget_rwf` DOUBLE NOT NULL,
  `payment_code` VARCHAR(128) NOT NULL,
  `payment_ref` VARCHAR(191) NOT NULL,
  `approved_worker_ids` LONGTEXT NOT NULL,
  `status` VARCHAR(48) NOT NULL,
  `created_at` VARCHAR(48) NOT NULL,
  `updated_at` VARCHAR(48) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_submissions` (
  `id` VARCHAR(100) PRIMARY KEY,
  `task_id` VARCHAR(100) NOT NULL,
  `task_title` VARCHAR(255) NOT NULL,
  `worker_id` VARCHAR(100) NOT NULL,
  `worker_name` VARCHAR(255) NOT NULL,
  `proof_text` TEXT NOT NULL,
  `proof_url` TEXT NULL,
  `reward_rwf` DOUBLE NOT NULL,
  `status` VARCHAR(48) NOT NULL,
  `admin_note` TEXT NULL,
  `submitted_at` VARCHAR(48) NOT NULL,
  `reviewed_at` VARCHAR(48) NULL,
  CONSTRAINT `fk_sub_task` FOREIGN KEY (`task_id`) REFERENCES `custom_tasks`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sub_worker` FOREIGN KEY (`worker_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bet_sessions` (
  `id` VARCHAR(100) PRIMARY KEY,
  `user_id` VARCHAR(100) NOT NULL,
  `user_name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `stake_rwf` DOUBLE NOT NULL,
  `questions_answered` INT NOT NULL,
  `multiplier` DOUBLE NOT NULL,
  `payout_rwf` DOUBLE NOT NULL,
  `status` VARCHAR(48) NOT NULL,
  `ended_reason` VARCHAR(255) NOT NULL,
  `created_at` VARCHAR(48) NOT NULL,
  CONSTRAINT `fk_bets_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `airtime_requests` (
  `id` VARCHAR(100) PRIMARY KEY,
  `user_id` VARCHAR(100) NOT NULL,
  `user_name` VARCHAR(255) NOT NULL,
  `network` VARCHAR(64) NOT NULL,
  `service_type` VARCHAR(64) NOT NULL,
  `phone_number` VARCHAR(48) NOT NULL,
  `amount_rwf` DOUBLE NOT NULL,
  `bundle_label` VARCHAR(191) NULL,
  `status` VARCHAR(48) NOT NULL,
  `admin_note` TEXT NULL,
  `created_at` VARCHAR(48) NOT NULL,
  `updated_at` VARCHAR(48) NOT NULL,
  CONSTRAINT `fk_airtime_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `p2p_transfers` (
  `id` VARCHAR(100) PRIMARY KEY,
  `sender_id` VARCHAR(100) NOT NULL,
  `sender_name` VARCHAR(255) NOT NULL,
  `sender_address` VARCHAR(64) NOT NULL,
  `receiver_id` VARCHAR(100) NOT NULL,
  `receiver_name` VARCHAR(255) NOT NULL,
  `receiver_address` VARCHAR(64) NOT NULL,
  `gross_amount_rwf` DOUBLE NOT NULL,
  `tax_percent` DOUBLE NOT NULL,
  `tax_rwf` DOUBLE NOT NULL,
  `net_amount_rwf` DOUBLE NOT NULL,
  `note` TEXT NULL,
  `status` VARCHAR(48) NOT NULL,
  `claimed_by_receiver` TINYINT NOT NULL DEFAULT 1,
  `created_at` VARCHAR(48) NOT NULL,
  CONSTRAINT `fk_p2p_sender` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_p2p_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fx_exchanges` (
  `id` VARCHAR(100) PRIMARY KEY,
  `user_id` VARCHAR(100) NOT NULL,
  `user_name` VARCHAR(255) NOT NULL,
  `direction` VARCHAR(48) NOT NULL,
  `from_amount` DOUBLE NOT NULL,
  `to_amount` DOUBLE NOT NULL,
  `rate_applied` DOUBLE NOT NULL,
  `created_at` VARCHAR(48) NOT NULL,
  CONSTRAINT `fk_fx_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `usdt_requests` (
  `id` VARCHAR(100) PRIMARY KEY,
  `user_id` VARCHAR(100) NOT NULL,
  `user_name` VARCHAR(255) NOT NULL,
  `action_type` VARCHAR(48) NOT NULL,
  `amount_usdt` DOUBLE NOT NULL,
  `network` VARCHAR(64) NOT NULL,
  `destination_or_tx_ref` VARCHAR(255) NOT NULL,
  `note` TEXT NULL,
  `status` VARCHAR(48) NOT NULL,
  `admin_note` TEXT NULL,
  `created_at` VARCHAR(48) NOT NULL,
  `updated_at` VARCHAR(48) NOT NULL,
  CONSTRAINT `fk_usdt_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transactions` (
  `id` VARCHAR(100) PRIMARY KEY,
  `user_id` VARCHAR(100) NOT NULL,
  `reference` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `channel` VARCHAR(255) NOT NULL,
  `amount_rwf` DOUBLE NOT NULL,
  `fee_rwf` DOUBLE NULL,
  `direction` VARCHAR(16) NOT NULL,
  `status` VARCHAR(48) NOT NULL,
  `timestamp` VARCHAR(48) NOT NULL,
  CONSTRAINT `fk_tx_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_users_account_status` ON `users` (`account_status`);
CREATE INDEX `idx_users_kyc_status` ON `users` (`kyc_status`);
CREATE INDEX `idx_users_referred_by` ON `users` (`referred_by_user_id`);
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);
CREATE INDEX `idx_savings_user_id` ON `savings_goals` (`user_id`);
CREATE INDEX `idx_loans_user_status` ON `loans` (`user_id`, `status`);
CREATE INDEX `idx_investments_user_status` ON `investments` (`user_id`, `status`);
CREATE INDEX `idx_spin_user_id` ON `spin_history` (`user_id`);
CREATE INDEX `idx_withdrawals_user_status` ON `withdrawals` (`user_id`, `status`);
CREATE INDEX `idx_videos_status` ON `video_campaigns` (`status`);
CREATE INDEX `idx_tasks_status` ON `custom_tasks` (`status`);
CREATE INDEX `idx_submissions_task_worker` ON `task_submissions` (`task_id`, `worker_id`);
CREATE INDEX `idx_bets_user_id` ON `bet_sessions` (`user_id`);
CREATE INDEX `idx_airtime_user_status` ON `airtime_requests` (`user_id`, `status`);
CREATE INDEX `idx_p2p_sender_id` ON `p2p_transfers` (`sender_id`);
CREATE INDEX `idx_p2p_receiver_id` ON `p2p_transfers` (`receiver_id`);
CREATE INDEX `idx_fx_user_id` ON `fx_exchanges` (`user_id`);
CREATE INDEX `idx_usdt_user_status` ON `usdt_requests` (`user_id`, `status`);
CREATE INDEX `idx_tx_user_timestamp` ON `transactions` (`user_id`, `timestamp`);
CREATE INDEX `idx_promotions_active` ON `promotions` (`active`, `created_at`);

INSERT IGNORE INTO `settings` (`key`, `data`, `updated_at`) VALUES (
  'platform',
  '{"activationFeeRwf":200,"welcomeBonusRwf":200,"dailyCheckInRwf":20,"withdrawalFeePercent":25,"subsequentMinWithdrawalRwf":1000,"subsequentMaxWithdrawalRwf":5000,"referralCommissionPercent":10,"minVideoRewardRwf":50,"momoPayCode":"1880554","sendMoneyTaxPercent":10,"rwfPerUsdRate":1380,"binanceDepositAddress":"Binance Pay ID: 58392014 · TRC20: TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE","platformTagline":"Rwanda Digital Finance — Savings, Credit Requests, Quiz Bet, Airtime, FX & USDT, Video Campaigns & Verified Tasks.","maintenanceMode":false}',
  '2026-11-01T08:00:00Z'
);

INSERT IGNORE INTO `promotions` (`id`, `title`, `summary`, `category`, `active`, `created_at`) VALUES
  ('promo-launch', 'Welcome to E-Finance Rwanda', 'Register your verified member account in three simple steps to manage RWF savings, invest in daily return plans, spin to win rewards, and track all transactions.', 'Official Announcement', 1, '2026-11-01T08:00:00Z'),
  ('promo-creators', 'Promote Short Videos & Paid Tasks Across Rwanda', 'Upload short promotional videos or publish custom tasks with clear requirements. Every submission is carefully reviewed before rewards are released.', 'Creator & Business Campaign', 1, '2026-11-10T10:00:00Z');

INSERT IGNORE INTO `schema_migrations` (`version`, `name`, `applied_at`) VALUES
  (1, '001_initial_relational_schema', '2026-11-01T08:00:00Z'),
  (2, '002_performance_indexes', '2026-11-01T08:00:00Z'),
  (3, '003_default_settings_and_promotions', '2026-11-01T08:00:00Z');

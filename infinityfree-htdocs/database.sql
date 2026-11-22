-- E-Finance Rwanda Production Database Schema
-- Compatible with MySQL 5.7+ / MariaDB 10.3+ (InfinityFree Shared Hosting)
-- Clean Production State: Zero dummy members, zero fake transactions.

SET NAMES utf8mb4;
SET time_zone = '+02:00';

CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  `activation_fee_rwf` INT UNSIGNED NOT NULL DEFAULT 200,
  `welcome_bonus_rwf` INT UNSIGNED NOT NULL DEFAULT 200,
  `daily_checkin_rwf` INT UNSIGNED NOT NULL DEFAULT 20,
  `withdrawal_fee_percent` DECIMAL(5,2) NOT NULL DEFAULT 25.00,
  `subsequent_min_withdrawal_rwf` INT UNSIGNED NOT NULL DEFAULT 1000,
  `subsequent_max_withdrawal_rwf` INT UNSIGNED NOT NULL DEFAULT 5000,
  `referral_commission_percent` DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  `min_video_reward_rwf` INT UNSIGNED NOT NULL DEFAULT 50,
  `momo_pay_code` VARCHAR(32) NOT NULL DEFAULT '1880554',
  `platform_tagline` VARCHAR(255) NOT NULL DEFAULT 'Digital savings, verified credit, and paid community tasks for Rwanda.',
  `maintenance_mode` TINYINT(1) NOT NULL DEFAULT 0,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `system_settings` (`id`) VALUES (1)
ON DUPLICATE KEY UPDATE `id` = `id`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `account_number` VARCHAR(32) NOT NULL UNIQUE,
  `role` ENUM('member', 'admin') NOT NULL DEFAULT 'member',
  `first_name` VARCHAR(80) NOT NULL,
  `second_name` VARCHAR(80) NOT NULL,
  `email` VARCHAR(160) NOT NULL UNIQUE,
  `phone` VARCHAR(24) NOT NULL UNIQUE,
  `gender` ENUM('Male', 'Female', 'Other') NOT NULL DEFAULT 'Male',
  `date_of_birth` DATE NOT NULL,
  `national_id` VARCHAR(16) NOT NULL UNIQUE,
  `profile_photo_path` VARCHAR(255) NOT NULL,
  `education_type` ENUM('University', 'A-Level') NOT NULL,
  `institution_name` VARCHAR(160) NOT NULL,
  `level_or_class` VARCHAR(80) NOT NULL,
  `faculty_or_combination` VARCHAR(120) NOT NULL,
  `place_of_birth` VARCHAR(120) NOT NULL,
  `akarere` VARCHAR(80) DEFAULT NULL,
  `umurenge` VARCHAR(80) DEFAULT NULL,
  `akagari` VARCHAR(80) DEFAULT NULL,
  `umudugudu` VARCHAR(80) DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `referral_code` VARCHAR(24) NOT NULL UNIQUE,
  `referred_by_user_id` INT UNSIGNED DEFAULT NULL,
  `spin_credits` INT UNSIGNED NOT NULL DEFAULT 0,
  `has_completed_first_withdrawal` TINYINT(1) NOT NULL DEFAULT 0,
  `account_status` ENUM('pending_approval', 'awaiting_payment', 'payment_submitted', 'active', 'suspended') NOT NULL DEFAULT 'pending_approval',
  `activation_phone` VARCHAR(24) DEFAULT NULL,
  `activation_ref` VARCHAR(120) DEFAULT NULL,
  `wallet_balance_rwf` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `bonus_balance_rwf` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `savings_balance_rwf` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `kyc_status` ENUM('not_submitted', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'not_submitted',
  `last_checkin_at` DATETIME DEFAULT NULL,
  `checkin_streak` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_users_referrer` FOREIGN KEY (`referred_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Super Admin Account (ezeprodeveloper@gmail.com / Eze@2005)
INSERT INTO `users` (
  `account_number`, `role`, `first_name`, `second_name`, `email`, `phone`, `gender`,
  `date_of_birth`, `national_id`, `profile_photo_path`, `education_type`,
  `institution_name`, `level_or_class`, `faculty_or_combination`,
  `place_of_birth`, `password_hash`, `referral_code`, `account_status`, `kyc_status`
) VALUES (
  'EF-RW-000001',
  'admin',
  'System',
  'Administrator',
  'ezeprodeveloper@gmail.com',
  '+250780000000',
  'Male',
  '2000-01-01',
  '1199000000000001',
  'assets/default-admin.png',
  'University',
  'Kigali Institute',
  'Admin',
  'FinTech Systems',
  'Kigali',
  '$2y$12$PdjEXpnW.Uz8tGlWXcva0eyfqTKW9dneBwmNbCbxFTKUcz5PHQz.6',
  'EF-ADMIN01',
  'active',
  'approved'
) ON DUPLICATE KEY UPDATE `email` = `email`;

CREATE TABLE IF NOT EXISTS `kyc_verifications` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL UNIQUE,
  `national_id` VARCHAR(16) NOT NULL,
  `id_issue_district` VARCHAR(80) NOT NULL,
  `province` VARCHAR(80) NOT NULL,
  `akarere` VARCHAR(80) NOT NULL,
  `umurenge` VARCHAR(80) NOT NULL,
  `akagari` VARCHAR(80) NOT NULL,
  `umudugudu` VARCHAR(80) NOT NULL,
  `occupation` VARCHAR(120) NOT NULL,
  `next_of_kin_name` VARCHAR(120) NOT NULL,
  `next_of_kin_phone` VARCHAR(24) NOT NULL,
  `id_document_path` VARCHAR(255) NOT NULL,
  `selfie_photo_path` VARCHAR(255) NOT NULL,
  `review_note` VARCHAR(255) DEFAULT NULL,
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` DATETIME DEFAULT NULL,
  CONSTRAINT `fk_kyc_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `savings_goals` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(140) NOT NULL,
  `plan_type` ENUM('Flexible', 'Goal-Based', 'Long-Term') NOT NULL DEFAULT 'Flexible',
  `target_rwf` DECIMAL(14,2) NOT NULL,
  `current_rwf` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `target_date` DATE NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_savings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `loans` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `product` VARCHAR(120) NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `principal_rwf` DECIMAL(14,2) NOT NULL,
  `term_months` SMALLINT UNSIGNED NOT NULL,
  `annual_rate_percent` DECIMAL(5,2) NOT NULL DEFAULT 12.00,
  `monthly_payment_rwf` DECIMAL(14,2) NOT NULL,
  `total_repayable_rwf` DECIMAL(14,2) NOT NULL,
  `repaid_rwf` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('pending_admin', 'approved', 'repaid', 'rejected') NOT NULL DEFAULT 'pending_admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_loans_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `investment_tiers` (
  `id` VARCHAR(32) NOT NULL PRIMARY KEY,
  `name` VARCHAR(80) NOT NULL,
  `deposit_rwf` INT UNSIGNED NOT NULL,
  `daily_return_rwf` INT UNSIGNED NOT NULL,
  `duration_days` SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `investment_tiers` (`id`, `name`, `deposit_rwf`, `daily_return_rwf`, `duration_days`) VALUES
('tier-500',   'Starter 500',     500,   20,   30),
('tier-1000',  'Basic 1,000',     1000,  50,   30),
('tier-1500',  'Bronze 1,500',    1500,  70,   30),
('tier-2000',  'Silver 2,000',    2000,  100,  30),
('tier-3000',  'Gold 3,000',      3000,  200,  30),
('tier-5000',  'Emerald 5,000',   5000,  400,  30),
('tier-8000',  'Sapphire 8,000',  8000,  700,  30),
('tier-10000', 'Executive 10,000',10000, 1000, 30),
('tier-15000', 'Premier 15,000',  15000, 1600, 30),
('tier-20000', 'Crown 20,000',    20000, 2200, 30)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `deposit_rwf` = VALUES(`deposit_rwf`),
  `daily_return_rwf` = VALUES(`daily_return_rwf`),
  `duration_days` = VALUES(`duration_days`);

CREATE TABLE IF NOT EXISTS `user_investments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `tier_id` VARCHAR(32) NOT NULL,
  `plan_name` VARCHAR(80) NOT NULL,
  `deposit_rwf` INT UNSIGNED NOT NULL,
  `daily_return_rwf` INT UNSIGNED NOT NULL,
  `duration_days` SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  `payment_code` VARCHAR(64) NOT NULL,
  `payment_ref` VARCHAR(120) NOT NULL,
  `status` ENUM('pending_admin', 'active', 'completed', 'rejected') NOT NULL DEFAULT 'pending_admin',
  `total_earned_rwf` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `days_credited` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `last_roi_credited_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_inv_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv_tier` FOREIGN KEY (`tier_id`) REFERENCES `investment_tiers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `video_campaigns` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `creator_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `description` TEXT,
  `video_path_or_url` VARCHAR(255) NOT NULL,
  `reward_per_view_rwf` INT UNSIGNED NOT NULL,
  `target_viewers` INT UNSIGNED NOT NULL,
  `total_budget_rwf` INT UNSIGNED NOT NULL,
  `payment_code` VARCHAR(64) NOT NULL,
  `payment_ref` VARCHAR(120) NOT NULL,
  `views_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `status` ENUM('pending_admin', 'active', 'completed', 'rejected') NOT NULL DEFAULT 'pending_admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_vid_creator` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_video_views` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `campaign_id` INT UNSIGNED NOT NULL,
  `watched_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_user_video` (`user_id`, `campaign_id`),
  CONSTRAINT `fk_uvv_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_uvv_camp` FOREIGN KEY (`campaign_id`) REFERENCES `video_campaigns` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `custom_tasks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `creator_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `requirements` TEXT NOT NULL,
  `reward_per_completion_rwf` INT UNSIGNED NOT NULL,
  `target_completions` INT UNSIGNED NOT NULL,
  `total_budget_rwf` INT UNSIGNED NOT NULL,
  `payment_code` VARCHAR(64) NOT NULL,
  `payment_ref` VARCHAR(120) NOT NULL,
  `approved_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `status` ENUM('pending_admin', 'active', 'completed', 'rejected') NOT NULL DEFAULT 'pending_admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_task_creator` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_submissions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `task_id` INT UNSIGNED NOT NULL,
  `worker_id` INT UNSIGNED NOT NULL,
  `proof_text` TEXT NOT NULL,
  `proof_url` VARCHAR(255) DEFAULT NULL,
  `reward_rwf` INT UNSIGNED NOT NULL,
  `status` ENUM('pending_admin', 'approved', 'rejected') NOT NULL DEFAULT 'pending_admin',
  `admin_note` VARCHAR(255) DEFAULT NULL,
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` DATETIME DEFAULT NULL,
  UNIQUE KEY `uq_user_task` (`worker_id`, `task_id`),
  CONSTRAINT `fk_sub_task` FOREIGN KEY (`task_id`) REFERENCES `custom_tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sub_worker` FOREIGN KEY (`worker_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `network` ENUM('MTN Rwanda', 'Airtel / Tigo Rwanda') NOT NULL,
  `destination_type` ENUM('Phone Number', 'MoMo Pay Code') NOT NULL,
  `destination_value` VARCHAR(64) NOT NULL,
  `account_registered_names` VARCHAR(160) NOT NULL,
  `gross_amount_rwf` DECIMAL(14,2) NOT NULL,
  `fee_percent` DECIMAL(5,2) NOT NULL,
  `fee_rwf` DECIMAL(14,2) NOT NULL,
  `net_amount_rwf` DECIMAL(14,2) NOT NULL,
  `is_first_bonus_withdrawal` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('pending_admin', 'paid', 'rejected') NOT NULL DEFAULT 'pending_admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wd_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `spin_history` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `reward_rwf` INT UNSIGNED NOT NULL,
  `spun_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_spin_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `reference` VARCHAR(32) NOT NULL UNIQUE,
  `title` VARCHAR(180) NOT NULL,
  `category` VARCHAR(48) NOT NULL,
  `channel` VARCHAR(160) NOT NULL,
  `amount_rwf` DECIMAL(14,2) NOT NULL,
  `fee_rwf` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `direction` ENUM('credit', 'debit') NOT NULL,
  `status` ENUM('Completed', 'Pending Review', 'Rejected') NOT NULL DEFAULT 'Completed',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tx_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `promotions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(180) NOT NULL,
  `category` VARCHAR(80) NOT NULL,
  `summary` TEXT NOT NULL,
  `banner_path` VARCHAR(255) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

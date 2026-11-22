# E-Finance Rwanda — InfinityFree & GitHub Deployment Guide

This folder (`/infinityfree-htdocs/`) contains the complete, self-contained **Vanilla PHP 8+ (PDO) + MySQL + HTML5 + CSS3 + Vanilla ES6+ JS** package engineered for shared hosting (InfinityFree) with zero Node.js or Composer runtime dependencies.

---

## 1. Clean Production Database Initialization

1. Open **InfinityFree VistaPanel** → **MySQL Databases** and create a new database (e.g. `epiz_XXXXXXXX_efinance`).
2. Note your **MySQL Host** (e.g. `sql304.infinityfree.com`), **Database Name**, **Username**, and **Password**.
3. Open **phpMyAdmin** for that database → click **Import** → select `database.sql` from this folder and execute it.
   - Zero dummy members and zero fake transactions are seeded.
   - Default `system_settings` and the 10 daily investment tiers (`500 RWF` to `20,000 RWF`) are initialized.
   - Super Admin account (`ezeprodeveloper@gmail.com`) is seeded and active. **Change the Admin password immediately after first login** inside **Admin Control Center → System Settings**.

---

## 2. Database Configuration

Edit `/infinityfree-htdocs/config/constants.php` (or set server environment variables):

```php
define('DB_HOST', 'YOUR_INFINITYFREE_MYSQL_HOST');
define('DB_NAME', 'YOUR_INFINITYFREE_DB_NAME');
define('DB_USER', 'YOUR_INFINITYFREE_DB_USER');
define('DB_PASS', 'YOUR_INFINITYFREE_DB_PASSWORD');
```

---

## 3. Upload to InfinityFree (`htdocs/`) & GitHub Sync

1. Push the repository to **GitHub**.
2. Upload the contents **inside** `infinityfree-htdocs/` directly into your InfinityFree domain's `/htdocs/` root via FileZilla/FTP (so `index.php`, `login.php`, `register.php`, `admin/`, `user/`, `includes/`, `config/`, `assets/`, `api/`, and `uploads/` sit directly inside `/htdocs/`).
3. Verify directory permissions on `/htdocs/uploads/` subdirectories (`photos/`, `kyc/`, `videos/`, `promotions/`) are writable by PHP (`0755`).
   - `/uploads/.htaccess` disables script execution and directory listing for uploaded files.

---

## 4. Automated 24-Hour ROI Distribution

`includes/cron_roi.php` distributes daily yields (`daily_return_rwf`) after each elapsed 24-hour cycle for active investment plans:
- It runs **opportunistically** whenever members or admins load the portal (`includes/auth.php`).
- You can also configure an external HTTP web-cron (e.g., cron-job.org every hour) hitting `/includes/cron_roi.php?key=YOUR_SECRET_TOKEN` (set `define('ROI_CRON_TOKEN', 'YOUR_SECRET_TOKEN');` in `config/constants.php` to enable HTTP cron).

---

## 5. Security Architecture Summary

- **Prepared Statements Only**: All SQL queries use PDO prepared statements with strict type binding.
- **CSRF Protection & Secure Sessions**: All `POST` forms and JSON endpoints enforce `hash_equals` CSRF verification; sessions use `HttpOnly` and `SameSite=Lax` cookies.
- **Safe Media Uploads**: MIME types are verified server-side via `finfo`, renamed with random hex filenames, and script execution inside `uploads/` is blocked via `.htaccess`.
- **Single-Claim Enforcement**: MySQL unique constraints (`uq_user_video`, `uq_user_task`) and row-level transactions (`FOR UPDATE`) prevent duplicate check-ins, duplicate video/task claims, or Lucky Spin race conditions.

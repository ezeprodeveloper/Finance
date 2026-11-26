# E-Finance Rwanda — XAMPP & InfinityFree Complete Package

This folder is a self-contained **React + PHP 8+ + MySQL/MariaDB** full-stack deployment ready for both **XAMPP (local Windows/macOS/Linux)** and **InfinityFree (free shared hosting)**.

## Option 1: Instant XAMPP Setup (Zero Manual SQL)

1. Extract or copy this entire folder into your XAMPP web root, for example:
   - `C:\xampp\htdocs\efinance\` (Windows)
   - `/Applications/XAMPP/htdocs/efinance/` (macOS)
   - `/opt/lampp/htdocs/efinance/` (Linux)
2. Open **XAMPP Control Panel** and start **Apache** and **MySQL**.
3. Open your browser to `http://localhost/efinance/`.
4. On the very first request:
   - MySQL database `efinance_rwanda` is created automatically (`root` / empty password).
   - All **20 tables**, **21 indexes**, **default system settings**, and **initial announcements** initialize automatically.
5. Sign in with `ezeprodeveloper@gmail.com` to claim and lock your Admin password on first run.

## Option 2: InfinityFree Shared Hosting Setup

1. Log into your **InfinityFree Client Area → VistaPanel → MySQL Databases** and create one MySQL database. Note your:
   - **MySQL Hostname** (e.g. `sql305.infinityfree.com`)
   - **MySQL Database Name** (e.g. `if0_12345678_efinance`)
   - **MySQL Username** (e.g. `if0_12345678`)
   - **MySQL Password**
2. Upload all contents of this folder into your domain's `/htdocs/` directory via **File Manager** or **FileZilla FTP** (including `.htaccess`, `api.php`, `setup.php`, `index.html`, `assets/`, and `config/`).
3. Visit `https://your-domain.infinityfreeapp.com/setup.php`.
4. Enter your 4 MySQL credentials and click **Connect Database & Initialize Tables**.
5. Once setup succeeds, open `https://your-domain.infinityfreeapp.com/` and sign in with `ezeprodeveloper@gmail.com` to set your Admin password.

## Included Files

- `index.html` & `assets/` — Built frontend (configured with `VITE_PHP_BACKEND=true` and relative paths `./` for subfolder support)
- `api.php` — Full REST API implementing all Auth, Member, Quiz Bet, Airtime, P2P Send Money (10% tax), FX RWF/USD/USDT, Binance USDT, Savings, Loans, Investment ROI, Videos, Tasks, KYC, and Admin endpoints
- `setup.php` — One-step MySQL browser installer for InfinityFree
- `config/` — Protected configuration (`config/.htaccess`), PDO MySQL connector, versioned auto-migrations, security helpers, and row mappers
- `database.sql` — Optional standalone SQL schema for manual phpMyAdmin import
- `.htaccess` — Apache directory rules, Authorization header forwarding, and `.sql`/dotfile access protection

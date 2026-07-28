<div align="center">
  <a href="https://pageel.com">
    <img src="https://raw.githubusercontent.com/pageel/pageel-cms/main/.github/assets/pageel-icon.svg" width="120" alt="Pageel CRM">
  </a>

  <h1>Pageel CRM</h1>

  <p><strong>A minimalist, lightning-fast CRM & automated bookkeeping system built on Astro, SQLite, and Cloudflare D1</strong></p>
  <p>Self-hosted financial and invoicing engine tailored for Vietnamese small businesses.</p>

  [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
  [![Version](https://img.shields.io/badge/Version-v0.13.3-blue.svg)](CHANGELOG.md)
  ![Status](https://img.shields.io/badge/Status-Stable-brightgreen.svg)
  [![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-BC52EE.svg?logo=astro&logoColor=white)](https://astro.build)

  <br />

  <a href="README.md">🇺🇸 <b>English</b></a> | <a href="docs/vi/README.md">🇻🇳 <b>Tiếng Việt</b></a>
</div>

<br/>

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture & Design Standards](#architecture--design-standards)
- [Quick Start](#quick-start)
- [Deployment](#deployment)
- [Database Architecture](#database-architecture)
- [License](#license)

---

## 🎯 Overview

**Pageel CRM** is a self-hosted, lightweight CRM and automated invoicing engine designed for small businesses and households (HKD) in Vietnam. It operates directly on edge nodes using Cloudflare Workers and Cloudflare D1, eliminating server maintenance overhead while ensuring zero-cold-start performance and 100% automated cash-flow reconciliation via SePay Webhook.

---

## ✨ Key Features

- **Custom QR Transaction Prefixes & Clean Memo Formatting (v0.13.3):** 
  - Dynamic `qr_quick_prefixes` configuration stored in D1 `config` table and managed via Settings UI.
  - Interactive ⚙️ Quick-Edit modal in VietQR generator tool for on-the-fly prefix management.
  - Pure `formatCleanMemo()` helper enforcing non-accented string sanitization and preventing duplicate prefix concatenation under VietQR's 50-character limit.
- **Automated Cash-Flow Reconciliation:** Real-time bank transaction matching and invoice reconciliation via SePay Webhook with duplicate payload protection (`transactionId` unique constraint).
- **Security Hardening (v0.13.1 & v0.13.2):** 
  - OWASP 2026-compliant PBKDF2 password hashing with **600,000 iterations** (`crypto.pbkdf2`) and transparent legacy hash upgrade on login.
  - Enforced mandatory `INITIAL_ADMIN_PASSWORD` secret configuration (blocking default `'admin123'` fallback).
  - Refactored Content-Security-Policy to `script-src 'self' 'unsafe-inline'` with per-request UUID nonces, fully restoring client-side JS interactive components.
  - Hardened Logout action via server-side HTML Form POST + HTTP 302 Redirect + `Cache-Control: no-store`.
  - Origin-based CSRF protection validating `Origin` vs `Host` on 100% mutative HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`).
  - Production error masking hiding 500 internal stack traces under `import.meta.env.DEV`.
  - Fail-closed Cloudflare KV rate limiting protecting authentication endpoints against brute-force attacks.
- **Database Concurrency & Two-Pass Restore (v0.11.4):** 
  - Atomic SQL balance updates (`balance = balance +/- amount`), eliminating race conditions in wallet deductions.
  - Two-pass database restore mechanism resolving cyclic foreign key constraints in Cloudflare D1 / SQLite.
  - Unified database transaction engine with exponential backoff and jitter retry mechanism.
- **Dynamic Reports Module & Billing Cycles (v0.12.0):** 
  - Auto-generates quarterly and monthly tax report spreadsheets complying with standard Vietnamese bookkeeping guidelines (S1a-HKD).
  - Custom month-to-month range filter report panels with ZIP server-side compression.
  - Dynamic VietQR payment code generation (EMVCo standard) with period suffix parsing (`X{N}` for 1-60 month durations).
- **Services & Late Association (v0.9.0):** Integrated product/service catalog management, manual transaction association (Late Association) for unmatched payments, and customizable invoice descriptions.
- **TDD-First & High Assurance:** 100% test coverage assurance with **283 / 283 Vitest tests PASSing**, zero `astro check` errors, and a **100/100 Health Score** on Security & Architecture Audits.

---

## 💻 Tech Stack

- **Framework:** [Astro](https://astro.build/) (Serverless SSR endpoints and static front-end)
- **Database ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Database Engine:** [Cloudflare D1](https://developers.cloudflare.com/d1/) (Production) & SQLite / [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) (Local/Testing)
- **Testing Suite:** [Vitest](https://vitest.dev/)

---

## 🏛️ Architecture & Design Standards

Pageel CRM follows an **Architecture-First** methodology aligned with standard PARA Workspace invariants:

- **Edge-First Infrastructure:** Deployed on Cloudflare Pages & Workers for ultra-low latency (< 50ms) and zero server maintenance costs.
- **Git-as-a-Database Backup:** Automated daily database snapshots pushed directly to a private GitHub repository via GitHub REST API.
- **Decoupled Repositories:** Implements Repository Pattern (`ICustomerRepository`, `IPaymentRepository`) separating data access from business logic.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v22 or higher)
- npm (v10 or higher)

### Setup & Run
1. Clone the repository:
   ```bash
   git clone https://github.com/pageel/pageel-crm.git
   cd pageel-crm
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Initialize the local database schema:
   - Apply Drizzle migrations onto the local emulated D1 instance:
     ```bash
     npx wrangler d1 migrations apply pageel-crm-db --local
     ```
3.5. Configure local development secrets:
   - Create a `.dev.vars` file in the root of the `repo` directory:
     ```bash
     cp .dev.vars.example .dev.vars
     ```
     Ensure you define a secure random `SESSION_SECRET` key (at least 32 characters) inside `.dev.vars`. Hardcoded fallback keys are removed, so this variable is strictly required.
4. Run the development server:
   - For Cloudflare emulated environment (D1 & KV bindings active):
     ```bash
     npm run dev:cf
     ```
   - For standalone Astro dev server:
     ```bash
     npm run dev
     ```
5. Run the unit test suite:
   ```bash
   npx vitest run
   ```

### 🔐 Local Development Login

When running the application locally using `npm run dev` or `npm run dev:cf`, the system connects to the local emulated database:

*   **Default Login Credentials (D1 Local):**
    *   **Username:** `admin`
    *   **Password:** `admin123`
*   **Seed Local Database (D1 Local):**
    You can save your sensitive seed data file to `scripts/migration.sql` (this filename is listed in `.gitignore` and won't be committed) and run:
    ```bash
    npx wrangler d1 execute pageel-crm-db --local --file=scripts/migration.sql
    ```
*   **Add/Sync custom user to D1 Local:**
    ```bash
    npx wrangler d1 execute pageel-crm-db --local --command="INSERT OR REPLACE INTO users (id, username, password_hash, role) VALUES ('<any_id>', '<custom_username>', '<pbkdf2_hash_value>', 'admin');"
    ```
*   **Reset Password on D1 Local Emulator:**
    ```bash
    node scripts/reset-password-local-d1.cjs <username> <new-password>
    ```
*   **Reset Password on local SQLite File (`local.db`):**
    ```bash
    node scripts/reset-password.cjs <username> <new-password>
    ```

---

## 🚀 Deployment

For detailed production deployment instructions using Cloudflare Workers, D1, KV, and setting up secure admin credentials, please refer to the [Production Deployment Guide](docs/guides/deployment-guide.md).

---

## 📐 Database Architecture

The application decouples business logic from physical storage engines using a dynamic database router:

- **Local & Unit Tests:** Operates using a fast, isolated in-memory SQLite database.
- **Production Edge:** Leverages Cloudflare D1's distributed SQLite engine by importing `env` from `cloudflare:workers` and routing it dynamically to `getDb(env)`.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.


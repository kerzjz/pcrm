<div align="center">
  <a href="https://pageel.com">
    <img src="https://raw.githubusercontent.com/pageel/pageel-cms/main/.github/assets/pageel-icon.svg" width="120" alt="Pageel CRM">
  </a>

  <h1>Pageel CRM</h1>

  <p><strong>Hệ thống CRM tối giản, siêu tốc và đối soát dòng tiền tự động chạy trên Astro, SQLite và Cloudflare D1</strong></p>
  <p>Bộ máy quản lý tài chính và hóa đơn tự vận hành tối ưu cho hộ kinh doanh Việt Nam.</p>

  [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
  [![Version](https://img.shields.io/badge/Version-v0.13.2-blue.svg)](../../CHANGELOG.md)
  ![Status](https://img.shields.io/badge/Status-Stable-brightgreen.svg)
  [![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-BC52EE.svg?logo=astro&logoColor=white)](https://astro.build)

  <br />

  <a href="../../README.md">🇺🇸 <b>English</b></a> | <a href="README.md">🇻🇳 <b>Tiếng Việt</b></a>
</div>

<br/>

## Mục lục
- [Giới thiệu](#giới-thiệu)
- [Tính năng nổi bật](#tính-năng-nổi-bật)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Tiêu chuẩn Kiến trúc System Design](#tiêu-chuẩn-kiến-trúc-system-design)
- [Khởi chạy nhanh](#khởi-chạy-nhanh)
- [Triển khai hệ thống](#triển-khai-hệ-thống)
- [Kiến trúc Cơ sở Dữ liệu](#kiến-trúc-cơ-sở-dữ-liệu)
- [Giấy phép](#giấy-phép)

---

## 🎯 Giới thiệu

**Pageel CRM** là giải pháp tự lưu trữ (self-hosted), CRM siêu nhẹ và bộ máy quản lý hóa đơn, đối soát tài chính tự động dành cho hộ kinh doanh cá thể (HKD) và doanh nghiệp nhỏ tại Việt Nam. Dự án vận hành trực tiếp trên hạ tầng Edge của Cloudflare Workers và Cloudflare D1, triệt tiêu hoàn toàn chi phí thuê server, đảm bảo độ trễ truy cập cực thấp (< 50ms) và đối soát tự động 100% dòng tiền qua SePay Webhook.

---

## ✨ Tính năng nổi bật

- **Đối soát Dòng tiền Tự động:** Đồng bộ và khớp giao dịch ngân hàng theo thời gian thực qua Webhook SePay, tích hợp cơ chế chống xử lý giao dịch trùng lặp (`transactionId` unique constraint).
- **Củng cố Bảo mật Toàn diện (v0.13.1 & v0.13.2):**
  - Thuật toán băm mật khẩu PBKDF2 đạt chuẩn OWASP 2026 với **600,000 iterations** (`crypto.pbkdf2`) kèm cơ chế tự động rehash mật khẩu cũ khi đăng nhập.
  - Bắt buộc cấu hình biến môi trường `INITIAL_ADMIN_PASSWORD` khi khởi tạo DB (loại bỏ mật khẩu mặc định `'admin123'`).
  - Refactor Content-Security-Policy sang `script-src 'self' 'unsafe-inline'` kết hợp UUID nonce cho mỗi request, khôi phục 100% chức năng nút bấm JS client.
  - An toàn hóa nút Đăng xuất bằng HTML Form POST server-side + HTTP 302 Redirect + `Cache-Control: no-store`.
  - Kiểm tra Origin vs Host header chống CSRF cho 100% mutative requests (`POST`, `PUT`, `PATCH`, `DELETE`).
  - Ẩn chi tiết lỗi 500 trên môi trường Production (`import.meta.env.DEV`).
  - Giới hạn tần suất brute-force đăng nhập fail-closed qua Cloudflare KV.
- **Xử lý Đồng thời & Khôi phục Database (v0.11.4):**
  - Cập nhật số dư ví nguyên tử (`balance = balance +/- amount`), loại bỏ triệt để race condition.
  - Cơ chế Two-Pass Restore khôi phục dữ liệu sao lưu giải quyết xung đột khóa ngoại vòng (Cyclic Foreign Keys) trong D1 SQLite.
  - Cơ chế tự động thử lại transaction với độ trễ ngẫu nhiên (exponential backoff & jitter) xử lý xung đột khóa ghi `SQLITE_BUSY`.
- **Báo cáo Thuế S1a & Chu kỳ Đơn hàng (v0.12.0):**
  - Tự động kết xuất báo cáo thuế S1a-HKD theo tháng/quý dạng tệp Excel/ZIP tuân thủ Thông tư 88/2021/TT-BTC.
  - Bảng lọc báo cáo theo khoảng tháng/quý linh hoạt đóng gói ZIP tại server Astro.
  - Sinh mã VietQR động (chuẩn EMVCo) tự động phân tích và xử lý chu kỳ thanh toán `X{N}` (hỗ trợ 1–60 tháng).
- **Quản lý Dịch vụ & Gán giao dịch nhanh (v0.9.0):** Quản lý danh mục dịch vụ, gán giao dịch thủ công (Late Association) cho các khoản chuyển khoản chưa khớp, và tùy chỉnh mẫu mô tả hóa đơn tự động.
- **Đảm bảo Chất lượng Kiểm thử:** Đạt **283 / 283 Vitest PASS (100%)**, 0 lỗi `astro check` và **100/100 Health Score** trên báo cáo Đánh giá Bảo mật & Kiến trúc.

---

## 💻 Công nghệ sử dụng

- **Framework:** [Astro](https://astro.build/) (Xây dựng Serverless SSR endpoints & giao diện tĩnh)
- **Database ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Database Engine:** [Cloudflare D1](https://developers.cloudflare.com/d1/) (Production) & SQLite / [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) (Local/Testing)
- **Framework kiểm thử:** [Vitest](https://vitest.dev/)

---

## 🏛️ Tiêu chuẩn Kiến trúc System Design

Pageel CRM tuân thủ phương pháp thiết kế **Architecture-First** chuẩn hóa theo định hướng PARA Workspace:

- **Hạ tầng Edge-First:** Vận hành trên Cloudflare Pages & Workers cho tốc độ phản hồi cực nhanh (< 50ms) và tối ưu hóa chi phí vận hành.
- **Git-as-a-Database Backup:** Tự động sao lưu bản snapshot dữ liệu D1 lên GitHub Repository private thông qua GitHub REST API.
- **Tách biệt Data Access Layer:** Áp dụng Repository Pattern (`ICustomerRepository`, `IPaymentRepository`) tách biệt logic nghiệp vụ khỏi database router.

---

## 🚀 Khởi chạy nhanh

### Yêu cầu hệ thống
- Node.js (phiên bản v22 trở lên)
- npm (phiên bản v10 trở lên)

### Cài đặt và Chạy
1. Clone mã nguồn dự án:
   ```bash
   git clone https://github.com/pageel/pageel-crm.git
   cd pageel-crm
   ```
2. Cài đặt các gói thư viện phụ thuộc:
   ```bash
   npm install
   ```
3. Khởi tạo cấu trúc cơ sở dữ liệu (schema) local:
   - Áp dụng các tệp tin migrations lên database D1 local giả lập:
     ```bash
     npx wrangler d1 migrations apply pageel-crm-db --local
     ```
3.5. Cấu hình biến môi trường bí mật cục bộ:
   - Tạo tệp tin `.dev.vars` trong thư mục gốc `repo/`:
     ```bash
     cp .dev.vars.example .dev.vars
     ```
     Đảm bảo bạn định nghĩa khóa `SESSION_SECRET` ngẫu nhiên và an toàn (tối thiểu 32 ký tự) bên trong `.dev.vars`. Do các khóa dự phòng mặc định cứng đã bị loại bỏ hoàn toàn, biến này là bắt buộc để ứng dụng hoạt động.
4. Khởi chạy server phát triển:
   - Sử dụng môi trường giả lập Cloudflare (đầy đủ binding D1 & KV):
     ```bash
     npm run dev:cf
     ```
   - Sử dụng Astro dev thuần:
     ```bash
     npm run dev
     ```
5. Chạy kiểm thử unit test:
   ```bash
   npx vitest run
   ```

### 🔐 Đăng nhập môi trường Dev

Khi khởi chạy cục bộ bằng `npm run dev` hoặc `npm run dev:cf`, ứng dụng sử dụng cơ sở dữ liệu mô phỏng local:

*   **Tài khoản đăng nhập mặc định (D1 Local):**
    *   **Username:** `admin`
    *   **Password:** `admin123`
*   **Nạp dữ liệu mẫu (Seed Data) vào D1 Local:**
    Bạn có thể đặt tệp tin SQL chứa dữ liệu nhạy cảm vào `scripts/migration.sql` (tệp tin này đã được đưa vào `.gitignore` để đảm bảo an toàn, không bị commit) và nạp dữ liệu bằng lệnh:
    ```bash
    npx wrangler d1 execute pageel-crm-db --local --file=scripts/migration.sql
    ```
*   **Thêm/Cập nhật tài khoản tùy chỉnh vào D1 Local:**
    ```bash
    npx wrangler d1 execute pageel-crm-db --local --command="INSERT OR REPLACE INTO users (id, username, password_hash, role) VALUES ('<id_tùy_ý>', '<tên_đăng_nhập>', '<mã_băm_pbkdf2>', 'admin');"
    ```
*   **Reset mật khẩu trên D1 Local:**
    ```bash
    node scripts/reset-password-local-d1.cjs <username> <new-password>
    ```
*   **Reset mật khẩu trên file SQLite (`local.db`):**
    ```bash
    node scripts/reset-password.cjs <username> <new-password>
    ```

---

## 🚀 Triển khai hệ thống (Deployment)

Để xem hướng dẫn chi tiết từng bước triển khai ứng dụng lên Cloudflare Workers (kèm D1 Database, KV Namespace) và thiết lập tài khoản Admin ban đầu bảo mật, vui lòng tham khảo [Hướng dẫn Triển khai Hệ thống](../../docs/guides/deployment-guide.md).

---

## 📐 Kiến trúc Cơ sở Dữ liệu

Ứng dụng tách biệt tầng logic nghiệp vụ khỏi lớp lưu trữ vật lý bằng bộ điều tuyến DB Router động:

- **Môi trường Test:** Khởi chạy trên in-memory SQLite biệt lập và siêu tốc.
- **Môi trường Production:** Tận dụng SQLite phân tán Cloudflare D1 thông qua kết nối truyền trực tiếp biến `env` từ `cloudflare:workers` vào hàm `getDb(env)`.

---

## 📄 Giấy phép

Phát hành dưới giấy phép MIT License. Xem tệp `LICENSE` để biết thêm chi tiết.


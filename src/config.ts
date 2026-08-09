/**
 * Cấu hình dùng chung cho toàn bộ test suite HW04.
 * Mọi hằng số môi trường tập trung ở đây để không hardcode rải rác trong spec.
 */

export const STUDENT_ID = process.env.STUDENT_ID ?? '23127362';

/**
 * URL của 3 thành phần trong SUT (xem setup_guide.md của eshop-sut).
 *
 * CHÚ Ý — dùng 127.0.0.1 chứ KHÔNG dùng "localhost":
 * Trên Windows, Node phân giải "localhost" ưu tiên sang IPv6 (::1), trong khi Vite
 * (5173 / 5174) và Express của SUT chỉ lắng nghe trên IPv4. Hệ quả là Playwright báo
 * `connect ECONNREFUSED ::1:3000` dù server vẫn đang chạy bình thường.
 * Ép IPv4 ở đây loại bỏ hẳn lớp nhiễu này khỏi kết quả test.
 */
export const URLS = {
  web: process.env.WEB_URL ?? 'http://127.0.0.1:5173',
  admin: process.env.ADMIN_URL ?? 'http://127.0.0.1:5174',
  api: process.env.API_URL ?? 'http://127.0.0.1:3000',
} as const;

/** Tài khoản seed sẵn trong database.js của SUT. */
export const ACCOUNTS = {
  admin: { email: 'admin@eshop.com', password: 'Admin123!' },
  user: { email: 'test@eshop.com', password: 'Test1234!' },
} as const;

/**
 * Tag browser của lần chạy hiện tại (chromium | firefox | webkit).
 * Do scripts/run-matrix.mjs set khi spawn tiến trình Playwright.
 */
export const BROWSER_TAG = process.env.BROWSER_TAG ?? 'all';

/**
 * Tag feature của lần chạy hiện tại (fr06 | fr09 | fr15 | smoke | suite).
 *
 * Lý do tách theo feature: đề bài (mục 6, Task 1) yêu cầu "Each feature must run on
 * all three browsers — at least 9 browser runs in total". Nếu gộp 3 feature vào 1 report
 * thì chỉ có 3 report và TA phải tự suy ra 9 lần chạy. Tách ra thành 9 thư mục report
 * (3 feature x 3 browser) là bằng chứng đếm được trực tiếp.
 */
export const FEATURE_TAG = process.env.FEATURE_TAG ?? 'suite';

/** Thư mục HTML report của lần chạy hiện tại. */
export const REPORT_DIR = `reports/html-${FEATURE_TAG}-${BROWSER_TAG}`;

/** ISO timestamp của lần chạy, hiển thị trong HTML report (yêu cầu chống gian lận mục 11). */
export const RUN_TIMESTAMP = new Date().toISOString();

/** Map tag feature -> mô tả, dùng cho tiêu đề report. */
export const FEATURE_LABELS: Record<string, string> = {
  smoke: 'Smoke — kiểm tra SUT sẵn sàng',
  fr06: 'FR-06 — Product Detail (Pool A)',
  fr09: 'FR-09 — Discount Coupon (Pool B)',
  fr15: 'FR-15 — Admin Product CRUD (Pool C)',
  suite: 'Toàn bộ suite (FR-06 + FR-09 + FR-15)',
};

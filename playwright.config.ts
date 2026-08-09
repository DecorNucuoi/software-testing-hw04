import { defineConfig, devices } from '@playwright/test';
import {
  BROWSER_TAG,
  FEATURE_LABELS,
  FEATURE_TAG,
  REPORT_DIR,
  RUN_TIMESTAMP,
  STUDENT_ID,
  URLS,
} from './src/config';

/**
 * HW04 - Automation Testing | EShop SUT
 * Student: 23127362
 *
 * Yêu cầu đề bài được ánh xạ vào config này:
 *  - Mục 6, Task 1: chạy trên >= 3 browser  -> 3 project chromium / firefox / webkit
 *  - Mục 6, Task 1: mỗi feature phải chạy trên cả 3 browser (>= 9 browser runs)
 *                   -> report tách theo cặp (feature, browser): reports/html-<feature>-<browser>
 *  - Mục 6, Task 1: mỗi run sinh HTML report hiển thị "Run by: <StudentID>"
 *                   -> `metadata` bên dưới được Playwright HTML reporter render ở đầu report,
 *                      và scripts/stamp-report.mjs chèn thêm banner + <title> để TA nhìn thấy ngay.
 *  - Mục 11: report phải kèm ISO timestamp -> RUN_TIMESTAMP.
 */
export default defineConfig({
  testDir: './tests',

  /* Chạy tuần tự trong 1 file để tránh đụng độ dữ liệu (SUT dùng SQLite chung, không có transaction rollback). */
  fullyParallel: false,
  workers: 1,

  /* Không cho phép .only lọt lên CI/bài nộp. */
  forbidOnly: !!process.env.CI,

  /**
   * Retry 1 lần để PHÂN BIỆT lỗi thật với flaky, không phải để che lỗi:
   * Playwright gắn nhãn "flaky" (khác hẳn "passed") cho test chỉ pass ở lần thử lại,
   * và nhãn này hiện rõ trong HTML report. Test fail cả 2 lần vẫn là "failed" -> vào bug report.
   * Đặt RETRIES=0 khi muốn xem kết quả thô.
   */
  retries: Number(process.env.RETRIES ?? 1),

  timeout: 30_000,
  expect: { timeout: 7_000 },

  /* Thông tin này hiển thị ngay phần header của Playwright HTML report. */
  metadata: {
    'Run by': STUDENT_ID,
    'Student ID': STUDENT_ID,
    'Run at (ISO 8601)': RUN_TIMESTAMP,
    'Browser project': BROWSER_TAG,
    'Feature under test': FEATURE_LABELS[FEATURE_TAG] ?? FEATURE_TAG,
    SUT: 'EShop — https://github.com/ttbhanh/eshop-sut',
    Homework: 'HW04 — Automation Testing',
  },

  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: REPORT_DIR,
        open: 'never',
        title: `HW04 — ${FEATURE_TAG.toUpperCase()} on ${BROWSER_TAG} — Run by: ${STUDENT_ID} — ${RUN_TIMESTAMP}`,
      },
    ],
    ['json', { outputFile: `reports/json/results-${FEATURE_TAG}-${BROWSER_TAG}.json` }],
  ],

  use: {
    baseURL: URLS.web,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        /**
         * Tắt quay video RIÊNG cho WebKit.
         * Bản WebKit đóng gói cho Windows dùng lớp ghi hình khác Chromium/Firefox và là
         * nguồn crash "Target page, context or browser has been closed" quan sát được
         * trong lần chạy smoke ngày 2026-08-09. Trace + screenshot vẫn bật nên bằng chứng
         * khi test fail không bị mất; chỉ hy sinh video của riêng project này.
         */
        video: 'off',
      },
    },
  ],

  outputDir: 'test-results',
});

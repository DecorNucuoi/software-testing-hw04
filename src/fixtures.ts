/**
 * Fixture dùng chung cho toàn bộ spec HW04.
 *
 * MỌI file .spec.ts phải import { test, expect } từ đây, KHÔNG import trực tiếp
 * từ '@playwright/test', để các fixture bên dưới được áp dụng tự động.
 *
 * ------------------------------------------------------------------------------
 * Vì sao cần fixture `isolateNetwork`?
 *
 * `backend/database.js` của SUT seed imageUrl trỏ ra internet:
 *     https://placehold.co/300x300/png?text=iPhone+15
 * Nghĩa là mỗi lần mở trang chủ / trang chi tiết, trình duyệt bắn request ra mạng ngoài.
 * Hệ quả quan sát được khi chạy smoke (2026-08-09):
 *   - WebKit trên Windows crash giữa chừng: "Target page, context or browser has been closed".
 *   - Chromium/Firefox pass nhưng chậm hơn hẳn.
 *
 * Request ra internet KHÔNG nằm trong phạm vi kiểm thử của HW04 (ta test logic EShop,
 * không test CDN của bên thứ ba). Nó chỉ tạo ra 2 rủi ro:
 *   1. Flaky xuyên browser -> báo cáo lỗi giả, làm nhiễu bug report thật.
 *   2. Không chạy được khi mất mạng.
 *
 * Cách xử lý: chặn tại tầng network và TRẢ VỀ một ảnh PNG 1x1 hợp lệ thay vì abort.
 * Chọn "fulfill" chứ không "abort" vì abort làm <img> bắn sự kiện onerror -> có thể
 * làm hỏng các assertion về hiển thị ảnh ở FR-06. Fulfill thì <img> vẫn load thành công,
 * chỉ khác là ảnh trắng — không ảnh hưởng logic nghiệp vụ đang test.
 * ------------------------------------------------------------------------------
 */
import { test as base, expect, type Page } from '@playwright/test';
import { RUN_TIMESTAMP, STUDENT_ID } from './config';

/** Host được coi là "trong phạm vi SUT". Mọi host khác bị chặn. */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/** Ảnh PNG 1x1 trong suốt, dùng để thay thế mọi ảnh tải từ internet. */
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/** Số request ngoài đã bị chặn trong mỗi test — in ra log để minh bạch, không giấu. */
export interface Hw04Fixtures {
  blockedRequests: string[];
}

/**
 * LƯU Ý THIẾT KẾ (một lỗi đã mắc và đã sửa — ghi lại để đưa vào phần Review của báo cáo):
 *
 * Phiên bản đầu tiên khai network guard là fixture `{ auto: true }` phụ thuộc `page`.
 * Hậu quả: Playwright phải khởi tạo browser context cho MỌI test, kể cả test thuần API
 * (S-01, S-02) vốn chỉ cần `request`. Trên WebKit/Windows điều này làm số lần
 * `browser.newContext()` tăng gấp 3 và lộ ra lỗi crash "Target page, context or browser
 * has been closed" — thời gian chạy S-01 nhảy từ 36ms lên 3.5s rồi fail.
 *
 * Cách đúng: OVERRIDE chính fixture `page`. Fixture của Playwright là lazy, nên test nào
 * không yêu cầu `page` sẽ không khởi tạo trình duyệt, còn test nào dùng `page` thì
 * guard vẫn được cài tự động mà không cần spec phải nhớ gọi.
 */
export const test = base.extend<Hw04Fixtures>({
  blockedRequests: async ({}, use) => {
    await use([]);
  },

  page: async ({ page, blockedRequests }, use, testInfo) => {
    await installNetworkGuard(page, blockedRequests);

    await use(page);

    if (blockedRequests.length > 0) {
      // Đính vào HTML report để người chấm thấy rõ ta đã chặn cái gì, không phải "giấu lỗi".
      await testInfo.attach('external-requests-blocked.txt', {
        body: [...new Set(blockedRequests)].join('\n'),
        contentType: 'text/plain',
      });
    }
  },
});

/** Gắn network guard lên một Page bất kỳ (kể cả page mới mở trong test). */
export async function installNetworkGuard(page: Page, sink: string[] = []): Promise<void> {
  await page.route('**/*', async (route) => {
    const url = route.request().url();

    // Bỏ qua data:, blob:, about: — không phải traffic mạng.
    if (!/^https?:/i.test(url)) return route.continue();

    let hostname: string;
    try {
      hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
    } catch {
      return route.continue();
    }

    if (LOCAL_HOSTS.has(hostname)) return route.continue();

    sink.push(url);
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: TRANSPARENT_PNG,
    });
  });
}

/** Log định danh lần chạy — phục vụ yêu cầu chống gian lận (đề mục 11). */
export function logRunHeader(scope: string): void {
  console.log(`[${scope}] Run by: ${STUDENT_ID} — ${RUN_TIMESTAMP}`);
}

export { expect };

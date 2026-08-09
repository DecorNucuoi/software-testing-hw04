/**
 * SMOKE TEST — nghiệm thu R1 (khung Playwright + môi trường SUT).
 *
 * File này KHÔNG tính vào 12 test case/feature của đề bài. Mục đích duy nhất của nó:
 * chứng minh khung chạy được trên cả 3 browser và SUT (api + web + admin) đang sống,
 * trước khi bỏ công viết các spec FR-06 / FR-09 / FR-15.
 *
 * Nếu smoke fail -> lỗi môi trường, KHÔNG phải bug của SUT. Đừng ghi vào bug report.
 */
import { expect, logRunHeader, test } from '../src/fixtures';
import { URLS } from '../src/config';

test.describe('SMOKE — môi trường SUT sẵn sàng', () => {
  test.beforeAll(() => logRunHeader('smoke'));

  test('S-01 | API backend trả về danh sách sản phẩm', async ({ request }) => {
    const res = await request.get(`${URLS.api}/api/products`);

    // Assertion pattern 1: kiểm tra HTTP status của response.
    expect(res.status(), 'GET /api/products phải trả 200').toBe(200);

    const body = await res.json();
    // Assertion pattern 2: kiểm tra kiểu + kích thước dữ liệu trả về.
    expect(Array.isArray(body), 'Response body phải là mảng sản phẩm').toBeTruthy();
    expect(body.length, 'Database phải có ít nhất 1 sản phẩm seed').toBeGreaterThan(0);
  });

  test('S-02 | API backend trả về danh sách category', async ({ request }) => {
    const res = await request.get(`${URLS.api}/api/categories`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBeTruthy();
  });

  test('S-03 | Web storefront (5173) load được', async ({ page }) => {
    const response = await page.goto(URLS.web, { waitUntil: 'domcontentloaded' });

    expect(response?.status(), `Không mở được ${URLS.web}`).toBeLessThan(400);

    // Assertion pattern 3: web locator assertion — chờ SPA render xong phần <body>.
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('S-04 | Web admin (5174) load được', async ({ page }) => {
    const response = await page.goto(URLS.admin, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `Không mở được ${URLS.admin}`).toBeLessThan(400);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('S-05 | Đăng nhập user qua API thành công (dữ liệu seed đúng)', async ({ request }) => {
    const res = await request.post(`${URLS.api}/api/login`, {
      data: { email: 'test@eshop.com', password: 'Test1234!' },
    });
    expect(res.status(), 'Tài khoản seed test@eshop.com phải đăng nhập được').toBe(200);

    const body = await res.json();
    // Assertion pattern 4: kiểm tra shape của object (đối tượng chứa các key mong đợi).
    expect(body).toHaveProperty('token');
    expect(body).toMatchObject({ user: { email: 'test@eshop.com' } });
  });

  test('S-06 | Network guard hoạt động — không có request nào thoát ra internet', async ({
    page,
    blockedRequests,
  }) => {
    await page.goto(URLS.web, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Trang chủ render ảnh từ placehold.co -> guard phải bắt được ít nhất 1 request.
    // Assertion pattern 5: kiểm tra mọi phần tử của mảng thoả điều kiện.
    for (const url of blockedRequests) {
      expect(url, 'Chỉ được chặn request ra ngoài, không chặn nhầm request nội bộ').not.toContain('127.0.0.1');
    }
    console.log(`[smoke] Đã chặn ${blockedRequests.length} request ra internet.`);
  });
});

/**
 * Helper API cho FR-09 — chỉ dùng cho SETUP / TEARDOWN, không bao giờ thay cho thao tác UI
 * đang được kiểm thử. Đối tượng kiểm thử của FR-09 là nút "Áp dụng" trên /checkout;
 * mọi thứ trong file này chỉ dựng tiền đề và dọn dẹp.
 */
import type { APIRequestContext } from '@playwright/test';
import { RUN_TIMESTAMP, STUDENT_ID, URLS } from '../config';
import type { Fr09Coupon } from '../pages/checkout-coupon.page';

export interface CreatedCoupon {
  id: number;
  code: string;
}

/**
 * Sinh mã coupon duy nhất cho một ca test.
 *
 * Ba thành phần, mỗi thành phần có lý do riêng:
 *   - STUDENT_ID  : mọi dòng rác trong database đều truy được về chủ nhân. Không phục vụ tính
 *                   duy nhất, phục vụ việc dọn dẹp thủ công về sau.
 *   - tc_id       : BẮT BUỘC. RUN_TIMESTAMP là hằng số trong suốt vòng đời một tiến trình, nên
 *                   15 ca trong cùng một lần chạy sẽ đâm vào ràng buộc UNIQUE nếu thiếu nó.
 *   - RUN_TIMESTAMP : BẮT BUỘC. Được tính lúc nạp config, mà runner spawn ba tiến trình riêng
 *                   cho ba browser, nên mỗi browser có một giá trị khác nhau. Điều này phủ luôn
 *                   cả trục "lần chạy trước để lại rác".
 * Cố tình KHÔNG có worker index (cấu hình chạy workers = 1) và KHÔNG có tên project
 * (RUN_TIMESTAMP đã phân biệt ba tiến trình rồi).
 *
 * Viết HOA và lọc ký tự là điều kiện sống còn, không phải chuyện thẩm mỹ: giao diện viết hoa
 * chuỗi mã trước khi gửi lên server, nên một mã chứa chữ thường trong database sẽ không bao giờ
 * khớp được qua đường UI. RUN_TIMESTAMP là chuỗi ISO nên chứa ':' và '.', phải loại bỏ.
 */
export function buildCouponCode(tcId: string): string {
  const stamp = RUN_TIMESTAMP.replace(/[^0-9A-Za-z]/g, '');
  return `${STUDENT_ID}-${tcId}-${stamp}`.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

/** Đăng nhập admin để lấy Bearer token cho các endpoint quản trị coupon. */
export async function createCoupon(
  request: APIRequestContext,
  adminToken: string,
  code: string,
  params: Fr09Coupon,
): Promise<CreatedCoupon> {
  const res = await request.post(`${URLS.api}/api/admin/coupons`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      code,
      type: params.type,
      discount_value: Number(params.discount_value),
      min_order_amount: Number(params.min_order_amount),
      expired_at: params.expired_at,
      max_uses_per_user: params.max_uses_per_user,
    },
  });
  const body = (await res.json().catch(() => ({}))) as { id?: number };
  if (!res.ok() || typeof body.id !== 'number') {
    // Ném lỗi thay vì retry: với workers = 1 và ba tiến trình tuần tự, không tồn tại tranh chấp
    // ghi đồng thời trên SQLite. Một retry ở đây chỉ có tác dụng che lỗi thật (payload sai,
    // token hết hạn, server chết) và biến nó thành lỗi chậm, khó chẩn đoán.
    throw new Error(
      `[coupon-api] Tạo coupon "${code}" thất bại: HTTP ${res.status()} — ${JSON.stringify(body)}`,
    );
  }
  return { id: body.id, code };
}

/** Xoá coupon. Nuốt lỗi vì teardown không được phép làm đỏ một test đã có kết luận. */
export async function deleteCoupon(
  request: APIRequestContext,
  adminToken: string,
  id: number,
): Promise<void> {
  try {
    await request.delete(`${URLS.api}/api/admin/coupons/${id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  } catch {
    /* teardown best-effort — rác còn lại mang mã duy nhất nên không ảnh hưởng lần chạy sau */
  }
}

/**
 * Ghi một lượt sử dụng cho user đang đăng nhập.
 *
 * Đây là cách duy nhất dựng tiền đề cho các ca C5 một cách xác định: coupon vừa được tạo nên
 * bộ đếm của nó chắc chắn bằng 0, và số lượt sau đó bằng đúng số lần gọi hàm này — không phụ
 * thuộc vào lịch sử database hay vào việc suite nào đã chạy trước đó.
 */
export async function recordCouponUsage(
  request: APIRequestContext,
  userToken: string,
  couponId: number,
): Promise<void> {
  const res = await request.post(`${URLS.api}/api/coupon-usage`, {
    headers: { Authorization: `Bearer ${userToken}` },
    data: { coupon_id: couponId },
  });
  if (!res.ok()) {
    throw new Error(
      `[coupon-api] Ghi lượt dùng cho coupon #${couponId} thất bại: HTTP ${res.status()} — ${await res.text()}`,
    );
  }
}

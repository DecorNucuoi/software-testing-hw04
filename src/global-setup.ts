/**
 * globalSetup của Playwright — chạy MỘT lần cho mỗi tiến trình Playwright, trước mọi test.
 *
 * ------------------------------------------------------------------------------
 * Nhiệm vụ duy nhất: dọn sản phẩm rác mà các lần chạy FR-15 trước để lại.
 *
 * RÀNG BUỘC QUAN TRỌNG NHẤT CỦA FILE NÀY: nó KHÔNG ĐƯỢC PHÉP NÉM LỖI.
 *
 * globalSetup chạy cho MỌI lần chạy, kể cả `npm run smoke`, FR-06 và FR-09 — những lần
 * chạy không liên quan gì tới sản phẩm test của FR-15. Nếu SUT chưa được khởi động,
 * một globalSetup ném lỗi sẽ giết cả run trước khi test đầu tiên kịp chạy. Hậu quả là
 * smoke test — vốn tồn tại để trả lời đúng câu hỏi "SUT đã sẵn sàng chưa" — không bao giờ
 * chạy, và người đọc report nhận được stack trace của bộ dọn rác thay vì câu trả lời.
 *
 * Nói cách khác: dọn rác là việc VỆ SINH, không phải ĐIỀU KIỆN TIÊN QUYẾT. Hai loại việc
 * này phải được đối xử khác nhau, và ranh giới đó đã được đặt ra từ FR-09.
 *
 * Vì vậy toàn bộ thân hàm nằm trong try/catch, và cả hàm sweep bên trong cũng tự nuốt lỗi.
 * Hai lớp là cố ý: lớp trong xử lý lỗi dự đoán được (API chưa lên, HTTP 5xx), lớp ngoài
 * chặn cả những lỗi không dự đoán được (không tạo nổi APIRequestContext, hết bộ nhớ...).
 * ------------------------------------------------------------------------------
 * Ghi chú vận hành: file này CHƯA được nối vào playwright.config.ts. Việc nối dây do người
 * dùng tự làm sau khi file tồn tại — trỏ config vào một file chưa tồn tại sẽ làm hỏng mọi
 * lần chạy hiện có, kể cả những lần chạy không cần đến nó.
 * Khi nối, thêm dòng:  globalSetup: './src/global-setup',
 */
import { request as playwrightRequest } from '@playwright/test';
import { BROWSER_TAG, FEATURE_TAG, RUN_TIMESTAMP, STUDENT_ID } from './config';
import { FR15_OWNER_PREFIX, loadSweepExtraNames, sweepFr15Products } from './utils/fr15-products';

const TAG = '[global-setup]';

export default async function globalSetup(): Promise<void> {
  console.log(`${TAG} Run by: ${STUDENT_ID} — ${RUN_TIMESTAMP} — feature=${FEATURE_TAG} browser=${BROWSER_TAG}`);

  let context: Awaited<ReturnType<typeof playwrightRequest.newContext>> | null = null;

  try {
    context = await playwrightRequest.newContext();
    // Tên ngắn (BT2/BT3) không mang được tiền tố sở hữu nên phải khai tường minh trong dữ liệu.
    const result = await sweepFr15Products(context, loadSweepExtraNames());

    if (result.warning) {
      // CẢNH BÁO, không phải lỗi. Run vẫn tiếp tục; nếu SUT thật sự chưa chạy thì
      // smoke test sẽ nói điều đó bằng ngôn ngữ của nó, đúng chỗ, đúng lúc.
      console.warn(`${TAG} Bỏ qua dọn dẹp — ${result.warning}. Đây là cảnh báo, không phải lỗi của lần chạy.`);
    } else {
      console.log(
        `${TAG} Đã dọn ${result.deleted} sản phẩm rác mang tiền tố "${FR15_OWNER_PREFIX}"` +
          (result.failed > 0 ? `, ${result.failed} hàng xoá không thành công` : '') +
          (result.protectedSeed > 0 ? `, ${result.protectedSeed} hàng bị từ chối xoá vì là sản phẩm seed` : '') +
          '.',
      );
    }

    if (result.protectedSeed > 0) {
      // Một sản phẩm seed mang tên theo quy ước của test nghĩa là có lần chạy trước đã GHI ĐÈ
      // lên tài sản chung. Sweeper cố ý KHÔNG xoá nó — xoá đi là phá huỷ bằng chứng của một bug.
      console.warn(
        `${TAG} CẢNH BÁO: ${result.protectedSeed} sản phẩm seed (id 1..5) đang mang tên theo quy ước ` +
          'của test FR-15. Nhiều khả năng một lần chạy trước đã ghi đè lên dữ liệu seed. ' +
          'Sweeper không tự sửa; hãy khôi phục CSDL trước khi tin vào kết quả các ca kiểm tính cô lập.',
      );
    }
  } catch (error) {
    // Lưới cuối. Không có `throw` nào trong file này — theo thiết kế.
    console.warn(`${TAG} Dọn dẹp thất bại ngoài dự kiến: ${(error as Error).message}. Bỏ qua và chạy tiếp.`);
  } finally {
    try {
      await context?.dispose();
    } catch {
      /* dispose thất bại cũng không được làm hỏng run */
    }
  }
}

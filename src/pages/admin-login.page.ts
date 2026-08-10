/**
 * Đưa trình duyệt vào trạng thái ĐÃ ĐĂNG NHẬP admin (Web Admin 127.0.0.1:5174).
 *
 * ------------------------------------------------------------------------------
 * Đăng nhập KHÔNG phải đối tượng kiểm thử của FR-15. Nó là tiền đề, và tiền đề phải được
 * dựng bằng con đường rẻ nhất và ổn định nhất, không phải bằng con đường đang được kiểm.
 *
 * LỰA CHỌN: nạp token vào localStorage, không đi qua form ở 24 ca.
 *
 * Cách làm: gọi POST /api/login một lần để lấy JWT thật, rồi addInitScript ghi token vào
 * localStorage key "adminToken" TRƯỚC khi bất kỳ script nào của trang chạy. Trang đọc key này
 * lúc mount nên nó vào thẳng màn hình quản trị.
 *
 * ĐÁNH ĐỔI, nói thẳng:
 *   + Nhanh và không phụ thuộc giao diện: 24 ca x 3 browser = 72 lần dựng tiền đề, mỗi lần
 *     tiết kiệm một vòng điền form + một lần điều hướng.
 *   + Không dính alert() của trình duyệt. SUT bật alert() khi sai vai trò/sai mật khẩu, và
 *     một hộp thoại chưa được xử lý sẽ treo cả tiến trình trên WebKit.
 *   - Bỏ qua luồng đăng nhập thật. Nếu ứng dụng còn ghi thêm state nào khác lúc đăng nhập
 *     (thông tin user, quyền...), cách nạp token có thể cấp thiếu. Triệu chứng khi cấp thiếu
 *     là rõ ràng và nhanh: form "Admin Login" vẫn hiện. Vì vậy locator của form đăng nhập được
 *     expose ra để spec chốt "đã vào được trang quản trị" trước khi làm bất cứ việc gì khác.
 *   - Token vẫn phải LÀ TOKEN THẬT do API cấp. Không bịa chuỗi, vì như thế sẽ kiểm thử trên
 *     một trạng thái mà người dùng thật không bao giờ đạt tới.
 *
 * loginViaForm() vẫn được giữ để dùng cho smoke / cho một ca duy nhất xác nhận luồng thật còn
 * chạy được — chứ không phải để dùng ở cả 24 ca.
 * ------------------------------------------------------------------------------
 */
import { ACCOUNTS, URLS } from '../config';
import type { APIRequestContext, Locator, Page } from '../fixtures';
import { loginViaApi } from '../utils/api';

/**
 * Key localStorage của Web Admin.
 * KHÁC key "token" mà storefront 5173 dùng. Nhầm key thì trang admin không thấy phiên đăng
 * nhập nào và dừng ở form Login — một lỗi im lặng nếu spec không chốt trạng thái sau đăng nhập.
 */
export const ADMIN_TOKEN_KEY = 'adminToken';

export interface FormLoginReport {
  /** Nội dung alert() nếu trình duyệt bật hộp thoại (sai mật khẩu / sai vai trò). null nếu không có. */
  dialogMessage: string | null;
  /** Lỗi khung (framework) nếu thao tác điền/bấm bị từ chối. Ghi nguyên văn. */
  frameworkError: string | null;
}

export class AdminLoginPage {
  readonly page: Page;

  /** Không có <label> nào gắn với input, nên placeholder là đường định vị duy nhất. */
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  /** Dấu hiệu quan sát được của trạng thái CHƯA đăng nhập. Spec dùng để chốt tiền đề. */
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByPlaceholder('Email', { exact: true });
    this.passwordInput = page.getByPlaceholder('Password', { exact: true });
    this.loginButton = page.getByRole('button', { name: 'Login', exact: true });
    this.heading = page.getByRole('heading', { name: 'Admin Login' });
  }

  /** Mở trang admin mà KHÔNG nạp token — dùng cho đường đăng nhập bằng form thật. */
  async openLoginForm(): Promise<void> {
    await this.page.goto(URLS.admin);
  }

  /**
   * Nạp token RỒI mở trang, trong cùng một hàm.
   *
   * ------------------------------------------------------------------------------
   * THỨ TỰ Ở ĐÂY LÀ THỨ QUYẾT ĐỊNH TẤT CẢ, và nó được làm cho KHÔNG THỂ đảo ngược.
   *
   * addInitScript chỉ áp cho những lần điều hướng ĐĂNG KÝ SAU NÓ. Gọi goto() trước rồi mới nạp
   * token thì lần tải trang đó đọc localStorage rỗng, ứng dụng dừng ở form Admin Login, và mọi
   * thao tác phía sau chờ tới hết giờ trên một màn hình không bao giờ đổi.
   *
   * Phiên bản trước để seedToken() và goto() là hai phương thức công khai, tức là vẫn tồn tại
   * một đường gọi cho ra thứ tự ngược. Nay seedToken là private và chỉ có DUY NHẤT hàm này ghép
   * hai bước lại — không còn cách nào gọi sai thứ tự.
   * ------------------------------------------------------------------------------
   */
  async openWithSession(token: string): Promise<void> {
    if (typeof token !== 'string' || token.length === 0) {
      // Không phải phán quyết về SUT, mà là hàm này bảo vệ hợp đồng của chính nó: nạp một token
      // rỗng sẽ ghi chuỗi "undefined" vào localStorage và biến lỗi thành một màn hình câm.
      throw new Error(
        `[admin-login] Token rỗng hoặc không phải chuỗi (${JSON.stringify(token)}). ` +
          'Nhiều khả năng phản hồi của POST /api/login đổi hình dạng trường chứa token.',
      );
    }
    await this.seedToken(token);
    await this.page.goto(URLS.admin);
  }

  /**
   * Đăng nhập bằng form thật.
   *
   * Handler dialog được đăng ký TRƯỚC khi bấm: nếu đăng ký sau, alert() có thể xuất hiện trong
   * khoảng chưa ai lắng nghe và làm treo tiến trình trên Firefox/WebKit. Handler chỉ GHI LẠI
   * nội dung rồi dismiss — không phán xét gì, việc đó thuộc về spec.
   */
  async loginViaForm(email: string, password: string): Promise<FormLoginReport> {
    const report: FormLoginReport = { dialogMessage: null, frameworkError: null };

    const onDialog = (dialog: { message(): string; dismiss(): Promise<void> }): void => {
      report.dialogMessage = dialog.message();
      void dialog.dismiss();
    };
    this.page.on('dialog', onDialog);

    try {
      await this.emailInput.fill(email);
      await this.passwordInput.fill(password);
      await this.loginButton.click();
    } catch (error) {
      report.frameworkError = (error as Error).message;
    } finally {
      this.page.off('dialog', onDialog);
    }

    return report;
  }

  /**
   * Ghi token vào localStorage cho MỌI lần điều hướng sau đó.
   *
   * PRIVATE có chủ ý — xem chú thích của openWithSession(). Để nó công khai là để ngỏ một
   * đường gọi sai thứ tự, và triệu chứng của thứ tự sai là một màn hình đứng im 10 giây.
   */
  private async seedToken(token: string): Promise<void> {
    await this.page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [ADMIN_TOKEN_KEY, token] as const,
    );
  }
}

/**
 * Tiền đề chuẩn cho mọi ca FR-15: lấy token thật qua API rồi nạp vào trang, sau đó điều hướng.
 *
 * Trả về token để spec có thể đính vào annotation khi cần chẩn đoán. Hàm này KHÔNG assert gì —
 * spec phải tự chốt rằng màn hình quản trị đã mở (ví dụ heading "Quản lý Sản phẩm" hiển thị,
 * hoặc AdminLoginPage.heading không còn). Nếu để hàm này tự khẳng định, một lần đăng nhập hỏng
 * sẽ báo lỗi ở tầng helper thay vì ở ca kiểm thử, và người đọc report mất dấu.
 */
export async function ensureAdminSession(
  page: Page,
  request: APIRequestContext,
): Promise<{ token: string }> {
  const { token } = await loginViaApi(request, 'admin');
  await new AdminLoginPage(page).openWithSession(token);
  return { token };
}

/** Thông tin tài khoản admin, để spec không phải tự gõ lại. */
export const ADMIN_CREDENTIALS = ACCOUNTS.admin;

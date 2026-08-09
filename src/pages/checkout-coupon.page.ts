import type { Locator, Page } from '@playwright/test';
import { URLS } from '../config';
import { parseVndDisplay } from '../utils/money';

/**
 * Endpoint mà nút "Áp dụng" gọi tới. Đặt ở đây vì nó là kiến thức về SUT, cùng tầng với locator;
 * spec không cần biết đường dẫn này để chờ cho đúng.
 */
const APPLY_ENDPOINT = /\/api\/apply-coupon/;

/** Tham số tạo coupon động — ánh xạ 1-1 với payload POST /api/admin/coupons. */
export interface Fr09Coupon {
  type: 'percent' | 'fixed';
  discount_value: string;
  min_order_amount: string;
  expired_at: string;
  max_uses_per_user: number;
}

/**
 * Một dòng của data/fr09-coupon.json.
 *
 * seed_code là cột TRƠ: nó chỉ được phép xuất hiện trong tiêu đề test, log và annotation.
 * Nếu có bất kỳ nhánh điều kiện nào trong spec hay page object đọc seed_code để quyết định
 * hành vi, thiết kế coi như hỏng — vì lúc đó dữ liệu seed lại trở thành phụ thuộc ẩn, đúng
 * cái mà toàn bộ chiến lược coupon động sinh ra để loại bỏ.
 */
export interface Fr09Case {
  tc_id: string;
  technique: string;
  bva_role: string;
  seed_code: string;
  condition_under_test: string;
  login_as: 'user' | 'none';
  code_mode: 'created' | 'generated_absent' | '<EMPTY>';
  order_total: string;
  pre_seeded_uses: number;
  coupon: Fr09Coupon | null;
  expected_outcome: 'accept' | 'reject' | 'blocked';
  expected_discount: string;
  expected_final: string;
  error_must_contain: string | null;
  rounding_sensitive: boolean;
  oracle_source: string;
  description: string;
  spec_basis: string;
}

/**
 * Page object cho khối Mã Giảm Giá trên /checkout.
 *
 * TUYỆT ĐỐI không chứa expect: mọi khẳng định thuộc về spec. Ở đây chỉ có locator, hành động,
 * và các hàm đọc trả về dữ liệu thô (BigInt mili-đồng hoặc chuỗi).
 *
 * Nguyên tắc định vị áp dụng cho toàn bộ file: vai trò ARIA > văn bản người dùng thật sự thấy >
 * neo cấu trúc trong phạm vi hẹp. Không có class Tailwind nào xuất hiện làm selector — class là
 * chi tiết trình bày, đổi bg-orange-500 sang bg-blue-500 không đổi một hành vi nào của FR-09.
 */
export class CheckoutCouponPage {
  readonly page: Page;

  /**
   * Ô "Tổng tiền thanh toán (VND)".
   *
   * getByRole('spinbutton') vì <input type="number"> ánh xạ sang role spinbutton, còn ô mã là
   * textbox — trang có đúng hai ô nhập và vai trò ARIA phân biệt chúng hoàn toàn, không cần
   * class, không cần .first().
   *
   * Vì sao KHÔNG getByLabel('Tổng tiền thanh toán'): <label> không có htmlFor và không bọc input
   * nên không tồn tại liên kết accessibility — getByLabel sẽ không tìm thấy gì.
   *
   * GÃY KHI: trang thêm một ô số thứ hai (strict mode báo ngay), hoặc ô đổi sang type="text".
   * Cả hai đều là thay đổi hành vi thật, đáng để gãy.
   */
  readonly totalInput: Locator;

  /**
   * Khối chứa toàn bộ chức năng mã giảm giá, dùng làm PHẠM VI cho mọi locator con bên dưới.
   *
   * Neo vào chính thẻ <label> "Mã Giảm Giá" rồi lấy phần tử cha. Cách này ổn định hơn hẳn
   * việc lọc div theo hasText: một bộ lọc như vậy khớp cả chuỗi div tổ tiên và làm strict mode
   * nổ, còn label thì là nút lá duy nhất mang đúng chuỗi đó.
   *
   * Thu hẹp phạm vi từ đầu là thứ khiến năm locator phía dưới không cần phòng thủ với phần
   * còn lại của trang — đặc biệt là với nút "Xác Nhận Thanh Toán".
   *
   * GÃY KHI: nhãn "Mã Giảm Giá" đổi chữ, hoặc label không còn là con trực tiếp của khối.
   */
  readonly couponBox: Locator;

  /**
   * Ô nhập mã. Placeholder là văn bản do sản phẩm định nghĩa và người dùng nhìn thấy, nên bền
   * hơn class và không thể nhầm với ô số.
   *
   * Class "uppercase" trên ô này chỉ ảnh hưởng hiển thị — giá trị thật trong DOM giữ nguyên
   * chữ người dùng gõ, và việc viết hoa xảy ra ở tầng gửi request. Đây là lý do mã coupon sinh
   * động bắt buộc phải viết HOA sẵn: một mã chứa chữ thường trong database sẽ không bao giờ
   * khớp được qua đường giao diện.
   */
  readonly codeInput: Locator;

  /**
   * Nút "Áp dụng", định vị KHÔNG phụ thuộc nhãn.
   *
   * Nhãn đổi thành "..." trong lúc gửi request. Neo theo chuỗi "Áp dụng" thì locator tự biến
   * mất giữa chừng và mọi thao tác chờ trở nên may rủi. Khối coupon chỉ chứa đúng một nút, nên
   * định vị theo vai trò trong phạm vi hẹp vừa đơn giản vừa đúng ở mọi trạng thái.
   *
   * Nhãn và thuộc tính disabled trở thành ĐỐI TƯỢNG của assertion (DT4), không phải phương tiện
   * định vị — đúng nguyên tắc page object không quyết định điều gì là đúng.
   */
  readonly applyButton: Locator;

  /** Nút ở trạng thái rảnh. Chỉ dùng làm ĐIỀU KIỆN CHỜ sau khi bấm, không dùng để click. */
  readonly applyButtonIdle: Locator;

  /**
   * Thông báo lỗi từ server.
   *
   * Nội dung do server sinh nên không thể định vị bằng text. Điểm phân biệt là cấu trúc: lỗi là
   * <p> CON TRỰC TIẾP của khối coupon, còn ba dòng kết quả thành công nằm lồng trong một <div>.
   * ':scope > p' diễn đạt đúng khác biệt đó mà không mượn tới class text-red-600 — màu sắc là
   * tín hiệu thị giác, không phải hợp đồng.
   *
   * GÃY KHI: SUT bọc thông báo lỗi vào một thẻ khác. Đây là phụ thuộc DOM có ý thức, được cô lập
   * trong đúng một dòng; nếu SUT bổ sung role="alert" thì nên đổi sang getByRole('alert') và
   * oracle sẽ mạnh hơn hẳn.
   */
  readonly errorMessage: Locator;

  /**
   * Dòng xác nhận áp dụng thành công. Đây là locator dùng cho khẳng định VẮNG MẶT ở mọi ca
   * reject: neo vào nội dung của khối thành công thay vì vào thẻ bọc, nên không phải phỏng đoán
   * cấu trúc div lồng nhau bên trong khối coupon.
   */
  readonly successNotice: Locator;

  /** Số tiền tiết kiệm. Neo theo nhãn tĩnh rồi lấy <strong> mang giá trị. */
  readonly savedAmount: Locator;

  /** Thành tiền hiển thị trong khối kết quả thành công. */
  readonly finalAmount: Locator;

  /**
   * Dòng "Tổng thanh toán" ở cuối trang.
   *
   * Regex neo đầu chuỗi để không nhập nhằng với nhãn "Tổng tiền thanh toán (VND):" phía trên —
   * hai chuỗi khác nhau đúng một từ, và khớp chuỗi con thuần sẽ là một cái bẫy im lặng.
   */
  readonly grandTotal: Locator;

  constructor(page: Page) {
    this.page = page;
    this.totalInput = page.getByRole('spinbutton');
    this.couponBox = page.getByText('Mã Giảm Giá', { exact: true }).locator('..');
    this.codeInput = this.couponBox.getByPlaceholder('Nhập mã giảm giá...');
    this.applyButton = this.couponBox.getByRole('button');
    this.applyButtonIdle = this.couponBox.getByRole('button', { name: 'Áp dụng' });
    this.errorMessage = this.couponBox.locator(':scope > p');
    this.successNotice = this.couponBox.getByText(/Áp dụng thành công/);
    this.savedAmount = this.couponBox.getByText(/^Tiết kiệm:/).locator('strong');
    this.finalAmount = this.couponBox.getByText(/^Thành tiền:/).locator('strong');
    this.grandTotal = page.getByText(/^Tổng thanh toán:/);
  }

  /**
   * Bơm (hoặc gỡ) JWT vào localStorage TRƯỚC khi trang được nạp.
   *
   * Phải gọi trước goto(): trang đọc key "token" lúc mount, nên đặt token sau khi mount thì
   * lần render đầu tiên vẫn ở trạng thái đăng xuất và ta kiểm nhầm điều kiện.
   *
   * Truyền null cho DT7. Việc xoá là chủ động chứ không phó mặc cho context mới: token sống sót
   * qua reload (khác hẳn giỏ hàng ở FR-06), nên "chắc là chưa đăng nhập" là một giả định không
   * ai kiểm chứng được từ trong test.
   */
  async setAuthToken(token: string | null): Promise<void> {
    await this.page.addInitScript((value: string | null) => {
      if (value === null) {
        window.localStorage.removeItem('token');
      } else {
        window.localStorage.setItem('token', value);
      }
    }, token);
  }

  /**
   * Mở /checkout và chờ theo điều kiện phần tử, không dùng waitForTimeout.
   *
   * Chờ đủ BỐN phần tử luôn tồn tại trên trang, không phải hai. Ba phần tử đầu là đầu vào của
   * thao tác; grandTotal được thêm vào vì mọi nhánh khẳng định đều đọc nó, và một lời gọi đọc
   * DOM chỉ được phép chạy khi phần tử đã được bảo đảm tồn tại. Đặt bảo đảm đó ở đây một lần
   * thay vì lặp lại ba lần trong spec.
   *
   * Bốn phần tử này khác hẳn thông báo lỗi và khối kết quả thành công: hai thứ kia CÓ ĐIỀU KIỆN,
   * chỉ xuất hiện tuỳ kết cục, nên chúng không được chờ ở đây mà phải được spec khẳng định trước
   * khi đọc.
   */
  async goto(): Promise<void> {
    await this.page.goto(`${URLS.web}/checkout`);
    await this.totalInput.waitFor({ state: 'visible' });
    await this.codeInput.waitFor({ state: 'visible' });
    await this.applyButton.waitFor({ state: 'visible' });
    await this.grandTotal.waitFor({ state: 'visible' });
  }

  /**
   * Đặt tổng đơn hàng.
   *
   * Nhận string chứ không nhận number: bộ dữ liệu có 9999999999 và các giá trị biên như 299999,
   * và mọi số tiền trong suite này đi thẳng từ chuỗi vào BigInt. Ép qua number ở đây là mở lại
   * đúng cánh cửa dấu phẩy động mà money.ts vừa đóng.
   */
  async setOrderTotal(value: string): Promise<void> {
    await this.totalInput.fill(value);
  }

  /** Gõ mã giảm giá. Chuỗi rỗng là dữ liệu hợp lệ của DT4, không phải trường hợp cần chặn. */
  async enterCode(code: string): Promise<void> {
    await this.codeInput.fill(code);
  }

  /**
   * Bấm "Áp dụng" và chờ vòng đời request kết thúc.
   *
   * Ba mốc chờ, không có mốc nào là thời gian cố định:
   *   1. Promise chờ response được đăng ký TRƯỚC khi click — nếu đăng ký sau, response nhanh
   *      có thể về trước khi ta kịp lắng nghe và test treo tới hết timeout.
   *   2. Chờ chính response của /api/apply-coupon.
   *   3. Chờ nhãn nút quay lại "Áp dụng" — đây là bằng chứng React đã render xong kết quả, vì
   *      nhãn và khối kết quả được cập nhật trong cùng một lần đổi state.
   *
   * Trả về status để spec có thêm một loại assertion độc lập với DOM nếu cần.
   *
   * KHÔNG dùng cho DT4: ca đó nút bị vô hiệu hoá nên không có request nào tồn tại để mà chờ.
   */
  async apply(): Promise<number> {
    const pending = this.page.waitForResponse((res) => APPLY_ENDPOINT.test(res.url()));
    await this.applyButton.click();
    const response = await pending;
    await this.applyButtonIdle.waitFor({ state: 'visible' });
    return response.status();
  }

  /**
   * ---------------------------------------------------------------------------------------
   * BA HÀM ĐỌC DƯỚI ĐÂY CHẠM VÀO PHẦN TỬ CÓ ĐIỀU KIỆN.
   *
   * errorMessage, savedAmount và finalAmount chỉ tồn tại ở đúng một kết cục. Gọi innerText khi
   * phần tử vắng mặt thì Playwright chờ tới hết timeout rồi ném TimeoutError — và một TimeoutError
   * KHÔNG mang theo message chẩn đoán mà spec đã soạn, nên người đọc report mất đúng thông tin
   * quan trọng nhất ở đúng ca hỏng nặng nhất.
   *
   * Hợp đồng: spec phải khẳng định phần tử hiện diện TRƯỚC khi gọi ba hàm này. Nếu chỉ cần giá
   * trị để dựng chuỗi cho message thì dùng đường đọc an toàn có bọc catch ở phía spec, không
   * dùng ba hàm này.
   * ---------------------------------------------------------------------------------------
   */

  /** Nguyên văn thông báo lỗi. Chỉ gọi sau khi đã khẳng định errorMessage hiện diện. */
  async getErrorText(): Promise<string> {
    return (await this.errorMessage.innerText()).trim();
  }

  /** Số tiền tiết kiệm, đơn vị mili-đồng. Chỉ gọi sau khi đã khẳng định savedAmount hiện diện. */
  async getSavedMilli(): Promise<bigint> {
    return parseVndDisplay(await this.savedAmount.innerText());
  }

  /** Thành tiền trong khối kết quả, mili-đồng. Chỉ gọi sau khi đã khẳng định finalAmount hiện diện. */
  async getFinalMilli(): Promise<bigint> {
    return parseVndDisplay(await this.finalAmount.innerText());
  }

  /**
   * Dòng "Tổng thanh toán" ở cuối trang, đơn vị mili-đồng. Phần tử này VÔ ĐIỀU KIỆN và đã được
   * goto() chờ hiện diện, nên gọi ở đâu cũng an toàn.
   * Cắt phần nhãn trước dấu hai chấm cuối cùng rồi mới bóc số, để bộ bóc tách chỉ phải hiểu
   * đúng một thứ là định dạng tiền.
   */
  async getGrandTotalMilli(): Promise<bigint> {
    const text = await this.grandTotal.innerText();
    return parseVndDisplay(text.slice(text.lastIndexOf(':') + 1));
  }

  /** Chuỗi thô của dòng Tổng thanh toán — dùng cho assertion về định dạng hiển thị (BT7). */
  async getGrandTotalRaw(): Promise<string> {
    const text = await this.grandTotal.innerText();
    return text.slice(text.lastIndexOf(':') + 1).trim();
  }
}

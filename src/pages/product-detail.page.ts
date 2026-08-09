import type { Locator, Page } from '@playwright/test';
import { URLS } from '../config';
import { CartPage } from './cart.page';

export class ProductDetailPage {
  readonly page: Page;

  /**
   * Tên sản phẩm. Đây là NGUỒN DUY NHẤT hợp lệ để biết sản phẩm tên gì (E1) — cùng với
   * GET /api/products/:id. Không có chuỗi "iPhone 15 Pro Max" nào trong toàn bộ mã test.
   * Định vị theo role heading level 1: trang chi tiết chỉ có một h1, và đó là ngữ nghĩa
   * chứ không phải kiểu dáng.
   * GÃY KHI: SUT hạ tên sản phẩm xuống h2, hoặc thêm một h1 thứ hai vào layout.
   */
  readonly heading: Locator;

  /**
   * Ô Số lượng.
   *
   * Vì sao getByRole('spinbutton'): <input type="number"> ánh xạ sang role spinbutton trong
   * accessibility tree, và trang chi tiết chỉ có đúng một ô số. Đây là cách định vị mô tả
   * Ý ĐỊNH của người dùng ("ô tăng giảm số"), trùng với thứ screen reader nhìn thấy.
   *
   * Vì sao KHÔNG getByLabel('Số lượng'): thẻ <label> không có htmlFor và không bọc input,
   * nên không tồn tại liên kết accessibility nào. getByLabel sẽ không tìm thấy gì — đây là
   * bẫy dễ mắc nhất ở trang này.
   *
   * Vì sao KHÔNG locator('.border.p-2.w-20.rounded'): class Tailwind là chi tiết trình bày.
   * Đổi w-20 thành w-24 vì lý do thẩm mỹ sẽ làm đỏ toàn bộ 14 test mà chức năng không hề đổi.
   *
   * GÃY KHI: trang thêm một ô số thứ hai (strict mode báo lỗi rõ ràng), hoặc input đổi sang
   * type="text" (mất role spinbutton). Cả hai đều là thay đổi hành vi thật, đáng để gãy.
   */
  readonly quantityInput: Locator;

  /**
   * Nút thêm vào giỏ, định vị KHÔNG PHỤ THUỘC TRẠNG THÁI nhãn.
   *
   * Nhãn đổi thành "Đã thêm" trong 2 giây rồi tự quay lại. Nếu neo vào đúng chuỗi
   * "Thêm vào giỏ hàng", lần bấm thứ hai của DT8 sẽ chờ một phần tử không tồn tại và treo
   * tới hết timeout. Regex phủ cả hai nhãn nên nút luôn định vị được ở mọi thời điểm.
   *
   * Đây cũng là locator dùng để CLICK, không bao giờ dùng để khẳng định phản hồi trực quan —
   * việc đó thuộc về addedButton bên dưới.
   *
   * GÃY KHI: xuất hiện thêm nhãn trạng thái thứ ba (ví dụ "Đang thêm..."), lúc đó regex phải
   * được mở rộng một cách có ý thức.
   */
  readonly addButton: Locator;

  /**
   * Nút ở trạng thái đã thêm. Tách riêng để spec khẳng định theo CHIỀU DƯƠNG.
   *
   * Cố ý không cung cấp locator cho chiều phủ định (kiểu "nút gốc biến mất"): nhãn tự quay
   * lại sau 2 giây, nên một assertion đếm-về-0 có cửa sổ thời gian và flaky ngay từ thiết kế.
   *
   * Không dùng exact: "Đã thêm" không phải chuỗi con của "Thêm vào giỏ hàng" theo cả hai
   * chiều, nên khớp chuỗi con đã đủ phân biệt; bật exact chỉ thêm phân biệt hoa thường,
   * tức thêm một điểm gãy vô ích.
   */
  readonly addedButton: Locator;

  private readonly cart: CartPage;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.quantityInput = page.getByRole('spinbutton');
    this.addButton = page.getByRole('button', { name: /Thêm vào giỏ hàng|Đã thêm/ });
    this.addedButton = page.getByRole('button', { name: 'Đã thêm' });
    // Header dùng chung; mượn locator của CartPage thay vì khai báo lại link "Giỏ hàng"
    // ở hai nơi. Hai bản sao của cùng một locator là hai chỗ phải sửa khi header đổi.
    this.cart = new CartPage(page);
  }

  /**
   * Điều hướng cấp document tới trang chi tiết. Đây là goto DUY NHẤT trong cả hai page object,
   * và nó hợp lệ vì đang mở phiên làm việc — giỏ lúc này đương nhiên rỗng.
   * Sau bước này, mọi di chuyển đều phải là điều hướng client-side.
   */
  async goto(productId: number): Promise<void> {
    await this.page.goto(`${URLS.web}/product/${productId}`);
    // Chờ theo điều kiện phần tử xuất hiện, không dùng waitForTimeout.
    await this.heading.waitFor({ state: 'visible' });
    await this.quantityInput.waitFor({ state: 'visible' });
  }

  /** Tên sản phẩm đọc từ chính SUT (E1). */
  async getProductName(): Promise<string> {
    return (await this.heading.innerText()).trim();
  }

  /**
   * Đặt số lượng bằng fill — đường dùng cho 12/14 ca (input_mode = fill).
   *
   * Nhận string chứ không nhận number vì bộ dữ liệu có '' (DT5), '1.5' (DT4) và '+5' (BT6);
   * ép qua number ở đây sẽ chuẩn hoá mất chính đặc trưng mà ba ca đó sinh ra để kiểm.
   *
   * Cố ý KHÔNG bắt lỗi: với 'abc', Playwright sẽ ném ở tầng framework. Nuốt lỗi tại đây sẽ
   * biến một sự kiện cần ghi nhận thành im lặng. Spec là nơi quyết định xử lý ngoại lệ đó.
   */
  async setQuantity(value: string): Promise<void> {
    await this.quantityInput.fill(value);
  }

  /**
   * Gõ từng phím — đường riêng cho DT6 (input_mode = type).
   *
   * fill() đặt thẳng value qua DOM và bị Playwright từ chối với input[type=number] khi chuỗi
   * không phải số. pressSequentially mô phỏng người dùng thật: trình duyệt tự nuốt ký tự phi
   * số, và giá trị còn lại trong ô mới là dữ kiện cần quan sát.
   *
   * Tách thành phương thức riêng thay vì thêm cờ vào setQuantity, để spec ánh xạ input_mode
   * -> phương thức bằng một bảng tra, không phải bằng if lồng nhau (E2).
   */
  async typeQuantity(value: string): Promise<void> {
    await this.quantityInput.click();
    await this.quantityInput.press('Control+a');
    await this.quantityInput.pressSequentially(value);
  }

  /** Xoá rỗng ô — đường cho DT5 (input_mode = clear). Ánh xạ 1-1 với sentinel <EMPTY>. */
  async clearQuantity(): Promise<void> {
    await this.quantityInput.fill('');
  }

  /**
   * Đọc lại giá trị THỰC TẾ đang nằm trong ô sau khi đặt (D2).
   *
   * Không có hàm này thì lúc test đỏ ta không phân biệt được "SUT xử lý sai" với "giá trị
   * chưa từng vào được ô". Với '+5' và 'abc', đây là dữ kiện quan trọng hơn cả kết quả cuối.
   * Trả string, không trả number: 9007199254740992 phải đi qua BigInt ở spec, không được
   * ghé qua dấu phẩy động ở đây.
   */
  async getQuantityValue(): Promise<string> {
    return this.quantityInput.inputValue();
  }

  /** Nhãn nút tại thời điểm gọi. Dùng cho annotation, không dùng thay cho assertion. */
  async getAddButtonLabel(): Promise<string> {
    return (await this.addButton.innerText()).trim();
  }

  /**
   * Bấm thêm vào giỏ. Không chờ nhãn đổi và không chờ nhãn quay lại:
   * DT8 cần bấm liên tục, việc chèn bất kỳ bước chờ nào ở đây sẽ làm sai bản chất của ca đó.
   * Ca nào cần khẳng định phản hồi trực quan thì tự assert trên addedButton.
   */
  async addToCart(): Promise<void> {
    await this.addButton.click();
  }

  /**
   * Sang trang giỏ bằng link header, giữ nguyên state React (G1).
   * Trả về CartPage để spec dùng tiếp, tránh việc spec phải tự khởi tạo và vô tình
   * đi đường khác.
   */
  async openCart(): Promise<CartPage> {
    await this.cart.openFromHeader();
    return this.cart;
  }
}

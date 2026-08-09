import type { Locator, Page } from '@playwright/test';

/**
 * Kết quả đọc một ô tiền tệ ("Thành tiền" hoặc "Tổng tạm tính").
 *
 * Trả về CẢ HAI dạng là có chủ đích (G2): `digits` để so bằng BigInt, `raw` để đưa vào
 * message của assertion. Nếu chỉ trả `digits`, khi test đỏ ta không biết SUT đã in ra
 * ký hiệu khoa học, ký tự vô hình, hay đơn giản là con số khác — ba nguyên nhân đó cần
 * ba hướng xử lý hoàn toàn khác nhau.
 */
export interface MoneyReading {
  /** Nguyên văn innerText của node chứa số, chưa đụng tới. Giữ cả NBSP và ký hiệu ₫. */
  raw: string;
  /**
   * Chuỗi chữ số thập phân chuẩn tắc, sẵn sàng cho BigInt().
   * `null` khi chuỗi hiển thị KHÔNG khớp định dạng nhóm vi-VN — ví dụ SUT rơi sang
   * "2.7021597764222976e+23". Trả null thay vì cố bóc là quyết định quan trọng: một phép
   * "xoá mọi ký tự không phải chữ số" trên chuỗi khoa học sẽ sinh ra con số rác trông
   * rất giống thật, và assertion sẽ đỏ vì lý do sai.
   */
  digits: string | null;
}

/**
 * Ảnh chụp thô của bảng giỏ hàng, dùng để đính kèm bằng chứng vào report.
 *
 * Cố ý trả về headers + rows dạng mảng chuỗi thô thay vì object đã đặt tên trường
 * (product/price/quantity/lineTotal). Hai lý do:
 *  1. Không cần suy ra chỉ số cột, nên hàm này KHÔNG BAO GIỜ ném lỗi vì bảng đổi cấu trúc —
 *     điều bắt buộc với một hàm chạy trong afterEach, nơi mọi ngoại lệ sẽ che mất nguyên nhân
 *     thật của test đã đỏ.
 *  2. Nếu SUT thêm hoặc đổi tên cột, bản dump vẫn phản ánh đúng bảng thật; một object cứng
 *     trường sẽ lặng lẽ bỏ rơi cột mới.
 */
export interface CartTableSnapshot {
  /** Tiêu đề cột đọc từ <thead>, theo đúng thứ tự SUT render. */
  headers: string[];
  /** Mỗi phần tử là một dòng sản phẩm, các ô theo thứ tự cột. */
  rows: string[][];
}

/** Định dạng nhóm nghìn của vi-VN: 1 đến 3 chữ số, rồi từng cụm 3 chữ số sau dấu chấm. */
const VI_VN_GROUPED = /^\d{1,3}(\.\d{3})*$/;

/**
 * Ký tự cần gỡ trước khi kiểm hình dạng số.
 * U+00A0 (NBSP) và U+202F (narrow NBSP) là thứ Intl chèn vào trước ký hiệu tiền tệ.
 * Chúng vô hình khi nhìn bằng mắt nhưng làm hỏng mọi regex chữ số, và mỗi engine
 * (Chromium/Firefox/WebKit) dùng phiên bản ICU khác nhau nên chèn ký tự khác nhau.
 */
const INVISIBLE_AND_CURRENCY = /[\s  ₫]/g;

/** Tiêu đề cột, đúng như SUT render. Đây là hợp đồng hiển thị, không phải chi tiết kỹ thuật. */
const COLUMN = {
  product: 'Sản phẩm',
  price: 'Giá',
  quantity: 'Số lượng',
  lineTotal: 'Thành tiền',
  actions: 'Thao tác',
} as const;

export class CartPage {
  readonly page: Page;

  /**
   * Link "Giỏ hàng" trên header — CỬA DUY NHẤT vào trang giỏ (G1).
   * Định vị theo role + tên hiển thị vì đó là hợp đồng với người dùng; class Tailwind
   * hay thứ tự trong header đều là chi tiết trình bày.
   * Không dùng exact: trên trang giỏ còn có link "← Mua tiếp" và "Tiếp tục mua sắm",
   * không chuỗi nào chứa "Giỏ hàng", nên khớp chuỗi con đã đủ phân biệt mà không phải
   * bật phân biệt hoa thường.
   * GÃY KHI: nhãn link đổi chữ, hoặc header thêm link khác cũng chứa "Giỏ hàng" — lúc đó
   * strict mode báo lỗi rõ ràng chứ không im lặng chọn nhầm.
   */
  readonly headerCartLink: Locator;

  /**
   * Tiêu đề trạng thái rỗng.
   * Lưu ý: khi giỏ CÓ hàng, trang render <h2>Giỏ Hàng</h2>. Hai chuỗi không chứa nhau theo
   * chiều nào, nên khớp chuỗi con vẫn phân biệt được hai trạng thái.
   * GÃY KHI: đổi câu chữ thông báo rỗng, hoặc đổi h2 sang <p> (mất role heading).
   */
  readonly emptyHeading: Locator;

  /**
   * Bảng giỏ hàng. Dùng role 'table' thay vì locator('table') để bám vào ngữ nghĩa
   * accessibility — nếu sau này SUT dựng bảng bằng div + role="table", locator vẫn sống.
   * Chỉ tồn tại khi giỏ có hàng: khi rỗng, toàn bộ khối này không render.
   */
  readonly table: Locator;

  /**
   * Các ô tiêu đề cột. Đây là NGUỒN để suy ra chỉ số cột lúc chạy (H2b), thay cho hằng số
   * viết cứng. Chỉ số cột là dữ liệu của SUT, không phải kiến thức của test.
   */
  readonly headerCells: Locator;

  /**
   * Các dòng sản phẩm = các dòng trong <tbody>.
   *
   * ĐỔI so với bản trước: bỏ cách lọc "dòng có chứa button". Lý do ban đầu của bộ lọc đó là
   * phòng dòng "Tổng tạm tính" bị đếm lẫn — nhưng markup thật cho thấy dòng tổng nằm trong
   * một <div> anh em NGOÀI <table>, nên mối lo đó không tồn tại. Giữ một bộ lọc mà lý do đã
   * biến mất là thói quen sao chép, không phải phòng thủ.
   *
   * Ngoài ra bộ lọc theo button còn tệ hơn ở một điểm: nếu nút "Xóa" được refactor thành
   * <a href> thì nó mất role button và MỌI dòng sản phẩm biến mất khỏi locator — một thay đổi
   * không liên quan gì tới danh tính của dòng lại làm hỏng phép đếm.
   *
   * Dùng <tbody> tách bạch với <thead> nên dòng tiêu đề không bị tính vào.
   * GÃY KHI: SUT bỏ <tbody> tường minh, hoặc render thêm một dòng phi sản phẩm (ví dụ dòng
   * khuyến mãi) vào trong tbody.
   */
  readonly productRows: Locator;

  /**
   * <div> chứa nhãn "Tổng tạm tính:" — KHÔNG phải nơi lấy con số (xem subtotalValue).
   *
   * Vì sao locator này không nuốt luôn các div cha (H3): text engine của Playwright chỉ khớp
   * phần tử có TEXT NODE TRỰC TIẾP chứa chuỗi cần tìm. Chỉ <div class="text-xl font-bold">
   * mới có text node "Tổng tạm tính: " nằm ngay trong nó; div.flex bao ngoài và div.bg-white
   * ngoài cùng chỉ chứa chuỗi đó gián tiếp qua con cháu nên không khớp. Vì vậy không cần
   * .last() và cũng không có nguy cơ vi phạm strict mode.
   */
  readonly subtotalLabel: Locator;

  /**
   * <span> chứa riêng con số tổng tạm tính.
   *
   * Đây là điểm mấu chốt của H3: nhãn "Tổng tạm tính:" là text node của div CHA, còn số nằm
   * trong <span> CON. Nếu đọc innerText của div cha, chuỗi raw sẽ là
   * "Tổng tạm tính: 150.000.000 ₫" — regex VI_VN_GROUPED không bao giờ khớp, và cả 8 ca
   * accept sẽ đỏ kể cả khi SUT hoàn toàn đúng. Đó là lý do bản trước có nhánh "lùi về đọc
   * text của container": nhánh đó nay bị XOÁ HẲN, vì nó chính là cái bẫy vừa mô tả.
   *
   * Đi xuống <span> con nên chuỗi raw chỉ chứa "150.000.000 ₫", không dính nhãn.
   * GÃY KHI: SUT bỏ <span> và in thẳng số vào text node của div — lúc đó locator không tìm
   * thấy gì và test đỏ ngay tại chỗ, đúng nguyên nhân, thay vì đỏ ở khâu so số.
   */
  readonly subtotalValue: Locator;

  constructor(page: Page) {
    this.page = page;
    this.headerCartLink = page.getByRole('link', { name: 'Giỏ hàng' });
    this.emptyHeading = page.getByRole('heading', { name: 'Giỏ hàng của bạn đang trống' });
    this.table = page.getByRole('table');
    this.headerCells = this.table.locator('thead th');
    this.productRows = this.table.locator('tbody tr');
    this.subtotalLabel = page.getByText('Tổng tạm tính');
    this.subtotalValue = this.subtotalLabel.locator('span');
  }

  /**
   * Mở trang giỏ bằng ĐIỀU HƯỚNG CLIENT-SIDE (G1).
   *
   * Không có page.goto ở đây, và cố ý không có đường dự phòng nào dùng goto. Giỏ là state
   * React trong bộ nhớ; bất kỳ điều hướng cấp document nào cũng remount provider và xoá
   * sạch giỏ. Một fallback goto sẽ khiến 6 ca reject xanh vĩnh viễn — giỏ rỗng vì bị reload
   * chứ không phải vì SUT từ chối giá trị — tức là biến bộ test thành vô dụng đúng ở chỗ
   * nó cần có ích nhất.
   */
  async openFromHeader(): Promise<void> {
    await this.headerCartLink.click();
    // Chờ theo ĐIỀU KIỆN url, không dùng timeout cố định. Dạng hàm để không phụ thuộc
    // host/port, vì cùng bộ test có thể chạy trên 127.0.0.1 lẫn tên miền khác khi CI đổi.
    await this.page.waitForURL((url) => url.pathname === '/cart');
    await this.waitUntilSettled();
  }

  /**
   * Chờ trang giỏ render xong, ở MỘT TRONG HAI trạng thái hợp lệ: rỗng hoặc có bảng.
   *
   * Dùng Locator.or() vì ca accept và ca reject cùng đi qua hàm này. Nếu chỉ chờ bảng, mọi
   * ca reject sẽ treo tới hết timeout rồi mới đỏ, làm thời gian chạy phình lên và che mất
   * nguyên nhân thật.
   */
  async waitUntilSettled(): Promise<void> {
    await this.emptyHeading.or(this.table).first().waitFor({ state: 'visible' });
  }

  /**
   * true khi giỏ đang ở trạng thái rỗng.
   * Gọi waitUntilSettled trước để isVisible() không đọc trúng khoảnh khắc React chưa render:
   * isVisible() KHÔNG tự thử lại, nên bước chờ phía trên là bắt buộc chứ không phải trang trí.
   */
  async isEmpty(): Promise<boolean> {
    await this.waitUntilSettled();
    return this.emptyHeading.isVisible();
  }

  /** Số dòng sản phẩm thực sự trong giỏ. Dùng cho annotation của DT8. */
  async getProductRowCount(): Promise<number> {
    await this.waitUntilSettled();
    return this.productRows.count();
  }

  /**
   * Dòng của một sản phẩm cụ thể.
   *
   * exact: true là BẮT BUỘC ở đây, khác với các locator khác trong file này. Tên sản phẩm
   * seed có thể là tiền tố của nhau ("iPhone 15 Pro" nằm trong "iPhone 15 Pro Max"); khớp
   * chuỗi con sẽ trúng nhiều dòng, và tệ hơn là có thể trúng ĐÚNG MỘT dòng nhưng là dòng sai.
   *
   * `name` luôn do spec truyền vào sau khi đọc từ SUT (h1 hoặc API), không bao giờ viết cứng.
   */
  rowFor(name: string): Locator {
    return this.productRows.filter({
      has: this.page.getByRole('cell', { name, exact: true }),
    });
  }

  /** Sản phẩm có trong giỏ hay không. Trả số dòng khớp để spec tự quyết định cách assert. */
  async countRowsFor(name: string): Promise<number> {
    await this.waitUntilSettled();
    return this.rowFor(name).count();
  }

  /**
   * Chụp toàn bộ bảng giỏ hàng ở dạng thô. Trả `null` khi bảng không tồn tại (giỏ rỗng) —
   * và bản thân giá trị null cũng là bằng chứng: nó chứng minh trạng thái rỗng cho 6 ca reject.
   *
   * KHÔNG gọi waitUntilSettled: hàm này chạy sau khi thân test đã điều hướng và chờ xong.
   * Chèn thêm một bước chờ ở đây sẽ khiến một test đã đỏ phải treo thêm tới hết timeout
   * trước khi report nhận được bằng chứng.
   */
  async getTableSnapshot(): Promise<CartTableSnapshot | null> {
    if ((await this.table.count()) === 0) return null;

    const headers = (await this.headerCells.allInnerTexts()).map((t) => t.trim());
    const rowLocators = await this.productRows.all();
    const rows: string[][] = [];
    for (const row of rowLocators) {
      rows.push((await row.getByRole('cell').allInnerTexts()).map((t) => t.trim()));
    }
    return { headers, rows };
  }

  /**
   * Suy ra chỉ số cột LÚC CHẠY từ hàng <th> (H2b).
   *
   * Vì sao không dùng nth(2) viết cứng: số 2 là con số ma — đọc code không thấy nó đến từ đâu,
   * và khi ai đó chèn thêm một cột (ví dụ "Ảnh") thì test đỏ ở khâu so số lượng, tức báo sai
   * địa chỉ hoàn toàn. Suy ra lúc chạy biến chỉ số cột thành dữ liệu của SUT thay vì kiến thức
   * ngầm của test.
   *
   * Dùng allInnerTexts() để lấy toàn bộ tiêu đề trong MỘT lần gọi thay vì lặp nth() — ít
   * round-trip hơn, và quan trọng hơn là chụp được ảnh nhất quán của cùng một lần render.
   *
   * Không cache kết quả: trong phạm vi một test, header không đổi, nên cache chỉ tiết kiệm
   * vài mili-giây và đổi lại một biến trạng thái có thể ôi thiu. Không đáng.
   *
   * NÉM LỖI khi không tìm thấy, thay vì lặng lẽ lùi về nth(2). Ba lý do:
   *  1. Fallback làm toàn bộ việc suy ra lúc chạy trở nên vô nghĩa — trong đúng tình huống
   *     nó sinh ra để xử lý, nó lại quay về chính con số ma mà ta vừa loại bỏ.
   *  2. Đọc nhầm cột không làm test đỏ ngay; nó trả về một giá trị SAI trông vẫn hợp lệ, rồi
   *     assertion đỏ với thông điệp "số lượng không khớp". Người đọc report sẽ đi truy lỗi
   *     logic giỏ hàng, trong khi nguyên nhân là bảng đổi cấu trúc.
   *  3. Cột biến mất là thay đổi hành vi thật của SUT, đáng được báo cáo tường minh — kèm
   *     danh sách tiêu đề tìm thấy được, để người sửa biết ngay bảng giờ trông như thế nào.
   */
  private async columnIndex(headerText: string): Promise<number> {
    await this.waitUntilSettled();
    const headers = (await this.headerCells.allInnerTexts()).map((t) => t.trim());
    const index = headers.indexOf(headerText);
    if (index === -1) {
      throw new Error(
        `Không tìm thấy cột "${headerText}" trong bảng giỏ hàng. ` +
          `Các tiêu đề đọc được: [${headers.join(' | ')}]. ` +
          `Cấu trúc bảng đã đổi — sửa hằng số COLUMN hoặc kiểm tra lại SUT.`,
      );
    }
    return index;
  }

  /** Ô tại cột có tiêu đề `headerText`, trong dòng của sản phẩm `name`. */
  private async cellOf(name: string, headerText: string): Promise<Locator> {
    const index = await this.columnIndex(headerText);
    return this.rowFor(name).getByRole('cell').nth(index);
  }

  /**
   * Số lượng hiển thị của một sản phẩm, dạng chuỗi thô.
   *
   * Trả string chứ không trả number: giá trị lớn nhất trong bộ dữ liệu là 2^53, ép qua number
   * ở tầng page object sẽ làm mất chính xác trước khi spec kịp so bằng BigInt.
   *
   * ĐỔI so với bản trước: bỏ nhánh "nếu ô chứa spinbutton thì đọc inputValue". Markup thật là
   * <td>{item.quantity}</td> — text thuần. Nhánh kia được viết khi chưa biết markup và giờ là
   * mã chết: nó không bao giờ chạy, nên không bao giờ được kiểm chứng, nhưng vẫn khiến người
   * đọc tưởng cột này có thể sửa được.
   */
  async getQuantityText(name: string): Promise<string> {
    const cell = await this.cellOf(name, COLUMN.quantity);
    return (await cell.innerText()).trim();
  }

  /**
   * Thành tiền của một dòng, bóc tách theo cùng quy tắc với tổng tạm tính.
   * Cột này cũng suy ra chỉ số lúc chạy, không dùng hằng số vị trí (H2b).
   */
  async getLineTotal(name: string): Promise<MoneyReading> {
    const cell = await this.cellOf(name, COLUMN.lineTotal);
    return this.parseMoney(await cell.innerText());
  }

  /** Đơn giá hiển thị của một dòng. Hữu ích khi cần đối chiếu với giá lấy từ API. */
  async getUnitPrice(name: string): Promise<MoneyReading> {
    const cell = await this.cellOf(name, COLUMN.price);
    return this.parseMoney(await cell.innerText());
  }

  /**
   * Đọc "Tổng tạm tính" theo đúng yêu cầu G2.
   * Đọc từ <span> con nên chuỗi raw không dính nhãn "Tổng tạm tính:" (H3).
   */
  async getSubtotal(): Promise<MoneyReading> {
    await this.waitUntilSettled();
    return this.parseMoney(await this.subtotalValue.innerText());
  }

  /**
   * Bóc chuỗi tiền tệ vi-VN về chuỗi chữ số chuẩn tắc.
   *
   * Toàn bộ đường đi KHÔNG chạm tới number: chuỗi hiển thị -> gỡ ký tự vô hình -> kiểm hình
   * dạng -> gỡ dấu chấm phân nhóm -> chuỗi chữ số. Nếu ở giữa có một bước parseInt hay
   * Number(), ta đã ném dữ liệu trở lại đúng kiểu dữ liệu đang bị nghi ngờ, và lỗi làm tròn
   * ở vùng trên 2^53 sẽ được giặt sạch trước khi assertion kịp nhìn thấy.
   *
   * Không phải phương thức public: spec không bao giờ cần tự bóc chuỗi, mọi lối vào đều qua
   * getSubtotal / getLineTotal / getUnitPrice.
   */
  private parseMoney(raw: string): MoneyReading {
    const stripped = raw.replace(INVISIBLE_AND_CURRENCY, '');
    if (!VI_VN_GROUPED.test(stripped)) {
      // Không cố cứu vãn. digits = null là tín hiệu để spec đỏ kèm chuỗi raw nguyên văn.
      return { raw, digits: null };
    }
    return { raw, digits: stripped.replaceAll('.', '') };
  }
}

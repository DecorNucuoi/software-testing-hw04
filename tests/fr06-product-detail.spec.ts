import { test, expect, logRunHeader } from '../src/fixtures';
import { loadCsv } from '../src/utils/data-loader';
import { getProductById } from '../src/utils/api';
import { ProductDetailPage } from '../src/pages/product-detail.page';
import { CartPage } from '../src/pages/cart.page';
import type { CartTableSnapshot } from '../src/pages/cart.page';

/* ===========================================================================
 * I2 — CÁC KIỂU ASSERTION DÙNG TRONG FILE NÀY
 *
 *  [K1] Web-first assertion trên LOCATOR của trang.
 *       expect(locator).toBeVisible() / .toHaveCount(n)
 *       Tự thử lại tới khi điều kiện đúng hoặc hết timeout. Dùng cho mọi mệnh đề về
 *       TRẠNG THÁI GIAO DIỆN, vì React render bất đồng bộ và không có mốc thời gian nào
 *       để chờ cứng.
 *
 *  [K2] Assertion trên GIÁ TRỊ ĐÃ TRÍCH XUẤT khỏi DOM.
 *       expect(chuỗi).toBe(...) / .toMatch(...)
 *       Dùng cho số lượng, tiền tệ, giá trị trong ô nhập — những thứ cần so sánh chính xác
 *       theo chuỗi/BigInt chứ không phải theo sự hiện diện của phần tử.
 *
 *  [K3] Assertion trên RESPONSE API.
 *       Kiểm giá lấy từ GET /api/products/:id trước khi dùng nó làm cơ sở oracle.
 *       Đây là điều kiện tiên quyết: nếu giá không phải số nguyên dương thì toàn bộ phép
 *       nhân BigInt phía sau vô nghĩa, và ta cần biết điều đó ngay tại nguồn.
 *
 *  [K4] Assertion PHỦ ĐỊNH.
 *       expect(locator).not.toContainText(...) / expect(value).not.toBeNull()
 *       Dùng cho bất biến "không bao giờ NaN" và cho việc phát hiện chuỗi tiền rơi sang
 *       ký hiệu khoa học.
 * ===========================================================================
 */

/** Một dòng của data/fr06-quantity.csv. Mọi trường đều là chuỗi — loadCsv không ép kiểu. */
interface QuantityCase extends Record<string, string> {
  tc_id: string;
  technique: string;
  bva_role: string;
  product_id: string;
  quantity_raw: string;
  input_mode: string;
  click_count: string;
  expected_outcome: string;
  expected_cart_qty: string;
  field_value_rule: string;
  description: string;
  spec_basis: string;
}

const CASES = loadCsv<QuantityCase>('fr06-quantity.csv');

/**
 * Vòng lặp sinh test im lặng khi mảng rỗng: 0 test chạy, report xanh, không ai biết dữ liệu
 * đã biến mất. Ném lỗi ngay lúc collect để hỏng ồn ào thay vì hỏng lặng lẽ.
 * Không dùng expect ở đây vì đang ở ngoài phạm vi một test.
 */
if (CASES.length === 0) {
  throw new Error('data/fr06-quantity.csv rỗng hoặc không đọc được — không sinh được test nào.');
}

/* --------------------------------------------------------------------------
 * SENTINEL — quy ước đã chốt ở bước 2
 * ------------------------------------------------------------------------ */

/** CSV không phân biệt được chuỗi rỗng với ô bỏ quên, nên ô rỗng cố ý được ghi tường minh. */
const EMPTY = '<EMPTY>';
/** Đặc tả không xác định giá trị kỳ vọng (chỉ DT8). */
const UNSPEC = '<UNSPEC>';

const resolveQuantityRaw = (value: string): string => (value === EMPTY ? '' : value);
const resolveExpectedQty = (value: string): string | null => (value === UNSPEC ? null : value);

/* --------------------------------------------------------------------------
 * I1 — BẢNG TRA, KHÔNG LỒNG IF
 * ------------------------------------------------------------------------ */

/**
 * input_mode -> phương thức thao tác. Ba chế độ trong CSV ánh xạ 1-1 sang ba phương thức
 * của page object, nên việc chọn cách nhập là một phép tra bảng chứ không phải chuỗi if.
 * Thêm một chế độ mới = thêm một dòng ở đây, không đụng tới thân test.
 */
const INPUT_MODE: Record<string, (page: ProductDetailPage, value: string) => Promise<void>> = {
  fill: (page, value) => page.setQuantity(value),
  type: (page, value) => page.typeQuantity(value),
  clear: (page) => page.clearQuantity(),
};

/** Bỏ dấu cộng dẫn đầu để đưa được '+5' vào BigInt — BigInt('+5') ném SyntaxError. */
const stripLeadingPlus = (value: string): string => value.replace(/^\+/, '');

/**
 * field_value_rule -> vị từ kiểm giá trị ĐỌC LẠI được từ ô (ràng buộc D2).
 * Không có hàm này thì lúc test đỏ ta không phân biệt được "SUT xử lý sai" với "giá trị chưa
 * từng vào được ô" — hai nguyên nhân cần hai hướng sửa hoàn toàn khác nhau.
 */
const FIELD_VALUE_RULE: Record<string, (actual: string, raw: string) => boolean> = {
  /** Ô phải giữ nguyên văn chuỗi đã đặt. */
  verbatim: (actual, raw) => actual === raw,
  /**
   * Chỉ so về GIÁ TRỊ SỐ, cho phép trình duyệt chuẩn hoá chuỗi ('+5' -> '5').
   * So bằng BigInt chứ không bằng Number, để cùng một quy tắc "không đi qua dấu phẩy động"
   * áp cho mọi nơi trong file, kể cả nơi con số nhỏ và an toàn.
   */
  numeric: (actual, raw) =>
    /^\+?\d+$/.test(actual) && BigInt(stripLeadingPlus(actual)) === BigInt(stripLeadingPlus(raw)),
  /** Ô phải rỗng sau khi xoá. */
  empty: (actual) => actual === '',
  /** Ô không được chứa bất kỳ ký tự phi số nào — kỳ vọng theo đặc tả cho DT6. */
  no_letters: (actual) => /^\d*$/.test(actual),
};

/* --------------------------------------------------------------------------
 * HOOKS
 * ------------------------------------------------------------------------ */

test.beforeAll(() => {
  // Không nhận page fixture: hàm này chỉ ghi header cho report, và nhận page ở beforeAll sẽ
  // tạo ra một page dùng chung — thứ phá vỡ cơ chế cô lập mô tả ở beforeEach.
  logRunHeader('fr06');
});

/**
 * Dựng bảng markdown từ ảnh chụp thô của bảng giỏ. Tiêu đề cột lấy từ chính SUT, nên bản dump
 * tự mô tả kể cả khi cấu trúc bảng đổi.
 */
function renderCartTable(snapshot: CartTableSnapshot): string {
  const head = `| ${snapshot.headers.join(' | ')} |`;
  const rule = `| ${snapshot.headers.map(() => '---').join(' | ')} |`;
  const body = snapshot.rows.map((cells) => `| ${cells.join(' | ')} |`);
  return [head, rule, ...body].join('\n');
}

/**
 * THU BẰNG CHỨNG — chạy cho CẢ 14 test, kể cả khi test đã đỏ.
 *
 * Chuyển từ assertAccepted sang đây vì ba lý do:
 *  - afterEach đã có sẵn điều kiện "đang ở /cart", nên không phát sinh nhánh mới nào trong
 *    vòng lặp sinh test — I1 giữ nguyên, không có if theo tc_id.
 *  - Bằng chứng được thu cho cả 6 ca reject, nơi bản dump "không có bảng, giỏ rỗng" chính là
 *    thứ chứng minh kỳ vọng, chứ không phải thông tin thừa.
 *  - afterEach chạy kể cả khi thân test ném lỗi, nên ca đỏ — thứ cần bằng chứng nhất — không
 *    còn là ca duy nhất không có bằng chứng.
 *
 * Toàn bộ khối được bọc try/catch và đặt TRƯỚC assertion không-NaN: nếu việc thu bằng chứng
 * tự ném lỗi, nó sẽ che mất nguyên nhân thật của test; và nếu đặt sau assertion, một test đỏ
 * vì NaN sẽ không bao giờ kịp đính kèm gì.
 */
test.afterEach(async ({ page }) => {
  if (new URL(page.url()).pathname !== '/cart') return;

  const info = test.info();
  const cart = new CartPage(page);

  try {
    const snapshot = await cart.getTableSnapshot();
    const lines = [
      `# Trạng thái giỏ hàng sau test`,
      ``,
      `- Test: **${info.title}**`,
      `- Kết quả: **${info.status ?? 'đang chạy'}**`,
      `- URL: ${page.url()}`,
      `- Bảng giỏ hàng: **${snapshot ? 'CÓ' : 'KHÔNG render (giỏ đang rỗng)'}**`,
      ``,
    ];

    if (snapshot) {
      lines.push(`- Số dòng sản phẩm: **${snapshot.rows.length}**`, ``, renderCartTable(snapshot), ``);

      // Nguyên văn, chưa bóc tách — để người đọc report thấy đúng chuỗi SUT in ra, kể cả ký
      // tự vô hình quanh ký hiệu ₫ hoặc dạng ký hiệu khoa học.
      const subtotal = await cart.getSubtotal().catch(() => null);
      lines.push(
        `- Tổng tạm tính (nguyên văn): ${subtotal ? JSON.stringify(subtotal.raw) : 'không đọc được'}`,
        `- Tổng tạm tính (chuỗi chữ số bóc tách): ${subtotal?.digits ?? 'null — không khớp định dạng vi-VN'}`,
      );

      // Ảnh chụp RIÊNG phần tử <table>, không phải cả trang: bằng chứng thị giác gọn, đọc
      // được ngay trong report mà không phải phóng to tìm bảng.
      const shot = await cart.table.screenshot().catch(() => null);
      if (shot) {
        await info.attach('gio-hang-bang.png', { body: shot, contentType: 'image/png' });
      }
    } else {
      lines.push(`- Không có dòng sản phẩm nào. Đây là bằng chứng cho các ca kỳ vọng bị từ chối.`);
    }

    await info.attach('gio-hang-trang-thai.md', {
      body: lines.join('\n'),
      contentType: 'text/markdown',
    });
  } catch (error) {
    // Thu bằng chứng thất bại KHÔNG được làm đỏ test hay che nguyên nhân thật. Ghi lại rồi đi tiếp.
    info.annotations.push({
      type: 'Thu bằng chứng giỏ hàng thất bại',
      description: error instanceof Error ? error.message.split('\n')[0] : String(error),
    });
  }
});

/**
 * I5 — BẤT BIẾN KHÔNG-NaN, chạy cho CẢ 14 test.
 *
 * Đặt ở afterEach chứ không nhét vào page object, vì 6 ca reject không hề chạm tới phần tử
 * tổng tiền; gắn vào CartPage.getSubtotal() thì bất biến sẽ biến mất đúng ở nơi NaN dễ xuất
 * hiện nhất — khi SUT nhét một số lượng không hợp lệ vào giỏ.
 *
 * Kiểm URL trước: nếu test đỏ sớm ở trang chi tiết, kiểm NaN trên trang đó là báo cáo sai
 * địa chỉ và làm nhiễu nguyên nhân thật.
 *
 * Giới hạn đã biết: đây là assertion phủ định web-first, nó thử lại tới khi điều kiện đúng,
 * nên một NaN chớp nhoáng giữa hai lần render sẽ lọt. Chọn chiều ngược lại sẽ biến mọi test
 * thành flaky vì trạng thái render trung gian.
 */
test.afterEach(async ({ page }) => {
  if (new URL(page.url()).pathname !== '/cart') return;

  // [K4] Assertion phủ định trên locator: quét toàn bộ body nên bắt được NaN ở cột Thành tiền,
  // cột Số lượng lẫn dòng Tổng tạm tính, không chỉ ở chỗ ta đoán trước.
  await expect(
    page.locator('body'),
    `Bất biến: trang giỏ hàng không được render "NaN" ở bất kỳ đâu. URL thực tế: ${page.url()}`,
  ).not.toContainText('NaN');
});

/* --------------------------------------------------------------------------
 * SINH TEST
 * ------------------------------------------------------------------------ */

for (const row of CASES) {
  // I6 — tiêu đề bắt đầu bằng tc_id, rồi kỹ thuật (kèm vai trò biên nếu có), rồi mô tả.
  // Người chấm đối chiếu report với bảng HW02 mà không cần mở source.
  const technique = row.bva_role === 'n/a' ? row.technique : `${row.technique} ${row.bva_role}`;

  test(`${row.tc_id} | ${technique} | ${row.description}`, async ({ page, request }) => {
    /**
     * CƠ CHẾ CÔ LẬP GIỮA CÁC TEST
     *
     * Giỏ hàng là state React nằm trong heap JS của document, không có localStorage,
     * sessionStorage, cookie hay bản ghi server nào. Playwright cấp cho mỗi test một
     * BrowserContext và một page mới; khi page đóng, toàn bộ giỏ biến mất theo.
     * Vì vậy KHÔNG cần afterEach dọn dẹp, không cần clear storage, không cần reset DB.
     *
     * Cái giá phải trả là kỷ luật, và ba điều sau là bắt buộc:
     *  - không tạo page ở beforeAll rồi dùng chung;
     *  - không đặt describe ở chế độ serial với page chia sẻ;
     *  - không tái dùng storageState.
     * Mỗi test tự đi lại từ đầu: mở trang chi tiết -> đặt số lượng -> bấm -> sang giỏ.
     */
    const productId = Number(row.product_id);
    const quantityRaw = resolveQuantityRaw(row.quantity_raw);
    const expectedQty = resolveExpectedQty(row.expected_cart_qty);

    // Đưa căn cứ đặc tả vào report: khi test đỏ, người đọc thấy ngay kỳ vọng đến từ đâu,
    // thay vì phải mở CSV rồi mở lại báo cáo HW02.
    test.info().annotations.push({
      type: `${row.tc_id} — căn cứ đặc tả`,
      description: row.spec_basis,
    });

    /* --- Nguồn chân lý về giá, lấy lúc chạy ----------------------------- */

    const product = await getProductById(request, productId);

    // [K3] Assertion trên response API — đồng thời là điều kiện tiên quyết của oracle tiền.
    // Nếu giá không phải số nguyên dương thì BigInt(price) sai ngay từ gốc và mọi so sánh
    // phía sau đều vô nghĩa; bắt tại đây để lỗi được quy đúng cho backend.
    expect(
      typeof product.price === 'number' && Number.isInteger(product.price) && product.price > 0,
      `[K3] Giá từ GET /api/products/${productId} phải là số nguyên dương để làm cơ sở oracle. ` +
        `Giá trị thực tế: ${product.price} (typeof ${typeof product.price})`,
    ).toBe(true);

    const unitPrice = BigInt(product.price);

    /* --- Trang chi tiết ------------------------------------------------- */

    const productPage = new ProductDetailPage(page);
    await productPage.goto(productId);

    // Tên sản phẩm đến từ chính SUT (E1). Không có chuỗi tên nào viết cứng trong file này.
    const productName = await productPage.getProductName();

    /**
     * NGOẠI LỆ DUY NHẤT mà I1 cho phép.
     *
     * Rẽ nhánh theo input_mode === 'type' (thuộc tính của DỮ LIỆU), không theo tc_id === 'DT6'.
     * Chế độ 'type' tồn tại chính vì fill() bị Playwright từ chối với input[type=number] khi
     * chuỗi không phải số. Ta vẫn THỬ fill() trước để ghi nhận sự từ chối đó — đây là dữ kiện
     * cần có trong report, không phải thứ để nuốt im lặng — rồi mới gõ từng phím như người dùng.
     *
     * Cố ý KHÔNG biến việc "fill có ném lỗi hay không" thành assertion: đó là hành vi của
     * Playwright, không phải của đặc tả. Kỳ vọng theo đặc tả nằm ở FIELD_VALUE_RULE bên dưới.
     */
    if (row.input_mode === 'type') {
      let frameworkOutcome: string;
      try {
        await productPage.setQuantity(quantityRaw);
        frameworkOutcome = `fill() KHÔNG bị từ chối — giá trị "${quantityRaw}" được đặt thẳng qua DOM`;
      } catch (error) {
        frameworkOutcome =
          error instanceof Error ? error.message.split('\n')[0] : String(error);
      }
      test.info().annotations.push({
        type: `${row.tc_id} — thao tác fill() ở tầng framework`,
        description: frameworkOutcome,
      });
    }

    const applyInput = INPUT_MODE[row.input_mode];
    if (!applyInput) {
      throw new Error(
        `input_mode "${row.input_mode}" ở dòng ${row.tc_id} không có trong bảng tra. ` +
          `Sửa CSV hoặc bổ sung chế độ vào INPUT_MODE.`,
      );
    }
    await applyInput(productPage, quantityRaw);

    /* --- D2: đọc lại giá trị thực tế trong ô ---------------------------- */

    const fieldValue = await productPage.getQuantityValue();
    const checkField = FIELD_VALUE_RULE[row.field_value_rule];
    if (!checkField) {
      throw new Error(
        `field_value_rule "${row.field_value_rule}" ở dòng ${row.tc_id} không có trong bảng tra.`,
      );
    }

    // [K2] Assertion trên giá trị đã trích xuất: so sánh nội dung ô nhập theo quy tắc lấy từ
    // dữ liệu. Không dùng K1 ở đây vì điều cần khẳng định là NỘI DUNG chuỗi, không phải sự
    // hiện diện của phần tử — và message phải chứa chuỗi thực tế để phân biệt "SUT sai" với
    // "giá trị chưa từng được đặt vào ô".
    expect(
      checkField(fieldValue, quantityRaw),
      `[K2] Ô Số lượng phải thoả quy tắc "${row.field_value_rule}" sau khi đặt bằng ` +
        `"${row.input_mode}". Đã cố đặt: ${JSON.stringify(quantityRaw)} — ` +
        `giá trị thực tế đọc lại từ ô: ${JSON.stringify(fieldValue)}`,
    ).toBe(true);

    /* --- Bấm nút -------------------------------------------------------- */

    const clickCount = Number(row.click_count);
    for (let i = 0; i < clickCount; i += 1) {
      // Không chờ giữa các lần bấm: DT8 kiểm đúng hành vi bấm liên tục, chèn bước chờ sẽ
      // làm sai bản chất của ca đó. Locator của nút phủ cả hai nhãn nên không bị mất mục tiêu
      // trong 2 giây nhãn hiển thị "Đã thêm".
      await productPage.addToCart();
    }

    /* --- Phản hồi trực quan (chỉ cho nhánh accept) ---------------------- */

    if (row.expected_outcome === 'accept') {
      // [K1] Web-first assertion trên locator: đây đúng là mệnh đề "phải hiển thị phản hồi
      // trực quan" của FR-06. Khẳng định theo CHIỀU DƯƠNG trên nhãn "Đã thêm"; không dùng
      // chiều phủ định "nút gốc biến mất" vì nhãn tự quay lại sau 2 giây, khiến assertion đó
      // có cửa sổ thời gian và flaky ngay từ thiết kế.
      // Đọc nhãn có phòng lỗi: template của message được tính TRƯỚC khi assertion chạy, nên
      // nếu nút không tồn tại thì innerText() sẽ ném và che mất assertion thật bằng một lỗi
      // locator khó hiểu. Nuốt lỗi ở đây là đúng chỗ — đây là chuỗi mô tả, không phải oracle.
      const labelNow = await productPage
        .getAddButtonLabel()
        .catch(() => '<không tìm thấy nút Thêm vào giỏ hàng / Đã thêm>');

      await expect(
        productPage.addedButton,
        `[K1] FR-06 đòi hỏi phản hồi trực quan sau khi bấm. Nhãn nút đọc được: "${labelNow}"`,
      ).toBeVisible();
    }
    // Nhánh reject KHÔNG kiểm nhãn nút (I4): "không thấy Đã thêm" là assertion phủ định trong
    // cửa sổ 2 giây, nó có thể xanh chỉ vì React chưa kịp render. Bằng chứng duy nhất được
    // chấp nhận là trạng thái giỏ.

    /* --- Sang giỏ bằng điều hướng client-side --------------------------- */

    const cart = await productPage.openCart();

    if (row.expected_outcome === 'accept') {
      await assertAccepted({ cart, productName, expectedQty, unitPrice, tcId: row.tc_id });
    } else if (row.expected_outcome === 'reject') {
      await assertRejected({ cart, productName, tcId: row.tc_id });
    } else {
      throw new Error(
        `expected_outcome "${row.expected_outcome}" ở dòng ${row.tc_id} không hợp lệ ` +
          `(chỉ nhận accept hoặc reject).`,
      );
    }
  });
}

/* --------------------------------------------------------------------------
 * HAI NHÁNH KHẲNG ĐỊNH
 * ------------------------------------------------------------------------ */

interface AcceptContext {
  cart: CartPage;
  productName: string;
  /** null nghĩa là đặc tả không xác định số lượng (DT8). */
  expectedQty: string | null;
  unitPrice: bigint;
  tcId: string;
}

/**
 * Nhánh accept: sản phẩm phải có trong giỏ, đúng số lượng, và thành tiền phải khớp phép nhân
 * CHÍNH XÁC bằng BigInt.
 *
 * Vì sao BigInt (I3): nếu vế kỳ vọng cũng được tính bằng số học dấu phẩy động như SUT, thì khi
 * phép nhân mất chính xác hai vế ra cùng một kết quả sai và assertion trở thành hằng đúng.
 * Với DT7/BT4/BT5, tích vượt Number.MAX_SAFE_INTEGER, và chuỗi hiển thị của BT5 vượt ngưỡng
 * 1e21 — nơi toLocaleString bị giới hạn 21 chữ số có nghĩa và mỗi engine ICU làm tròn một kiểu.
 * Toàn bộ đường đi ở đây không có một phép Number() nào.
 */
async function assertAccepted({
  cart,
  productName,
  expectedQty,
  unitPrice,
  tcId,
}: AcceptContext): Promise<void> {
  const rowCount = await cart.getProductRowCount();

  // [K1] Web-first assertion trên locator: dòng sản phẩm phải tồn tại đúng một lần.
  // Dùng K1 vì đây là mệnh đề về sự hiện diện của phần tử và cần tự thử lại trong lúc React
  // hoàn tất render bảng.
  await expect(
    cart.rowFor(productName),
    `[K1] ${tcId}: giỏ phải chứa đúng 1 dòng cho "${productName}". ` +
      `Tổng số dòng sản phẩm đọc được trong giỏ: ${rowCount}`,
  ).toHaveCount(1);

  const shownQty = await cart.getQuantityText(productName);

  // [K2] Assertion trên giá trị đã trích xuất: chuỗi số lượng phải là chữ số thuần trước khi
  // đưa vào BigInt. Bước này bắt trường hợp SUT in ra dạng khoa học hoặc chuỗi rỗng — nếu bỏ
  // qua, BigInt() sẽ ném SyntaxError và report chỉ hiện một lỗi runtime khó hiểu.
  expect(
    shownQty,
    `[K2] ${tcId}: số lượng hiển thị trong giỏ phải là chuỗi chữ số thuần. ` +
      `Nguyên văn đọc được: ${JSON.stringify(shownQty)}`,
  ).toMatch(/^\d+$/);

  const shownQtyBig = BigInt(shownQty);

  if (expectedQty !== null) {
    // [K2] So bằng chuỗi chữ số chuẩn tắc (kết quả BigInt.toString()), không so bằng number.
    // So chuỗi thay vì so hai BigInt trực tiếp vì Playwright serialize giá trị khi in diff,
    // mà JSON.stringify ném lỗi trên BigInt — so chuỗi cho ra diff đọc được với đủ chữ số.
    expect(
      shownQtyBig.toString(),
      `[K2] ${tcId}: số lượng trong giỏ phải bằng số đã nhập. ` +
        `Kỳ vọng ${expectedQty}, thực tế hiển thị ${JSON.stringify(shownQty)}`,
    ).toBe(BigInt(expectedQty).toString());
  } else {
    /**
     * DT8 — đặc tả KHÔNG định nghĩa hành vi bấm nhiều lần, nên ghim một con số ở đây là tự
     * chế ràng buộc. Ghi nhận số thực tế vào report thay vì so bằng.
     * Đây KHÔNG phải cách né một test khó: mọi mệnh đề mà đặc tả CÓ nói vẫn được assert đầy
     * đủ ở trên và dưới — giỏ không rỗng, có phản hồi trực quan, thành tiền khớp phép nhân,
     * không có NaN.
     */
    test.info().annotations.push({
      type: `${tcId} — quan sát (đặc tả không xác định số lượng cộng dồn)`,
      description: `số dòng sản phẩm trong giỏ = ${rowCount}; số lượng hiển thị = ${shownQty}`,
    });
  }

  /* --- Oracle tiền: số học chính xác, không đi qua dấu phẩy động --------- */

  // I3: với ca có kỳ vọng ghim thì dùng chính con số từ dữ liệu; với DT8 thì dùng số lượng
  // đọc được từ dòng giỏ. Cả hai đều là BigInt, không có Number ở giữa.
  const oracleQty = expectedQty !== null ? BigInt(expectedQty) : shownQtyBig;
  const expectedTotal = (oracleQty * unitPrice).toString();

  const lineTotal = await cart.getLineTotal(productName);
  const subtotal = await cart.getSubtotal();

  // [K4] Assertion phủ định: digits === null nghĩa là chuỗi hiển thị không khớp định dạng
  // nhóm vi-VN — điển hình là rơi sang ký hiệu khoa học ở vùng trên 1e21. Bắt riêng trường
  // hợp này để message chỉ ra nguyên nhân thật, thay vì báo "hai con số khác nhau".
  expect(
    lineTotal.digits,
    `[K4] ${tcId}: ô Thành tiền phải hiển thị theo định dạng nhóm vi-VN. ` +
      `Nguyên văn SUT in ra: ${JSON.stringify(lineTotal.raw)}`,
  ).not.toBeNull();

  expect(
    subtotal.digits,
    `[K4] ${tcId}: dòng Tổng tạm tính phải hiển thị theo định dạng nhóm vi-VN. ` +
      `Nguyên văn SUT in ra: ${JSON.stringify(subtotal.raw)}`,
  ).not.toBeNull();

  // [K2] So hai chuỗi chữ số chuẩn tắc. Message chứa nguyên văn chuỗi hiển thị (G2) để khi
  // đỏ, người đọc report thấy đúng thứ SUT in ra — kể cả ký tự vô hình quanh ký hiệu ₫.
  expect(
    lineTotal.digits,
    `[K2] ${tcId}: Thành tiền phải bằng số lượng × đơn giá tính bằng BigInt. ` +
      `Kỳ vọng ${expectedTotal}; SUT hiển thị ${JSON.stringify(lineTotal.raw)} ` +
      `(bóc tách được: ${lineTotal.digits})`,
  ).toBe(expectedTotal);

  expect(
    subtotal.digits,
    `[K2] ${tcId}: Tổng tạm tính phải bằng số lượng × đơn giá tính bằng BigInt. ` +
      `Kỳ vọng ${expectedTotal}; SUT hiển thị ${JSON.stringify(subtotal.raw)} ` +
      `(bóc tách được: ${subtotal.digits})`,
  ).toBe(expectedTotal);
}

interface RejectContext {
  cart: CartPage;
  productName: string;
  tcId: string;
}

/**
 * Nhánh reject: bằng chứng DUY NHẤT là trạng thái giỏ (I4).
 *
 * Cố ý không assert bất kỳ thông báo lỗi cụ thể nào: đặc tả FR-06 không định nghĩa thông báo
 * lỗi, nên khẳng định về nó là tự chế ràng buộc. Điều đặc tả nói là miền hợp lệ gồm số nguyên
 * >= 1; hệ quả kiểm được là sản phẩm KHÔNG được vào giỏ.
 *
 * Giỏ rỗng ở đây là bằng chứng thật, không phải tác dụng phụ, vì đường đi tới trang giỏ là
 * điều hướng client-side qua link header — state React sống sót. Nếu ở đâu đó lọt một
 * page.goto('/cart'), mọi ca reject sẽ xanh giả.
 */
async function assertRejected({ cart, productName, tcId }: RejectContext): Promise<void> {
  const rowCount = await cart.getProductRowCount();
  const empty = await cart.isEmpty();
  const evidence = `trạng thái giỏ rỗng = ${empty}; số dòng sản phẩm đọc được = ${rowCount}`;

  // [K1] Web-first assertion trên locator: tiêu đề trạng thái rỗng phải hiện diện.
  // Khẳng định theo chiều dương trên một phần tử CHỈ tồn tại khi giỏ rỗng, mạnh hơn nhiều so
  // với việc phủ định sự tồn tại của bảng.
  await expect(
    cart.emptyHeading,
    `[K1] ${tcId}: giá trị nằm ngoài miền hợp lệ (số nguyên >= 1) nên "${productName}" ` +
      `không được vào giỏ. ${evidence}`,
  ).toBeVisible();

  // [K1] Assertion trên locator, chiều đếm: không tồn tại dòng sản phẩm nào.
  // Bổ sung cho assertion trên để loại trừ trạng thái lai — vừa hiện thông báo rỗng vừa còn
  // sót một dòng do render dở.
  await expect(
    cart.productRows,
    `[K1] ${tcId}: giỏ không được chứa dòng sản phẩm nào. ${evidence}`,
  ).toHaveCount(0);
}

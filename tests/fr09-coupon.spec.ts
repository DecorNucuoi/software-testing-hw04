/**
 * FR-09 — Áp dụng mã giảm giá trên /checkout.
 *
 * ==============================================================================
 * CÁC KIỂU ASSERTION DÙNG TRONG FILE NÀY (mỗi chỗ dùng đều được đánh dấu [An])
 * ==============================================================================
 * [A1] Trạng thái hiển thị của phần tử — toBeVisible / toBeHidden / toBeEnabled.
 *      Oracle là sự HIỆN DIỆN, không đọc tới nội dung.
 * [A2] Giá trị số học tiền tệ — so sánh BigInt mili-đồng với oracle tính từ tham số coupon và
 *      tổng đơn lấy trong file dữ liệu. Không có một hằng số tiền nào viết cứng trong file này.
 * [A3] Nhất quán nội tại — hai vị trí hiển thị ĐỘC LẬP phải khớp nhau. Loại này không cần oracle
 *      bên ngoài và bắt được đúng lớp lỗi mà [A2] bỏ lọt (làm tròn ở một chỗ, quên ở chỗ kia).
 * [A4] Nội dung văn bản — thông báo lỗi không rỗng, và chứa mẩu chuỗi đặc trưng cho điều kiện bị
 *      vi phạm KHI dữ liệu có khai báo (error_must_contain).
 * [A5] Tầng giao thức mạng — đếm request thật sự rời trình duyệt. Không đi qua DOM nên nó kiểm
 *      được mệnh đề "không gửi được" một cách trực tiếp.
 * [A6] Định dạng hiển thị theo vi-VN — phân nhóm hàng nghìn.
 *
 * ==============================================================================
 * VỀ PHÉP CHIA CHO 100 CỦA COUPON PERCENT (không có phép chia nào cả)
 * ==============================================================================
 * Đặc tả cho discount = total * discount_value / 100 và IM LẶNG hoàn toàn về làm tròn.
 * Chọn "cắt phần thập phân" hay "làm tròn nửa lên" đều là tự chế một ràng buộc mà đặc tả không
 * có, và biến giả định của người viết test thành tiêu chuẩn đánh giá SUT.
 *
 * Cách xử lý ở đây:
 *   1. Oracle tính trên thang mili-đồng: total * value * 10 (mili) ≡ total * value / 100 (đồng).
 *      Không tồn tại phép chia, nên không có phần dư nào để mà quyết định — giá trị chính xác
 *      luôn biểu diễn được trọn vẹn bằng số nguyên.
 *   2. Nếu giá trị chính xác rơi đúng vào một số nguyên đồng: khẳng định BẰNG NHAU TUYỆT ĐỐI.
 *   3. Nếu có phần thập phân: chỉ khẳng định |hiển thị − chính xác| < 1 đồng. Điều kiện này đúng
 *      với mọi quy ước làm tròn hợp lý, và đúng cả khi SUT không làm tròn gì. Cố ý KHÔNG viết
 *      "phải bằng floor hoặc ceil": nếu SUT hiển thị đúng 30.000,1 thì giá trị đó không phải
 *      floor cũng chẳng phải ceil, mà nó lại hoàn toàn đúng.
 *   4. Bù lại chỗ nới lỏng ở (3) là [A3]: final = total − discount phải khớp TUYỆT ĐỐI giữa các
 *      số đang hiển thị. Không cần biết SUT làm tròn kiểu gì, nhưng đỏ ngay nếu nó làm tròn ở
 *      một chỗ mà quên chỗ kia — lỗi phổ biến nhất trong tính tiền.
 *
 * Kiểm chứng bằng chuỗi chữ số đầy đủ cho BT7 (yêu cầu K6), tổng đơn 9999999999 với percent 10:
 *   total    = 9999999999 đồng  = 9 999 999 999 000 mili-đồng
 *   discount = 9999999999 * 10 * 10 = 999 999 999 900 mili-đồng =   999 999 999,9 đồng
 *   final    = 9 999 999 999 000 − 999 999 999 900 = 8 999 999 999 100 mili = 8 999 999 999,1 đồng
 * Toàn bộ dãy trên vượt xa Number.MAX_SAFE_INTEGER khi nhân, nên nếu đi qua số dấu phẩy động thì
 * sai số xuất hiện trước cả khi so sánh. Đây chính là chỗ BigInt phải chứng minh giá trị.
 *
 * ==============================================================================
 * BA TRỤC RẼ NHÁNH (K1) — đều tra bảng theo DỮ LIỆU, không có if theo tc_id
 * ==============================================================================
 *   1. Trạng thái đăng nhập  -> cột login_as, một biểu thức ba ngôi duy nhất.
 *   2. Nguồn của chuỗi mã    -> cột code_mode, bảng CODE_RESOLVERS.
 *   3. Kết cục kỳ vọng       -> cột expected_outcome, bảng OUTCOME_ASSERTIONS.
 * Trục "coupon seed hay tạo động" đã BIẾN MẤT khỏi spec: mọi ca cần coupon đều tạo động, vì
 * bảng coupon_usage là dữ liệu thật tồn tại qua các lần chạy. Trục đó co lại thành "có tạo hay
 * không", và câu trả lời nằm ở chỗ cột coupon có null hay không.
 *
 * Cột seed_code là cột TRƠ: nó chỉ xuất hiện trong tiêu đề test và annotation. Không một nhánh
 * nào trong file này đọc nó để quyết định hành vi.
 */
// Lấy CẢ kiểu lẫn giá trị từ '../src/fixtures', không lấy gì trực tiếp từ gói Playwright.
// Không phải vì import chỉ-kiểu có hại — nó bị xoá lúc biên dịch nên vô hại — mà vì quy tắc
// "mọi spec phải đi qua fixture để network guard được cài" cần kiểm được bằng máy: một lần grep
// tên gói trong thư mục tests/ trả về 0 kết quả chính là bằng chứng đó. Quy tắc chỉ kiểm được
// bằng mắt thì sớm muộn cũng bị vi phạm. Vì cùng lý do, comment này cố tình không viết ra tên
// gói — nếu viết, chính nó sẽ làm phép kiểm trả về khác 0 và vô hiệu hoá bằng chứng.
import type { Locator, TestInfo } from '../src/fixtures';
import { test as base, expect, logRunHeader } from '../src/fixtures';
import { loadJson } from '../src/utils/data-loader';
import { loginViaApi } from '../src/utils/api';
import {
  buildCouponCode,
  createCoupon,
  deleteCoupon,
  recordCouponUsage,
  type CreatedCoupon,
} from '../src/utils/coupon-api';
import { CheckoutCouponPage, type Fr09Case, type Fr09Coupon } from '../src/pages/checkout-coupon.page';
import {
  ONE_DONG,
  absMilli,
  exactDiscountMilli,
  isVnGrouped,
  isWholeDong,
  milliToPlain,
  parseDecimalData,
} from '../src/utils/money';

const CASES = loadJson<Fr09Case>('fr09-coupon.json');

/** Ngưỡng bắt buộc phải phân nhóm hàng nghìn theo vi-VN: từ 1000 đồng trở lên. */
const GROUPING_THRESHOLD = 1000n * ONE_DONG;

interface CouponPool {
  create(tcId: string, params: Fr09Coupon): Promise<CreatedCoupon>;
  seedUses(coupon: CreatedCoupon, times: number, userToken: string): Promise<void>;
}

/**
 * Fixture quản lý vòng đời coupon (P2).
 *
 * Cơ chế dọn dẹp: phần code SAU `await use(pool)` là teardown của fixture, và Playwright chạy nó
 * kể cả khi test đỏ VÀ kể cả khi test timeout — khác hẳn try/finally trong thân test, vốn có thể
 * bị bỏ qua khi test bị hủy giữa chừng.
 *
 * Vì sao là "pool" chứ không phải một coupon đơn: danh sách id chỉ được thêm vào khi thực sự tạo
 * thành công. DT3 và DT4 không tạo gì nên danh sách rỗng và vòng lặp teardown không chạy lần nào
 * — không có đường nào để một DELETE với id undefined xuất hiện trong log.
 *
 * Rác còn lại khi tiến trình bị giết đột ngột là chấp nhận được: mã coupon chứa RUN_TIMESTAMP nên
 * không bao giờ đụng UNIQUE của lần chạy sau, và bộ đếm lượt dùng của coupon mới luôn bắt đầu từ 0.
 * Teardown ở đây là vệ sinh, không phải điều kiện để suite đúng.
 */
const test = base.extend<{ couponPool: CouponPool }>({
  couponPool: async ({ request }, use) => {
    const createdIds: number[] = [];
    let adminToken: string | null = null;

    const adminAuth = async (): Promise<string> => {
      adminToken ??= (await loginViaApi(request, 'admin')).token;
      return adminToken;
    };

    await use({
      async create(tcId, params) {
        const created = await createCoupon(request, await adminAuth(), buildCouponCode(tcId), params);
        createdIds.push(created.id);
        return created;
      },
      async seedUses(coupon, times, userToken) {
        for (let i = 0; i < times; i += 1) {
          await recordCouponUsage(request, userToken, coupon.id);
        }
      },
    });

    // Chỉ có thể có coupon để xoá khi đã từng đăng nhập admin, nên hai điều kiện dưới đây luôn
    // đi cùng nhau. Kiểm tra tường minh thay vì ép kiểu, để một thay đổi sau này không âm thầm
    // gửi DELETE với token rỗng.
    const tokenForCleanup = adminToken;
    if (tokenForCleanup !== null) {
      for (const id of createdIds) {
        await deleteCoupon(request, tokenForCleanup, id);
      }
    }
  },
});

interface CaseContext {
  checkout: CheckoutCouponPage;
  row: Fr09Case;
  testInfo: TestInfo;
}

/**
 * Trục 2 — chuỗi mã được gõ vào ô lấy từ đâu.
 * 'generated_absent' dùng đúng công thức đặt tên của suite nhưng coupon KHÔNG được tạo, nên mã
 * chắc chắn không tồn tại trong database. Bền hơn hẳn một chuỗi "INVALID" cứng, vốn có thể vô
 * tình được ai đó tạo thật.
 */
const CODE_RESOLVERS: Record<Fr09Case['code_mode'], (row: Fr09Case, created: CreatedCoupon | null) => string> = {
  created: (row, created) => {
    if (created === null) {
      throw new Error(`[fr09] ${row.tc_id} khai code_mode="created" nhưng cột coupon lại là null.`);
    }
    return created.code;
  },
  generated_absent: (row) => buildCouponCode(`${row.tc_id}-ABSENT`),
  '<EMPTY>': () => '',
};

/**
 * Đọc AN TOÀN một phần tử có thể không tồn tại, chỉ để dựng chuỗi cho message.
 *
 * Vì sao count() rồi mới innerText: count() không auto-wait, nó trả về số phần tử khớp tại thời
 * điểm gọi và không bao giờ treo. Gọi thẳng innerText lên một phần tử vắng mặt sẽ chờ tới hết
 * timeout rồi ném TimeoutError — đúng cái lỗi mà toàn bộ đợt sửa này nhắm vào. Catch bọc ngoài
 * xử lý khe hẹp giữa hai lời gọi, khi phần tử bị gỡ đúng lúc.
 *
 * Hàm này CHỈ dùng cho message. Không một giá trị nào nó trả về được đem đi so sánh, vì "(không
 * hiển thị)" không phải một quan sát về SUT mà là một quan sát về chính phép đọc.
 */
async function peek(locator: Locator): Promise<string> {
  try {
    if ((await locator.count()) === 0) return '(không hiển thị)';
    return (await locator.innerText()).trim();
  } catch {
    return '(không đọc được)';
  }
}

/** Mô tả một số tiền cho message lỗi: vừa chuỗi nguyên văn trên màn hình, vừa giá trị đã bóc. */
function describeMoney(label: string, raw: string, milli: bigint): string {
  return `${label} đọc được: "${raw.trim()}" (= ${milliToPlain(milli)} đồng)`;
}

/**
 * Khẳng định số tiền giảm khớp công thức đặc tả.
 * Hai chế độ, và chế độ nào được chọn là do CHÍNH DỮ LIỆU quyết định (giá trị chính xác có rơi
 * vào số nguyên đồng hay không), chứ không do một cột cờ hay một danh sách tc_id.
 */
function assertDiscountMatchesFormula(actual: bigint, exact: bigint, raw: string, row: Fr09Case): void {
  const base = `${row.tc_id} — ${describeMoney('Tiết kiệm', raw, actual)}; công thức đặc tả cho ${milliToPlain(exact)} đồng`;

  if (isWholeDong(exact)) {
    // [A2] Giá trị chính xác là số nguyên đồng -> không có chỗ cho làm tròn -> khớp tuyệt đối.
    expect(actual, `${base}. Giá trị chính xác là số nguyên đồng nên phải khớp tuyệt đối.`).toBe(exact);
    return;
  }

  // [A2] Có phần thập phân -> đặc tả không quy định làm tròn -> chỉ ràng buộc sai lệch dưới 1 đồng.
  const diff = absMilli(actual - exact);
  expect(
    diff < ONE_DONG,
    `${base}. Sai lệch ${milliToPlain(diff)} đồng, vượt ngưỡng 1 đồng — tức SUT không chỉ làm tròn mà tính sai.`,
  ).toBe(true);
}

/** Ca được áp dụng thành công. */
async function assertAccepted({ checkout, row, testInfo }: CaseContext): Promise<void> {
  const status = await checkout.apply();
  testInfo.annotations.push({ type: 'http', description: `POST /api/apply-coupon -> ${status}` });

  if (row.coupon === null) {
    throw new Error(`[fr09] ${row.tc_id} kỳ vọng áp dụng được nhưng không có tham số coupon nào.`);
  }

  // Đọc AN TOÀN, chỉ để dựng message. Khi ca này đỏ vì SUT từ chối mã, chính chuỗi lỗi của server
  // là câu trả lời cho "vì sao đỏ" — nhưng nó nằm ở phần tử có thể không tồn tại, nên phải đi qua
  // peek() chứ không qua getErrorText().
  const errorIfAny = await peek(checkout.errorMessage);

  // [A1] Mệnh đề chính, và nó phải đứng TRƯỚC mọi lời gọi đọc: khối kết quả thành công hiện diện.
  // Nếu SUT từ chối mã, test đỏ ngay tại đây kèm nguyên văn lý do — thay vì đỏ muộn hơn bằng một
  // TimeoutError của innerText, vốn không mang theo thông tin gì.
  await expect(
    checkout.successNotice,
    `${row.tc_id} (${row.condition_under_test}) — không thấy dòng "Áp dụng thành công" dù đặc tả cho phép áp mã này. Thông báo lỗi trên màn hình: "${errorIfAny}"`,
  ).toBeVisible();

  // [A1] Hai dòng số tiền phải hiện diện. Đây vừa là một khẳng định thật (khối kết quả theo đặc tả
  // gồm cả Tiết kiệm lẫn Thành tiền), vừa là hàng rào bảo đảm cho bốn lời gọi đọc ngay sau đó.
  await expect(
    checkout.savedAmount,
    `${row.tc_id} — khối kết quả thành công thiếu dòng "Tiết kiệm"`,
  ).toBeVisible();
  await expect(
    checkout.finalAmount,
    `${row.tc_id} — khối kết quả thành công thiếu dòng "Thành tiền"`,
  ).toBeVisible();

  // [A1] Chiều âm: không được đồng thời hiện thông báo lỗi. Thiếu vế này thì một giao diện hiện
  // cả hai khối cùng lúc vẫn xanh.
  await expect(
    checkout.errorMessage,
    `${row.tc_id} — vẫn còn thông báo lỗi "${errorIfAny}" trong khi mã đã được áp dụng thành công`,
  ).toBeHidden();

  // Từ đây trở xuống mọi phần tử được đọc đều đã có assertion bảo đảm tồn tại.
  const savedRaw = await checkout.savedAmount.innerText();
  const finalRaw = await checkout.finalAmount.innerText();
  const grandRaw = await checkout.getGrandTotalRaw();
  const saved = await checkout.getSavedMilli();
  const finalShown = await checkout.getFinalMilli();
  const grandShown = await checkout.getGrandTotalMilli();
  const total = parseDecimalData(row.order_total);
  const exact = exactDiscountMilli(row.coupon.type, row.coupon.discount_value, row.order_total);

  testInfo.annotations.push({
    type: 'tiền hiển thị',
    description: `Tiết kiệm "${savedRaw.trim()}" | Thành tiền "${finalRaw.trim()}" | Tổng thanh toán "${grandRaw}"`,
  });
  if (row.rounding_sensitive) {
    testInfo.annotations.push({
      type: 'giá trị chính xác',
      description: `Công thức đặc tả cho discount = ${milliToPlain(exact)} đồng (không làm tròn); đặc tả không quy định quy tắc làm tròn`,
    });
  }

  // [A2] Số tiền giảm so với công thức đặc tả.
  assertDiscountMatchesFormula(saved, exact, savedRaw, row);

  // [A3] Nhất quán nội tại thứ nhất: thành tiền phải bằng đúng tổng trừ đi số tiền giảm — tính
  // trên chính các con số ĐANG HIỂN THỊ. Không phụ thuộc quy ước làm tròn của SUT, nên đây là
  // ràng buộc mạnh nhất trong cả file mà vẫn không tự chế thêm điều gì.
  expect(
    finalShown,
    `${row.tc_id} — ${describeMoney('Thành tiền', finalRaw, finalShown)} nhưng tổng ${milliToPlain(total)} trừ ${describeMoney('tiết kiệm', savedRaw, saved)} phải ra ${milliToPlain(total - saved)} đồng. SUT làm tròn ở một chỗ mà quên chỗ kia`,
  ).toBe(total - saved);

  // [A3] Nhất quán nội tại thứ hai (P6): dòng Tổng thanh toán cuối trang và Thành tiền trong khối
  // kết quả do hai biểu thức khác nhau sinh ra. Một giao diện hiện hai con số khác nhau cho cùng
  // một đơn hàng là lỗi nghiêm trọng mà mọi assertion phía trên đều bỏ lọt.
  expect(
    grandShown,
    `${row.tc_id} — Tổng thanh toán "${grandRaw}" (= ${milliToPlain(grandShown)} đồng) lệch với Thành tiền "${finalRaw.trim()}" (= ${milliToPlain(finalShown)} đồng)`,
  ).toBe(finalShown);

  // [A6] Đặc tả nói mọi số tiền hiển thị qua toLocaleString, nên số từ 1000 đồng trở lên bắt buộc
  // có phân nhóm hàng nghìn. Điều kiện kích hoạt suy ra từ giá trị, không từ tc_id.
  if (absMilli(grandShown) >= GROUPING_THRESHOLD) {
    expect(
      isVnGrouped(grandRaw),
      `${row.tc_id} — Tổng thanh toán "${grandRaw}" không được phân nhóm hàng nghìn theo vi-VN`,
    ).toBe(true);
  }
}

/** Ca bị từ chối vì một trong các điều kiện C1..C5 không thoả. */
async function assertRejected({ checkout, row, testInfo }: CaseContext): Promise<void> {
  const status = await checkout.apply();
  testInfo.annotations.push({ type: 'http', description: `POST /api/apply-coupon -> ${status}` });

  // Đọc AN TOÀN, chỉ để dựng message cho assertion ngay bên dưới.
  const finalIfApplied = await peek(checkout.finalAmount);

  // [A1] Mệnh đề chính của mọi ca reject, và nó phải đứng ĐẦU TIÊN: mã KHÔNG được áp dụng.
  // Thứ tự này quan trọng chứ không tuỳ tiện — ở một ca như DT7, nếu khẳng định "có thông báo lỗi"
  // chạy trước thì test đỏ với thông điệp "thiếu thông báo lỗi", tức chẩn đoán sai vấn đề: điều
  // đặc tả bị vi phạm là mã đã được áp cho người chưa đăng nhập, không phải chuyện thiếu chữ.
  await expect(
    checkout.successNotice,
    `${row.tc_id} (${row.condition_under_test}) — mã ĐÃ ĐƯỢC ÁP DỤNG dù điều kiện này không thoả; khối kết quả hiển thị Thành tiền "${finalIfApplied}"`,
  ).toBeHidden();

  // [A1] Bằng chứng thứ hai, và nó KHÔNG thừa: chỉ kiểm "không có khối thành công" thì một giao
  // diện im lặng hoàn toàn — không giảm giá, cũng không nói gì — vẫn xanh, trong khi người dùng
  // không biết vì sao mã của mình bị từ chối. Hai mệnh đề bắt hai lớp lỗi khác nhau.
  await expect(
    checkout.errorMessage,
    `${row.tc_id} (${row.condition_under_test}) — mã bị từ chối nhưng không có thông báo lỗi nào giải thích lý do`,
  ).toBeVisible();

  // Từ đây trở xuống phần tử lỗi đã được bảo đảm tồn tại.
  const errorText = await checkout.getErrorText();
  const grandRaw = await checkout.getGrandTotalRaw();
  const grandShown = await checkout.getGrandTotalMilli();

  // (P4) Ghi nguyên văn thông báo kể cả khi test xanh. Đây là đầu vào của pha 2; không thu bây giờ
  // thì phải chạy lại toàn bộ suite trên cả ba browser chỉ để đọc lại mấy chuỗi này.
  testInfo.annotations.push({
    type: 'thông báo lỗi nguyên văn',
    description: `${row.condition_under_test} -> "${errorText}"`,
  });

  // [A4] Hiện diện thôi chưa đủ: một thẻ rỗng vẫn "visible". Nội dung phải khác rỗng.
  expect(
    errorText.length,
    `${row.tc_id} — phần tử thông báo lỗi tồn tại nhưng rỗng, người dùng không biết vì sao mã bị từ chối`,
  ).toBeGreaterThan(0);

  // [A4] (P3) Ràng buộc nội dung chỉ được áp dụng khi dữ liệu khai báo. Cân bằng ở đây:
  //  - Không khẳng định NGUYÊN VĂN thông báo, vì đặc tả không quy định câu chữ; làm vậy là biến
  //    một chuỗi tuỳ ý của lập trình viên thành hợp đồng và test sẽ đỏ mỗi lần sửa chính tả.
  //  - Nhưng đặc tả CÓ nói thông báo phải nêu rõ lý do. Nếu không kiểm gì, bốn ca reject vì bốn
  //    điều kiện khác nhau sẽ xanh như nhau kể cả khi server trả đúng một câu chung chung, và ta
  //    mất khả năng phân biệt C2 với C3 với C5 — tức mất chính thứ bộ test này sinh ra để đo.
  // Giải pháp: khẳng định một mẩu chuỗi ĐẶC TRƯNG CHO ĐIỀU KIỆN bị vi phạm, do đặc tả quy định
  // ngữ nghĩa chứ không chép từ SUT. Pha 1 để null nên nhánh này chưa kích hoạt; đọc trường ngay
  // từ bây giờ để pha 2 chỉ là điền dữ liệu, không phải sửa spec.
  if (row.error_must_contain !== null) {
    expect(
      errorText.toLowerCase(),
      `${row.tc_id} — thông báo "${errorText}" không nêu được lý do ứng với ${row.condition_under_test}`,
    ).toContain(row.error_must_contain.toLowerCase());
  }

  // [A2] Tổng thanh toán phải giữ nguyên: từ chối mà vẫn trừ tiền là lỗi nặng nhất có thể có ở đây.
  expect(
    grandShown,
    `${row.tc_id} — ${describeMoney('Tổng thanh toán', grandRaw, grandShown)} nhưng mã bị từ chối nên phải giữ nguyên ${row.expected_final} đồng`,
  ).toBe(parseDecimalData(row.expected_final));
}

/**
 * Ca không gửi được (P1, K5).
 *
 * Mệnh đề của đặc tả là "không áp được mã rỗng", và biểu hiện quan sát được trực tiếp nhất của nó
 * là KHÔNG CÓ REQUEST NÀO rời trình duyệt. Nút bị vô hiệu hoá chỉ là MỘT cách hiện thực mệnh đề
 * đó; một giao diện chặn bằng validation phía client, hoặc bằng cách bỏ qua sự kiện submit, vẫn
 * thoả đặc tả. Vì vậy trạng thái disabled được GHI LẠI vào annotation chứ không được nâng lên
 * thành assertion.
 *
 * Nhánh này không đi qua checkout.apply(): hàm đó chờ response của /api/apply-coupon, mà ở đây
 * không có request nào tồn tại để mà chờ — gọi vào sẽ treo tới hết timeout rồi đỏ với một thông
 * điệp về mạng, che mất đúng mệnh đề đang cần kiểm.
 */
async function assertBlocked({ checkout, row, testInfo }: CaseContext): Promise<void> {
  const sent: string[] = [];
  checkout.page.on('request', (req) => {
    if (/\/api\/apply-coupon/.test(req.url())) sent.push(req.url());
  });

  const disabledAtStart = await checkout.applyButton.isDisabled();
  testInfo.annotations.push({
    type: 'cách hiện thực (chỉ ghi nhận, không khẳng định)',
    description: `nút Áp dụng ${disabledAtStart ? 'bị vô hiệu hoá' : 'vẫn bật'} khi ô mã rỗng`,
  });

  // Thử gửi bằng cả hai đường người dùng thật có: phím Enter trong ô nhập (không phụ thuộc nút),
  // và bấm nút nếu nó đang bật. Nếu chỉ thử một đường thì "không gửi được" chưa được chứng minh.
  await checkout.codeInput.press('Enter');
  if (!disabledAtStart) {
    await checkout.applyButton.click();
  }

  // Chờ theo ĐIỀU KIỆN mạng lặng chứ không phải một khoảng thời gian cố định. Khẳng định về sự
  // vắng mặt luôn cần một cửa sổ quan sát; networkidle là cửa sổ mạnh nhất có được mà không vi
  // phạm quy ước cấm waitForTimeout.
  await checkout.page.waitForLoadState('networkidle');

  const grandRaw = await checkout.getGrandTotalRaw();
  const grandShown = await checkout.getGrandTotalMilli();

  // [A5] Mệnh đề chính của đặc tả, kiểm ở tầng giao thức nên độc lập hoàn toàn với cách hiện thực.
  expect(
    sent.length,
    `${row.tc_id} — mã rỗng nhưng vẫn có ${sent.length} request rời trình duyệt: ${sent.join(', ')}`,
  ).toBe(0);

  // [A1] Không có gì được áp dụng.
  await expect(
    checkout.successNotice,
    `${row.tc_id} — khối kết quả thành công hiển thị dù không có request nào được gửi`,
  ).toBeHidden();

  // [A2] Số tiền không đổi.
  expect(
    grandShown,
    `${row.tc_id} — ${describeMoney('Tổng thanh toán', grandRaw, grandShown)} nhưng không có mã nào được áp nên phải giữ nguyên ${row.expected_final} đồng`,
  ).toBe(parseDecimalData(row.expected_final));
}

/** Trục 3 — kết cục kỳ vọng. Bảng tra thay cho chuỗi if lồng nhau. */
const OUTCOME_ASSERTIONS: Record<Fr09Case['expected_outcome'], (ctx: CaseContext) => Promise<void>> = {
  accept: assertAccepted,
  reject: assertRejected,
  blocked: assertBlocked,
};

test.describe('FR-09 — Mã giảm giá trên trang thanh toán', () => {
  test.beforeAll(() => {
    logRunHeader('fr09');
  });

  for (const row of CASES) {
    const headline = row.description.split(';')[0];

    test(`${row.tc_id} [${row.seed_code}] — ${row.condition_under_test} — ${headline}`, async (
      { page, request, couponPool },
      testInfo,
    ) => {
      testInfo.annotations.push({
        type: 'truy vết HW02',
        description: `${row.tc_id} (${row.technique}, ${row.bva_role}) mô phỏng mã seed ${row.seed_code}`,
      });
      testInfo.annotations.push({ type: 'căn cứ đặc tả', description: row.spec_basis });
      testInfo.annotations.push({ type: 'nguồn oracle', description: row.oracle_source });

      // Trục 1 — trạng thái đăng nhập. Token lấy qua API vì đăng nhập KHÔNG phải đối tượng kiểm
      // thử của FR-09; đi qua form đăng nhập chỉ thêm một cách để test đỏ vì lý do không liên quan.
      const token = row.login_as === 'user' ? (await loginViaApi(request, 'user')).token : null;

      // Coupon luôn được tạo động khi ca cần một mã tồn tại — kể cả DT7 vốn chạy ở trạng thái đăng
      // xuất. Thiếu coupon ở DT7 thì một lần đỏ có thể giải thích bằng C1 thay vì C4, và ca đó mất
      // khả năng cô lập điều kiện.
      const created = row.coupon === null ? null : await couponPool.create(row.tc_id, row.coupon);

      if (row.pre_seeded_uses > 0) {
        if (created === null || token === null) {
          throw new Error(`[fr09] ${row.tc_id} cần seed lượt dùng nhưng thiếu coupon hoặc thiếu token.`);
        }
        await couponPool.seedUses(created, row.pre_seeded_uses, token);
      }

      testInfo.annotations.push({
        type: 'tiền đề đã dựng',
        description: `mã thật "${created?.code ?? '(không tạo coupon)'}" | lượt dùng seed sẵn ${row.pre_seeded_uses} | đăng nhập: ${row.login_as}`,
      });

      const checkout = new CheckoutCouponPage(page);
      // Phải đặt token TRƯỚC goto: trang đọc localStorage lúc mount, nên đặt sau thì lần render
      // đầu tiên vẫn ở trạng thái đăng xuất và ta kiểm nhầm điều kiện.
      await checkout.setAuthToken(token);
      await checkout.goto();

      await checkout.setOrderTotal(row.order_total);
      await checkout.enterCode(CODE_RESOLVERS[row.code_mode](row, created));

      await OUTCOME_ASSERTIONS[row.expected_outcome]({ checkout, row, testInfo });
    });
  }
});

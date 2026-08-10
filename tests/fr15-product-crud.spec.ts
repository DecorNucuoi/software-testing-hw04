/**
 * FR-15 — Admin Product CRUD (Thêm / Xem / Sửa / Xoá sản phẩm) trên Web Admin 5174.
 *
 * ==============================================================================
 * CÁC KIỂU ASSERTION DÙNG TRONG FILE NÀY (mỗi chỗ dùng đều được đánh dấu [Fn])
 * ==============================================================================
 * [F1] Web-first assertion trên LOCATOR — toBeVisible / toHaveCount.
 *      Tự thử lại tới khi đúng hoặc hết timeout. Dùng cho mọi mệnh đề về trạng thái giao diện,
 *      và đồng thời là HÀNG RÀO chốt sự tồn tại trước khi bất kỳ giá trị nào được đọc khỏi DOM.
 *
 * [F2] Giá trị đã trích xuất, so trên KHOÁ GIÁ chuẩn hoá (BigInt mili-đồng bên trong).
 *      Không có một hằng số tiền nào viết cứng trong file này; mọi giá đến từ /data.
 *
 * [F3] MỚI Ở FR-15 — ĐỐI CHIẾU CHÉO HAI NGUỒN ĐỘC LẬP (bảng trên giao diện ↔ GET /api/products),
 *      thực hiện bằng expect.poll trên một giá trị tính từ CẢ HAI nguồn trong cùng một vòng.
 *
 *      Vì sao FR-06/FR-09 không cần kiểu này mà FR-15 thì cần:
 *      FR-06 và FR-09 là các feature ĐỌC và TÍNH TOÁN — oracle của chúng là một con số suy ra
 *      được từ đặc tả, nên một nguồn là đủ. FR-09 có [A3] "nhất quán nội tại", nhưng đó là hai
 *      VỊ TRÍ HIỂN THỊ, cùng một nguồn sự thật là DOM.
 *      FR-15 là feature GHI. Sau khi bấm Lưu, tồn tại hai lớp lỗi mà không phép kiểm một-nguồn
 *      nào bắt được:
 *        (a) giao diện render lạc quan rồi nuốt lỗi HTTP — màn hình nói thành công, dữ liệu
 *            chưa bao giờ được ghi;
 *        (b) ghi thành công nhưng giao diện không refetch — dữ liệu đúng, màn hình cũ.
 *      Ở cả hai, phép kiểm chỉ-giao-diện và phép kiểm chỉ-API đều CÙNG XANH. Chỉ phép so hai
 *      nguồn với nhau mới đỏ. Vì lớp lỗi này không có lý do gì chỉ xuất hiện ở thao tác Sửa,
 *      [F3] chạy ở CẢ 24 ca, kể cả ca chỉ đọc và ca bị từ chối.
 *
 * [F4] MỚI Ở FR-15 — assertion trên ĐỐI TƯỢNG DIFF của TOÀN BỘ tập dữ liệu:
 *      expect(diff).toEqual({ added: [], removed: [], changed: [] }).
 *      Oracle ở đây không phải một giá trị mà là một mệnh đề về cả tập: "không có gì khác thay
 *      đổi". Diff duyệt HỢP các khoá hai phía nên nó bắt được cả trường ta không nghĩ tới —
 *      liệt kê tay từng trường chỉ bắt được đúng những gì người viết test đã tưởng tượng ra.
 *      FR-06/FR-09 không có mệnh đề nào thuộc loại này.
 *
 * [F5] MỚI Ở FR-15 — expect.soft, nhiều khẳng định ĐỘC LẬP trong một ca.
 *      Ca Sửa đổi cả tên lẫn giá, trên cả hai nguồn: bốn sự thật rời nhau. Với assertion cứng,
 *      tên sai sẽ dừng test và ta không bao giờ biết giá thế nào — "tên sai, giá đúng" và
 *      "cả hai sai" hiện ra y hệt trong report. Soft giữ đủ bốn phán quyết mà test vẫn đỏ.
 *
 * [F6] Cận số học — toBeGreaterThanOrEqual / toBeLessThanOrEqual.
 *      Dành cho ca quan sát DT9, nơi đặc tả im lặng nên không có con số kỳ vọng, chỉ có cận.
 *
 * ==============================================================================
 * BA TRỤC RẼ NHÁNH — tra bảng theo DỮ LIỆU, không có một if nào theo mã ca
 * ==============================================================================
 *   1. Thao tác   -> cột operation, bảng ACTIONS.
 *   2. Kết cục    -> cột expected.outcome, bảng SETTLERS và bảng ORACLES.
 *   3. Tiền đề    -> mảng fixtures rỗng hay không; vai trò target/witness đọc từ chính dữ liệu.
 * Các phép kiểm tuỳ chọn (danh mục trong form Sửa, cận số lần tạo, sản phẩm chứng) đều bật/tắt
 * bằng expected.checks — cũng là dữ liệu. Cột tc_id là cột TRƠ: nó chỉ xuất hiện trong tiêu đề
 * test, trong annotation và trong tiền tố tên sản phẩm.
 *
 * ==============================================================================
 * TRÌNH TỰ BẮT BUỘC QUANH PHÉP ĐỐI CHIẾU CHÉO
 * ==============================================================================
 *   thao tác -> chờ giao diện ổn định -> chụp CẢ HAI nguồn -> so  (KHÔNG reload ở giữa)
 *
 * Tải lại trang buộc ứng dụng đọc lại dữ liệu từ server. Nếu giao diện đang hiển thị lệch so
 * với dữ liệu thật, reload sẽ XOÁ SẠCH bằng chứng trước khi ta kịp ghi nhận. Vì vậy lần đối
 * chiếu thứ nhất luôn diễn ra trên đúng trạng thái mà người dùng thật đang nhìn thấy.
 *
 * Với riêng Sửa và Xoá, SAU KHI đã so xong, mới reload rồi so lần thứ hai. Cặp kết quả
 * (trước reload, sau reload) chính là bảng phân loại chẩn đoán:
 *   lệch trước / khớp sau  -> ghi thành công, giao diện không refetch (lỗi hiển thị).
 *   lệch trước / lệch sau  -> nghi ghi hỏng, hoặc bug ở tầng server.
 *   khớp trước / lệch sau  -> bất thường, nhiều khả năng có ghi nền sau khi ta đã đo.
 * Lần chụp thứ hai là bằng chứng BỔ SUNG. Nó không có quyền huỷ kết luận của lần thứ nhất:
 * phán quyết của lần thứ nhất được ghi bằng expect.soft nên nó đã đỏ rồi, và vẫn đỏ.
 */
import type { TestInfo } from '../src/fixtures';
import { test as base, expect, logRunHeader } from '../src/fixtures';
import { AdminProductsPage } from '../src/pages/admin-products.page';
import { ADMIN_TOKEN_KEY, AdminLoginPage, ensureAdminSession } from '../src/pages/admin-login.page';
import { priceKey, readAdminCellPrice, readExpectedPrice } from '../src/utils/admin-price';
import { getCategories } from '../src/utils/api';
import {
  buildName,
  loadFr15Data,
  type Fr15Case,
  type Fr15FixtureSpec,
  type Fr15Operation,
  type Fr15Outcome,
  type NameSpec,
  type PriceSpec,
} from '../src/utils/fr15-products';
import {
  EMPTY_DIFF,
  describeDiff,
  diffSnapshots,
  omitIds,
  projectApiByName,
  projectUiByName,
  takeApiSnapshot,
  type ApiSnapshot,
  type NameValueProjection,
  type ProductRecord,
} from '../src/utils/isolation-snapshot';
import { ProductFixture, type TrackedProduct } from '../src/utils/product-fixture';

const DATA = loadFr15Data();
const CASES = DATA.cases;

/**
 * Vòng lặp sinh test im lặng khi mảng rỗng: 0 test chạy, report xanh, không ai biết dữ liệu đã
 * biến mất. Ném ngay lúc collect để hỏng ồn ào. Không dùng expect vì đang ở ngoài phạm vi test.
 */
if (!Array.isArray(CASES) || CASES.length === 0) {
  throw new Error('[fr15] Không nạp được ca nào từ data/fr15-product-crud.json.');
}

/* ============================ TRẠNG THÁI GHI VÀO ANNOTATION ============================ */

interface CaseStats {
  uiCountBefore: number | null;
  uiCountAfter: number | null;
  apiCountBefore: number | null;
  apiCountAfter: number | null;
}

const show = (value: number | null): string => (value === null ? 'chưa đo được' : String(value));

/**
 * Hai fixture cục bộ. Cả hai dọn dẹp trong pha teardown nên chúng chạy KỂ CẢ khi test đỏ —
 * đúng lúc thông tin chẩn đoán có giá trị nhất.
 */
const test = base.extend<{ fixture: ProductFixture; stats: CaseStats }>({
  stats: async ({}, use, testInfo) => {
    const stats: CaseStats = {
      uiCountBefore: null,
      uiCountAfter: null,
      apiCountBefore: null,
      apiCountAfter: null,
    };
    await use(stats);
    testInfo.annotations.push({
      type: 'fr15-so-luong-san-pham',
      description:
        `bảng: trước=${show(stats.uiCountBefore)} sau=${show(stats.uiCountAfter)} | ` +
        `API: trước=${show(stats.apiCountBefore)} sau=${show(stats.apiCountAfter)}`,
    });
  },

  fixture: async ({ request }, use, testInfo) => {
    const productFixture = new ProductFixture(request);
    await use(productFixture);

    // Quét trước rồi mới liệt kê, để danh sách id bao gồm cả hàng do giao diện tạo ra mà test
    // đã đỏ trước khi kịp đăng ký. Đó chính là những hàng dễ bị bỏ quên nhất.
    await productFixture.adoptLeftovers();
    const created = productFixture.list();
    const report = await productFixture.cleanup({ sweepLeftovers: false });

    testInfo.annotations.push({
      type: 'fr15-id-do-test-nay-tao',
      description:
        created.length === 0
          ? 'không có sản phẩm nào'
          : created.map((p) => `#${p.id} ${p.origin} ${nameForMessage(p.name)}`).join(' ; '),
    });
    testInfo.annotations.push({
      type: 'fr15-don-dep',
      description:
        `đã xoá ${report.deleted.length}, thất bại ${report.failed.length}` +
        (report.refusedSeed.length > 0 ? `, TỪ CHỐI xoá id seed ${report.refusedSeed.join(', ')}` : ''),
    });
  },
});

test.beforeAll(() => {
  logRunHeader('fr15');
});

/* ============================ HÀM DỰNG THÔNG ĐIỆP ============================ */

/**
 * Tên dùng trong message.
 * Ca 254/255/256 ký tự KHÔNG được dán cả chuỗi vào report: một dòng lỗi dài 256 ký tự đệm làm
 * mọi thứ xung quanh không đọc được, mà thông tin thật sự cần lại chỉ là ĐỘ DÀI.
 */
function nameForMessage(name: string): string {
  if (name.length === 0) return '«tên rỗng»';
  if (name.length <= 40) return `"${name}"`;
  return `«tên dài ${name.length} ký tự, bắt đầu "${name.slice(0, 24)}…"»`;
}

/* ============================ ĐỌC KHAI BÁO TỪ DỮ LIỆU ============================ */

/** undefined = ô này KHÔNG được đụng tới; chuỗi rỗng = cố tình xoá trắng ô. */
function nameValue(spec: NameSpec | undefined, tcId: string): string | undefined {
  return spec === undefined ? undefined : buildName(spec, tcId);
}

function priceValue(spec: PriceSpec | undefined): string | undefined {
  if (spec === undefined) return undefined;
  return spec.kind === 'empty' ? '' : spec.text;
}

/** Khoá giá kỳ vọng, đi qua đúng lõi chuẩn hoá mà cả DOM lẫn API dùng. */
function expectedPriceKey(text: string): string {
  return priceKey(readExpectedPrice(text));
}

/* ============================ ĐỐI CHIẾU CHÉO [F3] ============================ */

/** Gom theo tên: một tên có thể ứng với nhiều hàng (DT9 bấm Lưu nhiều lần). */
function groupByName(rows: NameValueProjection[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.name) ?? [];
    bucket.push(row.price);
    grouped.set(row.name, bucket);
  }
  for (const bucket of grouped.values()) bucket.sort();
  return grouped;
}

/**
 * Danh sách bất đồng giữa hai nguồn. MỖI dòng in ra CẢ HAI phía — không bao giờ chọn bên nào
 * làm chuẩn, vì khi hai nguồn mâu thuẫn thì việc xác định bên nào sai là kết luận của người
 * đọc report, không phải của test.
 */
function crossCheckMismatches(ui: NameValueProjection[], api: NameValueProjection[]): string[] {
  const uiByName = groupByName(ui);
  const apiByName = groupByName(api);
  const names = [...new Set([...uiByName.keys(), ...apiByName.keys()])].sort();

  const mismatches: string[] = [];
  for (const name of names) {
    const inUi = uiByName.get(name);
    const inApi = apiByName.get(name);

    if (inUi === undefined) {
      mismatches.push(`${nameForMessage(name)} → BẢNG: không có | API: ${inApi?.length} bản ghi [${inApi?.join(', ')}]`);
      continue;
    }
    if (inApi === undefined) {
      mismatches.push(`${nameForMessage(name)} → BẢNG: ${inUi.length} hàng [${inUi.join(', ')}] | API: không có`);
      continue;
    }
    if (inUi.length !== inApi.length || inUi.some((price, index) => price !== inApi[index])) {
      mismatches.push(`${nameForMessage(name)} → BẢNG: [${inUi.join(', ')}] | API: [${inApi.join(', ')}]`);
    }
  }
  return mismatches;
}

interface CrossCheckResult {
  mismatches: string[];
  ui: NameValueProjection[];
  api: ApiSnapshot;
}

/**
 * Chụp cả hai nguồn và so, lặp lại tới khi khớp hoặc hết hạn.
 *
 * Kết quả của expect.poll bị NUỐT có chủ đích, và phán quyết được đưa ra ngay sau đó bằng
 * expect.soft. Lý do: ta cần đồng thời hai thứ mà một assertion cứng không cho cả hai —
 * (1) hành vi chờ-tới-khi-hội-tụ, để một khoảng render bất đồng bộ không bị báo cáo nhầm
 *     thành lỗi dữ liệu;
 * (2) việc thực thi ĐI TIẾP kể cả khi đã lệch, để lần chụp sau reload vẫn được thu thập —
 *     không có nó thì hai chẩn đoán "ghi hỏng" và "không refetch" không tách được.
 * Soft vẫn làm test đỏ, nên không có phép kiểm nào bị nới lỏng ở đây.
 */
async function crossCheck(
  products: AdminProductsPage,
  request: Parameters<typeof takeApiSnapshot>[0],
  timeoutMs = 7_000,
): Promise<CrossCheckResult> {
  let last: CrossCheckResult = { mismatches: ['chưa đọc được nguồn nào'], ui: [], api: { source: 'api-list', records: [] } };

  await expect
    .poll(
      async () => {
        // Đọc bảng trước, API sau: nếu còn ghi đang bay, vòng lặp sau sẽ bắt kịp.
        const uiSnapshot = await products.readTable();
        const apiSnapshot = await takeApiSnapshot(request);
        const ui = projectUiByName(uiSnapshot);
        const api = projectApiByName(apiSnapshot);
        last = { mismatches: crossCheckMismatches(ui, api), ui, api: apiSnapshot };
        return last.mismatches.length;
      },
      { timeout: timeoutMs, intervals: [100, 200, 300, 500, 1_000] },
    )
    .toBe(0)
    .catch(() => {
      /* phán quyết do expect.soft ngay phía dưới đưa ra — xem chú thích của hàm */
    });

  return last;
}

/* ============================ BẢNG THAO TÁC (TRỤC 1) ============================ */

interface ActContext {
  products: AdminProductsPage;
  testCase: Fr15Case;
  categoryValue: string;
  targetName: string | null;
  /** Khoá giá của sản phẩm mục tiêu TRƯỚC thao tác — mốc để khẳng định "ô không đụng tới thì không đổi". */
  targetPriceKey: string | null;
}

interface ActResult {
  /** Tên mà thao tác cố gắng ghi vào hệ thống. Chuỗi rỗng là một giá trị hợp lệ ở đây. */
  attemptedName: string;
  /** Khoá giá kỳ vọng nếu thao tác thành công. null khi ca không đặt giá. */
  attemptedPriceKey: string | null;
  /** Báo cáo của (các) lần bấm Lưu. Rỗng với thao tác không qua form. */
  submits: Awaited<ReturnType<AdminProductsPage['submitForm']>>[];
}

const ACTIONS: Record<Fr15Operation, (ctx: ActContext) => Promise<ActResult>> = {
  create: async ({ products, testCase, categoryValue }) => {
    const name = nameValue(testCase.input.name, testCase.tc_id) ?? '';
    const price = priceValue(testCase.input.price) ?? '';

    await products.fillProductForm({
      name,
      price,
      imageUrl: DATA.meta.defaults.image_url,
      description: DATA.meta.defaults.description,
      categoryId: categoryValue,
    });

    // repeat_submit nằm trong DỮ LIỆU, không phải trong code. Mặc định 1 lần.
    const clicks = testCase.input.repeat_submit ?? 1;
    const submits = [];
    for (let index = 0; index < clicks; index += 1) {
      submits.push(await products.submitForm());
    }
    return { attemptedName: name, attemptedPriceKey: expectedPriceKey(price), submits };
  },

  read: async ({ targetName, targetPriceKey }) => ({
    // Ca Xem không ghi gì; "attempted" ở đây là sản phẩm đang được xem.
    attemptedName: targetName ?? '',
    attemptedPriceKey: targetPriceKey,
    submits: [],
  }),

  update: async ({ products, testCase, targetName, targetPriceKey }) => {
    await products.clickEditFor(targetName ?? '');

    const newName = nameValue(testCase.input.update?.name, testCase.tc_id);
    const newPrice = priceValue(testCase.input.update?.price);
    await products.fillProductForm({ name: newName, price: newPrice });

    const submits = [await products.submitForm()];
    return {
      // Trường vắng mặt nghĩa là ô đó không đổi, nên tên/giá kỳ vọng lùi về giá trị cũ.
      // Đây là một khẳng định có ích chứ không phải mặc định cho qua: DT13 chỉ đổi giá, và
      // việc TÊN phải giữ nguyên cũng là một phần của mệnh đề "chỉ thứ được sửa mới đổi".
      attemptedName: newName ?? targetName ?? '',
      attemptedPriceKey: newPrice === undefined ? targetPriceKey : expectedPriceKey(newPrice),
      submits,
    };
  },

  delete: async ({ products, targetName }) => {
    // Nút Xóa xoá thẳng, không có hộp thoại xác nhận — nên không có bước xác nhận nào ở đây.
    await products.clickDeleteFor(targetName ?? '');
    return { attemptedName: targetName ?? '', attemptedPriceKey: null, submits: [] };
  },
};

/* ============================ CHỜ ỔN ĐỊNH (TRỤC 2, phần 1) ============================ */

interface OracleContext extends ActContext {
  act: ActResult;
  before: ApiSnapshot;
  uiCountBefore: number;
  target: TrackedProduct | null;
  witness: TrackedProduct | null;
  fixture: ProductFixture;
  request: Parameters<typeof takeApiSnapshot>[0];
  testInfo: TestInfo;
}

/**
 * Chờ giao diện ổn định TRƯỚC khi đối chiếu chéo.
 *
 * Không có waitForTimeout nào: mỗi kết cục có một mệnh đề riêng để chờ, và mệnh đề đó tự nó
 * là một assertion có auto-retry. Nếu bỏ bước này mà đối chiếu ngay, cả hai nguồn cùng chưa
 * cập nhật sẽ "khớp nhau" một cách vô nghĩa và [F3] mất tác dụng.
 */
const SETTLERS: Record<Fr15Outcome, (ctx: OracleContext) => Promise<void>> = {
  accepted: async ({ products, testCase, act }) => {
    const expectedRows = testCase.operation === 'delete' ? 0 : 1;
    // [F1]
    await expect(
      products.getRowFor(act.attemptedName),
      `${act.attemptedName === '' ? '«tên rỗng»' : nameForMessage(act.attemptedName)}: bảng phải có ` +
        `đúng ${expectedRows} hàng sau thao tác ${testCase.operation}`,
    ).toHaveCount(expectedRows);
  },

  /*
   * Ca bị từ chối KHÔNG có mệnh đề "chờ tới khi X xuất hiện" — thứ đáng chờ là sự VẮNG MẶT, mà
   * vắng mặt thì đúng ngay từ mili-giây đầu và một assertion auto-retry sẽ pass tức thì, tức là
   * không chờ gì cả. Nên ở đây chờ dữ liệu NGỪNG THAY ĐỔI, giống ca quan sát.
   *
   * Cố ý KHÔNG đặt phán quyết nào vào bước chờ: nếu SUT lỡ tạo hàng, một assertion cứng ở đây
   * sẽ dừng test với thông điệp "số hàng phải giữ nguyên N" — đúng nhưng cùn — và ta không bao
   * giờ tới được thông điệp sắc hơn nằm trong ORACLES ("SUT chấp nhận giá rỗng, trái với
   * <câu đặc tả>"). Bước chờ chỉ để chờ; phán quyết dồn hết về một chỗ, theo đúng thứ tự.
   */
  rejected: async ({ request }) => waitForApiSettle(request),

  observe: async ({ request }) => waitForApiSettle(request),
};

/**
 * Chờ dữ liệu ngừng thay đổi: hai lần đọc liên tiếp cho kết quả giống nhau.
 * Không đoán trước SUT sẽ chấp nhận hay từ chối, nên dùng được cho cả ca bị từ chối lẫn ca quan
 * sát. Không ném: không hội tụ tự nó sẽ lộ ra ở phép đối chiếu chéo phía sau.
 */
async function waitForApiSettle(
  request: Parameters<typeof takeApiSnapshot>[0],
  timeoutMs = 7_000,
): Promise<void> {
  let previous = '';
  await expect
    .poll(
      async () => {
        const current = JSON.stringify(
          (await takeApiSnapshot(request)).records.map((r) => `${r.id}|${r.fields.name}|${r.fields.price}`),
        );
        const stable = current === previous;
        previous = current;
        return stable;
      },
      { timeout: timeoutMs, intervals: [200, 200, 300, 500, 1_000] },
    )
    .toBe(true)
    .catch(() => {
      /* xem chú thích của hàm */
    });
}

/* ============================ ORACLE THEO KẾT CỤC (TRỤC 2, phần 2) ============================ */

/** Tìm các bản ghi API theo tên. Dùng sau khi [F1] đã chốt sự tồn tại phía giao diện. */
function apiRecordsNamed(snapshot: ApiSnapshot, name: string): ProductRecord[] {
  return snapshot.records.filter((record) => record.fields.name === name);
}

/**
 * Khẳng định sản phẩm chứng KHÔNG đổi, RIÊNG RẼ trên hai nguồn.
 *
 * Cố ý không gộp vào phép so diff toàn bảng: diff đã phủ nó rồi, nhưng khi đỏ, diff nói
 * "một bản ghi nào đó đã đổi" chứ không nói "sản phẩm chứng đã đổi". Hai assertion riêng ở đây
 * làm report chỉ thẳng vào mệnh đề cô lập của đặc tả.
 */
async function assertWitnessUnchanged(ctx: OracleContext, after: CrossCheckResult): Promise<void> {
  const { witness, products } = ctx;
  if (witness === null) return;

  const beforeRecord = ctx.before.records.find((r) => r.id === witness.id);
  const afterRecord = after.api.records.find((r) => r.id === witness.id);

  const uiRows = await products.readRows(witness.name);
  const uiPrice = uiRows.length === 1 ? uiPriceKeyOf(uiRows[0].priceRaw) : `«${uiRows.length} hàng»`;
  const apiPrice = afterRecord?.fields.price ?? '«không còn trong API»';
  const apiPriceBefore = beforeRecord?.fields.price ?? '«không có trước đó»';

  const bothSources = `BẢNG: ${uiPrice} | API trước: ${apiPriceBefore} | API sau: ${apiPrice}`;

  // [F1] [F5] Nguồn 1 — giao diện.
  await expect
    .soft(
      products.getRowFor(witness.name),
      `Sản phẩm chứng ${nameForMessage(witness.name)} phải còn đúng 1 hàng trên bảng. ${bothSources}`,
    )
    .toHaveCount(1);

  // [F2] [F5] Nguồn 2 — API. Hai phán quyết rời nhau: nếu một nguồn nói đổi còn nguồn kia nói
  // không, cả hai dòng đều hiện trong report và message của mỗi dòng in cả hai phía.
  expect
    .soft(afterRecord?.fields, `Sản phẩm chứng #${witness.id} không được đổi ở API. ${bothSources}`)
    .toEqual(beforeRecord?.fields);
}

function uiPriceKeyOf(priceRaw: string): string {
  return priceKey(readAdminCellPrice(priceRaw));
}

/**
 * Khẳng định TỪNG TRƯỜNG, trên TỪNG NGUỒN, bằng expect.soft [F5].
 * Bốn phán quyết rời nhau cho một thao tác Sửa đổi hai trường — xem [F5] ở đầu file.
 */
async function assertSubjectFields(
  ctx: OracleContext,
  after: CrossCheckResult,
  uiRow: { name: string; priceRaw: string } | null,
): Promise<void> {
  const { act } = ctx;
  const apiRecords = apiRecordsNamed(after.api, act.attemptedName);
  const apiRecord = apiRecords.length === 1 ? apiRecords[0] : null;

  const uiName = uiRow === null ? '«không đọc được hàng»' : uiRow.name;
  const uiPrice = uiRow === null ? '«không đọc được hàng»' : uiPriceKeyOf(uiRow.priceRaw);
  const apiName = apiRecord === null ? `«${apiRecords.length} bản ghi khớp tên»` : apiRecord.fields.name;
  const apiPrice = apiRecord === null ? `«${apiRecords.length} bản ghi khớp tên»` : apiRecord.fields.price;
  const bothSources = `BẢNG: name=${nameForMessage(uiName)} price=${uiPrice} | API: name=${nameForMessage(apiName)} price=${apiPrice}`;

  // [F5] Tên — nguồn giao diện.
  expect
    .soft(uiName, `Tên trên BẢNG phải là ${nameForMessage(act.attemptedName)}. ${bothSources}`)
    .toBe(act.attemptedName);

  // [F5] Tên — nguồn API.
  expect
    .soft(apiName, `Tên ở API phải là ${nameForMessage(act.attemptedName)}. ${bothSources}`)
    .toBe(act.attemptedName);

  if (act.attemptedPriceKey !== null) {
    // [F2] [F5] Giá — nguồn giao diện.
    expect
      .soft(uiPrice, `Giá trên BẢNG phải là ${act.attemptedPriceKey}. ${bothSources}`)
      .toBe(act.attemptedPriceKey);

    // [F2] [F5] Giá — nguồn API.
    expect
      .soft(apiPrice, `Giá ở API phải là ${act.attemptedPriceKey}. ${bothSources}`)
      .toBe(act.attemptedPriceKey);
  }
}

const ORACLES: Record<Fr15Outcome, (ctx: OracleContext, after: CrossCheckResult) => Promise<void>> = {
  accepted: async (ctx, after) => {
    const { products, testCase, act } = ctx;

    if (testCase.operation === 'delete') {
      // [F1] Hàng đã biến mất khỏi bảng — đã chốt ở SETTLERS, khẳng định lại ở API.
      const stillThere = apiRecordsNamed(after.api, act.attemptedName);
      expect(
        stillThere.map((r) => r.id),
        `Sau khi xoá, API không được còn bản ghi nào tên ${nameForMessage(act.attemptedName)}`,
      ).toEqual([]);
    } else {
      // Chỉ đọc giá trị SAU KHI [F1] ở SETTLERS đã bảo đảm hàng tồn tại đúng 1.
      const uiRow = await products.readRow(act.attemptedName);
      await assertSubjectFields(ctx, after, uiRow);
    }

    await assertWitnessUnchanged(ctx, after);
  },

  rejected: async (ctx, after) => {
    const { products, act, uiCountBefore } = ctx;

    /*
     * S3 — CẦN CẢ HAI BẰNG CHỨNG, và đây là lý do từng cái một là chưa đủ:
     *
     *  - Chỉ kiểm "không có hàng nào mang tên đã nhập": bỏ lọt trường hợp SUT vẫn tạo bản ghi
     *    nhưng dưới một cái tên khác — cắt ngắn, trim, chuẩn hoá ký tự. Hàng rác vẫn sinh ra,
     *    và test báo xanh.
     *  - Chỉ kiểm "tổng số hàng không đổi": bỏ lọt trường hợp SUT vừa tạo một hàng vừa mất một
     *    hàng khác, hoặc đổi tên một hàng có sẵn thành tên vừa nhập. Tổng vẫn khớp, dữ liệu đã hỏng.
     * Hai phép kiểm bù đúng điểm mù của nhau; cộng thêm [F4] trên diff toàn bảng thì không còn
     * đường nào để một thao tác ghi lọt qua mà không bị nhìn thấy.
     */

    // [F1] Bằng chứng 1 — không có hàng nào mang tên đã nhập.
    // Đây là mệnh đề SẮC NHẤT của ca, nên nó đứng đầu và nó nhắc luôn câu đặc tả bị vi phạm:
    // người đọc report thấy ngay "SUT chấp nhận giá rỗng" chứ không phải một bất biến chung.
    if (act.attemptedName !== '') {
      await expect(
        products.getRowFor(act.attemptedName),
        `Đặc tả: ${ctx.testCase.spec_basis} — nên thao tác phải bị từ chối và bảng không được ` +
          `có hàng nào tên ${nameForMessage(act.attemptedName)}`,
      ).toHaveCount(0);
    }

    // [F1] Bằng chứng 1b — cắt ngắn âm thầm là một kiểu "từ chối" giả: tên 256 ký tự bị lưu
    // thành 255. Chỉ ca có tên vượt giới hạn mới cần phép kiểm này, và điều kiện lấy từ dữ liệu.
    if (act.attemptedName.length > DATA.meta.name_limit_chars) {
      const truncated = act.attemptedName.slice(0, DATA.meta.name_limit_chars);
      await expect(
        products.getRowFor(truncated),
        `Không được xuất hiện hàng nào mang ${DATA.meta.name_limit_chars} ký tự đầu của tên đã nhập ` +
          `(${nameForMessage(truncated)}) — đó là dấu hiệu SUT cắt ngắn rồi lưu thay vì từ chối`,
      ).toHaveCount(0);
    }

    // [F1] Bằng chứng 2 — tổng số hàng không đổi.
    await expect(
      products.getAllRows(),
      `Đặc tả: ${ctx.testCase.spec_basis} — thao tác bị từ chối thì tổng số hàng phải giữ nguyên ${uiCountBefore}`,
    ).toHaveCount(uiCountBefore);

    await assertWitnessUnchanged(ctx, after);
  },

  observe: async (ctx, after) => {
    const { act, testCase, testInfo, before } = ctx;
    const createdNow = apiRecordsNamed(after.api, act.attemptedName);

    if (testCase.expected.checks.includes('at-least-one-created')) {
      // [F6] Cận dưới — suy ra từ đặc tả: đầu vào hợp lệ thì phải lưu được.
      expect(
        createdNow.length,
        `Đầu vào hợp lệ nên phải có ít nhất 1 sản phẩm được tạo. Thực tế: ${createdNow.length}`,
      ).toBeGreaterThanOrEqual(1);
    }

    if (testCase.expected.checks.includes('created-count-le-clicks')) {
      const clicks = testCase.input.repeat_submit ?? 1;
      // [F6] Cận trên — tạo nhiều hơn số lần bấm là hành vi không cách nào biện minh được.
      expect(
        createdNow.length,
        `Đã bấm Lưu ${clicks} lần, không được tạo ra nhiều hơn ${clicks} sản phẩm. ` +
          `Thực tế: ${createdNow.length} (ids: ${createdNow.map((r) => r.id).join(', ') || 'không có'})`,
      ).toBeLessThanOrEqual(clicks);
    }

    // Đặc tả im lặng nên phần còn lại chỉ được GHI LẠI, không được biến thành pass/fail.
    const uiRows = await ctx.products.readRows(act.attemptedName);
    testInfo.annotations.push({
      type: 'fr15-quan-sat',
      description:
        `kết cục=${createdNow.length > 0 ? 'được chấp nhận' : 'bị từ chối'} | ` +
        `số bản ghi tạo ra=${createdNow.length} | ids=${createdNow.map((r) => r.id).join(', ') || 'không có'} | ` +
        `giá ở API=${createdNow.map((r) => r.fields.price).join(', ') || 'không có'} | ` +
        `chuỗi giá trên BẢNG=${uiRows.map((r) => JSON.stringify(r.priceRaw)).join(', ') || 'không có'} | ` +
        `tổng số bản ghi trước=${before.records.length} sau=${after.api.records.length}`,
    });

    await assertWitnessUnchanged(ctx, after);
  },
};

/* ============================ VÒNG LẶP SINH TEST ============================ */

/** Thao tác cần lần đối chiếu thứ hai sau khi tải lại trang (W3). */
const RELOAD_AFTER: ReadonlySet<Fr15Operation> = new Set<Fr15Operation>(['update', 'delete']);

/**
 * Thao tác được PHÉP làm thay đổi sản phẩm mục tiêu.
 * Cố ý khai riêng chứ không dùng lại RELOAD_AFTER: hai tập tình cờ trùng nhau, nhưng chúng trả
 * lời hai câu hỏi khác nhau, và gộp lại thì một thay đổi ở tương lai sẽ âm thầm sai cả hai chỗ.
 */
const MUTATES_TARGET: ReadonlySet<Fr15Operation> = new Set<Fr15Operation>(['update', 'delete']);

for (const testCase of CASES) {
  const title = `${testCase.tc_id} — ${testCase.operation} — ${testCase.varied_factor}`;

  test(title, async ({ page, request, fixture, stats }, testInfo) => {
    testInfo.annotations.push({
      type: 'fr15-can-cu-dac-ta',
      description: `${testCase.technique} | biên: ${testCase.bva_role} | thẩm quyền oracle: ${testCase.oracle_source} | ${testCase.spec_basis}`,
    });

    /* --- 0. Giải danh mục theo VỊ TRÍ, không viết cứng id --- */
    const categories = await getCategories(request);
    // [F2] Tiền đề của cả feature: ràng buộc "chọn từ danh sách có sẵn" vô nghĩa nếu danh sách rỗng.
    expect(categories.length, 'SUT phải có sẵn ít nhất một danh mục').toBeGreaterThan(0);
    const categoryIdOf = (index: number): number => (categories[index] ?? categories[0]).id;
    const categoryValue = String(categoryIdOf(testCase.input.category?.index ?? 0));

    /* --- 1. Tiền đề: sản phẩm mục tiêu + sản phẩm chứng, tạo QUA API --- */
    const roles = new Map<Fr15FixtureSpec['role'], TrackedProduct>();
    const rolePriceKeys = new Map<Fr15FixtureSpec['role'], string>();
    for (const spec of testCase.fixtures) {
      const priceText = priceValue(spec.price) ?? '';
      const created = await fixture.createViaApi({
        name: buildName(spec.name, testCase.tc_id),
        price: priceText,
        categoryId: categoryIdOf(spec.category.index),
      });
      roles.set(spec.role, created);
      rolePriceKeys.set(spec.role, expectedPriceKey(priceText));
    }
    const target = roles.get('target') ?? null;
    const witness = roles.get('witness') ?? null;
    const targetPriceKey = rolePriceKeys.get('target') ?? null;

    /* --- 2. Vào trạng thái đã đăng nhập, KHẲNG ĐỊNH tiền đề, rồi mở tab Sản phẩm --- */
    const session = await ensureAdminSession(page, request);
    const products = new AdminProductsPage(page);
    const login = new AdminLoginPage(page);

    /*
     * ------------------------------------------------------------------------------
     * VÌ SAO PHẢI KHẲNG ĐỊNH TIỀN ĐỀ THAY VÌ NGẦM ĐỊNH
     *
     * ensureAdminSession() cố ý không assert: helper không được phán quyết thay ca kiểm thử.
     * Nhưng nếu spec cũng không assert thì phiên đăng nhập trở thành một giả định không ai kiểm,
     * và triệu chứng của nó là thứ tệ nhất có thể: thao tác đầu tiên chạm vào DOM sau đăng nhập
     * — cú bấm mục sidebar — chờ hết 10 giây rồi ném một thông điệp về locator, trong khi nguyên
     * nhân thật là trang chưa bao giờ rời màn hình Admin Login. Annotation ghi "chưa đo được"
     * vì test chết trước cả bước đếm sản phẩm.
     *
     * Ba assertion dưới đây chia một lỗi câm thành ba chẩn đoán tách bạch:
     *   - token rỗng            -> phản hồi của POST /api/login đã đổi hình dạng;
     *   - còn form Admin Login  -> phiên chưa được thiết lập (token sai, hoặc ứng dụng đòi thêm
     *                              state ngoài token);
     *   - hết form nhưng không thấy mục sidebar -> cấu trúc sidebar đã đổi, KHÔNG phải lỗi phiên.
     * Trước đây cả ba cho cùng một triệu chứng.
     * ------------------------------------------------------------------------------
     */

    // [F2] Tiền đề 0 — token phải là chuỗi không rỗng.
    expect(
      session.token,
      'POST /api/login không trả về token dùng được cho tài khoản admin',
    ).toBeTruthy();

    // [F1] Tiền đề 1 — đã rời khỏi màn hình đăng nhập.
    await expect(
      login.heading,
      `Phiên admin CHƯA được thiết lập: trang vẫn đang ở form "Admin Login". Token được nạp vào ` +
        `localStorage key "${ADMIN_TOKEN_KEY}" (KHÁC key "token" của storefront 5173) bằng ` +
        'addInitScript chạy TRƯỚC page.goto. Vẫn thấy form này nghĩa là token không được chấp ' +
        'nhận, hoặc ứng dụng còn đòi thêm state khác ngoài token.',
    ).toHaveCount(0);

    // [F1] Tiền đề 2 — dấu hiệu chỉ có sau khi đăng nhập: mục sidebar "Sản phẩm".
    await expect(
      products.menuProducts,
      'Đã rời form đăng nhập nhưng không tìm thấy mục sidebar "Sản phẩm". Đây KHÔNG phải lỗi ' +
        'phiên mà nhiều khả năng là cấu trúc sidebar đã đổi — locator mong đợi một <li> có nội ' +
        'dung đúng bằng "Sản phẩm", nằm trong <ul> chứa "Đăng xuất".',
    ).toHaveCount(1);

    await products.gotoProductsTab();

    // [F1] Hai hàng rào chốt sự tồn tại TRƯỚC mọi lần đọc DOM ở phía dưới.
    await expect(products.pageHeading, 'Phải mở được tab Quản lý Sản phẩm').toBeVisible();
    await expect(products.productTable, 'Bảng sản phẩm phải hiển thị').toBeVisible();

    /* --- 3. Ảnh chụp TRƯỚC, từ cả hai nguồn --- */
    const before = await takeApiSnapshot(request);
    const uiCountBefore = await products.getRowCount();
    stats.apiCountBefore = before.records.length;
    stats.uiCountBefore = uiCountBefore;

    /* --- 4. Thao tác (trục 1) --- */
    const act = await ACTIONS[testCase.operation]({
      products,
      testCase,
      categoryValue,
      targetName: target?.name ?? null,
      targetPriceKey,
    });

    // Nhận nuôi ngay: sản phẩm do GIAO DIỆN tạo ra không có id trong tay test, và nếu một
    // assertion phía dưới đỏ trước khi teardown quét lại thì hàng đó dễ bị bỏ quên nhất.
    if (act.attemptedName !== '') {
      await fixture.adoptByName(act.attemptedName);
    }

    const ctx: OracleContext = {
      products,
      testCase,
      categoryValue,
      targetName: target?.name ?? null,
      targetPriceKey,
      act,
      before,
      uiCountBefore,
      target,
      witness,
      fixture,
      request,
      testInfo,
    };

    /* --- 5. Chờ ổn định, rồi CHỤP cả hai nguồn. TUYỆT ĐỐI KHÔNG reload trước bước này --- */
    await SETTLERS[testCase.expected.outcome](ctx);
    const first = await crossCheck(products, request);
    stats.apiCountAfter = first.api.records.length;
    stats.uiCountAfter = first.ui.length;

    // Ghi bằng chứng NGAY khi vừa đo, trước mọi phán quyết. Nếu một assertion cứng phía dưới
    // dừng test, annotation này vẫn còn trong report — dữ liệu đã đo không được phép mất chỉ vì
    // luồng thực thi kết thúc sớm.
    testInfo.annotations.push({
      type: 'fr15-doi-chieu-cheo-truoc-reload',
      description:
        first.mismatches.length === 0 ? 'hai nguồn khớp nhau' : first.mismatches.join(' ;; '),
    });

    /*
     * ------------------------------------------------------------------------------
     * THỨ TỰ PHÁN QUYẾT: mệnh đề RIÊNG của ca trước, bất biến CHUNG sau.
     *
     * Việc CHỤP đã xong ở trên và không có reload nào xen vào, nên yêu cầu W2 được giữ nguyên;
     * thứ dời xuống dưới chỉ là lúc PHÁN QUYẾT, không phải lúc đo.
     *
     * Vì sao thứ tự này đúng — để nó không bị đảo lại ở lần refactor sau:
     *   Một ca kiểm thử tồn tại để trả lời ĐÚNG MỘT câu hỏi. Với DT7 câu hỏi là "SUT có từ chối
     *   giá rỗng không". Phép đối chiếu chéo toàn bảng và phép so diff là BẤT BIẾN CHUNG — chúng
     *   đúng như nhau ở cả 24 ca và không nói gì riêng về câu hỏi của ca này.
     *   Khi cả hai cùng đỏ, dòng đầu tiên trong report quyết định người đọc hiểu chuyện gì. Đặt
     *   bất biến chung lên trước thì report mở đầu bằng "bảng và API không khớp" — đúng, nhưng
     *   nó là TRIỆU CHỨNG. Thông tin đắt nhất, "SUT chấp nhận giá rỗng, trái với ràng buộc
     *   'Giá: là số DƯƠNG (> 0)'", bị đẩy xuống dưới hoặc mất hẳn nếu một assertion cứng đã dừng
     *   test. Bất biến chung là lưới bắt những gì mệnh đề riêng bỏ lọt, nên nó phải đứng SAU;
     *   đưa lên trước là để cái lưới che mất con cá.
     * ------------------------------------------------------------------------------
     */

    /* --- 6. Mệnh đề RIÊNG của ca (trục 2) --- */
    await ORACLES[testCase.expected.outcome](ctx, first);

    /* --- 6b. Vẫn là mệnh đề riêng: cô lập ở mức tập dữ liệu [F4] --- */
    /*
     * Tập id được PHÉP thay đổi, suy ra từ dữ liệu chứ không từ mã ca:
     *   - kết cục "bị từ chối" -> KHÔNG id nào được phép đổi, kể cả sản phẩm mục tiêu. Một
     *     thao tác Sửa bị từ chối mà vẫn để lại dấu vết trên chính đối tượng nó định sửa thì
     *     vẫn là hỏng, nên tập này rỗng và diff phải rỗng trên TOÀN bảng.
     *   - kết cục khác -> chỉ những sản phẩm do thao tác này tạo ra, cộng sản phẩm mục tiêu
     *     nhưng CHỈ khi thao tác là Sửa/Xoá. Với ca Xem, sản phẩm mục tiêu cũng phải y nguyên.
     *   - sản phẩm chứng KHÔNG BAO GIỜ nằm trong tập này.
     */
    const touchedIds = new Set<number>();
    if (testCase.expected.outcome !== 'rejected') {
      for (const product of fixture.list()) touchedIds.add(product.id);
      if (target !== null && !MUTATES_TARGET.has(testCase.operation)) touchedIds.delete(target.id);
      if (witness !== null) touchedIds.delete(witness.id);
    }

    const isolationDiff = diffSnapshots(omitIds(before, touchedIds), omitIds(first.api, touchedIds));
    expect(
      isolationDiff,
      'Ngoài (các) sản phẩm mà ca này thao tác, không sản phẩm nào khác được thay đổi. ' +
        `Thực tế: ${describeDiff(isolationDiff)}`,
    ).toEqual(EMPTY_DIFF);

    /* --- 6c. Danh mục: bảng KHÔNG có cột danh mục nên phải mở form Sửa mà kiểm --- */
    if (testCase.expected.checks.includes('category-in-edit-form') && target !== null) {
      await products.clickEditFor(target.name);
      // [F1] Chốt form đã vào chế độ Sửa trước khi đọc giá trị của <select>.
      await expect(products.cancelEditButton, 'Form phải vào chế độ Sửa').toBeVisible();

      // ĐỌC giá trị đang được chọn, KHÔNG đặt lại nó. Phiên bản trước gọi selectCategory() ở đây,
      // tức tự đặt giá trị rồi tự đọc lại chính nó — phép kiểm luôn xanh và không bao giờ đỏ
      // được, kể cả khi SUT hiển thị sai danh mục hoàn toàn.
      const selected = await products.readSelectedCategory();
      const apiRecord = first.api.records.find((r) => r.id === target.id);
      // [F2] Danh mục hiển thị trong form phải khớp category_id mà API đang lưu.
      expect(
        selected,
        'Bảng không có cột danh mục nên form Sửa là chỗ duy nhất kiểm được "danh mục hiển thị đúng". ' +
          `FORM Sửa: ${selected} | API: ${apiRecord?.fields.category_id}`,
      ).toBe(apiRecord?.fields.category_id);
    }

    /* --- 7. BẤT BIẾN CHUNG, phán quyết SAU cùng: hai nguồn phải nói cùng một điều [F3] [F5] --- */
    // Soft để lần chụp sau reload vẫn được thu thập; test đã đỏ từ đây và không gì gỡ được.
    expect
      .soft(
        first.mismatches,
        'Bảng trên giao diện và GET /api/products phải nói cùng một điều NGAY SAU thao tác, ' +
          'chưa tải lại trang. Mỗi dòng dưới đây in cả hai phía; test không chọn bên nào làm chuẩn.',
      )
      .toEqual([]);

    /* --- 8. Ghi tầng chặn (chỉ là dữ kiện, không phải phán quyết) --- */
    if (act.submits.length > 0) {
      const layers = act.submits.map((submit, index) => {
        const invalid = submit.nativeValidityBefore.invalidFields
          .map((f) => `${f.placeholder}: ${f.validationMessage}`)
          .join(' / ');
        return submit.requestSent
          ? `lần ${index + 1}: TẦNG ỨNG DỤNG — ${submit.requestMethod} rời trình duyệt, HTTP ${submit.responseStatus}`
          : `lần ${index + 1}: TẦNG TRÌNH DUYỆT — không request nào rời trình duyệt` +
              (invalid === '' ? '' : `; ô không hợp lệ: ${invalid}`);
      });
      testInfo.annotations.push({ type: 'fr15-tang-chan', description: layers.join(' | ') });

      const frameworkErrors = act.submits
        .map((s) => s.frameworkError)
        .filter((message): message is string => message !== null);
      if (frameworkErrors.length > 0) {
        testInfo.annotations.push({ type: 'fr15-loi-khung-khi-bam', description: frameworkErrors.join(' || ') });
      }
    }

    /* --- 9. W3 — chỉ Sửa/Xoá: reload rồi so LẦN HAI, làm bằng chứng chẩn đoán --- */
    if (RELOAD_AFTER.has(testCase.operation)) {
      await page.reload();
      await products.gotoProductsTab();
      // [F1] Chốt lại sự tồn tại sau khi tải lại, trước khi đọc bất cứ thứ gì.
      await expect(products.productTable, 'Bảng phải hiển thị lại sau khi tải lại trang').toBeVisible();

      const second = await crossCheck(products, request);

      testInfo.annotations.push({
        type: 'fr15-chan-doan-truoc-va-sau-reload',
        description:
          `TRƯỚC reload: ${first.mismatches.length === 0 ? 'hai nguồn khớp' : first.mismatches.join(' ;; ')} || ` +
          `SAU reload: ${second.mismatches.length === 0 ? 'hai nguồn khớp' : second.mismatches.join(' ;; ')} || ` +
          `phân loại: ${classifyReloadEvidence(first.mismatches.length === 0, second.mismatches.length === 0)}`,
      });

      // [F3] [F5] Lệch sau khi tải lại cũng là bất đồng thật và phải đỏ — nhưng nó KHÔNG có
      // quyền huỷ kết luận của lần thứ nhất, vốn đã được ghi bằng một assertion riêng ở trên.
      expect
        .soft(
          second.mismatches,
          'Sau khi tải lại trang, bảng và GET /api/products vẫn phải nói cùng một điều. ' +
            `Phân loại chẩn đoán: ${classifyReloadEvidence(first.mismatches.length === 0, second.mismatches.length === 0)}`,
        )
        .toEqual([]);
    }
  });
}

/**
 * Bảng phân loại chẩn đoán dựng ở bước thiết kế, nay được in thẳng vào report để người đọc
 * không phải tự suy ra từ hai danh sách bất đồng.
 */
function classifyReloadEvidence(agreedBefore: boolean, agreedAfter: boolean): string {
  if (agreedBefore && agreedAfter) return 'không phát hiện bất đồng ở cả hai lần đo';
  if (!agreedBefore && agreedAfter) {
    return 'ghi dữ liệu THÀNH CÔNG nhưng giao diện không cập nhật lại sau thao tác (lỗi hiển thị / cache thiu)';
  }
  if (!agreedBefore && !agreedAfter) {
    return 'bất đồng vẫn còn sau khi đọc lại từ server — nghi ghi hỏng, hoặc bug ở tầng server';
  }
  return 'khớp trước reload nhưng lệch sau reload — bất thường, nhiều khả năng có ghi nền xảy ra sau lần đo thứ nhất';
}

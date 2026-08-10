/**
 * Vòng đời dữ liệu test của FR-15: tạo tiền đề, NHẬN NUÔI sản phẩm do giao diện tạo ra, và
 * xoá sạch mọi thứ khi kết thúc.
 *
 * ------------------------------------------------------------------------------
 * Bài toán khó nhất ở đây không phải là tạo, mà là XOÁ THỨ MÌNH KHÔNG BIẾT ID.
 *
 * Tiền đề của các ca Update/Delete được tạo qua API nên id có ngay trong phản hồi. Nhưng phần
 * lớn 24 ca là thao tác Create QUA GIAO DIỆN: test bấm "Lưu sản phẩm", SUT tự sinh id, và test
 * không có cách nào biết id đó ngoài việc đi hỏi lại. Nếu không hỏi lại, mỗi ca Create thành
 * công để lại một hàng vĩnh viễn — 3 browser x nhiều lần chạy là hàng trăm hàng.
 *
 * Cách tìm lại id: tên sản phẩm do test sinh ra là DUY NHẤT trong toàn hệ thống (tiền tố chứa
 * STUDENT_ID + RUN_STAMP + BROWSER_TAG + mã ca + vai trò). Sau khi thao tác giao diện kết thúc,
 * gọi GET /api/products và lọc theo tên đó — mọi hàng khớp đều là của ta. Hàm adoptByName()
 * trả về MẢNG chứ không phải một phần tử, vì DT9 (bấm Lưu 3 lần) có thể sinh nhiều hàng trùng
 * tên và bỏ sót hàng nào cũng là bỏ lại rác.
 *
 * BA LỚP DỌN DẸP, không lớp nào thay thế lớp nào:
 *   1. registry trong test  -> afterEach xoá theo id đã biết. Chạy cả khi test fail.
 *   2. adoptLeftovers()     -> ngay trước khi dọn, quét lại toàn bảng theo tiền tố của LẦN CHẠY
 *                              NÀY để bắt những hàng test tạo ra rồi fail trước khi kịp đăng ký.
 *   3. sweeper ở globalSetup-> lưới cuối cho trường hợp tiến trình bị giết.
 * ------------------------------------------------------------------------------
 */
import { URLS } from '../config';
import type { APIRequestContext } from '../fixtures';
import { createProduct, getProducts, type Product } from './api';
import {
  FR15_OWNER_PREFIX,
  SEEDED_PRODUCT_IDS,
  isOwnedByFr15,
  loadSweepExtraNames,
} from './fr15-products';

export interface ProductSpec {
  name: string;
  /** Luôn là CHUỖI: giá trị như 99999999999999999999999 không sống sót qua kiểu number. */
  price: string;
  categoryId: number;
  description?: string;
  imageUrl?: string;
}

export interface TrackedProduct {
  id: number;
  name: string;
  /** Nguồn gốc — đi vào report để phân biệt tiền đề với sản phẩm do chính thao tác kiểm thử sinh ra. */
  origin: 'api-fixture' | 'ui-adopted' | 'leftover-adopted';
}

export interface CleanupReport {
  deleted: number[];
  failed: number[];
  /** Hàng khớp tiền tố nhưng là sản phẩm seed — từ chối xoá, chỉ báo cáo. */
  refusedSeed: number[];
  /** Tên của những hàng phải nhặt thêm ở bước quét, tức chúng đã KHÔNG được đăng ký đúng lúc. */
  adoptedAtCleanup: string[];
}

export class ProductFixture {
  private readonly tracked = new Map<number, TrackedProduct>();
  private readonly extraExactNames: Set<string>;

  constructor(private readonly request: APIRequestContext) {
    this.extraExactNames = new Set(loadSweepExtraNames());
  }

  /** Danh sách đang theo dõi — để spec đính vào annotation khi cần chẩn đoán. */
  list(): TrackedProduct[] {
    return [...this.tracked.values()];
  }

  /** Đăng ký thủ công một id đã biết. */
  track(id: number, name: string, origin: TrackedProduct['origin']): TrackedProduct {
    const entry: TrackedProduct = { id, name, origin };
    this.tracked.set(id, entry);
    return entry;
  }

  /**
   * Tạo tiền đề qua API.
   *
   * Cố ý KHÔNG dùng form: nếu tiền đề của ca Update được dựng bằng chính chức năng Create đang
   * bị kiểm thử, một bug ở Create sẽ làm đỏ cả 5 ca Update/Delete và ta mất khả năng quy lỗi.
   */
  async createViaApi(spec: ProductSpec): Promise<TrackedProduct> {
    const id = await createProduct(this.request, {
      name: spec.name,
      price: spec.price,
      description: spec.description ?? '',
      imageUrl: spec.imageUrl ?? '',
      category_id: spec.categoryId,
    });
    return this.track(id, spec.name, 'api-fixture');
  }

  /**
   * Tìm lại id của (những) sản phẩm vừa được tạo QUA GIAO DIỆN, dựa trên tên duy nhất.
   * Trả về mảng: một lần bấm lặp có thể sinh nhiều hàng trùng tên, và bỏ sót hàng nào cũng là
   * bỏ lại rác.
   */
  async adoptByName(name: string): Promise<TrackedProduct[]> {
    const rows = await this.safeGetProducts();
    return rows
      .filter((row) => row.name === name && typeof row.id === 'number')
      .map((row) => this.track(row.id, row.name, 'ui-adopted'));
  }

  /**
   * Quét toàn bảng, nhận nuôi MỌI hàng mang dấu vết của lần chạy này mà chưa được đăng ký.
   *
   * Đây là lớp bắt lỗi cho tình huống thực tế nhất: thao tác giao diện đã tạo được hàng, rồi
   * một assertion phía sau đỏ, và test dừng trước khi kịp gọi adoptByName. Không có bước này,
   * đúng những lần chạy có bug lại là những lần để lại nhiều rác nhất.
   *
   * Lọc theo tiền tố của LẦN CHẠY NÀY (FR15_OWNER_PREFIX + dấu thời gian nằm trong tên), cộng
   * danh sách tên ngắn khai trong file dữ liệu cho BT2/BT3. An toàn với workers = 1: không có
   * test nào khác đang chạy song song để ta nhặt nhầm hàng của nó.
   */
  async adoptLeftovers(): Promise<TrackedProduct[]> {
    const rows = await this.safeGetProducts();
    const adopted: TrackedProduct[] = [];

    for (const row of rows) {
      if (typeof row.id !== 'number' || this.tracked.has(row.id)) continue;
      const mine = isOwnedByFr15(row.name) || this.extraExactNames.has(row.name);
      if (!mine) continue;
      adopted.push(this.track(row.id, row.name, 'leftover-adopted'));
    }
    return adopted;
  }

  /**
   * Dọn sạch. Mặc định quét thêm một lượt trước khi xoá.
   * KHÔNG NÉM: teardown mà ném sẽ che mất nguyên nhân thật của một test đang đỏ.
   */
  async cleanup(options: { sweepLeftovers?: boolean } = {}): Promise<CleanupReport> {
    const report: CleanupReport = { deleted: [], failed: [], refusedSeed: [], adoptedAtCleanup: [] };

    if (options.sweepLeftovers !== false) {
      const adopted = await this.adoptLeftovers();
      report.adoptedAtCleanup = adopted.map((p) => p.name);
    }

    for (const entry of this.tracked.values()) {
      // Chốt chặn cuối: dù đường nào dẫn tới đây, 5 sản phẩm seed không bao giờ bị xoá.
      if (SEEDED_PRODUCT_IDS.has(entry.id)) {
        report.refusedSeed.push(entry.id);
        continue;
      }
      try {
        const res = await this.request.delete(`${URLS.api}/api/products/${entry.id}`, {
          timeout: 5_000,
        });
        if (res.ok()) report.deleted.push(entry.id);
        else report.failed.push(entry.id);
      } catch {
        report.failed.push(entry.id);
      }
    }

    this.tracked.clear();
    return report;
  }

  /** GET /api/products nhưng không bao giờ ném — mọi lời gọi ở file này đều nằm trong teardown. */
  private async safeGetProducts(): Promise<Product[]> {
    try {
      const rows = await getProducts(this.request);
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }
}

/**
 * ĐIỀU GÌ CÒN SÓT LẠI NẾU TIẾN TRÌNH BỊ GIẾT GIỮA CHỪNG
 *
 * afterEach không chạy khi worker bị kill (Ctrl-C, mất điện, IDE đóng tiến trình). Lúc đó còn
 * lại đúng những hàng mà test ĐANG CHẠY vừa tạo: tối đa 2 sản phẩm tiền đề cộng số hàng do
 * thao tác giao diện sinh ra (nhiều nhất là 3, ở ca DT9). Nghĩa là tối đa khoảng 5 hàng, không
 * phải 24.
 *
 * Số hàng đó được dọn ở lần chạy KẾ TIẾP, bởi sweeper trong globalSetup:
 *   - hàng có tên sinh theo template  -> khớp tiền tố, bị xoá;
 *   - hàng tên "~" / "~~" của BT2/BT3 -> khớp danh sách tên tuyệt đối, bị xoá;
 *   - hàng bị SUT cắt ngắn (ví dụ 256 ký tự bị cắt còn 255) -> tiền tố nằm ở ĐẦU tên nên vẫn
 *     khớp, bị xoá. Đây chính là lý do tiền tố không được đặt ở cuối.
 *
 * Thứ THẬT SỰ có thể sót lại vĩnh viễn, nói thẳng:
 *   1. Hàng mà SUT lưu với tên KHÔNG bắt đầu bằng tiền tố của ta — ví dụ nếu server tự chuẩn
 *      hoá tên bằng cách cắt đầu chuỗi, hoặc mã hoá lại ký tự. Chưa quan sát thấy, nhưng nếu
 *      xảy ra thì lưới an toàn không phủ được, và bản thân việc đó là một bug đáng báo cáo.
 *   2. Mọi hàng còn lại nếu người dùng không bao giờ chạy suite thêm lần nào nữa — sweeper chỉ
 *      chạy khi có một lần chạy mới. Dọn tay: xoá mọi sản phẩm có tên bắt đầu bằng tiền tố
 *      dưới đây, cộng hai tên "~" và "~~".
 */
export const MANUAL_CLEANUP_HINT = `Xoá mọi sản phẩm có tên bắt đầu bằng "${FR15_OWNER_PREFIX}" (và hai tên ngắn "~", "~~"). Không đụng vào id 1..5.`;

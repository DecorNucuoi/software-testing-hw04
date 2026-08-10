/**
 * Quy ước SỞ HỮU dữ liệu test của FR-15, và bộ dọn rác dùng chung.
 *
 * ------------------------------------------------------------------------------
 * Bài toán: bảng products là dữ liệu THẬT, không có transaction rollback (SUT dùng SQLite
 * qua Express, mỗi request tự commit). Một lần chạy suite spawn 3 tiến trình browser tuần
 * tự, mỗi tiến trình chạy trọn 24 ca FR-15, phần lớn là thao tác Create. Nếu không dọn,
 * mỗi lần chạy để lại cỡ 70 hàng và bảng phình ra sau vài lần debug.
 *
 * Giải pháp gồm hai lớp, KHÔNG thay thế nhau:
 *   1. afterEach xoá theo id đã đăng ký — đường dọn chính, chạy cả khi test fail.
 *   2. Sweeper ở globalSetup quét theo TIỀN TỐ TÊN — lưới an toàn cho trường hợp lớp 1
 *      không kịp chạy (worker crash, Ctrl-C, mất điện).
 *
 * Vì sao sweeper đặt ở globalSetup chứ không phải globalTeardown: đúng những lần chạy
 * để lại rác nhiều nhất lại là những lần teardown KHÔNG chạy. Quét ở đầu run dọn rác của
 * lần trước, và đầu run là thứ luôn thực thi được.
 * ------------------------------------------------------------------------------
 * Vì sao lọc theo TÊN chứ không phải theo "id > 5": id lớn có thể thuộc về dữ liệu của
 * FR khác, của lần chạy tay, hoặc của người khác dùng chung server. Chỉ được xoá thứ mình
 * chứng minh được là mình tạo ra, và tiền tố chứa STUDENT_ID chính là bằng chứng đó.
 */
import type { APIRequestContext } from '@playwright/test';
import { BROWSER_TAG, RUN_TIMESTAMP, STUDENT_ID, URLS } from '../config';
import { loadJsonObject } from './data-loader';

/** Tên file dữ liệu FR-15 — khai ở đây để sweeper và spec không tự gõ lại chuỗi này. */
export const FR15_DATA_FILE = 'fr15-product-crud.json';

/**
 * Đọc danh sách tên ngắn cần dọn từ file dữ liệu.
 *
 * KHÔNG NÉM: hàm này được gọi từ globalSetup, vốn chạy cho cả smoke / FR-06 / FR-09. Nếu file
 * dữ liệu FR-15 chưa tồn tại hoặc hỏng cú pháp, đó là chuyện của FR-15 và phải nổ ra ở FR-15,
 * không phải làm chết một lần chạy smoke không liên quan.
 */
export function loadSweepExtraNames(): string[] {
  try {
    const names = loadJsonObject<{ sweeper_extra_exact_names?: unknown }>(FR15_DATA_FILE)
      .sweeper_extra_exact_names;
    return Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Tiền tố sở hữu. Mọi sản phẩm do test FR-15 tạo ra đều bắt đầu bằng chuỗi này, và
 * sweeper chỉ đụng vào những hàng khớp tiền tố này.
 */
export const FR15_OWNER_PREFIX = `${STUDENT_ID}-FR15-`;

/**
 * Dấu thời gian rút gọn của lần chạy (chỉ chữ số) — nhét vào tên để phân biệt rác của
 * lần chạy hiện tại với rác còn sót của lần trước khi đọc thẳng vào CSDL.
 */
const RUN_STAMP = RUN_TIMESTAMP.replace(/\D/g, '');

/**
 * 5 sản phẩm seed sẵn (id 1..5) là TÀI SẢN CHUNG — chỉ đọc, không bao giờ sửa/xoá.
 *
 * Ba lý do, theo thứ tự quan trọng:
 *   1. Chúng là tập chứng bất biến để kiểm mệnh đề "sản phẩm khác giữ nguyên" của FR-15.
 *      Nếu chính chúng bị test đụng vào thì không còn mốc nào để so.
 *   2. Không phục hồi được. POST tạo id mới (auto-increment không tái sử dụng), nên xoá
 *      id 3 rồi tạo lại sẽ ra id 27; mọi thứ tham chiếu id 3 hỏng vĩnh viễn.
 *   3. Suite chạy 3 lần liên tiếp. Nếu chromium xoá seed thì firefox và webkit chạy trên
 *      một tiền đề khác, và fail của chúng không còn nói lên điều gì về SUT.
 * Danh sách này là chốt chặn cuối: kể cả khi tên bị đặt trùng tiền tố, sweeper vẫn không xoá.
 */
export const SEEDED_PRODUCT_IDS: ReadonlySet<number> = new Set([1, 2, 3, 4, 5]);

/* ------------------------------------------------------------------------------
 * BỘ DỰNG TÊN
 *
 * Đặt cùng file với sweeper là CỐ Ý: nơi dựng tiền tố và nơi nhận ra tiền tố phải là một.
 * Nếu tách ra hai file, một lần sửa template mà quên sửa bộ lọc sẽ làm mọi hàng rác trở nên
 * vô hình với lưới an toàn — và triệu chứng của lỗi đó là "bảng tự phình ra", xuất hiện sau
 * nhiều ngày, không quy được về thay đổi nào.
 * Ràng buộc đó được kiểm bằng máy ở buildName(): tiền tố dựng ra PHẢI bắt đầu bằng
 * FR15_OWNER_PREFIX, nếu không thì ném lỗi ngay.
 * ------------------------------------------------------------------------------ */

/** Khai báo một cái tên trong file dữ liệu. Ba dạng, tương ứng ba trạng thái của ô nhập. */
export type NameSpec =
  | { kind: 'generated'; length: number; charset?: 'ascii' | 'vietnamese'; slot?: string }
  | { kind: 'literal'; value: string; owned?: boolean; cleanup?: string }
  | { kind: 'empty' };

export interface NameBuilderConfig {
  template: string;
  filler: { ascii: string; vietnamese: string };
  min_owned_length: number;
}

/** Khai báo giá trong file dữ liệu. Luôn là CHUỖI — xem meta.notes của file dữ liệu. */
export type PriceSpec = { kind: 'literal'; text: string } | { kind: 'empty' };

/** Danh mục khai theo VỊ TRÍ, không theo id: id danh mục có thể khác nhau giữa các môi trường. */
export interface CategorySpec {
  kind: 'index';
  index: number;
}

export type Fr15Operation = 'create' | 'read' | 'update' | 'delete';
export type Fr15Outcome = 'accepted' | 'rejected' | 'observe';

export interface Fr15FixtureSpec {
  role: 'target' | 'witness';
  name: NameSpec;
  price: PriceSpec;
  category: CategorySpec;
  created_via: 'api';
}

export interface Fr15CaseInput {
  name?: NameSpec;
  price?: PriceSpec;
  category?: CategorySpec;
  /** Số lần bấm nút Lưu. Chỉ DT9 khai; mặc định 1. */
  repeat_submit?: number;
  /** Giá trị mới cho thao tác Sửa. Trường vắng mặt = không đụng tới ô đó. */
  update?: { name?: NameSpec; price?: PriceSpec };
}

export interface Fr15Expected {
  outcome: Fr15Outcome;
  checks: string[];
  observe: string[];
}

export interface Fr15Case {
  tc_id: string;
  technique: 'EP' | 'BVA';
  bva_role: string;
  operation: Fr15Operation;
  varied_factor: string;
  fixtures: Fr15FixtureSpec[];
  input: Fr15CaseInput;
  expected: Fr15Expected;
  oracle_source: 'spec' | 'derived' | 'observation';
  spec_basis: string;
  description: string;
}

export interface Fr15Meta {
  name_limit_chars: number;
  defaults: { description: string; image_url: string };
  [key: string]: unknown;
}

export interface Fr15Data {
  meta: Fr15Meta;
  name_builder: NameBuilderConfig;
  sweeper_extra_exact_names: string[];
  cases: Fr15Case[];
}

/** Nạp một lần rồi giữ lại: file dữ liệu là bất biến trong suốt một tiến trình. */
let cachedData: Fr15Data | null = null;

export function loadFr15Data(): Fr15Data {
  if (cachedData === null) cachedData = loadJsonObject<Fr15Data>(FR15_DATA_FILE);
  return cachedData;
}

/**
 * Dựng phần tiền tố sở hữu cho một ca / một vai trò.
 * Tiền tố nằm ở ĐẦU tên: nếu SUT âm thầm cắt tên 256 ký tự xuống 255 thì phần mất đi là
 * đuôi đệm, dấu vết sở hữu còn nguyên và sweeper vẫn nhặt được hàng đó.
 */
export function ownedPrefix(tcId: string, slot = 'in'): string {
  const { template } = loadFr15Data().name_builder;
  const prefix = template
    .replace('{STUDENT_ID}', STUDENT_ID)
    .replace('{RUN_STAMP}', RUN_STAMP)
    .replace('{BROWSER_TAG}', BROWSER_TAG)
    .replace('{TC}', tcId)
    .replace('{SLOT}', slot);

  if (!prefix.startsWith(FR15_OWNER_PREFIX)) {
    throw new Error(
      `[fr15] Template tên trong ${FR15_DATA_FILE} sinh ra "${prefix.slice(0, 40)}...", không bắt đầu ` +
        `bằng tiền tố sở hữu "${FR15_OWNER_PREFIX}" mà sweeper dùng để lọc. Hai quy ước đã lệch nhau; ` +
        'mọi sản phẩm tạo ra từ lúc này sẽ vô hình với lưới dọn rác.',
    );
  }
  return prefix;
}

/**
 * Dựng tên thật từ khai báo trong file dữ liệu.
 *
 * NÉM LỖI khi độ dài yêu cầu nhỏ hơn tiền tố — đây là lỗi dữ liệu và phải lộ ra ngay lúc dựng.
 * Cắt bớt tiền tố cho vừa là cách im lặng biến một hàng test thành rác vĩnh viễn.
 * Ba ca biên dưới (0/1/2 ký tự) không dùng nhánh này mà dùng kind 'literal', và các literal đó
 * được khai ở sweeper_extra_exact_names để lưới an toàn vẫn phủ.
 */
export function buildName(spec: NameSpec, tcId: string): string {
  if (spec.kind === 'empty') return '';
  if (spec.kind === 'literal') return spec.value;

  const cfg = loadFr15Data().name_builder;
  const filler = cfg.filler[spec.charset ?? 'ascii'];
  if (typeof filler !== 'string' || filler.length !== 1) {
    throw new Error(
      `[fr15] Ký tự đệm cho charset "${spec.charset ?? 'ascii'}" phải dài đúng 1 đơn vị mã UTF-16; ` +
        'nếu không thì độ dài tên dựng ra sẽ khác độ dài khai báo và cả bộ ca biên mất ý nghĩa.',
    );
  }

  const prefix = ownedPrefix(tcId, spec.slot ?? 'in');
  if (spec.length < prefix.length) {
    throw new Error(
      `[fr15] Ca ${tcId} yêu cầu tên dài ${spec.length} ký tự, nhưng tiền tố sở hữu đã chiếm ` +
        `${prefix.length} ký tự. Không cắt tiền tố để cho vừa: hàng tạo ra sẽ không còn dấu vết ` +
        `nào để sweeper nhận ra. Tên ngắn hơn ${cfg.min_owned_length} phải khai bằng kind "literal" ` +
        'và liệt kê ở sweeper_extra_exact_names.',
    );
  }

  return prefix + filler.repeat(spec.length - prefix.length);
}

/** Một hàng có phải do test FR-15 tạo ra hay không. */
export function isOwnedByFr15(name: unknown): boolean {
  return typeof name === 'string' && name.startsWith(FR15_OWNER_PREFIX);
}

export interface SweepResult {
  /** Số hàng đã xoá thành công. */
  deleted: number;
  /** Số hàng khớp tiền tố nhưng bị từ chối xoá vì nằm trong danh sách seed. */
  protectedSeed: number;
  /** Số hàng khớp tiền tố nhưng xoá thất bại. */
  failed: number;
  /** Lý do sweeper không làm được việc, nếu có. Khác null KHÔNG phải là lỗi của run. */
  warning: string | null;
}

/**
 * Dọn sản phẩm rác của các lần chạy trước.
 *
 * HÀM NÀY KHÔNG BAO GIỜ NÉM. Nó là công việc vệ sinh, không phải điều kiện tiên quyết của
 * suite. Nếu nó ném, mọi lần chạy — kể cả smoke, FR-06, FR-09 — sẽ chết ngay ở globalSetup
 * khi API chưa kịp lên, và thông điệp lỗi thật của smoke test ("SUT chưa chạy") bị thay bằng
 * một stack trace của bộ dọn rác. Đó là đúng thứ ranh giới đã đặt ra ở FR-09: chẩn đoán của
 * test không được để cho hạ tầng phụ trợ làm nhiễu.
 */
export async function sweepFr15Products(
  request: APIRequestContext,
  /**
   * Danh sách tên NGẮN được xoá theo so khớp tuyệt đối cả chuỗi.
   *
   * Ba ca biên dưới của độ dài tên (0, 1, 2 ký tự) không thể mang tiền tố sở hữu — 49 ký tự
   * định danh không nhét vừa một ký tự. Chúng được khai báo tường minh trong
   * data/fr15-product-crud.json và truyền vào đây. So khớp TUYỆT ĐỐI chứ không phải theo tiền
   * tố: "~" chỉ xoá đúng hàng tên "~", không đụng tới "~ Áo thun" của bất kỳ ai.
   */
  extraExactNames: readonly string[] = [],
): Promise<SweepResult> {
  const result: SweepResult = { deleted: 0, protectedSeed: 0, failed: 0, warning: null };
  const exact = new Set(extraExactNames);

  let rows: unknown;
  try {
    const res = await request.get(`${URLS.api}/api/products`, { timeout: 5_000 });
    if (!res.ok()) {
      result.warning = `GET /api/products trả HTTP ${res.status()}`;
      return result;
    }
    rows = await res.json();
  } catch (error) {
    // Trường hợp thường gặp nhất: SUT chưa được khởi động. Không phải lỗi của lần chạy này.
    result.warning = `Không gọi được API: ${(error as Error).message}`;
    return result;
  }

  if (!Array.isArray(rows)) {
    result.warning = 'GET /api/products không trả về mảng.';
    return result;
  }

  for (const row of rows) {
    const id = (row as { id?: unknown })?.id;
    const name = (row as { name?: unknown })?.name;
    const isMine = isOwnedByFr15(name) || (typeof name === 'string' && exact.has(name));
    if (typeof id !== 'number' || !isMine) continue;

    if (SEEDED_PRODUCT_IDS.has(id)) {
      // Trùng tiền tố mà lại là id seed nghĩa là có ai đó đã GHI ĐÈ lên sản phẩm seed.
      // Sweeper không xoá, chỉ đếm và để cảnh báo nổi lên — xoá đi là phá huỷ bằng chứng.
      result.protectedSeed += 1;
      continue;
    }

    try {
      const res = await request.delete(`${URLS.api}/api/products/${id}`, { timeout: 5_000 });
      if (res.ok()) result.deleted += 1;
      else result.failed += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

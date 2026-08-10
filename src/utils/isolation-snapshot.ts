/**
 * Chụp trạng thái sản phẩm trước/sau một thao tác, và so hai ảnh chụp để kiểm mệnh đề cô lập
 * của FR-15: "khi sửa một sản phẩm, CHỈ sản phẩm đó thay đổi; mọi sản phẩm khác giữ nguyên".
 *
 * ------------------------------------------------------------------------------
 * CHỤP TỪ HAI NGUỒN, VÀ SO CHÚNG VỚI NHAU
 *
 * Nguồn 1 — GET /api/products. Đầy đủ nhất: có id, category_id, description, imageUrl, tức là
 *   những trường bảng không hiển thị. Đây là nguồn để tính diff.
 * Nguồn 2 — bảng trên giao diện. Chỉ có tên và giá, nhưng nó là thứ người dùng thật nhìn thấy.
 *
 * Vì sao không chọn một nguồn: chỉ nhìn API thì bỏ lọt lỗi hiển thị (dữ liệu đúng, màn hình
 * sai); chỉ nhìn giao diện thì bỏ lọt lỗi ghi (màn hình đúng vì render lạc quan, dữ liệu chưa
 * bao giờ được lưu). Hai phép kiểm độc lập có thể CÙNG XANH trong khi hệ thống hỏng.
 *
 * Cách so hai nguồn: chiếu cả hai về đúng phần giao nhau — mảng { name, price } đã chuẩn hoá,
 * sắp theo tên — rồi so bằng toEqual. Giá của hai bên đi qua CÙNG một lõi chuẩn hoá trong
 * admin-price.ts, nên một khác biệt trong kết quả là khác biệt về GIÁ TRỊ chứ không phải về
 * phép biến đổi.
 * ------------------------------------------------------------------------------
 * VÌ SAO DIFF SO TOÀN BỘ TRƯỜNG, KHÔNG PHẢI TỪNG TRƯỜNG TA NGHĨ TỚI
 *
 * diffSnapshots duyệt HỢP của các khoá có mặt ở hai phía. Nhờ đó một assertion duy nhất
 * `expect(diff).toEqual({ added: [], removed: [], changed: [] })` bắt được cả những thay đổi
 * ta không nghĩ tới — đúng loại bug mà mệnh đề cô lập tồn tại để phát hiện. Liệt kê tay từng
 * trường thì chỉ bắt được đúng những gì người viết test đã tưởng tượng ra.
 * ------------------------------------------------------------------------------
 */
import type { APIRequestContext } from '../fixtures';
import {
  priceKey,
  readAdminCellPrice,
  readApiPrice,
  type PrimitiveType,
} from './admin-price';
import { getProducts, type Product } from './api';
import type { AdminTableSnapshot } from './admin-table';

/** Một bản ghi đã chuẩn hoá. Mọi trường về chuỗi để diff luôn JSON-serialize được. */
export interface ProductRecord {
  id: number;
  /** Mọi trường khác id, đã chuẩn hoá về chuỗi. Trường `price` là khoá giá của admin-price. */
  fields: Record<string, string>;
  /** Kiểu nguyên thuỷ của `price` đọc được từ nguồn — dữ kiện cho phần bất đồng kiểu (T3). */
  priceType: PrimitiveType;
}

export interface ApiSnapshot {
  source: 'api-list';
  records: ProductRecord[];
}

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

export interface ChangedRecord {
  id: number;
  changes: FieldChange[];
}

export interface SnapshotDiff {
  added: Array<{ id: number; name: string }>;
  removed: Array<{ id: number; name: string }>;
  changed: ChangedRecord[];
}

/** Hình chiếu chung của hai nguồn: phần giao nhau giữa những gì bảng hiện và những gì API trả. */
export interface NameValueProjection {
  name: string;
  price: string;
}

/** Khoá giá dựng từ chuỗi hiển thị trong bảng admin. */
export function uiPriceKey(priceText: string): string {
  return priceKey(readAdminCellPrice(priceText));
}

/** Đưa một giá trị bất kỳ về chuỗi ổn định, phân biệt null với chuỗi "null". */
function stringifyField(value: unknown): string {
  if (value === null) return '<null>';
  if (value === undefined) return '<undefined>';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Chuẩn hoá một hàng thô từ API thành ProductRecord. */
export function normalizeApiRow(row: Record<string, unknown>): ProductRecord {
  const reading = readApiPrice('api-list', row.price);
  const fields: Record<string, string> = {};

  for (const [key, value] of Object.entries(row)) {
    if (key === 'id') continue;
    // Giá đi qua lõi chuẩn hoá riêng để so được với chuỗi hiển thị trên bảng.
    fields[key] = key === 'price' ? priceKey(reading) : stringifyField(value);
  }

  return { id: Number(row.id), fields, priceType: reading.primitiveType };
}

/** Chụp trạng thái từ API. Sắp theo id để hai lần chụp luôn cùng thứ tự. */
export async function takeApiSnapshot(request: APIRequestContext): Promise<ApiSnapshot> {
  const rows = (await getProducts(request)) as unknown as Array<Record<string, unknown>>;
  const records = (Array.isArray(rows) ? rows : [])
    .filter((row) => row !== null && typeof row === 'object')
    .map(normalizeApiRow)
    .sort((a, b) => a.id - b.id);
  return { source: 'api-list', records };
}

/**
 * Bỏ ra khỏi ảnh chụp những sản phẩm ĐANG được thao tác, để phần còn lại đúng nghĩa
 * "mọi sản phẩm KHÁC". Diff trên phần còn lại phải rỗng tuyệt đối.
 */
export function omitIds(snapshot: ApiSnapshot, ids: Iterable<number>): ApiSnapshot {
  const excluded = new Set(ids);
  return { source: snapshot.source, records: snapshot.records.filter((r) => !excluded.has(r.id)) };
}

/** Ngược lại: chỉ giữ những id quan tâm, dùng khi muốn khẳng định đúng cái gì đã đổi. */
export function keepIds(snapshot: ApiSnapshot, ids: Iterable<number>): ApiSnapshot {
  const kept = new Set(ids);
  return { source: snapshot.source, records: snapshot.records.filter((r) => kept.has(r.id)) };
}

/**
 * So hai ảnh chụp.
 *
 * Kết quả được thiết kế để dùng thẳng với `expect(diff).toEqual({added: [], removed: [], changed: []})`:
 * mọi thứ đều là mảng đã sắp xếp ổn định và mọi giá trị đều là chuỗi, nên khi đỏ, phần diff mà
 * Playwright in ra đọc được ngay mà không cần mở trace.
 */
export function diffSnapshots(before: ApiSnapshot, after: ApiSnapshot): SnapshotDiff {
  const beforeById = new Map(before.records.map((r) => [r.id, r]));
  const afterById = new Map(after.records.map((r) => [r.id, r]));

  const nameOf = (record: ProductRecord): string => record.fields.name ?? '<không có trường name>';

  const added = after.records
    .filter((r) => !beforeById.has(r.id))
    .map((r) => ({ id: r.id, name: nameOf(r) }));

  const removed = before.records
    .filter((r) => !afterById.has(r.id))
    .map((r) => ({ id: r.id, name: nameOf(r) }));

  const changed: ChangedRecord[] = [];
  for (const recordBefore of before.records) {
    const recordAfter = afterById.get(recordBefore.id);
    if (recordAfter === undefined) continue;

    // HỢP của các khoá hai phía: một trường mới xuất hiện, hoặc biến mất, đều là thay đổi.
    const keys = [...new Set([...Object.keys(recordBefore.fields), ...Object.keys(recordAfter.fields)])].sort();
    const changes: FieldChange[] = [];
    for (const field of keys) {
      const valueBefore = recordBefore.fields[field] ?? '<không có trường>';
      const valueAfter = recordAfter.fields[field] ?? '<không có trường>';
      if (valueBefore !== valueAfter) changes.push({ field, before: valueBefore, after: valueAfter });
    }
    if (changes.length > 0) changed.push({ id: recordBefore.id, changes });
  }

  return {
    added: added.sort((a, b) => a.id - b.id),
    removed: removed.sort((a, b) => a.id - b.id),
    changed: changed.sort((a, b) => a.id - b.id),
  };
}

/** Diff rỗng — hằng số để spec so bằng toEqual mà không phải gõ lại object rỗng. */
export const EMPTY_DIFF: SnapshotDiff = { added: [], removed: [], changed: [] };

/* ============================ ĐỐI CHIẾU CHÉO HAI NGUỒN ============================ */

/** Chiếu ảnh chụp API về phần giao nhau với bảng: { name, price }, sắp theo tên. */
export function projectApiByName(snapshot: ApiSnapshot): NameValueProjection[] {
  return snapshot.records
    .map((r) => ({ name: r.fields.name ?? '', price: r.fields.price ?? '' }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Chiếu ảnh chụp bảng về cùng dạng. Cùng phép chuẩn hoá giá, nên khác biệt là khác GIÁ TRỊ. */
export function projectUiByName(snapshot: AdminTableSnapshot): NameValueProjection[] {
  return snapshot.rows
    .map((row) => ({ name: row.name, price: uiPriceKey(row.priceText) }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * Bất đồng KIỂU của trường price giữa hai bản ghi cùng id, đọc từ hai nguồn khác nhau.
 * Trả về mô tả để spec đưa vào annotation; KHÔNG assert ở đây — bất đồng kiểu phải được báo
 * cáo ở mọi ca nhưng chỉ làm đỏ ở ca dành riêng cho nó.
 */
export function describePriceTypes(snapshot: ApiSnapshot): string[] {
  return snapshot.records.map((r) => `#${r.id} price:${r.priceType} = ${r.fields.price}`);
}

/** Mô tả ngắn gọn một diff, dùng làm message của assertion. */
export function describeDiff(diff: SnapshotDiff): string {
  const parts: string[] = [];
  if (diff.added.length > 0) parts.push(`thêm ${diff.added.map((a) => `#${a.id}`).join(', ')}`);
  if (diff.removed.length > 0) parts.push(`mất ${diff.removed.map((r) => `#${r.id}`).join(', ')}`);
  for (const record of diff.changed) {
    const fields = record.changes.map((c) => `${c.field}: ${c.before} -> ${c.after}`).join('; ');
    parts.push(`#${record.id} đổi (${fields})`);
  }
  return parts.length === 0 ? 'không có thay đổi nào' : parts.join(' | ');
}

/** Kiểu Product của api.ts được tái xuất để spec khỏi import từ hai nơi. */
export type { Product };

/**
 * Nạp dữ liệu test từ file rời (.json / .csv).
 *
 * Đề bài (Task 1) yêu cầu: "The test data must be stored in a separate .csv or .json file
 * (hardcoded inline arrays or objects in the script are not accepted)".
 * Vì vậy MỌI bộ dữ liệu test đều đi qua 2 hàm dưới đây, không có mảng dữ liệu nào
 * được viết thẳng trong file .spec.ts.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '..', '..', 'data');

/** Đọc file JSON trong thư mục /data và trả về mảng đã ép kiểu. */
export function loadJson<T>(fileName: string): T[] {
  const raw = readFileSync(resolve(DATA_DIR, fileName), 'utf-8');
  const parsed = JSON.parse(raw) as T[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`[data-loader] ${fileName} rỗng hoặc không phải mảng — test sẽ không có case nào để chạy.`);
  }
  return parsed;
}

/**
 * Đọc file JSON có gốc là OBJECT (không phải mảng).
 *
 * Vì sao cần thêm hàm này bên cạnh loadJson: bộ dữ liệu FR-15 có một khối quy ước dùng chung
 * cho cả 24 ca — ngân sách 255 ký tự của tên, ký tự đệm, giá trị mặc định của description /
 * imageUrl, danh sách tên ngắn mà sweeper cần biết. Nhét khối đó vào từng dòng là cách chắc
 * chắn nhất để 24 bản sao của cùng một hằng số trôi dạt khỏi nhau sau vài lần sửa.
 * loadJson giữ nguyên hành vi cũ; FR-06 và FR-09 không bị ảnh hưởng.
 */
export function loadJsonObject<T>(fileName: string): T {
  const raw = readFileSync(resolve(DATA_DIR, fileName), 'utf-8');
  const parsed = JSON.parse(raw) as T;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`[data-loader] ${fileName} phải có gốc là một object JSON.`);
  }
  return parsed;
}

/**
 * Đọc file CSV trong thư mục /data.
 * `columns: true` -> mỗi dòng thành object theo header; `trim` để tránh lỗi khoảng trắng thừa
 * khi file được mở/chỉnh sửa bằng Excel.
 */
export function loadCsv<T extends Record<string, string>>(fileName: string): T[] {
  const raw = readFileSync(resolve(DATA_DIR, fileName), 'utf-8');
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as T[];
  if (rows.length === 0) {
    throw new Error(`[data-loader] ${fileName} không có dòng dữ liệu nào.`);
  }
  return rows;
}

/** CSV luôn trả về string — helper để ép số một cách tường minh, báo lỗi sớm nếu dữ liệu sai. */
export function toNumber(value: string, field: string): number {
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new Error(`[data-loader] Trường "${field}" có giá trị không phải số: "${value}"`);
  }
  return n;
}

/** CSV không có kiểu boolean — quy ước "true"/"1"/"yes". */
export function toBoolean(value: string): boolean {
  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
}

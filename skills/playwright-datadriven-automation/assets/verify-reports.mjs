/**
 * Tự kiểm tra bằng chứng nộp bài (đề mục 11 — Anti-AI-Cheat).
 *
 * Kiểm 4 điều kiện trên MỌI thư mục reports/html-*:
 *   1. Có file index.html.
 *   2. HTML chứa chuỗi "Run by: <StudentID>".
 *   3. HTML chứa ISO 8601 timestamp.
 *   4. Đủ tối thiểu 9 report (3 feature x 3 browser) — yêu cầu "at least 9 browser runs".
 *
 * Mục đích: phát hiện sớm việc thiếu/hụt bằng chứng TRƯỚC khi zip nộp,
 * thay vì bị trừ điểm sau khi TA chấm.
 *
 * Dùng: node scripts/verify-reports.mjs
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const STUDENT_ID = process.env.STUDENT_ID ?? '23127362';
const RUN_BY = `Run by: ${STUDENT_ID}`;
const ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/;
const REQUIRED_RUNS = 9;

const reportsRoot = resolve(process.cwd(), 'reports');
if (!existsSync(reportsRoot)) {
  console.error('[verify] FAIL — chưa có thư mục reports/. Chạy `npm run test:matrix` trước.');
  process.exit(1);
}

const dirs = readdirSync(reportsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith('html-') && !d.name.startsWith('html-smoke'))
  .map((d) => d.name)
  .sort();

const rows = [];
let failures = 0;

for (const name of dirs) {
  const file = resolve(reportsRoot, name, 'index.html');
  const row = { report: name, 'index.html': false, 'Run by': false, 'ISO ts': false };

  if (existsSync(file)) {
    row['index.html'] = true;
    const html = readFileSync(file, 'utf-8');
    row['Run by'] = html.includes(RUN_BY);
    row['ISO ts'] = ISO_RE.test(html);
  }

  if (!row['index.html'] || !row['Run by'] || !row['ISO ts']) failures += 1;
  rows.push(row);
}

console.table(rows);

console.log(`\n[verify] Số report hợp lệ: ${rows.length - failures}/${rows.length}`);
console.log(`[verify] Yêu cầu tối thiểu của đề: ${REQUIRED_RUNS} browser runs.`);

if (rows.length < REQUIRED_RUNS) {
  console.error(`[verify] FAIL — mới có ${rows.length} report, còn thiếu ${REQUIRED_RUNS - rows.length}.`);
}
if (failures > 0) {
  console.error(`[verify] FAIL — ${failures} report thiếu banner "Run by" hoặc ISO timestamp. Chạy \`npm run stamp:all\`.`);
}

process.exit(rows.length >= REQUIRED_RUNS && failures === 0 ? 0 : 1);

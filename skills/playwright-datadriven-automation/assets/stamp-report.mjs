/**
 * Chèn banner "Run by: <StudentID>" + ISO timestamp vào Playwright HTML report.
 *
 * Lý do cần script này: đề bài mục 11 (Anti-AI-Cheat) bắt buộc HTML report phải
 * CHỨA và HIỂN THỊ chuỗi "Run by: <StudentID>" kèm ISO timestamp. Playwright đã render
 * `metadata` từ config, nhưng metadata nằm trong JS bundle nên khó grep; banner này
 * đảm bảo chuỗi nằm ngay trong HTML tĩnh (grep được bằng Ctrl+F / `grep` trên file)
 * kể cả khi TA mở report offline.
 *
 * Dùng:
 *   node scripts/stamp-report.mjs --dir=reports/html-fr06-chromium
 *   node scripts/stamp-report.mjs --all      (đóng dấu mọi report chưa đóng dấu)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const STUDENT_ID = process.env.STUDENT_ID ?? '23127362';
const STAMP_ID = 'hw04-run-by-banner';

/* ------------------------------ đọc tham số ------------------------------ */
const dirArg = process.argv.find((a) => a.startsWith('--dir='))?.slice('--dir='.length);
const all = process.argv.includes('--all');

let targets = [];
if (all) {
  const reportsRoot = resolve(process.cwd(), 'reports');
  if (!existsSync(reportsRoot)) {
    console.error('[stamp-report] Chưa có thư mục reports/. Hãy chạy test trước.');
    process.exit(1);
  }
  targets = readdirSync(reportsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('html-'))
    .map((d) => join('reports', d.name));
} else if (dirArg) {
  targets = [dirArg];
} else {
  console.error('[stamp-report] Thiếu tham số. Dùng --dir=<thư mục report> hoặc --all');
  process.exit(1);
}

/* ------------------------------ đóng dấu -------------------------------- */
let stampedCount = 0;

for (const dir of targets) {
  const reportFile = resolve(process.cwd(), dir, 'index.html');

  if (!existsSync(reportFile)) {
    console.error(`[stamp-report] Không tìm thấy ${reportFile} — bỏ qua.`);
    continue;
  }

  let html = readFileSync(reportFile, 'utf-8');
  if (html.includes(STAMP_ID)) {
    console.log(`[stamp-report] ${dir} đã được đóng dấu trước đó, bỏ qua.`);
    continue;
  }

  const iso = new Date().toISOString();
  const tag = dir.replace(/^.*html-/, ''); // ví dụ: fr06-chromium
  const [feature, browser] = tag.split('-');

  const banner = `
<div id="${STAMP_ID}" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  background:#0f172a;color:#f8fafc;padding:12px 20px;border-bottom:3px solid #22c55e;
  font-size:14px;line-height:1.6;">
  <strong style="font-size:16px;">Run by: ${STUDENT_ID}</strong>
  &nbsp;|&nbsp; Report generated at (ISO 8601): <code>${iso}</code>
  &nbsp;|&nbsp; Feature: <strong>${(feature ?? '').toUpperCase()}</strong>
  &nbsp;|&nbsp; Browser: <strong>${browser ?? ''}</strong>
  <br/>
  HW04 — Automation Testing &nbsp;|&nbsp; SUT: EShop (https://github.com/ttbhanh/eshop-sut)
</div>
`;

  // Chèn ngay sau <body> để banner luôn nằm trên cùng, không phụ thuộc SPA render.
  html = html.replace(/<body([^>]*)>/i, `<body$1>${banner}`);
  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>HW04 ${(feature ?? '').toUpperCase()}/${browser ?? ''} — Run by: ${STUDENT_ID} — ${iso}</title>`,
  );

  writeFileSync(reportFile, html, 'utf-8');
  stampedCount += 1;
  console.log(`[stamp-report] Đã đóng dấu "Run by: ${STUDENT_ID}" (${iso}) vào ${dir}/index.html`);
}

console.log(`[stamp-report] Hoàn tất: ${stampedCount} report được đóng dấu.`);

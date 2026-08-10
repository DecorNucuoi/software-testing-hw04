/**
 * Runner ma trận (feature x browser) cho HW04.
 *
 * Đề bài mục 6 - Task 1: "Each feature must run on all three browsers — at least 9
 * browser runs in total across the suite. Each run must produce an HTML report ...".
 * Script này spawn từng tiến trình `playwright test` cho mỗi cặp (feature, browser),
 * sinh ra 9 thư mục report riêng biệt, rồi tự đóng dấu "Run by: <StudentID>" vào từng report.
 *
 * Dùng:
 *   node scripts/run-matrix.mjs                          -> chạy đủ 9 tổ hợp
 *   node scripts/run-matrix.mjs --feature fr06           -> fr06 trên cả 3 browser
 *   node scripts/run-matrix.mjs --browser firefox        -> cả 3 feature trên firefox
 *   node scripts/run-matrix.mjs --feature smoke --browser chromium
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STUDENT_ID = process.env.STUDENT_ID ?? '23127362';

/** Khai báo tường minh feature -> file spec, để runner không phải đoán tên file. */
const FEATURES = {
  smoke: 'tests/smoke.spec.ts',
  fr06: 'tests/fr06-product-detail.spec.ts',
  fr09: 'tests/fr09-coupon.spec.ts',
  fr15: 'tests/fr15-product-crud.spec.ts',
};

const BROWSERS = ['chromium', 'firefox', 'webkit'];

/* ------------------------------ đọc tham số ------------------------------ */
function argOf(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const featureArg = argOf('--feature');
const browserArg = argOf('--browser');

/** Mặc định chỉ chạy 3 feature tính điểm; `smoke` phải gọi tên rõ ràng. */
const features = featureArg ? [featureArg] : ['fr06', 'fr09', 'fr15'];
const browsers = browserArg ? [browserArg] : BROWSERS;

for (const f of features) {
  if (!FEATURES[f]) {
    console.error(`[run-matrix] Feature không hợp lệ: "${f}". Hợp lệ: ${Object.keys(FEATURES).join(', ')}`);
    process.exit(1);
  }
}
for (const b of browsers) {
  if (!BROWSERS.includes(b)) {
    console.error(`[run-matrix] Browser không hợp lệ: "${b}". Hợp lệ: ${BROWSERS.join(', ')}`);
    process.exit(1);
  }
}

/* ------------------------------ chạy ma trận ----------------------------- */
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const results = [];

for (const feature of features) {
  const specFile = FEATURES[feature];

  if (!existsSync(resolve(process.cwd(), specFile))) {
    console.warn(`[run-matrix] Bỏ qua "${feature}": chưa có file ${specFile}.`);
    continue;
  }

  for (const browser of browsers) {
    const label = `${feature} @ ${browser}`;
    console.log(`\n========================================================`);
    console.log(`[run-matrix] RUN ${label}`);
    console.log(`========================================================`);

    const startedAt = new Date().toISOString();
    const env = { ...process.env, FEATURE_TAG: feature, BROWSER_TAG: browser, STUDENT_ID };

    const run = spawnSync(npx, ['playwright', 'test', specFile, `--project=${browser}`], {
      stdio: 'inherit',
      env,
      shell: process.platform === 'win32',
    });

    /* Đóng dấu report NGAY CẢ KHI test fail — report của lần chạy fail vẫn là bằng chứng hợp lệ. */
    const stamp = spawnSync(
      process.execPath,
      ['scripts/stamp-report.mjs', `--dir=reports/html-${feature}-${browser}`],
      { stdio: 'inherit', env, shell: false },
    );

    results.push({
      feature,
      browser,
      reportDir: `reports/html-${feature}-${browser}`,
      startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: run.status,
      testsPassed: run.status === 0,
      stamped: stamp.status === 0,
    });
  }
}

/* --------------------------- tổng kết ma trận ---------------------------- */
mkdirSync(resolve(process.cwd(), 'reports'), { recursive: true });
const summary = {
  studentId: STUDENT_ID,
  generatedAt: new Date().toISOString(),
  totalRuns: results.length,
  passedRuns: results.filter((r) => r.testsPassed).length,
  failedRuns: results.filter((r) => !r.testsPassed).length,
  runs: results,
};
writeFileSync(resolve(process.cwd(), 'reports/run-matrix.json'), JSON.stringify(summary, null, 2), 'utf-8');

console.log(`\n=================== TỔNG KẾT MA TRẬN ===================`);
console.table(results.map(({ feature, browser, exitCode, reportDir }) => ({ feature, browser, exitCode, reportDir })));
console.log(`[run-matrix] Tổng số browser run: ${results.length} (đề yêu cầu >= 9)`);
console.log(`[run-matrix] Đã ghi reports/run-matrix.json`);

/* Không exit(1) khi test fail: fail là dữ liệu đầu vào cho bug report, không phải lỗi hạ tầng. */
process.exit(0);

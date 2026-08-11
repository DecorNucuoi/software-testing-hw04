# HW04 — Automation Testing on EShop

| | |
|---|---|
| **Sinh viên** | Phạm Anh Hào — 23127362 |
| **Lớp** | 23KTPM1 |
| **Môn** | CS423 / CSC13003 — Software Testing |
| **SUT** | EShop — https://github.com/ttbhanh/eshop-sut |
| **Repo** | https://github.com/DecorNucuoi/software-testing-hw04 (public) |
| **Công cụ** | Playwright Test + TypeScript · Playwright HTML reporter |
| **AI** | Claude |

---

## Tự đánh giá

| No. | Tiêu chí | Điểm | Tự đánh giá |
|---|---|---|---|
| 1 | Task 1 — Feature A (FR-06 Product Detail) | 25 | 25 |
| 1 | Task 1 — Feature B (FR-09 Discount Coupon) | 25 | 25 |
| 1 | Task 1 — Feature C (FR-15 Product CRUD) | 25 | 25 |
| 2 | Task 2 — Video demo | 15 | 15 |
| 3 | Agent Skills | 10 | 10 |
| | **Tổng** | **100** | **100** |

> Điểm tự đánh giá 3 chữ số cũng nằm trong tên file zip:
> `23127362_HW04_AI_Automation_100.zip`

---

## Test summary

| Chỉ số | Số lượng |
|---|---|
| Feature được tự động hoá | 3 |
| Test case được tự động hoá | 54 |
| Lượt chạy (54 ca × 3 browser) | 162 |
| Passed | 96 |
| Failed | 66 |
| Không chạy | 0 |
| Browser run | 9 |
| Bug tìm được | 13 (2 Critical · 8 Major · 3 Minor) |
| GitHub Issue đã mở | 13 (#1–#13) |
| Ca không tự động hoá được | 4 — ghi rõ lý do, không ca nào bị `skip` |

### Chi tiết theo feature và trình duyệt

| Feature | Ca | Chromium | Firefox | WebKit | Bug |
|---|---|---|---|---|---|
| FR-06 — Product Detail | 15 | 8 / 7 | 7 / 8 | 8 / 7 | 5 |
| FR-09 — Discount Coupon | 15 | 10 / 5 | 10 / 5 | 10 / 5 | 4 |
| FR-15 — Product CRUD (Admin) | 24 | 14 / 10 | 15 / 9 | 14 / 10 | 4 |

*(pass / fail)*

**66 lượt đỏ là kết quả đúng và mong muốn** — assertion được viết theo đặc tả, còn SUT thì được cố ý
cài lỗi. Mỗi lượt đỏ đã được phân loại thành bug của SUT / lỗi script / giới hạn công cụ; chi tiết
trong `report/HW04_AI_review_gap_analysis.md`.

---

## Video

| Video | Nội dung | Link |
|---|---|---|
| Task 2 (§6) | Một script chạy end-to-end, ma trận 3 trình duyệt, HTML report, và thuyết minh một chỗ đã sửa script do AI sinh | https://drive.google.com/file/d/1RSgGSw1rOvoqPxJmSEf1IOGaXvcaa3aa/view?usp=drive_link |
| Agent Skill (§7) | Dùng skill end-to-end trên một feature hoàn chỉnh | |

---

## Cấu trúc

Bài nộp gồm hai phần: **repo GitHub** chứa mã kiểm thử, dữ liệu và HTML report (đúng những gì §14
yêu cầu ở mục link repo); **file zip nộp Moodle** chứa toàn bộ repo cộng thêm các tài liệu báo cáo.

### Trong repo GitHub

```
tests/
  fr06-product-detail.spec.ts       15 ca
  fr09-coupon.spec.ts               15 ca
  fr15-product-crud.spec.ts         24 ca
  smoke.spec.ts                     6 ca kiểm môi trường (không tính điểm)
src/
  config.ts fixtures.ts global-setup.ts
  pages/                            5 page object — không chứa expect
  utils/                            data-loader · money · admin-price · admin-table · fixture trạng thái
data/                               3 file dữ liệu + 2 file ghi ca không tự động hoá được
reports/
  html-{fr06,fr09,fr15}-{chromium,firefox,webkit}/    9 HTML report
  json/                             kết quả dạng JSON của từng run
  run-matrix.json                   tổng kết ma trận feature × browser
scripts/
  run-matrix.mjs                    chạy ma trận feature × browser, đóng dấu report
  stamp-report.mjs                  chèn "Run by: 23127362" + ISO timestamp
  verify-reports.mjs                tự kiểm 9 report trước khi nộp
skills/
  playwright-datadriven-automation/ Agent Skill — 11 file, tài liệu tiếng Anh
ai/prompts/                         3 chuỗi prompt (FR-06, FR-09, FR-15)
report/
  HW04_AI_review_gap_analysis.md    rà soát của người — 8 lỗi trong script do AI sinh
bugs/
  HW04_bug_report.md                13 bug
playwright.config.ts  package.json  tsconfig.json
```

### Chỉ có trong file zip nộp Moodle

```
README.md                                    file này
report/HW04_main_report.md   + .docx         báo cáo chính (14 mục, theo thứ tự bullet của đề)
report/HW04_AI_critique.md   + .docx         AI Critique (§10)
report/HW04_AI_review_gap_analysis.docx      bản .docx của bản rà soát
bugs/HW04_bug_report.docx                    bản .docx của bug report
Copy of [AI-02] … AI Audit Report_En.docx    AI Audit Report — 22 artifact
AI chat/                                     44 file .txt — nguyên văn 22 lượt tương tác kèm timestamp
git-log.txt                                  lịch sử commit dạng văn bản (§12)
```

> Bản `bugs/HW04_bug_report.md` trong zip mới hơn bản trên GitHub: bản trong zip đã bỏ bảng tổng
> hợp và gắn số Issue vào từng bug. Nội dung 13 bug thì giống nhau ở cả hai bản.

---

## Cách chạy

Cần **3 tiến trình SUT** chạy song song. Dùng `--host 127.0.0.1` để tránh việc `localhost` phân giải
sang IPv6 trong khi server chỉ lắng nghe IPv4:

```bash
cd <eshop>/backend        && node database.js && node server.js   # :3000
cd <eshop>/frontend-web   && npm run dev -- --host 127.0.0.1      # :5173
cd <eshop>/frontend-admin && npm run dev -- --host 127.0.0.1      # :5174
```

Rồi trong thư mục bài làm:

```bash
npm install
npm run typecheck

npm run smoke:all                    # kiểm môi trường trước — 6 ca × 3 browser
node scripts/run-matrix.mjs          # chạy đủ 3 feature × 3 browser = 9 run
node scripts/verify-reports.mjs      # tự kiểm 9 report có định danh + timestamp
```

Chạy riêng một feature hoặc một trình duyệt:

```bash
node scripts/run-matrix.mjs --feature fr09
node scripts/run-matrix.mjs --feature fr15 --browser chromium
```

Mở report:

```bash
npx playwright show-report reports/html-fr09-chromium
```

Nếu `smoke` đỏ thì đó là **lỗi môi trường, không phải lỗi script** — kiểm ba cổng trước khi đọc tiếp:

```powershell
curl.exe -s -o NUL -w "api   %{http_code}`n" http://127.0.0.1:3000/api/products
curl.exe -s -o NUL -w "web   %{http_code}`n" http://127.0.0.1:5173
curl.exe -s -o NUL -w "admin %{http_code}`n" http://127.0.0.1:5174
```

---

## Bằng chứng thực thi

Mỗi `reports/html-<feature>-<browser>/index.html` chứa chuỗi `"Run by: 23127362"` **hai lần** — một
trong thẻ `<title>`, một trong banner ở đầu trang — kèm ISO 8601 timestamp của lần chạy. Chuỗi nằm
trong HTML tĩnh nên `grep` được trực tiếp trên file:

```bash
grep -c "Run by: 23127362" reports/html-fr09-chromium/index.html    # 2
```

`scripts/verify-reports.mjs` tự kiểm cả 9 thư mục: có `index.html`, có định danh, có timestamp, và
đếm đủ 9 run — mục đích là phát hiện thiếu bằng chứng **trước** khi zip nộp.

---

## 13 bug

| ID | Feature | Bug | Mức | Issue |
|---|---|---|---|---|
| FR06-01 | FR-06 | Nút "Thêm vào giỏ hàng" bỏ qua lần bấm đầu tiên | Major | [#1](https://github.com/DecorNucuoi/software-testing-hw04/issues/1) |
| FR06-02 | FR-06 | Ô Số lượng chấp nhận `0` | Major | [#2](https://github.com/DecorNucuoi/software-testing-hw04/issues/2) |
| FR06-03 | FR-06 | Ô Số lượng chấp nhận số âm | Major | [#3](https://github.com/DecorNucuoi/software-testing-hw04/issues/3) |
| FR06-04 | FR-06 | Số lượng thập phân bị cắt cụt âm thầm | Minor | [#4](https://github.com/DecorNucuoi/software-testing-hw04/issues/4) |
| FR06-05 | FR-06 | Ô rỗng được chấp nhận, giỏ hiển thị `NaN` | Major | [#5](https://github.com/DecorNucuoi/software-testing-hw04/issues/5) |
| FR09-01 | FR-09 | Mã `percent` tính ra số **ÂM** — khách trả gấp 10 lần | **Critical** | [#6](https://github.com/DecorNucuoi/software-testing-hw04/issues/6) |
| FR09-02 | FR-09 | Áp được mã khi chưa đăng nhập (C4 không được kiểm) | Major | [#7](https://github.com/DecorNucuoi/software-testing-hw04/issues/7) |
| FR09-03 | FR-09 | Ngưỡng đơn tối thiểu dùng `>` thay vì `>=` | Major | [#8](https://github.com/DecorNucuoi/software-testing-hw04/issues/8) |
| FR09-04 | FR-09 | Định dạng số không nhất quán server ↔ giao diện | Minor | [#9](https://github.com/DecorNucuoi/software-testing-hw04/issues/9) |
| FR15-01 | FR-15 | Tên sản phẩm > 255 ký tự được chấp nhận | Major | [#10](https://github.com/DecorNucuoi/software-testing-hw04/issues/10) |
| FR15-02 | FR-15 | Giá `≤ 0` được chấp nhận | Major | [#11](https://github.com/DecorNucuoi/software-testing-hw04/issues/11) |
| FR15-03 | FR-15 | Giá rỗng / phi số được chấp nhận | Major | [#12](https://github.com/DecorNucuoi/software-testing-hw04/issues/12) |
| FR15-04 | FR-15 | Sửa 1 sản phẩm — giao diện đổi tên **toàn bộ** trong khi dữ liệu vẫn đúng | **Critical** | [#13](https://github.com/DecorNucuoi/software-testing-hw04/issues/13) |

Chi tiết, các bước tái hiện, và **Phụ lục A — 5 quan sát KHÔNG phải bug**: `bugs/HW04_bug_report.md`.

---

## Tài khoản seed của SUT

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@eshop.com` | `Admin123!` |
| User | `test@eshop.com` | `Test1234!` |

`setup_guide.md` của SUT ghi mật khẩu admin là `admin123` — **sai so với `backend/database.js`**.
Giá trị đúng là `Admin123!`.

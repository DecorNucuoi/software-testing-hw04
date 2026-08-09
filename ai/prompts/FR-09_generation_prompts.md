# FR-09 — Chuỗi prompt sinh script tự động (Feature B, Pool B)

- **Sinh viên:** 23127362
- **Feature:** FR-09 — Áp dụng mã giảm giá tại trang thanh toán
- **Nguồn test case:** `report/FR-09_Coupon.md` (HW02) — 15 case: DT1–DT8, BT1–BT7

Khác biệt lớn nhất so với FR-06: **FR-09 có trạng thái phía server**. Việc cô lập test không còn
miễn phí, và đó là chủ đề xuyên suốt chuỗi prompt này.

---

## PROMPT 1 — Bối cảnh và bài toán cô lập trạng thái. KHÔNG sinh code.

```
Bạn là kỹ sư kiểm thử tự động cấp cao. Ta làm việc qua nhiều bước. Bước này TUYỆT ĐỐI chưa
viết code, chỉ trả lời phần được hỏi ở cuối.

## Stack và repo
Playwright Test + TypeScript, ESM, Node 22, Windows. 3 project: chromium / firefox / webkit.
Repo đã có sẵn (KHÔNG sửa, chỉ dùng):

src/config.ts        -> STUDENT_ID; URLS { web: 'http://127.0.0.1:5173', api: 'http://127.0.0.1:3000' };
                        ACCOUNTS { admin: {email,password}, user: {email,password} }; RUN_TIMESTAMP
src/fixtures.ts      -> test, expect, logRunHeader(scope), fixture blockedRequests
                        (test đã extend sẵn, tự chặn mọi request ra ngoài 127.0.0.1/localhost)
src/utils/data-loader.ts -> loadCsv<T>(file), loadJson<T>(file), toNumber(v, field), toBoolean(v)
src/utils/api.ts     -> loginViaApi(request, role) trả { token, user }; uniqueName(prefix)

Đã làm xong FR-06 theo cùng bộ quy ước, và các quy ước đó tiếp tục áp dụng:
- spec import { test, expect } từ '../src/fixtures', KHÔNG từ '@playwright/test'
- CẤM mảng/object dữ liệu cứng trong spec; mọi dữ liệu nằm ở /data dạng .csv hoặc .json
- tối thiểu 3 KIỂU assertion phân biệt được, đánh số và đánh dấu tại chỗ
- page object KHÔNG chứa expect
- oracle số tiền tính bằng BigInt, không đi qua số dấu phẩy động
- CẤM test.skip / test.fixme / test.fail
- comment tiếng Việt, giải thích "vì sao" chứ không mô tả lại "cái gì"
- không waitForTimeout cố định

## Đặc tả FR-09 (nguồn chân lý duy nhất, không suy diễn thêm)

Mã giảm giá chỉ được áp dụng khi ĐỒNG THỜI thoả 5 điều kiện:
  C1 — mã tồn tại và đang bật (is_active = 1)
  C2 — chưa hết hạn (hôm nay < expired_at)
  C3 — tổng đơn hàng >= min_order_amount
  C4 — người dùng đã đăng nhập (JWT hợp lệ)
  C5 — số lần user đã dùng mã < max_uses_per_user
Cách tính giảm giá:
  type = 'percent' -> discount = total * discount_value / 100
  type = 'fixed'   -> discount = discount_value
Thành tiền cuối = total - discount.

Coupon seed sẵn trong DB:
  SAVE10  percent 10   min 300000  max_uses/user 1  hạn 2099-12-31
  BIGBUY  fixed   50000 min 500000 max_uses/user 1  hạn 2099-12-31
  VIP100  fixed  100000 min 300000 max_uses/user 2  hạn 2099-12-31
  EXPIRED percent 20   min 100000  max_uses/user 1  hạn 2020-01-01

## Cấu trúc DOM thật của trang /checkout (trích từ HTML render ra)

<h2>Xác Nhận Đơn Hàng</h2>
<h3>Sản phẩm:</h3>
<ul><li>Tên sản phẩm x 2 — 60.000.000 ₫</li></ul>

<label class="font-semibold">Tổng tiền thanh toán (VND):</label>
<input type="number" class="border p-2 rounded text-red-600 font-bold">
   <!-- KHÔNG có htmlFor. Ô này người dùng sửa được, và giá trị của nó là tổng đơn hàng
        được gửi lên khi áp mã. -->

<div class="mb-6 p-4 bg-gray-50 border rounded">
  <label class="font-semibold block mb-2">Mã Giảm Giá</label>
  <input type="text" placeholder="Nhập mã giảm giá..." class="flex-1 border p-2 rounded uppercase">
  <button class="bg-orange-500 ...">Áp dụng</button>   <!-- nhãn đổi thành "..." khi đang gửi -->
                                                        <!-- disabled khi ô mã rỗng -->
  <!-- Khi lỗi: -->   <p class="mt-2 text-red-600 text-sm">Thông báo lỗi từ server</p>
  <!-- Khi thành công: -->
  <div class="mt-2 text-green-700 text-sm space-y-1">
    <p>✅ Áp dụng thành công! Giảm 10%</p>
    <p>Tiết kiệm: <strong>40.000 ₫</strong></p>
    <p>Thành tiền: <strong class="text-lg">360.000 ₫</strong></p>
  </div>
</div>

<div class="mb-4 text-right"><span class="font-bold text-xl">Tổng thanh toán: 360.000 ₫</span></div>
<button class="w-full bg-green-600 ...">Xác Nhận Thanh Toán</button>

Lưu ý: ô nhập mã có class CSS "uppercase" (chỉ ảnh hưởng hiển thị), và giá trị được viết hoa
trước khi gửi lên server. Mọi số tiền hiển thị qua Number.prototype.toLocaleString().

## Trạng thái đăng nhập
Token JWT được lưu ở localStorage với key "token". Trang đọc key này khi mount, nên trạng thái
đăng nhập SỐNG SÓT qua việc tải lại trang — khác hẳn giỏ hàng ở FR-06 (chỉ nằm trong bộ nhớ).

## API dùng cho SETUP / TEARDOWN (không phải đối tượng kiểm thử)
POST   /api/login                  { email, password } -> { token, user }
POST   /api/admin/coupons          header Bearer; { code, type, discount_value, min_order_amount,
                                     expired_at, max_uses_per_user } -> { id }
DELETE /api/admin/coupons/:id      header Bearer
POST   /api/coupon-usage           header Bearer; { coupon_id }  -> ghi 1 lượt sử dụng cho user
                                     đang đăng nhập
Cột `code` của bảng coupons có ràng buộc UNIQUE.

## Bài toán bạn phải giải ở bước này

FR-06 được cô lập miễn phí vì giỏ hàng chỉ nằm trong bộ nhớ trang. FR-09 thì không: bảng
coupon_usage là dữ liệu thật trong SQLite và tồn tại qua các lần chạy.

Trả lời 4 mục, bằng lời, chưa viết code:

(a) Chạy suite FR-09 hai lần liên tiếp trên cùng một database. Những ca nào cho kết quả khác
    nhau giữa lần 1 và lần 2? Giải thích cơ chế.

(b) Đề xuất chiến lược cô lập trạng thái. Nêu rõ: cái gì được tạo ra lúc nào, bị xoá lúc nào,
    và điều gì xảy ra nếu một test sập giữa chừng trước khi kịp dọn.

(c) Chạy 3 browser lần lượt trên cùng một database, cùng một tài khoản người dùng. Nêu các
    xung đột có thể xảy ra và cách bạn tránh.

(d) Chiến lược selector cho: ô Tổng tiền thanh toán, ô Mã Giảm Giá, nút Áp dụng, thông báo lỗi,
    khối kết quả thành công (Tiết kiệm / Thành tiền), và dòng Tổng thanh toán.
    Biết rằng KHÔNG có data-testid, các <label> không gắn với input, và trang có TỔNG CỘNG
    hai ô nhập cùng lúc (một number, một text).
```

---

## PROMPT 2 — Thiết kế dữ liệu

```
Bước 2: thiết kế file dữ liệu. Chưa viết spec.

15 test case từ báo cáo Domain Testing + BVA đã nộp. Cột "Điều kiện bị vi phạm" cho biết ca đó
sinh ra để soi điều kiện nào; các điều kiện còn lại phải hợp lệ VÀ phải nằm xa biên của chính
chúng, để một lần đỏ chỉ có duy nhất một cách giải thích.

| TC  | Mã       | Đăng nhập | Tổng đơn      | Đã dùng | Điều kiện soi | Kỳ vọng theo đặc tả                        |
|-----|----------|-----------|---------------|---------|---------------|--------------------------------------------|
| DT1 | SAVE10   | có        | 400000        | 0       | tính percent  | Giảm 40000, còn 360000                     |
| DT2 | BIGBUY   | có        | 600000        | 0       | tính fixed    | Giảm 50000, còn 550000                     |
| DT3 | INVALID  | có        | 500000        | 0       | C1            | Lỗi: mã không tồn tại                      |
| DT4 | (rỗng)   | có        | 500000        | 0       | C1            | Không gửi được / nút bị vô hiệu hoá         |
| DT5 | EXPIRED  | có        | 200000        | 0       | C2            | Lỗi: mã đã hết hạn                         |
| DT6 | SAVE10   | có        | 200000        | 0       | C3            | Lỗi: chưa đủ giá trị tối thiểu 300000      |
| DT7 | SAVE10   | KHÔNG     | 400000        | -       | C4            | Lỗi / yêu cầu đăng nhập                    |
| DT8 | SAVE10   | có        | 400000        | 1       | C5            | Lỗi: đã đạt giới hạn (1 < 1 sai)           |
| BT1 | SAVE10   | có        | 299999        | 0       | C3 biên dưới-1| Bị từ chối                                 |
| BT2 | SAVE10   | có        | 300000        | 0       | C3 ĐÚNG biên  | Được áp dụng (300000 >= 300000)            |
| BT3 | SAVE10   | có        | 300001        | 0       | C3 biên+1     | Được áp dụng                               |
| BT4 | VIP100   | có        | 400000        | 1       | C5 biên-1     | Được áp dụng (1 < 2)                       |
| BT5 | VIP100   | có        | 400000        | 2       | C5 ĐÚNG biên  | Bị từ chối (2 < 2 sai)                     |
| BT6 | (tự tạo) | có        | 150000        | 0       | giảm > tổng   | Thành tiền không được âm                   |
| BT7 | SAVE10   | có        | 9999999999    | 0       | số rất lớn    | Tính đúng, hiển thị không vỡ               |

Ràng buộc thiết kế:

J1. DT5 dùng tổng 200000 trong khi EXPIRED có min = 100000 -> C3 hợp lệ, C2 là điều kiện duy
    nhất bị vi phạm. Giữ nguyên các con số này, đừng "làm tròn cho đẹp": chúng được chọn để
    cô lập điều kiện.

J2. BT6 KHÔNG có coupon seed nào thoả. Mọi coupon mẫu đều có min_order_amount >= discount_value,
    nên tình huống "giảm nhiều hơn tổng" không thể chạm tới bằng dữ liệu seed — báo cáo HW02
    đã phải bỏ ca này. Bạn PHẢI tạo coupon riêng cho ca này qua API admin. Nêu rõ tham số bạn
    chọn và vì sao chúng làm C1..C5 đều hợp lệ mà vẫn khiến giảm giá vượt tổng.

J3. Các ca C5 (DT8, BT4, BT5) cần số lần đã dùng chính xác bằng 0, 1, 2. Dùng coupon seed
    (SAVE10, VIP100) sẽ khiến lần chạy thứ hai sai. Quyết định: dùng coupon seed hay coupon tự
    tạo? Nêu quyết định và hệ quả của nó lên cột "Mã" trong file dữ liệu.

J4. Ô Tổng đơn hàng nhận giá trị trực tiếp từ dữ liệu. Giải thích trong phần diễn giải VÌ SAO
    ta đặt tổng đơn qua ô nhập thay vì dựng giỏ hàng cho đủ tiền — nêu rõ đây là ràng buộc của
    SUT chứ không phải sự lười biếng.

J5. Mỗi dòng phải có cột ghi CĂN CỨ ĐẶC TẢ như đã làm ở FR-06, và cột mã test case gốc.

Trả về: nội dung file dữ liệu đầy đủ + bảng giải thích từng cột + quy ước cho giá trị đặc biệt
(mã rỗng ở DT4, trạng thái không đăng nhập ở DT7, coupon phải tạo động ở BT6 và các ca C5).
Chọn .csv hay .json tuỳ bạn — nhưng phải nêu lý do chọn, biết rằng một số ca cần mô tả cả tham
số của coupon sẽ được tạo động.
```

---

## PROMPT 3 — Page object và lớp quản lý trạng thái

```
Bước 3: tách page object và lớp dựng/dọn trạng thái. Chưa viết spec.

3a. src/pages/checkout.page.ts — class CheckoutPage
    Phương thức tối thiểu: goto(); setOrderTotal(value: string); enterCouponCode(code: string);
    applyCoupon(); isApplyButtonEnabled(); getErrorText(); getDiscountReading();
    getFinalAmountReading(); getGrandTotalReading().
    Các phương thức đọc tiền phải trả về CẢ chuỗi chữ số đã chuẩn hoá lẫn chuỗi hiển thị nguyên
    văn, theo đúng quy ước đã dùng ở FR-06 (bóc tách không đi qua số dấu phẩy động; nếu chuỗi
    không khớp định dạng nhóm vi-VN thì trả null thay vì cố đoán).
    KHÔNG có expect trong file này.

3b. src/utils/coupon-fixture.ts — lớp dựng và dọn trạng thái
    Cung cấp đủ để: tạo coupon với tham số tuỳ ý; ghi N lượt sử dụng cho một user; xoá coupon.
    Yêu cầu:
    - Mã coupon sinh ra phải VIẾT HOA. Trang thanh toán viết hoa chuỗi người dùng nhập trước khi
      gửi lên server, nên mã chứa chữ thường sẽ không bao giờ khớp và test sẽ đỏ vì lý do sai.
    - Mã phải duy nhất giữa các test và giữa các browser chạy song song trên cùng database.
    - Việc dọn dẹp phải chạy KỂ CẢ khi test đã đỏ giữa chừng.
    - Nêu rõ điều gì còn sót lại trong database sau khi dọn, và vì sao phần sót đó vô hại.

3c. Đăng nhập
    Nêu hai cách đưa trình duyệt vào trạng thái đã đăng nhập: đi qua form đăng nhập, hoặc lấy
    token qua API rồi nạp vào localStorage trước khi trang khởi tạo. Chọn một, giải thích đánh
    đổi. Nhắc lại: FR-09 kiểm mã giảm giá, KHÔNG kiểm chức năng đăng nhập; và form đăng nhập có
    hai ô nhập đều là type="text", nhãn không gắn với ô.
    Ca DT7 cần trạng thái CHƯA đăng nhập — nêu cách bạn đảm bảo trạng thái đó thực sự sạch.
```

---

## PROMPT 4 — File spec

```
Bước 4: viết tests/fr09-coupon.spec.ts.

Ràng buộc:

K1. Vòng lặp tra bảng, không lồng if theo tc_id. Ba trục rẽ nhánh dự kiến: cần đăng nhập hay
    không, coupon là seed hay tạo động, kỳ vọng áp dụng được hay bị từ chối. Nếu thấy mình viết
    if (tc_id === ...) thì quay lại sửa file dữ liệu.

K2. Đầu file liệt kê các KIỂU assertion, đánh số, đánh dấu tại từng chỗ dùng.

K3. Oracle tiền tính bằng BigInt từ tham số coupon và tổng đơn lấy từ dữ liệu. CẤM hằng số tiền
    viết cứng trong spec. Với coupon percent, chú ý phép chia cho 100 — nêu rõ bạn xử lý phần dư
    thế nào và căn cứ vào đâu, vì đặc tả không nói gì về làm tròn.

K4. Ca bị từ chối: bằng chứng là thông báo lỗi HIỆN DIỆN và khối kết quả thành công KHÔNG hiện
    diện. Chỉ kiểm một trong hai là chưa đủ — nêu rõ trong comment vì sao.
    KHÔNG khẳng định nội dung chính xác của thông báo lỗi trừ khi đặc tả có nói; nhưng PHẢI
    khẳng định lỗi trả về đúng ĐIỀU KIỆN bị vi phạm khi thông báo có nêu. Giải thích cách bạn
    cân bằng hai điều này mà không tự chế ràng buộc.

K5. DT4 (mã rỗng): kỳ vọng theo đặc tả là không gửi được. Nút bị vô hiệu hoá là một cách hiện
    thực điều đó, nhưng KHÔNG phải điều duy nhất đúng. Viết assertion sao cho nó kiểm mệnh đề
    của đặc tả chứ không kiểm cách hiện thực.

K6. BT7 tổng 9999999999 với coupon percent: đây là chỗ oracle BigInt phải chứng minh giá trị.
    Nêu rõ phép tính kỳ vọng của bạn dưới dạng chuỗi chữ số đầy đủ.

K7. Tiêu đề test bắt đầu bằng mã test case, rồi điều kiện đang soi, rồi mô tả.
    Gọi logRunHeader('fr09') ở beforeAll.

K8. Mọi assertion phải có message chứa giá trị thực đọc được từ SUT: chuỗi tiền nguyên văn,
    thông báo lỗi nguyên văn, trạng thái đăng nhập. Khi nhiều test cùng đỏ, message là thứ duy
    nhất phân biệt "SUT sai" với "script sai" với "dữ liệu chưa dựng xong".

Trả về nguyên nội dung file.
```

---

## PROMPT 5 — Tự rà soát

```
Bước 5: tự rà soát. Không viết lại code.

1. Test nào phụ thuộc vào việc test khác đã chạy xong? Chỉ ra cơ chế cụ thể.
2. Nếu chạy suite này hai lần liên tiếp không reset database, ca nào đổi kết quả? Vì sao?
3. Assertion nào vẫn pass ngay cả khi SUT hỏng? Nêu kịch bản hỏng cụ thể bị bỏ lọt.
4. Giả định nào bạn tự đưa vào mà đặc tả FR-09 không nói?
5. Ca nào không thể tự động hoá một cách đáng tin cậy, và vì sao?
6. Nếu server trả về thông báo lỗi bằng ngôn ngữ hoặc câu chữ khác, bao nhiêu test của bạn đỏ?
   Con số đó có phản ánh đúng mức độ nghiêm trọng không?
7. Việc dọn dẹp của bạn có bỏ sót gì trong database không? Sau 50 lần chạy suite thì sao?
```

---

## Sau khi có output

1. Lưu 5 cặp prompt/output kèm timestamp cho §9.
2. Chép file vào repo đúng đường dẫn.
3. **Chưa chạy.** Đưa lại toàn bộ output để rà soát, rồi chạy chromium trước, triage, mới bung 3 browser.

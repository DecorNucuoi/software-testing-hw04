# FR-06 — Chuỗi prompt sinh script tự động (Feature A, Pool A)

- **Sinh viên:** 23127362
- **Feature:** FR-06 — Product Detail, ô Số lượng + nút "Thêm vào giỏ hàng"
- **Nguồn test case:** `report/FR-06_ProductDetail.md` (HW02) — 14 case: DT1–DT8, BT1–BT6

## Vì sao chia 5 prompt

Đề §6 Task 1 bullet 1 yêu cầu *"drive an AI tool — step by step, not with a single generic prompt"*.
Một prompt gộp "viết hết script cho FR-06" vi phạm trực tiếp yêu cầu này. Chuỗi dưới đây tách theo
đúng các bước của quy trình automation: chốt hợp đồng kỹ thuật → thiết kế dữ liệu → tách Page Object
→ viết spec → tự rà soát.

**Sau mỗi prompt: lưu lại nguyên văn prompt + nguyên văn output + timestamp.** §9 bắt buộc.

---

## PROMPT 1 — Thiết lập bối cảnh, KHÔNG sinh code

```
Bạn là kỹ sư kiểm thử tự động cấp cao. Ta sẽ làm việc qua nhiều bước; bước này bạn TUYỆT ĐỐI
chưa được viết code, chỉ trả lời đúng phần được hỏi ở cuối.

## Stack
Playwright Test + TypeScript, ESM ("type": "module"), Node 22, chạy trên Windows.
3 project browser: chromium / firefox / webkit.

## Cấu trúc repo đã có sẵn (KHÔNG được sửa, chỉ được dùng)

src/config.ts export:
  STUDENT_ID: string
  URLS: { web: 'http://127.0.0.1:5173', admin: 'http://127.0.0.1:5174', api: 'http://127.0.0.1:3000' }
  ACCOUNTS: { admin: {email,password}, user: {email,password} }
  RUN_TIMESTAMP: string

src/fixtures.ts export:
  test    // đã extend từ @playwright/test, tự cài network guard chặn request ra internet
  expect
  logRunHeader(scope: string): void
  // fixture bổ sung: blockedRequests: string[]

src/utils/data-loader.ts export:
  loadCsv<T extends Record<string,string>>(fileName: string): T[]   // đọc từ thư mục /data
  loadJson<T>(fileName: string): T[]                                 // đọc từ thư mục /data
  toNumber(value: string, field: string): number
  toBoolean(value: string): boolean

src/utils/api.ts export:
  loginViaApi(request, role): Promise<{token, user}>
  getProducts(request): Promise<Product[]>
  getProductById(request, id): Promise<Product>
  createProduct(request, product): Promise<number>
  deleteProduct(request, id): Promise<void>
  uniqueName(prefix: string): string

## Ràng buộc bắt buộc
1. Spec PHẢI import { test, expect } từ '../src/fixtures', KHÔNG import từ '@playwright/test'.
   Import sai thì network guard không được áp và test sẽ flaky trên WebKit.
2. CẤM để mảng/object dữ liệu test cứng trong file spec. Mọi dữ liệu phải nằm trong .csv hoặc
   .json ở thư mục /data và nạp qua data-loader. Đây là yêu cầu chấm điểm, không phải sở thích.
3. Phải dùng ít nhất 3 KIỂU assertion khác nhau (ví dụ: assertion trên locator của trang,
   assertion trên giá trị đã trích xuất, assertion trên response API, assertion phủ định...).
   Nêu rõ trong comment mỗi chỗ đang dùng kiểu nào.
4. Không được sửa source của SUT. SUT KHÔNG có thuộc tính data-testid nào.
5. Comment trong code viết bằng tiếng Việt, giải thích "vì sao" chứ không mô tả lại "cái gì".
6. Không dùng waitForTimeout cố định. Dùng web-first assertion hoặc chờ theo điều kiện.

## Đặc tả FR-06 (đây là nguồn chân lý, KHÔNG suy diễn thêm ràng buộc nào khác)
"Ô Số lượng chỉ nhận số nguyên dương, tối thiểu là 1. Nút Thêm vào giỏ hàng, sau khi bấm,
phải hiển thị phản hồi trực quan (thông báo hoặc cập nhật số lượng trên giỏ)."

Hệ quả: miền hợp lệ là số nguyên >= 1. Đặc tả KHÔNG định nghĩa giá trị tối đa, KHÔNG có khái
niệm tồn kho. Đừng tự bịa ra ràng buộc tồn kho hay giới hạn trên.

## Cấu trúc DOM thật của SUT (trích từ HTML render ra, không phải mã nguồn)

Trang chi tiết sản phẩm — đường dẫn /product/:id
  <h1 class="text-3xl font-bold mb-4">Tên sản phẩm</h1>
  <p class="text-2xl text-red-600 font-bold mb-4">30.000.000 ₫</p>
  <p class="text-gray-700 mb-6 flex-grow">Mô tả</p>
  <div class="flex items-center gap-4 mb-4">
    <label>Số lượng:</label>          <!-- KHÔNG có htmlFor, KHÔNG gắn với input -->
    <input type="number" class="border p-2 w-20 rounded">
  </div>
  <button class="bg-green-600 ...">Thêm vào giỏ hàng</button>
  <!-- nhãn nút đổi thành "Đã thêm" sau khi thêm thành công, rồi tự quay lại sau 2 giây -->

Header (mọi trang)
  <a href="/">EShop</a>
  <a href="/cart">Giỏ hàng</a>       <!-- không có badge số lượng -->
  <a href="/login">Đăng nhập</a>

Trang giỏ hàng — đường dẫn /cart
  Khi rỗng:  <h2>Giỏ hàng của bạn đang trống</h2>
  Khi có hàng: <table> với các cột: Sản phẩm | Giá | Số lượng | Thành tiền | Thao tác
               dòng tổng: "Tổng tạm tính: <span>1.000.000 ₫</span>"
  Số hiển thị theo định dạng Number.prototype.toLocaleString() của locale vi-VN.

## Dữ liệu seed sẵn trong DB
5 sản phẩm, id 1..5. id=1 là "iPhone 15 Pro Max", giá 30000000.

## Việc của bạn ở BƯỚC NÀY
Chưa viết code. Chỉ trả lời 3 mục:
(a) Liệt kê những thông tin còn thiếu khiến bạn chưa thể viết test một cách chắc chắn.
(b) Với ô Số lượng và nút Thêm vào giỏ hàng, đề xuất chiến lược selector và giải thích vì sao
    lựa chọn đó bền hơn các lựa chọn khác, biết rằng SUT không có data-testid và thẻ <label>
    không được gắn với input.
(c) Nêu cách bạn sẽ kiểm chứng "sản phẩm đã thực sự vào giỏ", trong điều kiện header không có
    badge số lượng.
```

---

## PROMPT 2 — Thiết kế file dữ liệu

```
Tốt. Bước 2: thiết kế file dữ liệu. Vẫn chưa viết file spec.

Dưới đây là 14 test case đã thiết kế bằng Domain Testing + Boundary Value Analysis ở bài trước.
Nhiệm vụ của bạn là chuyển chúng thành MỘT file CSV để spec nạp bằng loadCsv().

| TC   | Quantity           | Hành động        | Kỹ thuật | Kỳ vọng theo đặc tả              |
|------|--------------------|------------------|----------|----------------------------------|
| DT1  | 5                  | click 1 lần      | EP       | Thêm 5 sản phẩm, có phản hồi     |
| DT2  | 0                  | click 1 lần      | EP       | Bị từ chối, không thêm           |
| DT3  | -1                 | click 1 lần      | EP       | Bị từ chối                       |
| DT4  | 1.5                | click 1 lần      | EP       | Bị từ chối (chỉ nhận số nguyên)  |
| DT5  | (rỗng)             | click 1 lần      | EP       | Bị từ chối, tổng tiền không NaN  |
| DT6  | abc                | click 1 lần      | EP       | Bị từ chối, tổng tiền không NaN  |
| DT7  | 9999999999         | click 1 lần      | EP       | Quan sát: đặc tả không có cận trên |
| DT8  | 5                  | click liên tục   | EP       | Quan sát số lượng thực tế được thêm |
| BT1  | 0                  | click 1 lần      | BVA LB-1 | Bị từ chối                       |
| BT2  | 1                  | click 1 lần      | BVA LB   | Được chấp nhận, có phản hồi      |
| BT3  | 2                  | click 1 lần      | BVA LB+1 | Được chấp nhận, có phản hồi      |
| BT4  | 9999999999         | click 1 lần      | BVA UI   | Tính toán/hiển thị đúng          |
| BT5  | 9007199254740992   | click 1 lần      | BVA UI   | Vượt MAX_SAFE_INTEGER, quan sát  |
| BT6  | +5                 | click 1 lần      | BVA adv  | Quan sát việc tự động sửa giá trị |

Yêu cầu với file CSV:
- Đường dẫn: data/fr06-quantity.csv
- Phải tự mô tả được: mỗi dòng đọc lên là hiểu ngay test đó kiểm cái gì và kỳ vọng gì,
  KHÔNG cần mở file spec.
- Phải mã hoá được sự khác biệt giữa "kỳ vọng được chấp nhận" và "kỳ vọng bị từ chối", để spec
  chỉ cần một vòng lặp duy nhất thay vì viết tay 14 khối test riêng.
- Phải xử lý được ô Quantity rỗng (DT5) — CSV không phân biệt được chuỗi rỗng với ô trống.
  Nêu rõ quy ước bạn chọn.
- Ghi kèm cột kỹ thuật (EP / BVA) và cột mã test case gốc, để truy vết ngược về báo cáo HW02.

Trả về: nội dung CSV đầy đủ + bảng giải thích ý nghĩa từng cột + quy ước cho các giá trị đặc biệt.
```

---

## PROMPT 3 — Page Object

```
Bước 3: tách Page Object. Vẫn chưa viết spec.

Tạo file src/pages/product-detail.page.ts, export class ProductDetailPage.

Yêu cầu:
- Constructor nhận Page của Playwright.
- Các locator khai báo là thuộc tính readonly, khởi tạo trong constructor (không tạo lại
  locator mỗi lần gọi hàm).
- Phương thức tối thiểu:
    goto(productId: number)
    setQuantity(value: string)        // nhận string vì cần đặt được cả '' và '1.5'
    addToCart()
    getQuantityValue(): Promise<string>
    getAddButtonLabel(): Promise<string>
    openCart()                        // đi tới trang /cart
- Bổ sung một class CartPage trong src/pages/cart.page.ts với các phương thức đủ để khẳng định
  một sản phẩm có trong giỏ hay không, số lượng bao nhiêu, và tổng tạm tính là bao nhiêu
  (trả về dạng số đã bóc tách khỏi chuỗi định dạng "30.000.000 ₫").
- Mỗi locator kèm comment tiếng Việt giải thích vì sao chọn cách định vị đó và nó gãy khi nào.

Lưu ý: ô Số lượng là <input type="number"> và thẻ <label>Số lượng:</label> KHÔNG được liên kết
với nó, nên getByLabel() sẽ không hoạt động.
```

---

## PROMPT 4 — File spec

```
Bước 4: viết file spec.

Tạo tests/fr06-product-detail.spec.ts.

Yêu cầu bắt buộc:
- import { test, expect, logRunHeader } from '../src/fixtures'
- Nạp dữ liệu bằng loadCsv từ src/utils/data-loader. KHÔNG có mảng dữ liệu cứng nào trong file.
- Sinh test bằng cách lặp trên dữ liệu đã nạp. Tiêu đề mỗi test phải chứa mã test case gốc
  (DT1..DT8, BT1..BT6) để đối chiếu với báo cáo HW02.
- Dùng ít nhất 3 kiểu assertion khác nhau, mỗi chỗ có comment ghi rõ đang dùng kiểu nào và vì sao
  kiểu đó phù hợp với điều đang kiểm.
- Mỗi test phải độc lập: trạng thái giỏ hàng của test này không được ảnh hưởng test khác.
  Giải thích trong comment cơ chế bạn dùng để đảm bảo điều đó.
- Với các case "quan sát hành vi" (DT7, DT8, BT5, BT6): assertion phải khẳng định điều đặc tả
  đòi hỏi, KHÔNG được viết assertion mô tả lại hành vi sai hiện có của SUT rồi cho pass.
  Test thất bại vì SUT sai là kết quả ĐÚNG và mong muốn.
- Gọi logRunHeader('fr06') trong beforeAll.

Trả về nguyên nội dung file.
```

---

## PROMPT 5 — Tự rà soát

```
Bước 5: tự rà soát chính bạn.

Rà lại toàn bộ code bạn vừa sinh ở bước 3 và 4, trả lời thẳng thắn:

1. Selector nào trong code của bạn là dễ gãy nhất? Nó gãy khi SUT thay đổi điều gì?
2. Assertion nào yếu, tức là vẫn pass ngay cả khi SUT hỏng theo một cách nào đó? Nêu cụ thể
   kịch bản hỏng mà assertion đó bỏ lọt.
3. Test nào có nguy cơ flaky? Vì sao? Nguy cơ đó khác nhau thế nào giữa chromium, firefox, webkit?
4. Giả định nào bạn đã tự đưa vào mà đặc tả FR-06 không hề nói? Liệt kê hết.
5. Trong 14 test case, case nào bạn cho là KHÔNG thể tự động hoá một cách đáng tin cậy? Vì sao?
6. Nếu chạy toàn bộ 14 test này liên tiếp trong cùng một file, có test nào làm hỏng test sau nó
   không? Chỉ ra cơ chế cụ thể.

Trả lời dưới dạng bảng, không viết lại code ở bước này.
```

---

## Sau khi có output

1. Lưu 5 cặp prompt/output kèm timestamp vào `ai/prompt_log.md` (phục vụ §9).
2. Chép các file AI sinh ra vào repo theo đúng đường dẫn đã yêu cầu.
3. **Chưa chạy vội.** Đưa lại toàn bộ output cho bước rà soát của người — đó là §6 Task 1 bullet 4,
   và là phần tôi sẽ soi kỹ nhất trước khi cho chạy.

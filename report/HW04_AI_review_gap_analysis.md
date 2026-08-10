# HW04 — Rà soát của người đối với script do AI sinh

- **Sinh viên:** 23127362
- **SUT:** EShop — https://github.com/ttbhanh/eshop-sut
- **Suite:** 54 test case · 162 lượt chạy · 9 browser run · 13 bug

---

## 1. Cách làm việc

Mỗi feature dùng **một công cụ AI khác nhau**, và mỗi feature đi qua **chuỗi 5 prompt tuần tự**
thay vì một prompt gộp (yêu cầu §6 Task 1 bullet 1):

| Bước | Nội dung | Sản phẩm |
|---|---|---|
| 1 | Bối cảnh + hợp đồng kỹ thuật, **cấm sinh code** | Chiến lược selector, danh sách giả định |
| 2 | Thiết kế file dữ liệu từ bộ ca HW02 | `.csv` / `.json` trong `/data` |
| 3 | Page object + lớp dựng/dọn trạng thái | `src/pages/*`, `src/utils/*` |
| 4 | File spec data-driven | `tests/*.spec.ts` |
| 5 | Bắt AI tự phê bình chính nó | Bảng tự rà soát |

Giữa các bước luôn có một **bước rà soát của người** (đánh số 1.5, 2.5, 3.5, 4.5). Toàn bộ lỗi
liệt kê ở mục 2 được phát hiện ở các bước rà soát này hoặc từ kết quả chạy thật, không phải từ
việc đọc lướt code.

Nguyên tắc tôi giữ suốt quá trình: **chặn trước những gì gây xanh giả, thả cho những gì gây đỏ ồn
ào.** Một test đỏ sai lý do tốn một vòng chạy; một test xanh sai lý do thì không ai phát hiện.

---

## 2. Lỗi của AI — phân loại và nguyên nhân

### Loại A — Cơ chế được dựng đúng, nhưng một mắt xích khiến cơ chế mất tác dụng

Đây là loại nguy hiểm nhất và cũng phổ biến nhất: **bốn trên tám lỗi**. Điểm chung là AI thiết kế
một cơ chế phòng vệ hợp lý, rồi tự vô hiệu hoá nó ở một chi tiết mà chỉ khi chạy thật mới lộ ra.

#### A1 · FR-09 — Đọc DOM trước khi khẳng định phần tử tồn tại

- **Triệu chứng:** DT7 và BT2 đỏ bằng `TimeoutError: locator.innerText: Timeout 10000ms exceeded`,
  không phải bằng assertion.
- **Nguyên nhân:** cả hai nhánh khẳng định đều gọi `innerText()` **trước** khi assert sự hiện diện.
  Ở DT7 mã lại áp được nên không có phần tử lỗi; ở BT2 mã bị từ chối nên không có khối thành công.
- **Vì sao lọt:** AI đã soạn thông điệp assertion rất công phu — chứa nguyên văn chuỗi SUT in ra,
  chênh lệch bao nhiêu đồng, ngưỡng nào bị vượt. Chính sự công phu đó tạo cảm giác "phần chẩn đoán
  đã được lo xong", trong khi **đường đi tới thông điệp** mới là chỗ hỏng. Thông điệp không bao giờ
  được in ra, đúng ở hai ca nhiều thông tin nhất.
- **Sửa:** đảo thứ tự — web-first assertion về sự hiện diện trước, đọc giá trị sau. Giá trị chỉ dùng
  dựng message thì bọc `catch`.
- **Kết quả:** DT7 đổi từ timeout 10s thành `"mã ĐÃ ĐƯỢC ÁP DỤNG dù điều kiện này không thoả; khối
  kết quả hiển thị Thành tiền 4.000.000 ₫"`.

#### A2 · FR-15 — Khoá so sánh giá dùng chuỗi thô chưa chuẩn hoá

- **Triệu chứng:** DT6, DT7, DT8, BT10 báo bất đồng giao diện–API. Bằng chứng:
  ```
  DT8:  BẢNG [scientific:1e+23 ₫]  |  API [scientific:1e+23]
  DT6:  BẢNG [empty:₫]             |  API [empty:]
  ```
  Hai vế giống hệt nhau **ngoại trừ hậu tố ` ₫`**.
- **Nguyên nhân:** với `kind: 'plain'` khoá là giá trị mili-đồng nên ký hiệu tiền đã bị bóc; với mọi
  `kind` khác khoá rơi về chuỗi hiển thị thô, mà chuỗi từ bảng luôn kèm `₫` còn từ API thì không.
- **Vì sao lọt:** AI xây kiểu union có nhãn (`plain` / `scientific` / `empty` / …) **chính xác để
  không bịa ra con số** khi gặp giá trị không parse được — một quyết định tốt. Nhưng nó chỉ chuẩn
  hoá nhánh `plain`, vì đó là nhánh nó đã suy nghĩ kỹ. Công cụ chống bịa số tự sinh ra bất đồng giả
  ở đúng những nhánh nó sinh ra để xử lý.
- **Sửa:** khoá so sánh cho **mọi** kind dựng từ chuỗi đã chuẩn hoá; chuỗi thô chỉ đi vào message.
- **Kết quả:** 4 ca hết dương tính giả; DT8/BT10 chuyển sang pass đúng bản chất (đặc tả không có
  cận trên nên chấp nhận số lớn là hành vi đúng).

#### A3 · FR-15 — Assertion tautology ở phép kiểm danh mục *(AI tự phát hiện)*

- **Triệu chứng:** không có triệu chứng. DT2 luôn xanh.
- **Nguyên nhân:** phép kiểm gọi `selectCategory(value)` rồi so `inputValue()` với chính `value` vừa
  đặt — tự đặt rồi tự đọc lại. Không bao giờ đỏ được, kể cả khi SUT hiển thị sai hoàn toàn.
- **Vì sao nghiêm trọng:** DT2 là ca **duy nhất** trong 24 ca kiểm được vế *"danh mục hiển thị đúng"*
  của FR-15. Nhánh đó đang không được kiểm gì cả.
- **Sửa:** thêm `readSelectedCategory()` chỉ đọc, không đặt; DT2 đọc rồi so với `category_id` từ API.
- **Kết quả:** DT2 vẫn pass sau khi sửa — nay là **kết luận thật** thay vì một hằng đúng.

#### A4 · FR-15 — Tiền đề "đã đăng nhập admin" không được khẳng định

- **Triệu chứng:** lần thử lại của DT7 đỏ bằng `locator.click: Timeout` khi bấm mục sidebar, và
  annotation ghi `trước=chưa đo được` — trang chưa bao giờ rời màn hình Admin Login.
- **Nguyên nhân:** `ensureAdminSession()` cố ý không assert (helper không nên phán quyết thay ca kiểm
  thử — nguyên tắc đúng), nhưng spec cũng không nhận lấy trách nhiệm đó. Tiền đề thành vùng không ai
  canh gác.
- **Vì sao lọt:** đây là hệ quả của một nguyên tắc thiết kế **tốt** được áp dụng nửa vời. AI thậm chí
  đã expose `AdminLoginPage.heading` cho đúng mục đích này mà spec không dùng tới.
- **Sửa:** spec khẳng định tiền đề ngay sau khi thiết lập phiên, message nhắc đúng key `localStorage`
  đang dùng.

### Loại B — Suy diễn vượt quá đặc tả

#### B1 · FR-06 — Tự thêm test case ngoài bộ đã thiết kế

AI đề xuất *"thêm một ca số lớn ví dụ 9999 và kỳ vọng thành công"*, ngoài 14 ca của HW02.
**Vì sao:** mô hình có xu hướng lấp đầy chỗ nó thấy "thiếu", kể cả khi phạm vi đã được chốt.
**Xử lý:** chặn ở bước 1.5. Vùng số lớn đã được DT7/BT4 phủ bằng `9999999999`.

#### B2 · FR-06 — Xin biết hành vi thực tế của SUT để viết kỳ vọng

AI hỏi thẳng: *"hành vi thực tế khi nhập 0 là gì?"*, *"SUT ràng buộc bằng `min` hay `onChange` hay
validate lúc submit?"*.

**Đây là câu hỏi mà trả lời là hỏng cả bài.** SUT này được cố ý cài lỗi. Nếu kỳ vọng được suy từ hành
vi quan sát được thay vì từ đặc tả, assertion sẽ mô tả lại chính cái sai và test xanh vĩnh viễn.

**Xử lý:** từ chối trả lời, kèm quy tắc áp cho toàn bộ phần còn lại — *mọi assertion phải trả lời được
câu "đặc tả nói gì", không phải "chương trình đang làm gì"*. Sau khi được nói rõ, AI giữ đúng nguyên
tắc này ở cả FR-09 và FR-15 mà không cần nhắc lại.

### Loại C — Assertion yếu

#### C1 · FR-06 — Dùng sự biến mất của nhãn nút làm dấu hiệu thành công

AI định dùng `expect(nút "Thêm vào giỏ hàng").toHaveCount(0)`. Nhãn tự quay lại sau 2 giây, nên count
trở về 1 mà không cần bất cứ thứ gì hỏng — assertion có **cửa sổ thời gian**, flaky ngay từ thiết kế.
**Vì sao lọt:** đây là **đặc điểm của SUT** (`setTimeout` 2 giây trong component), không phải điểm mù
của mô hình. Chỉ phát hiện được khi đọc kỹ mô tả hành vi nút.
**Sửa:** khẳng định theo chiều dương trên nhãn `"Đã thêm"`, và không lấy nó làm bằng chứng dữ liệu.

#### C2 · FR-09 + FR-15 — Oracle tính bằng chính cỗ máy đang bị nghi ngờ

Vế kỳ vọng của phép kiểm tiền được tính bằng số học JavaScript thông thường — cùng phép tính mà SUT
dùng. Khi phép tính đó mất chính xác, hai vế cùng sai theo cùng một cách và assertion trở thành
`f(x) === f(x)`, một hằng đúng.

**Vì sao lọt:** đây là điểm mù sâu nhất trong cả bài. Không phải lỗi cẩu thả — nó bắt nguồn từ việc
mặc định coi phép tính của ngôn ngữ là chân lý, trong khi **chính phép tính đó là đối tượng bị kiểm
thử**. Cùng một điểm mù xuất hiện độc lập ở hai công cụ AI khác nhau.

**Sửa:** toàn bộ oracle tiền chuyển sang `BigInt` trên thang mili-đồng; không có một phép chia hay
một lần đi qua số dấu phẩy động nào trên đường tính giá trị kỳ vọng.

**Ghi chú về mức độ:** ở đúng hai giá trị BT4/BT5 của FR-06, phép nhân **không** thực sự mất chính
xác (xem mục 3). Nhưng oracle chỉ đúng nhờ tính chất số học của một hằng số cụ thể là oracle sẽ hỏng
im lặng khi ai đó đổi giá seed. Việc thay thế là bắt buộc độc lập với chuyện may rủi đó.

---

## 3. Ba lần AI phản biện lại tôi, và AI đúng

Phần này quan trọng ngang phần liệt kê lỗi của AI, vì nó cho thấy quan hệ hai chiều chứ không phải
một chiều kiểm duyệt.

| # | Tôi khẳng định | AI phản biện | Kết luận |
|---|---|---|---|
| 1 | `2⁵³ × 30.000.000` vượt `MAX_SAFE_INTEGER` nên phép nhân mất chính xác, BT4/BT5 xanh giả | `30000000 = 2⁷ × 234375`, nên tích `= 2⁶⁰ × 234375`; định trị `234375 < 2⁵³` ⇒ **biểu diễn chính xác**. BT4 tương tự. | **AI đúng.** Tôi nhảy từ "tổng vượt ngưỡng" sang "phép nhân sai" — vượt ngưỡng chỉ nghĩa là không phải *mọi* số nguyên biểu diễn được, không nói gì về số cụ thể. Lập luận cấu trúc của tôi vẫn đứng, cơ chế thì sai. |
| 2 | Hai dòng dữ liệu bị ảnh hưởng (BT4, BT5) | Ba dòng — bỏ sót DT7, vốn cùng giá trị với BT4 | **AI đúng.** Hai dòng cùng dữ liệu mà khác độ chặt oracle là bất đối xứng khó phát hiện nhất khi đọc report. |
| 3 | `money.ts` áp lên `"0.1 ₫"` sẽ trả 1 đồng (sai âm thầm) | `parseVndDisplay("0.1 ₫")` **ném lỗi**; chỗ sai âm thầm là `"0.100 ₫"` — hợp lệ theo ngữ pháp vi-VN, xoá dấu chấm, ra 100 đồng thay vì 0,1 đồng, **lệch 1000 lần không một ngoại lệ** | **AI đúng, và cơ chế thật nguy hiểm hơn tôi mô tả.** AI dựng spec tạm chứng minh cả hai dạng rồi xoá. |

Đặc điểm chung của cả ba: AI phản biện **sau khi được cung cấp dữ kiện**, không phải sau khi bị ép,
và mỗi lần đều kèm chứng minh kiểm chứng được — đại số hoặc một kịch bản chạy thật.

---

## 4. Một giả thuyết hợp lý bị thực nghiệm bác bỏ

AI lo rằng `toLocaleString` bị giới hạn 21 chữ số có nghĩa, nên con số 24 chữ số của BT5 sẽ bị làm
tròn và mỗi engine ICU làm tròn một kiểu — dự báo BT4/BT5 sẽ lệch giữa 3 browser.

Chạy thật: **BT4 và BT5 pass đồng nhất trên cả Chromium, Firefox và WebKit.** Chuỗi 24 chữ số được in
đầy đủ và giống nhau.

Đây không phải lỗi của AI — giả thuyết hợp lý, có căn cứ, và regex kiểm hình dạng mà nó thêm vào đã
khiến giả thuyết trở nên **tự kiểm chứng được**. Nhưng nó minh hoạ giới hạn của suy luận không có dữ
liệu, và vì sao mọi phỏng đoán về hành vi engine phải được chạy chứ không được kết luận.

---

## 5. Automation đính chính kết luận của HW02

Sáu chỗ báo cáo HW02 (kiểm thử thủ công, quan sát bằng mắt) bị automation sửa lại:

| Ca | HW02 kết luận | Automation cho thấy | Bản chất khác biệt |
|---|---|---|---|
| FR-06 DT1/DT8 | Nghi vấn *"nút bỏ lỡ click đầu tiên"* là **không đúng** | **Đúng.** DT8 là ca `accept` duy nhất pass, và cũng là ca duy nhất bấm >1 lần. 7 ca bấm 1 lần đỏ hết. | Kiểm thử tay không phân biệt được "tôi bấm 1 lần" với "tôi bấm 2 lần mà không để ý" |
| FR-06 BT5 | **Fail** — tràn số, hiển thị sai | **Pass.** `2⁵³ × 30.000.000` biểu diễn chính xác; 24 chữ số in đúng trên cả 3 engine | Mắt người không kiểm được số 24 chữ số; oracle BigInt thì được |
| FR-06 DT7/BT4/BT6 | **Fail** — "không có cận trên hợp lý", "tự chuẩn hoá `+5`" | **Pass.** Đặc tả không định nghĩa cận trên; `+5` có giá trị số là 5 | Nhận xét về **thiết kế**, không phải vi phạm **đặc tả** |
| FR-09 BUG-01 | Giảm giá hiển thị `360.000` | Giảm giá là **`−3.600.000`**; thành tiền `4.000.000` trên đơn `400.000` | Khách phải trả **gấp 10 lần**. Mức độ nâng từ Major lên **Critical** |
| FR-15 BUG-03 | *"Tất cả sản phẩm bị đổi tên, thay đổi giá không được áp dụng"* | **Dữ liệu hoàn toàn đúng** — đúng 1 sản phẩm được cập nhật, đúng cả tên lẫn giá. Chỉ **giao diện** hiển thị sai | Đổi phân loại từ "hỏng dữ liệu" thành "giao diện nói dối dữ liệu". Cách sửa khác hẳn |
| FR-15 BUG-04 | **Fail** — hiển thị `1e+23 ₫` | **Pass** theo đặc tả; ghi nhận dạng quan sát | Không có cận trên trong đặc tả |

Bằng chứng cho FR-15 BUG-03 là diff của phép đối chiếu chéo:

```
BẢNG: 7 sản phẩm, TẤT CẢ mang cùng một tên, 7 mức giá khác nhau
API : mỗi sản phẩm giữ đúng tên riêng của nó
```

Nếu suite chỉ nhìn giao diện, nó kết luận "dữ liệu bị phá hoại hàng loạt". Nếu chỉ nhìn API, nó kết
luận "mọi thứ ổn". **Chỉ oracle hai nguồn mới nói đúng.**

---

## 6. Phát hiện cross-browser

| Ca | Chromium | Firefox | WebKit | Bản chất |
|---|---|---|---|---|
| FR-06 BT6 — `+5` vào `<input type=number>` | pass | **fail** | pass | Firefox để ô rỗng sau khi gán `+5`; hai engine kia giữ giá trị số |
| FR-15 DT6 — `abc` vào `<input type=number>` | fail | **pass** | fail | Firefox cho ký tự lọt vào ô rồi đánh dấu `:invalid`; hai engine kia nuốt ký tự |
| FR-09 (toàn bộ) | — | — | — | Không lệch một ca nào |

Hai kết luận:

1. **Lỗi FR-09 nằm ở server** nên không engine nào che được — dấu vân tay cross-browser phẳng lì.
   Lỗi FR-06/FR-15 liên quan `<input type="number">` thì lệch theo engine. Dạng phân bố này tự nó
   phân loại được tầng phát sinh lỗi.
2. Cả hai ca lệch đều là **khác biệt engine, không phải bug SUT**. Chúng vẫn phải nằm trong báo cáo,
   nhưng ở mục tương thích chứ không ở bug report.

Ngoài ra, một vấn đề hạ tầng thuần tuý: **WebKit trên Windows crash khi bật ghi video**
(`Target page, context or browser has been closed`). Xử lý bằng `video: 'off'` riêng cho project
`webkit`; trace và screenshot vẫn bật nên không mất bằng chứng.

---

## 7. Trả lời trực tiếp câu hỏi *"vì sao AI bỏ sót"*

Đề yêu cầu quy nguyên nhân về **chất lượng prompt**, **giới hạn mô hình**, hay **đặc điểm của
feature**. Phân bố thực tế:

| Nguyên nhân | Lỗi thuộc về | Nhận xét |
|---|---|---|
| **Giới hạn mô hình** | A1, A2, A3, A4, C2 | Chiếm đa số. Dạng cụ thể: AI thiết kế cơ chế đúng nhưng **không mô phỏng được đường đi khi cơ chế đó gặp trạng thái hỏng**, vì nó không chạy thử. Mọi lỗi loại A đều chỉ lộ ra khi có kết quả chạy thật. |
| **Chất lượng prompt** | B1, B2 | Đều biến mất sau khi prompt nói rõ phạm vi và nguyên tắc "kỳ vọng suy từ đặc tả". Sau lần được nhắc, không tái phát ở hai feature sau — kể cả với công cụ AI khác. |
| **Đặc điểm feature** | C1 | Nhãn nút tự hoàn nguyên sau 2 giây là hành vi riêng của SUT; không suy ra được từ nguyên tắc chung. |

Kết luận thực tiễn: **prompt tốt loại được nhóm B ngay từ đầu, nhưng không loại được nhóm A.**
Nhóm A chỉ có một cách phát hiện — chạy thật rồi đọc kỹ *cách* test đỏ, không chỉ đọc *bao nhiêu*
test đỏ. Bốn lỗi loại A đều đã pass qua vòng "AI tự rà soát" ở bước 5 mà không bị chính nó bắt.

---

## 8. Test case không tự động hoá được

| Mã | Ca | Vì sao | Điều kiện gỡ chặn |
|---|---|---|---|
| L-1 | FR-09 — coupon tồn tại nhưng `is_active = 0` | `POST /api/admin/coupons` không nhận trường `is_active`; không có endpoint cập nhật coupon | Bổ sung `is_active` vào payload tạo, hoặc thêm `PATCH /api/admin/coupons/:id` |
| L-2 | FR-09 — biên C2 "hết hạn đúng hôm nay" | Kết quả phụ thuộc nơi phép so sánh ngày được thực hiện (Node theo giờ máy, trình duyệt theo `Asia/Ho_Chi_Minh`, server theo UTC). Ca sát biên ngày là ca dễ flaky nhất | Đặc tả nói rõ so sánh ở múi giờ nào |
| L-3 | FR-15 — "255 ký tự" hay "255 byte" | Bộ ca dùng ASCII nên hai cách hiểu không phân biệt được. Nếu dùng chữ có dấu ở biên, một lần đỏ sẽ có hai cách giải thích — vi phạm nguyên tắc "một ca một yếu tố" | Thêm một ca 255 ký tự tiếng Việt (bộ dựng tên đã hỗ trợ `charset: vietnamese`) |
| L-4 | FR-15 — lớp không hợp lệ của Danh mục | `<select>` luôn có giá trị mặc định và không có tuỳ chọn rỗng; không chạm tới được qua giao diện | Kiểm ở tầng API, ngoài phạm vi kiểm thử hộp đen qua UI |

Tất cả đều **được viết ra và chạy thật** ở dạng gần nhất có thể, không có ca nào bị `test.skip`.

---

## 9. Những gì AI làm tốt hơn tôi mong đợi

Ghi lại để bản rà soát không một chiều:

- **FR-09** — từ chối neo locator vào nhãn nút `"Áp dụng"` vì nhãn đổi thành `"..."` khi đang gửi.
  Tôi không nêu chi tiết này trong prompt.
- **FR-09** — chọn hằng số ngày cố định `2020-01-01` / `2099-12-31` thay vì tính ngày động, với lập
  luận: lệch múi giờ tối đa ~26 giờ không thể lật một mốc cách hiện tại 6 năm hay 73 năm, nên sự mơ
  hồ trở nên **không quan sát được** — một dạng bảo đảm mạnh hơn việc cố loại bỏ nó.
- **FR-15** — đặt tiền tố sở hữu ở **đầu** tên sản phẩm, để nếu SUT âm thầm cắt 256 → 255 ký tự thì
  phần bị mất là đuôi đệm và bộ dọn rác vẫn nhận ra được hàng đó.
- **FR-15** — tự dựng ba tầng oracle kèm bảng phân loại chẩn đoán (UI mới/API cũ, UI cũ/API mới, cả
  hai đổi nhưng đổi thêm bản ghi khác) **trước khi** biết bug thật là gì. Bảng đó dự đoán đúng bug
  thực tế.
- **FR-15** — tự tìm ra assertion tautology của chính mình (A3) khi đọc lại code, không cần ai chỉ.
- **FR-15** — đọc toàn bảng bằng **một** lời gọi `evaluate` thay vì 2 vòng khứ hồi mỗi hàng, với lý
  do đúng trọng tâm: chi phí rải rác sẽ bào mòn timeout và làm test đỏ vì hết giờ chứ không phải vì
  SUT sai — *"một oracle không được phép tự sinh ra flakiness của chính nó"*.

---

## 10. Nguyên tắc rút ra

1. **Kỳ vọng suy từ đặc tả, không từ hành vi quan sát được.** Với một SUT cố ý cài lỗi, đây là ranh
   giới giữa một suite phát hiện được lỗi và một suite mô tả lại lỗi rồi cho pass.
2. **Oracle không được tính bằng cỗ máy đang bị nghi ngờ.** Điểm mù này xuất hiện độc lập ở hai công
   cụ AI khác nhau, nên nó là thuộc tính của bài toán chứ không của một mô hình.
3. **Cơ chế đúng chưa đủ; phải kiểm cả đường đi của cơ chế khi hệ thống hỏng.** Bốn lỗi loại A đều
   là cơ chế tốt bị vô hiệu bởi một mắt xích, và không lỗi nào bị chính AI bắt được ở bước tự rà soát.
4. **Prompt tốt loại được lỗi suy diễn, không loại được lỗi thực thi.** Nhóm B biến mất sau một lần
   nhắc; nhóm A chỉ lộ ra khi chạy thật.
5. **Đọc *cách* test đỏ, không chỉ đếm *bao nhiêu* test đỏ.** Cả A1, A2 và A4 đều được phát hiện nhờ
   nhìn vào dạng thông điệp lỗi chứ không nhìn vào con số pass/fail.

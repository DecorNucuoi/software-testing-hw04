# HW04 — Bug report

- **Sinh viên:** 23127362
- **SUT:** EShop — https://github.com/ttbhanh/eshop-sut
- **Cách phát hiện:** toàn bộ 13 bug dưới đây do suite Playwright phát hiện qua assertion thất bại,
  không phải do quan sát thủ công. Mỗi bug đều tái hiện trên **cả 3 browser** trừ chỗ ghi rõ khác.
- **Bằng chứng gốc:** `reports/html-<feature>-<browser>/index.html` (9 report, mỗi report chứa
  `"Run by: 23127362"` kèm ISO timestamp).

## Quy ước mức độ

| Mức | Nghĩa |
|---|---|
| **Critical** | Gây thiệt hại tiền bạc cho người dùng, hoặc khiến giao diện nói sai về dữ liệu |
| **Major** | Vi phạm trực tiếp một ràng buộc đặc tả, dữ liệu sai lọt vào hệ thống |
| **Minor** | Vi phạm đặc tả nhưng hậu quả giới hạn ở hiển thị hoặc trải nghiệm |

## Bảng tổng hợp

Toàn bộ 13 bug đã được mở thành GitHub Issue tại
`https://github.com/DecorNucuoi/software-testing-hw04/issues`.

| ID | Feature | Tiêu đề | Mức | Ca chứng minh | Issue |
|---|---|---|---|---|---|
| FR06-01 | FR-06 | Nút "Thêm vào giỏ hàng" bỏ qua lần bấm đầu tiên | Major | EX1, DT8 | [#1](https://github.com/DecorNucuoi/software-testing-hw04/issues/1) |
| FR06-02 | FR-06 | Ô Số lượng chấp nhận giá trị `0` | Major | DT2, BT1 | [#2](https://github.com/DecorNucuoi/software-testing-hw04/issues/2) |
| FR06-03 | FR-06 | Ô Số lượng chấp nhận giá trị âm | Major | DT3 | [#3](https://github.com/DecorNucuoi/software-testing-hw04/issues/3) |
| FR06-04 | FR-06 | Số lượng thập phân bị cắt cụt âm thầm | Minor | DT4 | [#4](https://github.com/DecorNucuoi/software-testing-hw04/issues/4) |
| FR06-05 | FR-06 | Ô Số lượng rỗng được chấp nhận, giỏ hiển thị `NaN` | Major | DT5, DT6 | [#5](https://github.com/DecorNucuoi/software-testing-hw04/issues/5) |
| FR09-01 | FR-09 | Mã giảm giá `percent` tính ra số ÂM — khách phải trả nhiều hơn | **Critical** | DT1, BT3, BT7 | [#6](https://github.com/DecorNucuoi/software-testing-hw04/issues/6) |
| FR09-02 | FR-09 | Áp được mã giảm giá khi chưa đăng nhập (C4 không được kiểm) | Major | DT7 | [#7](https://github.com/DecorNucuoi/software-testing-hw04/issues/7) |
| FR09-03 | FR-09 | Ngưỡng đơn tối thiểu dùng `>` thay vì `>=` | Major | BT2 | [#8](https://github.com/DecorNucuoi/software-testing-hw04/issues/8) |
| FR09-04 | FR-09 | Định dạng số không nhất quán giữa thông báo server và giao diện | Minor | BT2, DT6, BT1 | [#9](https://github.com/DecorNucuoi/software-testing-hw04/issues/9) |
| FR15-01 | FR-15 | Tên sản phẩm dài hơn 255 ký tự được chấp nhận | Major | DT4, BT6, DT12 | [#10](https://github.com/DecorNucuoi/software-testing-hw04/issues/10) |
| FR15-02 | FR-15 | Giá sản phẩm `≤ 0` được chấp nhận | Major | DT5, BT7, BT8, DT13 | [#11](https://github.com/DecorNucuoi/software-testing-hw04/issues/11) |
| FR15-03 | FR-15 | Giá sản phẩm rỗng / phi số được chấp nhận | Major | DT6, DT7 | [#12](https://github.com/DecorNucuoi/software-testing-hw04/issues/12) |
| FR15-04 | FR-15 | Sửa 1 sản phẩm — giao diện đổi tên TOÀN BỘ sản phẩm trong khi dữ liệu vẫn đúng | **Critical** | DT10, DT12, DT13 | [#13](https://github.com/DecorNucuoi/software-testing-hw04/issues/13) |

> **Ghi chú về sự khác biệt giữa GitHub Issue và báo cáo này.** Hai bản có cùng các bước tái hiện,
> cùng kỳ vọng và cùng số liệu thực tế. Khác nhau ở hai chỗ, đều có chủ ý:
>
> - Issue **lược bỏ** các đoạn đối chiếu với báo cáo HW02. Issue dành cho người sửa lỗi, họ không
>   cần biết kết luận kiểm thử thủ công trước đó là gì. Báo cáo này giữ lại, vì đó là bằng chứng
>   cho thấy automation đính chính được kết luận thủ công.
> - Issue **lược bỏ** nhãn "Ca chứng minh" nhưng giữ nội dung. Báo cáo này giữ cả nhãn, vì nó là
>   đường truy vết từ bug về mã test case — cần cho việc kiểm chứng bug do suite phát hiện chứ
>   không phải do quan sát.

---

# FR-06 — Product Detail (ô Số lượng)

## FR06-01 · Nút "Thêm vào giỏ hàng" bỏ qua lần bấm đầu tiên

**Mức độ:** Major · **Browser:** Chromium, Firefox, WebKit

**Các bước tái hiện**
1. Mở `http://127.0.0.1:5173/product/1`
2. Để nguyên Số lượng mặc định (hoặc nhập một số nguyên bất kỳ ≥ 1)
3. Bấm "Thêm vào giỏ hàng" **đúng một lần**
4. Bấm link "Giỏ hàng" trên header

**Kỳ vọng (FR-06):** nút sau khi bấm phải hiển thị phản hồi trực quan, và sản phẩm phải vào giỏ.

**Thực tế:** không có gì xảy ra. Nhãn nút vẫn là "Thêm vào giỏ hàng", giỏ vẫn trống. Phải bấm
**lần thứ hai** thì sản phẩm mới được thêm.

**Bằng chứng phân biệt**
- Ca `EX1` (bấm 1 lần) đỏ trên cả 3 browser: `Nhãn nút đọc được: "Thêm vào giỏ hàng"`
- Ca `DT8` (bấm 3 lần) **pass**, annotation ghi `số dòng sản phẩm trong giỏ = 1; số lượng hiển thị = 5`

Ba lần bấm chỉ thêm được một lần, cho thấy bộ đếm bị đặt lại sau mỗi lần thêm thành công: bấm 1
không làm gì, bấm 2 thêm, bấm 3 lại không làm gì.

**Ghi chú:** báo cáo HW02 từng kết luận nghi vấn này là **không đúng**. Automation lật lại kết
luận đó — kiểm thử thủ công không phân biệt được "tôi bấm một lần" với "tôi bấm hai lần mà không
để ý".

---

## FR06-02 · Ô Số lượng chấp nhận giá trị `0`

**Mức độ:** Major · **Browser:** cả 3

**Các bước tái hiện**
1. Mở `/product/1`
2. Đặt Số lượng = `0`
3. Bấm "Thêm vào giỏ hàng" hai lần (xem FR06-01)
4. Vào giỏ hàng

**Kỳ vọng (FR-06):** miền hợp lệ là số nguyên ≥ 1, nên `0` phải bị từ chối.

**Thực tế:** sản phẩm được thêm vào giỏ. Thông điệp assertion:
`giá trị nằm ngoài miền hợp lệ (số nguyên >= 1) nên "iPhone 15 Pro Max" không được vào giỏ.
trạng thái giỏ rỗng = false; số dòng sản phẩm đọc được = 1`

**Ca chứng minh:** DT2 (lớp tương đương) và BT1 (biên dưới − 1). Hai kỹ thuật độc lập cùng chỉ ra
một lỗi.

---

## FR06-03 · Ô Số lượng chấp nhận giá trị âm

**Mức độ:** Major · **Browser:** cả 3

**Các bước tái hiện:** như FR06-02 nhưng Số lượng = `-1`.

**Kỳ vọng:** bị từ chối (số nguyên ≥ 1).

**Thực tế:** sản phẩm được thêm vào giỏ với số lượng âm.

**Ca chứng minh:** DT3.

---

## FR06-04 · Số lượng thập phân bị cắt cụt âm thầm

**Mức độ:** Minor · **Browser:** cả 3

**Các bước tái hiện:** như FR06-02 nhưng Số lượng = `1.5`.

**Kỳ vọng:** bị từ chối — đặc tả nói *số nguyên*.

**Thực tế:** giá trị bị cắt thành `1`, sản phẩm được thêm, **không có thông báo nào** cho người
dùng biết giá trị họ nhập đã bị thay đổi.

**Ca chứng minh:** DT4.

---

## FR06-05 · Ô Số lượng rỗng được chấp nhận, giỏ hiển thị `NaN`

**Mức độ:** Major · **Browser:** cả 3

**Các bước tái hiện**
1. Mở `/product/1`
2. Xoá trắng ô Số lượng
3. Bấm "Thêm vào giỏ hàng" hai lần
4. Vào giỏ hàng

**Kỳ vọng:** bị từ chối; giỏ không được hiển thị `NaN` ở bất kỳ đâu.

**Thực tế:** sản phẩm được thêm, cột Số lượng hiển thị `NaN`. Thông điệp assertion:
`số lượng hiển thị trong giỏ phải là chuỗi chữ số thuần. Nguyên văn đọc được: "NaN"`

**Ca chứng minh:** DT5 (ô bị xoá trắng) và DT6 (gõ `abc` — trình duyệt chặn ký tự chữ nhưng
**đồng thời xoá rỗng ô**, nên giá trị đi vào nút là chuỗi rỗng, dẫn tới cùng một lỗi).

---

# FR-09 — Mã giảm giá

## FR09-01 · Mã giảm giá `percent` tính ra số ÂM — khách phải trả nhiều hơn

**Mức độ: CRITICAL** · **Browser:** cả 3

**Các bước tái hiện**
1. Đăng nhập bằng `test@eshop.com` / `Test1234!`
2. Mở `http://127.0.0.1:5173/checkout`
3. Đặt "Tổng tiền thanh toán (VND)" = `400000`
4. Nhập mã `SAVE10` (percent, 10%, đơn tối thiểu 300.000) rồi bấm "Áp dụng"

**Kỳ vọng (FR-09):** `discount = total × value / 100 = 40.000`; thành tiền `360.000 ₫`.

**Thực tế:** "Tiết kiệm" hiển thị **`-3.600.000 ₫`**, thành tiền **`4.000.000 ₫`**.
Trên đơn hàng 400.000 ₫, sau khi áp *mã giảm giá*, khách phải trả **gấp 10 lần**.

**Tái hiện ở nhiều mức giá — cùng một cơ chế**

| Ca | Tổng đơn | Giảm giá kỳ vọng | Giảm giá thực tế |
|---|---|---|---|
| DT1 | 400.000 | 40.000 | **−3.600.000** |
| BT3 | 300.001 | 30.000,1 | **−2.700.009** |
| BT7 | 9.999.999.999 | 999.999.999,9 | **−89.999.999.991** |

**Ghi chú:** báo cáo HW02 ghi nhận giá trị `360.000` (tức 90% của tổng). Automation với oracle
tính bằng số nguyên chính xác cho ra `-3.600.000`. Mức độ được nâng từ Major lên **Critical**:
đây không phải lỗi hiển thị mà là lỗi tính tiền theo hướng bất lợi cho khách hàng.

---

## FR09-02 · Áp được mã giảm giá khi chưa đăng nhập (điều kiện C4 không được kiểm)

**Mức độ:** Major · **Browser:** cả 3

**Các bước tái hiện**
1. **Đăng xuất** (hoặc mở cửa sổ ẩn danh), xác nhận `localStorage` không có khoá `token`
2. Mở `/checkout`
3. Đặt tổng tiền `400000`, nhập `SAVE10`, bấm "Áp dụng"

**Kỳ vọng (FR-09, điều kiện C4):** mã chỉ được áp dụng khi người dùng đã đăng nhập với JWT hợp lệ.
Trường hợp này phải bị từ chối kèm thông báo yêu cầu đăng nhập.

**Thực tế:** mã được áp dụng bình thường. Thông điệp assertion:
`DT7 (C4 — người dùng chưa đăng nhập) — mã ĐÃ ĐƯỢC ÁP DỤNG dù điều kiện này không thoả;
khối kết quả hiển thị Thành tiền "4.000.000 ₫"`

**Hệ quả kép:** kết hợp với FR09-01, một khách chưa đăng nhập áp mã "giảm giá" và nhận đơn hàng
4.000.000 ₫ thay vì 400.000 ₫.

---

## FR09-03 · Ngưỡng đơn tối thiểu dùng `>` thay vì `>=`

**Mức độ:** Major · **Browser:** cả 3

**Các bước tái hiện**
1. Đăng nhập
2. Mở `/checkout`, đặt tổng tiền **đúng bằng** `300000` (bằng `min_order_amount` của `SAVE10`)
3. Nhập `SAVE10`, bấm "Áp dụng"

**Kỳ vọng (FR-09, điều kiện C3):** `tổng đơn >= min_order_amount`, nên `300000 >= 300000` là đúng
và mã phải được áp dụng.

**Thực tế:** bị từ chối. Thông báo nguyên văn:
`"Đơn hàng chưa đủ giá trị tối thiểu 300,000 ₫ để áp dụng mã này"`

Phải tăng lên `300001` mới áp được — lỗi off-by-one kinh điển.

**Bằng chứng bổ trợ:** BT1 (`299.999`) bị từ chối đúng, BT3 (`300.001`) được chấp nhận. Chỉ đúng
điểm biên là sai. Đây là giá trị mà nếu bỏ khỏi bộ test thì lỗi này không bao giờ bị phát hiện.

---

## FR09-04 · Định dạng số không nhất quán giữa thông báo server và giao diện

**Mức độ:** Minor · **Browser:** cả 3

**Các bước tái hiện**
1. Đăng nhập, mở `/checkout`, đặt tổng tiền `200000`
2. Nhập `SAVE10` (đơn tối thiểu 300.000), bấm "Áp dụng"
3. So sánh con số trong thông báo lỗi với con số hiển thị ở các chỗ khác trên trang

**Kỳ vọng:** cùng một ứng dụng hiển thị tiền theo cùng một quy ước.

**Thực tế:**
- Thông báo lỗi từ server: `300,000 ₫` — dấu **phẩy** phân nhóm (quy ước en-US)
- Giao diện storefront: `300.000 ₫` — dấu **chấm** phân nhóm (quy ước vi-VN)

---

# FR-15 — Quản lý sản phẩm (Admin)

## FR15-01 · Tên sản phẩm dài hơn 255 ký tự được chấp nhận

**Mức độ:** Major · **Browser:** cả 3

**Các bước tái hiện**
1. Đăng nhập admin `http://127.0.0.1:5174` (`admin@eshop.com` / `Admin123!`)
2. Vào tab "Sản phẩm"
3. Nhập Tên sản phẩm dài **256 ký tự**, Giá `300000`, chọn danh mục bất kỳ
4. Bấm "Lưu sản phẩm"

**Kỳ vọng (FR-15):** tên tối đa 255 ký tự, nên 256 ký tự phải bị từ chối.

**Thực tế:** sản phẩm được lưu. Ô nhập không có giới hạn độ dài, và không có kiểm tra nào ở tầng
ứng dụng.

**Ca chứng minh:** DT4 (256 ký tự tiếng Việt có dấu), BT6 (256 ký tự ASCII), DT12 (256 ký tự khi
**Sửa**, cho thấy ràng buộc cũng không được áp ở luồng cập nhật).

**Đã kiểm và đúng:** BT4 (254 ký tự) và BT5 (255 ký tự) đều được chấp nhận — biên trên đúng ở
phía trong, chỉ sai ở phía ngoài.

---

## FR15-02 · Giá sản phẩm `≤ 0` được chấp nhận

**Mức độ:** Major · **Browser:** cả 3

**Các bước tái hiện**
1. Đăng nhập admin, vào tab "Sản phẩm"
2. Nhập Tên hợp lệ, Giá = `0` (lặp lại với `-1` và `-100`)
3. Bấm "Lưu sản phẩm"

**Kỳ vọng (FR-15):** giá phải là số **dương** (`> 0`).

**Thực tế:** sản phẩm được lưu trong cả ba trường hợp.

**Ca chứng minh:** BT8 (`0` — đúng điểm biên, bắt lỗi `>=` thay vì `>`), BT7 (`-1`), DT5 (`-100`),
DT13 (`-100` khi **Sửa**).

**Đã kiểm và đúng:** BT9 (`1`) được chấp nhận.

---

## FR15-03 · Giá sản phẩm rỗng / phi số được chấp nhận

**Mức độ:** Major · **Browser:** Chromium, WebKit (xem ghi chú)

**Các bước tái hiện**
1. Đăng nhập admin, vào tab "Sản phẩm"
2. Nhập Tên hợp lệ, **để trống** ô Giá tiền
3. Bấm "Lưu sản phẩm"

**Kỳ vọng (FR-15):** giá là trường **bắt buộc**, nên phải bị từ chối.

**Thực tế:** sản phẩm được lưu. Số sản phẩm tăng từ 5 lên 6 trên **cả giao diện lẫn API**
(annotation: `bảng: trước=5 sau=6 | API: trước=5 sau=6`).

**Nguyên nhân gốc:** ô "Tên sản phẩm" có thuộc tính chặn gửi form khi rỗng, ô "Giá tiền" thì
**không có**. Hai trường cùng được đặc tả là bắt buộc nhưng chỉ một trường được bảo vệ.

**Ca chứng minh:** DT7 (ô rỗng), DT6 (gõ `abc` — trình duyệt chặn ký tự chữ và để ô rỗng, dẫn tới
cùng một lỗi).

**Ghi chú cross-browser:** DT6 **pass trên Firefox** vì Firefox cho ký tự chữ lọt vào ô rồi đánh
dấu `:invalid`, khiến form không gửi được; Chromium và WebKit nuốt ký tự và để ô rỗng. Đây là
khác biệt giữa các engine trình duyệt, không phải khác biệt của SUT — nhưng nó cho thấy SUT đang
dựa vào hành vi trình duyệt thay vì tự kiểm tra.

---

## FR15-04 · Sửa 1 sản phẩm — giao diện đổi tên TOÀN BỘ sản phẩm trong khi dữ liệu vẫn đúng

**Mức độ: CRITICAL** · **Browser:** cả 3

**Các bước tái hiện**
1. Đăng nhập admin, vào tab "Sản phẩm" (cần có ít nhất 2 sản phẩm trong bảng)
2. Bấm "Sửa" trên **một** sản phẩm
3. Đổi tên và giá, bấm "Lưu sản phẩm"
4. Quan sát **toàn bộ** bảng sản phẩm
5. **Tải lại trang** (F5) rồi quan sát lại

**Kỳ vọng (FR-15):** khi sửa một sản phẩm, chỉ sản phẩm đó thay đổi; mọi sản phẩm khác giữ nguyên.

**Thực tế:** ngay sau khi lưu, **mọi hàng trong bảng** đều hiển thị tên mới, mỗi hàng vẫn giữ giá
cũ của nó. Sau khi tải lại trang, bảng hiển thị đúng trở lại.

**Đây là lỗi HIỂN THỊ, không phải lỗi dữ liệu.** Đối chiếu với API cho thấy dữ liệu hoàn toàn
đúng — chỉ một sản phẩm được cập nhật, đúng cả tên lẫn giá:

```
BẢNG : 7 sản phẩm, TẤT CẢ mang cùng một tên, 7 mức giá khác nhau
API  : mỗi sản phẩm giữ đúng tên riêng của nó
```

**Vì sao vẫn là Critical:** admin nhìn màn hình và tin rằng mình vừa phá hỏng toàn bộ danh mục.
Phản ứng tự nhiên là sửa tay từng sản phẩm về tên cũ — và **chính hành động sửa chữa đó mới thực
sự phá hỏng dữ liệu**. Một giao diện nói dối về dữ liệu nguy hiểm không kém một giao diện làm hỏng
dữ liệu.

**Ca chứng minh:** DT10 (assertion `bảng phải có đúng 1 hàng sau thao tác update`, thực tế nhận
được **7**), DT12 và DT13 (phép đối chiếu chéo giao diện–API cho diff 9 dòng).

**Ghi chú:** báo cáo HW02 mô tả lỗi này là *"tất cả sản phẩm bị đổi tên và thay đổi giá không được
áp dụng"* — đúng những gì quan sát được trên màn hình, nhưng sai bản chất. Automation với oracle
hai nguồn cho thấy dữ liệu nguyên vẹn. Phân loại đổi từ "hỏng dữ liệu" thành "hiển thị sai lệch",
và cách khắc phục cũng khác hẳn.

---

# Phụ lục A — Quan sát KHÔNG phải bug

Ghi lại để phân biệt rõ với 13 bug ở trên.

| # | Quan sát | Vì sao không phải bug |
|---|---|---|
| A1 | FR-06 BT4/BT5 — số lượng rất lớn (`9.999.999.999`, `9.007.199.254.740.992`) được chấp nhận, tính và hiển thị **đúng** | Đặc tả FR-06 không định nghĩa giá trị tối đa. Báo cáo HW02 đánh Fail; automation cho thấy phép tính chính xác và chuỗi 24 chữ số hiển thị đúng trên cả 3 engine |
| A2 | FR-06 BT6 — `+5` bị trình duyệt tự chuẩn hoá | Giá trị số là 5, nằm trong miền hợp lệ. Riêng Firefox để ô rỗng sau khi gán — **khác biệt engine**, không phải hành vi SUT |
| A3 | FR-15 DT8/BT10 — giá `99999999999999999999999` hiển thị dạng `1e+23 ₫` | Đặc tả không có cận trên. Việc hiển thị ký hiệu khoa học là vấn đề trình bày, ghi nhận nhưng không tính là vi phạm đặc tả |
| A4 | Bảng admin in tiền không qua bộ định dạng (`30000000 ₫`), storefront thì có (`30.000.000 ₫`) | Không có điều khoản đặc tả nào ràng buộc định dạng ở màn hình admin. Ghi vào mục nhất quán giao diện |
| A5 | WebKit trên Windows crash khi bật ghi video | Vấn đề hạ tầng kiểm thử, không phải SUT. Xử lý bằng `video: 'off'` riêng cho project webkit |

# Phụ lục B — Test case không tự động hoá được

| Mã | Ca | Vì sao | Điều kiện gỡ chặn |
|---|---|---|---|
| L-1 | FR-09 — coupon `is_active = 0` | API tạo coupon không nhận trường `is_active`; không có endpoint cập nhật | Bổ sung `is_active` vào payload, hoặc thêm endpoint cập nhật coupon |
| L-2 | FR-09 — biên "hết hạn đúng hôm nay" | Kết quả phụ thuộc múi giờ nơi phép so sánh được thực hiện | Đặc tả nói rõ so sánh ngày ở múi giờ nào |
| L-3 | FR-15 — "255 ký tự" hay "255 byte" | Bộ ca dùng ASCII nên hai cách hiểu không phân biệt được; dùng chữ có dấu ở biên sẽ khiến một lần đỏ có hai cách giải thích | Thêm một ca 255 ký tự tiếng Việt |
| L-4 | FR-15 — danh mục không hợp lệ | `<select>` luôn có giá trị mặc định, không có tuỳ chọn rỗng | Kiểm ở tầng API, ngoài phạm vi kiểm thử hộp đen qua UI |

Không ca nào bị `test.skip` — tất cả đều được viết và chạy ở dạng gần nhất có thể.

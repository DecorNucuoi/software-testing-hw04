# FR-09 — Test case không tự động hoá được, và các khoảng trống đặc tả

Bảng này là bằng chứng có chủ đích, không phải danh sách việc chưa làm.

## 1. Nhánh không tự động hoá được

| # | Nhánh | Điều kiện | Vì sao không làm được | Kiểm thủ công thay thế | Điều kiện gỡ chặn |
|---|---|---|---|---|---|
| L-1 | Mã tồn tại nhưng đã bị tắt (`is_active = 0`) | C1, nhánh thứ hai | `POST /api/admin/coupons` không nhận trường `is_active` (cột mặc định bằng 1) và không có endpoint cập nhật coupon. Cả bốn mã seed đều đang bật — EXPIRED bị chặn ở C2 chứ không phải C1 — nên không có dữ liệu sẵn có nào chạm tới nhánh này | Tắt thủ công một mã trong database rồi áp mã đó trên `/checkout`, kỳ vọng bị từ chối | Thêm `is_active` vào payload tạo coupon, **hoặc** bổ sung `PATCH /api/admin/coupons/:id` |
| L-2 | Mã hết hạn đúng ngày hôm nay (biên của C2) | C2, đúng biên | `expired_at` lưu dạng chuỗi ngày; phép so sánh diễn ra ở server còn dữ liệu do tiến trình Node sinh theo múi giờ máy, trong khi trình duyệt chạy ở Asia/Ho_Chi_Minh. Một ca đặt đúng ranh giới ngày sẽ đổi kết quả tuỳ giờ chạy và tuỳ máy — nó đo môi trường chứ không đo SUT | Đặt `expired_at` bằng ngày hiện tại rồi áp mã, ghi lại kết quả kèm giờ và múi giờ | Đặc tả nói rõ so sánh là `<` hay `<=`, tính theo múi giờ nào |

## 2. Khoảng trống đặc tả — xử lý bằng oracle yếu hơn, không bằng quy ước tự chế

| # | Ca | Khoảng trống | Cách xử lý |
|---|---|---|---|
| O-1 | BT3, BT7 | Công thức percent cho kết quả thập phân (30000.1 và 999999999.9) nhưng đặc tả im lặng hoàn toàn về làm tròn | Không chọn quy ước nào. `expected_discount` ghi giá trị **chính xác**; assertion chỉ đòi (i) sai lệch so với giá trị chính xác nhỏ hơn một đồng, và (ii) `final == total − discount` khớp tuyệt đối giữa các số **hiển thị**. Mệnh đề (ii) không cần biết SUT làm tròn kiểu gì nhưng bắt được ngay nếu SUT làm tròn ở một chỗ mà quên chỗ kia |
| O-2 | BT6 | Công thức đặc tả cho −50000; báo cáo HW02 kỳ vọng không âm và tự đánh dấu kỳ vọng đó là `[ASSUMED]` | Assertion cứng theo đúng công thức đặc tả (`expected_final = -50000`). Tính chất "không âm" chỉ ghi vào annotation kèm giá trị thực đọc được. Nếu SUT hiển thị số âm, mục đó vào **bug report** với nhãn nguồn `[ASSUMED]`, không phải một assertion đỏ giả danh vi phạm đặc tả |

## 3. Thông báo lỗi — kiểm theo hai pha

**Pha 1 (đang làm).** Assertion cứng chỉ gồm ba mệnh đề cấu trúc: phần tử lỗi hiện diện và nội dung không rỗng; khối kết quả thành công không hiện diện; dòng Tổng thanh toán giữ nguyên bằng `order_total`. Nguyên văn thông báo được ghi vào annotation của mọi ca `reject`.

**Pha 2 (sau lần chạy đầu).** Điền trường `error_must_contain` cho từng ca `reject` bằng mẩu chuỗi **đặc trưng cho điều kiện bị vi phạm**. Không có bước này thì bốn ca reject vì bốn lý do khác nhau đều xanh như nhau kể cả khi server trả cùng một câu chung chung, và ta mất khả năng phân biệt C2 với C3 với C5.

Giá trị điền vào phải theo **ngữ nghĩa mà đặc tả đòi hỏi** (thông báo phải nêu rõ lý do), không phải chép mù chuỗi SUT đang trả về. Nếu SUT trả một câu không nêu được lý do, đó là bug cần báo cáo, không phải oracle cần chép lại.

`DT4` giữ `error_must_contain = null` vĩnh viễn: request không bao giờ rời trình duyệt nên không có thông báo server nào tồn tại để mà kiểm.

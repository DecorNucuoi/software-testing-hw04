# FR-15 — Hạn chế của bộ dữ liệu và các quyết định thiết kế

Ghi kèm `data/fr15-product-crud.json`. Mục đích: nói rõ 24 ca **không** phủ được điều gì, để
người đọc báo cáo không suy ra nhiều hơn những gì bộ test thực sự chứng minh.

## 1. "255 ký tự" hay "255 byte" — không phân biệt được bằng 24 ca

Đặc tả viết "tối đa 255 ký tự", không nói byte. Hai cách hiểu cho kết quả khác nhau ngay khi
tên chứa chữ có dấu: một chữ như `ế` chiếm 1 ký tự nhưng 3 byte trong UTF-8.

Bộ ba biên BT4/BT5/BT6 dùng **ký tự ASCII**, nơi số ký tự bằng số byte, nên chúng chốt được vị
trí biên nhưng **im lặng hoàn toàn** về việc SUT đếm gì. Đây là lựa chọn có ý thức: nếu BT5 dùng
chữ tiếng Việt và nó đỏ, một lần đỏ sẽ có hai cách giải thích (lệch biên một bậc, hay SUT đếm
byte) — đúng thứ mà nguyên tắc "một ca chỉ để sai một yếu tố" tồn tại để tránh.

DT4 dùng 256 ký tự tiếng Việt và cho một điểm dữ liệu về xử lý đa byte, nhưng nó **không phân
biệt được** hai cách hiểu: 256 ký tự tiếng Việt vượt ngưỡng theo cả hai.

**Ca phân biệt được là "255 ký tự tiếng Việt"** — chấp nhận nghĩa là đếm ký tự, từ chối nghĩa là
đếm byte. Ca này **không nằm trong 24 ca của HW02** và không được thêm vào để giữ nguyên bộ ca
gốc. Đề xuất: chạy như một mục quan sát riêng ngoài suite, hoặc đưa vào vòng sau. Bộ dựng tên đã
nhận tham số `charset: "vietnamese"` nên chỉ cần thêm một dòng dữ liệu, không phải sửa code.

## 2. Ràng buộc "Danh mục BẮT BUỘC" không kiểm được qua giao diện

Form dùng `<select>` và thẻ này luôn có một option đang được chọn. Trạng thái "không chọn danh
mục" **không tới được** bằng thao tác người dùng, nên không có ca âm nào cho ràng buộc thứ ba
của đặc tả. 24 ca chỉ chứng minh danh mục được **lưu và hiển thị đúng** (DT2), không chứng minh
được SUT từ chối khi thiếu danh mục.

Muốn phủ thì phải gửi thẳng request thiếu `category_id` — nhưng đó là kiểm API, không phải kiểm
chức năng quản trị qua giao diện như FR-15 mô tả. Ghi nhận là khoảng trống, không lấp bằng cách
đổi phạm vi.

## 3. DT6 có thể tự thoái hoá thành DT7

Ô giá là `<input type="number">`. Trình duyệt có thể từ chối nhận ký tự chữ, khiến giá trị thực
tế trong ô là **rỗng** chứ không phải `"abc"`. Khi đó DT6 không còn kiểm "giá phải là số" mà
kiểm lại đúng thứ DT7 đã kiểm.

Ca này bắt buộc đọc lại và ghi giá trị thực tế còn trong ô. Nếu là rỗng, báo cáo phải nói rõ:
ràng buộc "phải là số" đang được **trình duyệt** giữ, chưa có bằng chứng nào cho thấy **tầng ứng
dụng** cũng giữ. Ba trình duyệt có thể cho ba kết quả khác nhau ở điểm này, và sự khác nhau đó
là phát hiện chứ không phải nhiễu.

## 4. Ba ca tên ngắn không được lưới an toàn phủ theo tiền tố

BT1 (0 ký tự), BT2 (1 ký tự), BT3 (2 ký tự) không thể mang tiền tố sở hữu dài ~49 ký tự.

- BT1 kỳ vọng bị từ chối nên không sinh hàng nào — không có gì để dọn.
- BT2/BT3 kỳ vọng lưu được, nên chúng **sinh hàng thật**. Tên của chúng (`~`, `~~`) được khai
  trong `sweeper_extra_exact_names` và sweeper xoá theo **so khớp tuyệt đối cả chuỗi**, không
  theo tiền tố — nên nó không thể đụng nhầm vào `~ Áo thun` của ai đó.

Rủi ro còn lại: nếu có ai tạo tay một sản phẩm tên đúng `~` thì sweeper sẽ xoá nó. Trên một SUT
chạy cục bộ, hai ký tự này được chọn vì không sản phẩm thật nào mang tên như vậy. Đây là đánh
đổi có ý thức, không phải sơ suất.

## 5. DT8, BT10, DT9 — không có kỳ vọng pass/fail

Ba ca này có `oracle_source: "observation"`. Đặc tả im lặng, nên **không có kết quả nào của SUT
làm chúng đỏ vì lý do nghiệp vụ**:

- DT8/BT10 (giá `99999999999999999999999`): đặc tả nói giá **không có cận trên**, nên chấp nhận
  hay từ chối đều không sai. Chỉ hai bất biến được assert: bảng và API phải nói cùng một điều,
  và không sản phẩm nào khác bị đụng tới.
- DT9 (bấm Lưu 3 lần): đặc tả **không nói gì** về chống gửi lặp. Số sản phẩm tạo ra đi vào
  report như một quan sát. Chỉ hai điều được assert, và cả hai đều là hệ quả bắt buộc chứ không
  phải con số tự chọn: ít nhất một sản phẩm phải được tạo (đầu vào hợp lệ thì phải lưu được), và
  số tạo ra không được lớn hơn số lần bấm.

Nếu SUT tạo 3 sản phẩm, đó **không phải fail của FR-15**. Nó là phát hiện về khả dụng và toàn
vẹn dữ liệu, thuộc mục quan sát của báo cáo.

## 6. DT2 chỉ chứng minh sản phẩm **do test tạo** hiển thị đúng

DT2 đọc sản phẩm test tự tạo qua API, không đọc sản phẩm seed. Đổi lại tính lặp lại tuyệt đối
(chạy được trên CSDL bẩn, không phụ thuộc thứ tự, lặp bao nhiêu lần cũng cho cùng tiền đề), ca
này **không chứng minh** rằng các sản phẩm có sẵn từ trước hiển thị đúng.

Khoảng trống đó được lấp một phần — không phải toàn bộ — bởi tầng 3 của oracle: phép đối chiếu
chéo toàn bảng giữa DOM và API chạy ở mọi ca và phủ **mọi** hàng, kể cả 5 sản phẩm seed. Nó bắt
được việc hiển thị lệch khỏi dữ liệu, nhưng không bắt được việc **cả hai cùng sai** so với thứ
đáng lẽ phải có.

## 7. Bộ dữ liệu không giả định CSDL sạch

`globalSetup` chỉ dọn hàng mang tiền tố của suite này. Mọi thứ khác — 5 sản phẩm seed, dữ liệu
do FR-06/FR-09 để lại, dữ liệu tạo tay — **vẫn còn nguyên**. Vì vậy:

- Không ca nào assert tổng số sản phẩm bằng một hằng số.
- Mọi phép so đều là **diff trước/sau** trong cùng một test, không phải so với trạng thái tuyệt
  đối.
- Sản phẩm chứng của các ca Update/Delete là sản phẩm **test tự tạo vài trăm mili-giây trước**,
  vì đó là thứ duy nhất trong CSDL mà ta biết chính xác trạng thái kỳ vọng.

## 8. Quan sát ngoài phạm vi 24 ca

Ghi vào báo cáo, không thuộc ca nào:

- **Bảng admin in tiền không qua định dạng.** Ô giá render `{price} ₫` thô, trong khi storefront
  5173 dùng `toLocaleString('vi-VN')`. Cùng một giá hiện ra hai kiểu ở hai màn hình của cùng hệ
  thống, và số đủ lớn rơi sang ký hiệu khoa học (`1e+23 ₫`) — không đọc được với người dùng.
- **Nút "Xóa" không có hộp thoại xác nhận.** Thao tác phá huỷ, không hoàn tác được, không hỏi
  lại. DT14 vì thế không có bước xác nhận nào để kiểm.
- **Bảng không phân trang.** Số hàng tăng vô hạn theo thời gian sử dụng; đây vừa là vấn đề khả
  dụng, vừa là lý do bộ đọc bảng phải gói toàn bộ việc duyệt DOM vào một lời gọi duy nhất.
- **Hai endpoint sản phẩm có thể trả `price` khác kiểu nhau.** Nếu quan sát thấy, ghi kèm giá
  trị thô và `typeof` của cả hai phía.

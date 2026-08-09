# FR-09 — Rà soát của người: lỗi thiết kế test đã phát hiện và sửa

## R-1. Đọc DOM trước, khẳng định sau — TimeoutError nuốt mất message chẩn đoán

**Đây là lỗi của bộ test, không phải lỗi của SUT.**

| Mục | Nội dung |
|---|---|
| Triệu chứng | Chạy thật trên chromium: DT7 và BT2 đỏ bằng `TimeoutError: locator.innerText: Timeout 10000ms exceeded`, không phải bằng assertion nào của suite. Report chỉ hiện một lỗi locator; muốn biết SUT thực sự làm gì phải mở trace |
| Nguyên nhân | Cả hai nhánh khẳng định đều đọc giá trị trước rồi mới assert. Nhánh reject đọc `innerText` của phần tử lỗi — ở DT7 mã lại áp được nên phần tử đó không tồn tại. Nhánh accept đọc dòng "Tiết kiệm" — ở BT2 mã bị từ chối nên khối thành công không tồn tại |
| Hậu quả | Toàn bộ message đã soạn (nguyên văn chuỗi SUT in ra, chênh lệch bao nhiêu đồng, ngưỡng nào bị vượt) không bao giờ được in ra, và mất đúng ở hai ca có nhiều thông tin nhất |
| Vì sao lọt qua khâu tự rà | Message được soạn rất kỹ nên tạo cảm giác việc chẩn đoán đã được lo xong. Nhưng thứ hỏng không phải nội dung message mà là ĐƯỜNG ĐI TỚI message: một lời gọi đọc đứng chắn phía trước khiến assertion không bao giờ được chạm tới |
| Điều kiện để lộ ra | Chỉ lộ khi SUT hỏng theo đúng kiểu làm phần tử biến mất — tức đúng những ca mà ta cần thông tin nhất. Ở mọi lần chạy xanh, khuyết tật này hoàn toàn vô hình |
| Cách sửa | Đảo thứ tự trong cả hai nhánh: web-first assertion về sự hiện diện trước, đọc giá trị sau. Ở nhánh reject, assertion đứng đầu là "khối kết quả thành công KHÔNG hiện diện" — vì ở DT7 đó mới là mệnh đề đặc tả bị vi phạm, chứ không phải chuyện thiếu thông báo lỗi |
| Quy tắc rút ra | Một lời gọi đọc DOM chỉ được chạy sau khi đã có assertion bảo đảm phần tử tồn tại; hoặc, nếu giá trị chỉ dùng để dựng message, phải đi qua đường đọc an toàn có bọc `catch`. Không có trường hợp thứ ba |

## R-2. Bảng rà soát mọi lời gọi đọc DOM sau khi sửa

| # | Vị trí | Lời gọi | Phần tử có được bảo đảm tồn tại? | Xử lý |
|---|---|---|---|---|
| 1 | spec — `peek()` | `count()` rồi `innerText()` | Không | `count()` không auto-wait nên không bao giờ treo; chỉ đọc `innerText` khi `count > 0`; `catch` bọc ngoài xử lý khe hẹp giữa hai lời gọi. Giá trị trả về CHỈ dùng cho message, không bao giờ đem so sánh |
| 2 | `assertAccepted` — trước assertion đầu | `peek(errorMessage)` | Không | Đi qua `peek` |
| 3 | `assertAccepted` | `savedAmount.innerText()` | **Có** | `[A1] toBeVisible` ngay phía trên |
| 4 | `assertAccepted` | `finalAmount.innerText()` | **Có** | `[A1] toBeVisible` ngay phía trên |
| 5 | `assertAccepted` | `getSavedMilli()`, `getFinalMilli()` | **Có** | cùng hai assertion ở trên |
| 6 | `assertAccepted` | `getGrandTotalRaw()`, `getGrandTotalMilli()` | **Có** | phần tử vô điều kiện, `goto()` đã chờ hiện diện |
| 7 | `assertRejected` — trước assertion đầu | `peek(finalAmount)` | Không | Đi qua `peek` |
| 8 | `assertRejected` | `getErrorText()` | **Có** | `[A1] toBeVisible` của `errorMessage` ngay phía trên |
| 9 | `assertRejected` | `getGrandTotalRaw()`, `getGrandTotalMilli()` | **Có** | vô điều kiện, `goto()` đã chờ |
| 10 | `assertBlocked` | `applyButton.isDisabled()` | **Có** | vô điều kiện, `goto()` đã chờ |
| 11 | `assertBlocked` | `getGrandTotalRaw()`, `getGrandTotalMilli()` | **Có** | vô điều kiện, `goto()` đã chờ |
| 12 | page object — `getErrorText`, `getSavedMilli`, `getFinalMilli` | `innerText()` | Không tự bảo đảm | Ba hàm chạm phần tử CÓ ĐIỀU KIỆN. Hợp đồng "spec phải khẳng định hiện diện trước khi gọi" được ghi thành khối comment ngay trên chúng |
| 13 | page object — `getGrandTotalMilli`, `getGrandTotalRaw` | `innerText()` | **Có** | `goto()` chờ `grandTotal` |

Không phải lời gọi đọc, nhưng cùng họ rủi ro:

| # | Vị trí | Lời gọi | Ghi chú |
|---|---|---|---|
| 14 | `apply()` | `applyButtonIdle.waitFor()` | Là phép CHỜ, không phải phép đọc. Nếu nút không bao giờ trở lại trạng thái rảnh thì timeout ở đây mô tả đúng triệu chứng thật, nên giữ nguyên |
| 15 | `apply()` | `waitForResponse` | Tầng mạng, không phải DOM. Chỉ dùng ở nhánh accept/reject; nhánh `blocked` cố ý không đi qua `apply()` vì ở đó không có request nào tồn tại để chờ |
| 16 | các `fill()`, `press()` | thao tác | Auto-wait theo actionability trên phần tử vô điều kiện đã được `goto()` chờ |

`toBeHidden()` được dùng cho mọi khẳng định vắng mặt: nó đúng cả khi phần tử không tồn tại lẫn khi tồn tại mà ẩn — đúng ngữ nghĩa cần thiết, và không bao giờ ném lỗi vì thiếu phần tử.

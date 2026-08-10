# FR-15 — Chuỗi prompt sinh script tự động (Feature C, Pool C)

- **Sinh viên:** 23127362
- **Feature:** FR-15 — Quản lý sản phẩm (CRUD) trên Web Admin `127.0.0.1:5174`
- **Nguồn test case:** `report/FR-15_ProductCRUD.md` (HW02) — 24 case: DT1–DT14, BT1–BT10

Ba khác biệt so với FR-09:
1. Ghi vào bảng `products` là **vĩnh viễn** — không có coupon nào để vứt đi.
2. Chạy trên cổng 5174, một ứng dụng khác, token lưu ở key **khác**.
3. Đặc tả có một tính chất mà FR-06/FR-09 không có: **tính cô lập** — sửa/xoá một sản phẩm
   không được ảnh hưởng sản phẩm khác. Kiểm tính chất này đòi hỏi một loại oracle mới.

---

## PROMPT 1 — Bối cảnh, bài toán trạng thái, bài toán oracle. KHÔNG sinh code.

```
Bạn là kỹ sư kiểm thử tự động cấp cao. Bước này TUYỆT ĐỐI chưa viết code.

## Stack và quy ước repo (giữ nguyên từ FR-06/FR-09)
Playwright Test + TypeScript, ESM, Node 22, Windows. 3 project chromium/firefox/webkit.
fullyParallel = false, workers = 1; một runner spawn 3 tiến trình TUẦN TỰ, mỗi tiến trình 1 browser.

src/config.ts   -> STUDENT_ID; URLS { web, admin: 'http://127.0.0.1:5174', api: 'http://127.0.0.1:3000' };
                   ACCOUNTS { admin, user }; RUN_TIMESTAMP (ISO, hằng số trong một tiến trình)
src/fixtures.ts -> test, expect, logRunHeader(scope), fixture blockedRequests,
                   và re-export kiểu TestInfo/Page/Locator/APIRequestContext
src/utils/data-loader.ts -> loadCsv, loadJson, toNumber, toBoolean
src/utils/api.ts -> loginViaApi(request, role), getProducts, getProductById, createProduct,
                    deleteProduct, uniqueName
src/utils/money.ts -> bộ bóc tách tiền thang mili-đồng bằng BigInt (đã viết ở FR-09)

Quy ước bắt buộc, giữ nguyên:
- import { test, expect } từ '../src/fixtures'; KHÔNG bao giờ từ '@playwright/test' (kể cả import kiểu)
- CẤM dữ liệu cứng trong spec; mọi dữ liệu ở /data
- >= 3 KIỂU assertion, đánh số ở đầu file, đánh dấu tại chỗ
- page object KHÔNG chứa expect
- CẤM test.skip / test.fixme / test.fail
- không waitForTimeout cố định
- KHÔNG đọc giá trị từ DOM trước khi có assertion bảo đảm phần tử tồn tại; nếu giá trị chỉ
  dùng để dựng message thì phải bọc catch. Đây là lỗi đã mắc ở FR-09, đừng lặp lại.
- comment tiếng Việt, giải thích "vì sao"

## Đặc tả FR-15 (nguồn chân lý duy nhất)

Admin có thể Thêm / Xem / Sửa / Xoá sản phẩm.
Ràng buộc đầu vào:
  - Tên sản phẩm: BẮT BUỘC, tối đa 255 ký tự
  - Giá: BẮT BUỘC, là số DƯƠNG (> 0), KHÔNG có giá trị tối đa
  - Danh mục: BẮT BUỘC, chọn từ danh sách có sẵn
Tính cô lập: khi sửa một sản phẩm, CHỈ sản phẩm đó thay đổi; mọi sản phẩm khác giữ nguyên.
Tương tự với xoá.

## DOM thật của Web Admin (127.0.0.1:5174)

Khi CHƯA đăng nhập — toàn trang chỉ có form này:
  <h2>Admin Login</h2>
  <input placeholder="Email">                 <!-- type mặc định (text) -->
  <input placeholder="Password" type="password">
  <button>Login</button>
Đăng nhập sai vai trò hoặc sai mật khẩu -> hộp thoại alert() của trình duyệt.

Sau khi đăng nhập — sidebar là danh sách <li>, KHÔNG phải <a> và KHÔNG phải <button>:
  <li>Dashboard</li> <li>Danh mục</li> <li>Sản phẩm</li> <li>Mã Giảm Giá</li>
  <li>Đơn hàng</li> <li>Người dùng</li> <li>Đăng xuất</li>

Tab "Sản phẩm" gồm 3 khối theo thứ tự: khối Import CSV, form sản phẩm, bảng sản phẩm.

  <h2>Quản lý Sản phẩm</h2>

  <!-- KHỐI IMPORT CSV — thuộc FR-16, KHÔNG phải FR-15. Nó chứa một <input type="file">,
       một <button> "Import N sản phẩm", và có thể chứa một <table> xem trước. -->

  <form>
    <h3>Thêm sản phẩm mới</h3>      <!-- đổi thành "Sửa sản phẩm" khi đang sửa -->
    <input placeholder="Tên sản phẩm" required>
    <input placeholder="Giá tiền" type="number">
    <input placeholder="URL Ảnh">
    <textarea placeholder="Mô tả"></textarea>
    <select>  <option value="1">Điện thoại</option> ... </select>
    <button>Lưu sản phẩm</button>
    <button type="button">Hủy sửa</button>   <!-- CHỈ xuất hiện khi đang sửa -->
  </form>

  <table>
    <thead><tr><th>Ảnh</th><th>Tên SP</th><th>Giá</th><th>Hành động</th></tr></thead>
    <tbody>
      <tr>
        <td><img></td>
        <td>Tên sản phẩm</td>
        <td>30000000 ₫</td>     <!-- LƯU Ý: in thẳng giá trị thô, KHÔNG qua toLocaleString -->
        <td><button>Sửa</button><button>Xóa</button></td>
      </tr>
    </tbody>
  </table>

Không có data-testid. Không có <label> nào gắn với input — mọi ô đều chỉ có placeholder.
Nút "Xóa" xoá thẳng, KHÔNG có hộp thoại xác nhận.

## Trạng thái đăng nhập admin
Token lưu ở localStorage key "adminToken" — KHÁC key "token" của storefront 5173.
Trang đọc key này khi mount.
Tài khoản admin nằm trong ACCOUNTS.admin.

## API dùng cho SETUP / TEARDOWN (không phải đối tượng kiểm thử)
GET    /api/products          -> mảng sản phẩm
GET    /api/products/:id      -> một sản phẩm
POST   /api/products          { name, price, description, imageUrl, category_id } -> { id }
PUT    /api/products/:id      cùng body
DELETE /api/products/:id
GET    /api/categories
Ba endpoint ghi ở trên KHÔNG yêu cầu token.

## Việc của bạn ở BƯỚC NÀY — trả lời 4 mục bằng lời

(a) TRẠNG THÁI. Bảng products là dữ liệu thật, và phần lớn trong 24 ca là thao tác Create.
    Chạy suite 3 lần (3 browser) sẽ để lại bao nhiêu hàng? Đề xuất chiến lược cô lập và dọn dẹp.
    Nêu rõ: cái gì tạo lúc nào, xoá lúc nào, và điều gì xảy ra nếu test sập giữa chừng.
    Đặc biệt: 5 sản phẩm seed sẵn (id 1..5) là tài sản chung — nêu quan điểm của bạn về việc
    được phép động vào chúng hay không, và hệ quả của lựa chọn đó.

(b) ORACLE — đây là câu hỏi quan trọng nhất của FR-15.
    Đặc tả nói "khi sửa một sản phẩm, chỉ sản phẩm đó thay đổi". Sau khi bấm Lưu, bạn có HAI
    nguồn thông tin về trạng thái sản phẩm: bảng hiển thị trên giao diện, và GET /api/products.
    - Hai nguồn này có bắt buộc phải khớp nhau không? Căn cứ vào đâu?
    - Nếu chúng KHÔNG khớp, đó là bug hay là chuyện bình thường? Bug ở đâu?
    - Bạn thiết kế assertion thế nào để phát hiện được trường hợp không khớp, thay vì âm thầm
      tin vào một trong hai nguồn?
    Trả lời kỹ mục này. Một thiết kế chỉ nhìn giao diện, hoặc chỉ nhìn API, đều sẽ bỏ lọt cả một
    lớp lỗi.

(c) SELECTOR. Đề xuất cách định vị: mục sidebar "Sản phẩm" (là <li>, không phải link/button);
    từng ô trong form sản phẩm (chỉ có placeholder); nút "Lưu sản phẩm"; một hàng sản phẩm CỤ THỂ
    trong bảng; nút "Sửa"/"Xóa" của đúng hàng đó.
    Cảnh báo: trên cùng màn hình còn có khối Import CSV, và khối đó cũng chứa <button> và có thể
    chứa <table>. Nêu cách bạn tránh nhầm sang chúng.

(d) TÍNH CÔ LẬP. Để kiểm "sản phẩm khác giữ nguyên", bạn cần một cách chụp lại trạng thái trước
    và sau. Mô tả cách bạn làm, và cho biết cách đó phát hiện được những kiểu thay đổi nào và
    bỏ lọt những kiểu nào.
```

---

## PROMPT 2 — Thiết kế dữ liệu

```
Bước 2: thiết kế file dữ liệu. Chưa viết spec.

24 ca từ báo cáo HW02. Mỗi ca giữ mọi yếu tố khác hợp lệ và chỉ để đúng một yếu tố sai, để một
lần đỏ chỉ có một cách giải thích.

CREATE — miền và biên
| TC   | Tên                    | Giá                      | Kỳ vọng theo đặc tả          |
|------|------------------------|--------------------------|------------------------------|
| DT1  | hợp lệ (vài ký tự)     | 300000                   | Lưu được, có phản hồi        |
| DT3  | rỗng                   | 300000                   | Bị từ chối                   |
| DT4  | 256 ký tự              | 300000                   | Bị từ chối (tối đa 255)      |
| DT5  | hợp lệ                 | -100                     | Bị từ chối (phải > 0)        |
| DT6  | hợp lệ                 | abc                      | Bị từ chối (phải là số)      |
| DT7  | hợp lệ                 | rỗng                     | Bị từ chối (bắt buộc)        |
| DT8  | hợp lệ                 | 99999999999999999999999  | Quan sát: đặc tả không có cận trên |
| BT1  | 0 ký tự                | 300000                   | Bị từ chối                   |
| BT2  | 1 ký tự                | 300000                   | Lưu được                     |
| BT3  | 2 ký tự                | 300000                   | Lưu được                     |
| BT4  | 254 ký tự              | 300000                   | Lưu được                     |
| BT5  | 255 ký tự              | 300000                   | Lưu được                     |
| BT6  | 256 ký tự              | 300000                   | Bị từ chối                   |
| BT7  | hợp lệ                 | -1                       | Bị từ chối                   |
| BT8  | hợp lệ                 | 0                        | Bị từ chối (quy tắc là > 0)  |
| BT9  | hợp lệ                 | 1                        | Lưu được                     |
| BT10 | hợp lệ                 | 99999999999999999999999  | Quan sát                     |

CÁC THAO TÁC KHÁC
| TC   | Thao tác | Nội dung                                  | Kỳ vọng theo đặc tả                     |
|------|----------|-------------------------------------------|-----------------------------------------|
| DT2  | Read     | xem sản phẩm vừa tạo trong bảng           | tên/giá/danh mục hiển thị đúng          |
| DT9  | Create   | bấm Lưu liên tiếp nhiều lần               | Quan sát số sản phẩm được tạo           |
| DT10 | Update   | đổi cả tên và giá của 1 sản phẩm          | CHỈ sản phẩm đó đổi; sản phẩm thứ 2 giữ nguyên |
| DT11 | Update   | đổi tên thành rỗng                        | Bị từ chối                              |
| DT12 | Update   | đổi tên thành 256 ký tự                   | Bị từ chối                              |
| DT13 | Update   | đổi giá thành -100                        | Bị từ chối                              |
| DT14 | Delete   | xoá 1 sản phẩm                            | Sản phẩm đó biến mất; sản phẩm thứ 2 còn nguyên |

Ràng buộc thiết kế:

R1. Mỗi ca Update/Delete cần TỐI THIỂU hai sản phẩm tồn tại trước đó, để kiểm được tính cô lập.
    Nêu cách bạn dựng tiền đề đó và vì sao chúng phải là sản phẩm do test tự tạo.

R2. Tên sản phẩm dài 254/255/256 ký tự KHÔNG được viết thẳng vào file dữ liệu dưới dạng chuỗi
    dài. Mã hoá bằng ĐỘ DÀI + cách sinh, rồi dựng lúc chạy. Nêu quy ước bạn chọn, và bảo đảm tên
    sinh ra vẫn duy nhất giữa các ca và các lần chạy.

R3. Ca 256 ký tự với chữ có dấu tiếng Việt: đặc tả nói "255 ký tự" chứ không nói 255 byte.
    Nếu bạn dùng ký tự ASCII thì không phân biệt được hai cách hiểu. Nêu quyết định của bạn và
    ghi vào mục hạn chế nếu bạn chọn không phủ.

R4. DT9 "bấm liên tiếp": định lượng số lần bấm trong DỮ LIỆU, không trong code.
    Kỳ vọng theo đặc tả là gì? Đặc tả có nói gì về chống bấm trùng không? Nếu không thì oracle
    của ca này là gì — nêu rõ, và đừng bịa một con số.

R5. Giá `99999999999999999999999` vượt xa MAX_SAFE_INTEGER. Nêu bạn lưu nó thế nào trong file
    dữ liệu và so sánh thế nào, biết rằng bảng admin in giá trị THÔ không qua toLocaleString.

R6. Mỗi dòng có cột mã ca gốc, cột kỹ thuật (EP/BVA), cột vị trí biên, cột căn cứ đặc tả, và
    cột ghi rõ oracle này lấy thẩm quyền từ đâu (spec / suy diễn / quan sát).

Chọn .csv hay .json tuỳ bạn, nhưng nêu lý do — nhắc lại rằng ở FR-09 bạn chọn JSON vì có khối
tham số lồng nhau và vì cần phân biệt chuỗi rỗng với không-có-giá-trị.
```

---

## PROMPT 3 — Page object và lớp dựng/dọn trạng thái

```
Bước 3: page object + fixture. Chưa viết spec.

3a. src/pages/admin-products.page.ts
    Tối thiểu: gotoProductsTab(); fillProductForm({name, price, imageUrl, description, categoryId});
    submitForm(); clickEditFor(productName); clickDeleteFor(productName);
    isFormInEditMode(); getRowFor(productName); getAllRows(); getRowCount();
    readRow(productName) -> { name, priceRaw };
    Mọi locator phải nằm trong phạm vi form hoặc phạm vi bảng sản phẩm, KHÔNG neo vào toàn trang —
    trên màn hình còn khối Import CSV cũng có button và có thể có table.
    KHÔNG có expect trong file này.

3b. src/pages/admin-login.page.ts hoặc một helper tương đương
    Đưa trình duyệt vào trạng thái đã đăng nhập admin. Nhắc lại: token ở localStorage key
    "adminToken", KHÁC key của storefront. Nêu bạn chọn đi qua form hay nạp token, và đánh đổi.
    Đăng nhập KHÔNG phải đối tượng kiểm thử của FR-15.

3c. src/utils/product-fixture.ts
    Tạo sản phẩm cho tiền đề, và xoá MỌI sản phẩm do test tạo ra khi kết thúc — kể cả sản phẩm
    được tạo bởi chính thao tác đang kiểm thử (ca Create thành công sẽ để lại một hàng).
    Yêu cầu:
    - Tên sản phẩm sinh ra phải nhận diện được là của lần chạy này (chứa STUDENT_ID và
      RUN_TIMESTAMP đã lọc ký tự), để nếu teardown sập thì người dọn thủ công biết xoá cái gì.
    - Phải xử lý được ca mà sản phẩm được tạo QUA GIAO DIỆN, tức test không biết trước id.
      Nêu cách bạn tìm lại id của nó.
    - Nêu rõ điều gì còn sót lại nếu tiến trình bị giết giữa chừng.

3d. Chụp trạng thái để kiểm tính cô lập
    Cung cấp một cách chụp lại trạng thái các sản phẩm KHÁC (không phải sản phẩm đang thao tác)
    trước và sau hành động, rồi so sánh. Nêu bạn chụp từ nguồn nào, và nếu bạn chụp từ nhiều
    nguồn thì so sánh chúng với nhau ra sao.
```

---

## PROMPT 4 — File spec

```
Bước 4: viết tests/fr15-product-crud.spec.ts.

S1. Vòng lặp tra bảng. Các trục dự kiến: thao tác (create/read/update/delete), kỳ vọng
    (accept/reject/observe), có cần tiền đề nhiều sản phẩm hay không. Không lồng if theo mã ca.

S2. Đầu file liệt kê các KIỂU assertion, đánh số, đánh dấu tại chỗ. FR-15 nên có ít nhất một
    kiểu mà FR-06/FR-09 chưa dùng — nêu rõ nó là gì và vì sao feature này cần nó.

S3. Ca "bị từ chối": bằng chứng phải gồm cả hai — không có sản phẩm mới nào xuất hiện trong
    bảng, VÀ tổng số sản phẩm không đổi. Chỉ kiểm một trong hai là chưa đủ; nêu lý do trong comment.
    Chú ý: một số ô có thuộc tính HTML chặn gửi form. Nếu form không được gửi, đó vẫn là
    "bị từ chối" theo đặc tả — nhưng annotation phải ghi rõ việc chặn xảy ra ở tầng nào.

S4. Ca Update và Delete: khẳng định tính cô lập theo thiết kế ở bước 3d. Nếu hai nguồn dữ liệu
    mâu thuẫn nhau, assertion phải đỏ và message phải in ra CẢ HAI nguồn, không được chọn bên nào.

S5. Mọi assertion có message chứa giá trị thực đọc được. Với ca 254/255/256 ký tự, message phải
    ghi ĐỘ DÀI chứ không dán cả chuỗi.

S6. Tiêu đề test bắt đầu bằng mã ca, rồi thao tác, rồi mô tả. logRunHeader('fr15') ở beforeAll.

S7. Sau mỗi test, ghi vào annotation: số sản phẩm trước và sau, và danh sách id do test này tạo ra.
```

---

## PROMPT 5 — Tự rà soát

```
Bước 5: tự rà soát, không viết lại code.

1. Chạy suite 3 lần liên tiếp, database còn lại bao nhiêu hàng thừa? Chứng minh.
2. Assertion nào vẫn pass ngay cả khi SUT hỏng? Nêu kịch bản bị bỏ lọt.
3. Test nào phụ thuộc thứ tự chạy?
4. Nếu bảng sản phẩm có 200 hàng, test nào chậm đi hoặc sai đi?
5. Giả định nào bạn tự đưa vào mà đặc tả FR-15 không nói?
6. Ca nào không tự động hoá được đáng tin cậy, vì sao?
7. Nếu giao diện và API cho hai câu trả lời khác nhau, test của bạn báo cáo điều đó rõ tới mức nào?
```

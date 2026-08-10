/**
 * Đọc TOÀN BỘ bảng sản phẩm của Web Admin bằng ĐÚNG MỘT lời gọi sang trình duyệt.
 *
 * ------------------------------------------------------------------------------
 * Vì sao phải quan tâm tới số lời gọi
 *
 * Bảng Quản lý Sản phẩm KHÔNG phân trang. Sau vài lần chạy suite, nó có thể có hàng trăm
 * hàng. Tầng 3 của oracle (đối chiếu chéo DOM với API) đọc toàn bảng ở MỌI test:
 * 24 ca x 3 browser = 72 lần đọc mỗi lần chạy suite.
 *
 * Cách viết ngây thơ:
 *     const rows = table.locator('tbody tr');
 *     for (let i = 0; i < await rows.count(); i++) {
 *       name.push(await rows.nth(i).locator('td').nth(1).textContent());
 *       price.push(await rows.nth(i).locator('td').nth(2).textContent());
 *     }
 * tốn 2 lời gọi CDP/WebSocket cho mỗi hàng, tức chi phí tăng theo tích (số hàng x số cột).
 * Với 300 hàng là 600 vòng khứ hồi cho một lần chụp, 43.200 vòng cho cả suite. Mỗi vòng
 * cỡ 1-3 ms, nên riêng phần chụp đã ngốn hàng phút — và tệ hơn, thời gian đó nằm rải rác
 * trong mọi test nên nó bào mòn `timeout: 30_000` cho tới lúc test bắt đầu đỏ vì hết giờ
 * chứ không phải vì SUT sai. Một oracle không được phép tự tạo ra flakiness của chính nó.
 *
 * Cách ở file này: một lần `Locator.evaluate` trên phần tử <table>. Toàn bộ việc duyệt DOM
 * xảy ra TRONG trang, chỉ có kết quả đã cấu trúc hoá đi ngược trở lại. Chi phí là O(1) vòng
 * khứ hồi, O(số ô) trong trang — nơi việc duyệt DOM vốn rẻ.
 * ------------------------------------------------------------------------------
 * Vì sao dò chỉ số cột từ <thead> thay vì viết cứng td[1], td[2]
 *
 * Viết cứng chỉ số thì khi SUT chèn thêm một cột, mọi assertion về tên/giá sẽ so nhầm cột
 * và đỏ với thông điệp vô nghĩa. Dò theo tiêu đề cột thì việc dò thất bại được BÁO CÁO
 * tường minh (nameColumn = -1) và spec đỏ đúng nguyên nhân. Việc dò diễn ra trong cùng một
 * lần evaluate nên không tốn thêm vòng khứ hồi nào.
 * ------------------------------------------------------------------------------
 * KỶ LUẬT SỬ DỤNG (lỗi đã mắc ở FR-09, không lặp lại):
 * hàm này ĐỌC dữ liệu, nó KHÔNG phải assertion. Spec phải chốt sự tồn tại trước rồi mới gọi:
 *     await expect(rowsLocator).toHaveCount(n);   // assertion, có auto-retry
 *     const snapshot = await readAdminTable(tableLocator);
 * Gọi trước khi có assertion chốt sẽ chụp phải một bảng đang render dở, và snapshot rỗng đó
 * sẽ đi thẳng vào phép so sánh mà không ai nhận ra.
 */
import type { Locator } from '../fixtures';

/** Một hàng đã bóc tách, chỉ gồm những trường bảng thực sự hiển thị. */
export interface AdminTableRow {
  /** Vị trí trong tbody, 0-based. Giữ lại để so sánh THỨ TỰ tách riêng khỏi so sánh nội dung. */
  index: number;
  /** Nội dung ô "Tên SP" đã trim. */
  name: string;
  /** Nội dung ô "Giá" ở dạng THÔ, chưa chuẩn hoá — việc đó thuộc về admin-price.ts. */
  priceText: string;
  /** Số ô <td> của hàng. Lệch khỏi số cột của thead là dấu hiệu DOM đã đổi. */
  cellCount: number;
}

export interface AdminTableSnapshot {
  /** Số hàng trong tbody. */
  rowCount: number;
  /** Danh sách tiêu đề cột đọc được — đưa vào message khi việc dò cột thất bại. */
  headers: string[];
  /** Chỉ số cột "Tên SP", -1 nếu không dò được. */
  nameColumn: number;
  /** Chỉ số cột "Giá", -1 nếu không dò được. */
  priceColumn: number;
  rows: AdminTableRow[];
}

/**
 * Nhãn tiêu đề cột theo DOM thật của Web Admin.
 * Đây là hằng số CẤU TRÚC GIAO DIỆN (tên cột do SUT in ra), không phải dữ liệu kiểm thử,
 * nên nó thuộc về tầng page/util chứ không vi phạm quy ước "cấm dữ liệu cứng trong spec".
 */
const NAME_HEADER = 'Tên SP';
const PRICE_HEADER = 'Giá';

/**
 * Chụp toàn bộ bảng sản phẩm.
 *
 * @param table Locator trỏ tới đúng phần tử <table> của khối quản lý sản phẩm.
 *   Người gọi chịu trách nhiệm neo locator này vào bảng ĐÚNG — trên cùng màn hình còn có
 *   khối Import CSV (FR-16) và khối đó cũng có thể chứa một <table> xem trước. Cách neo
 *   được dùng ở page object là lọc theo tiêu đề cột "Hành động", vốn chỉ bảng quản lý mới có.
 */
export async function readAdminTable(table: Locator): Promise<AdminTableSnapshot> {
  // MỘT lời gọi duy nhất. Hàm bên dưới chạy trong ngữ cảnh trang, không đóng gói biến Node nào.
  return table.evaluate((el, headerLabels) => {
    const [nameHeader, priceHeader] = headerLabels;
    const norm = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();

    const headerCells = Array.from(el.querySelectorAll('thead th'));
    const headers = headerCells.map((th) => norm(th.textContent));

    // So khớp KHÔNG phân biệt hoa/thường và bỏ dấu hai chấm thừa, nhưng vẫn là so khớp
    // chính xác cả chuỗi: "Giá" không được vô tình khớp với một cột "Giá gốc" nào đó.
    const indexOfHeader = (label: string): number =>
      headers.findIndex((h) => h.toLowerCase() === label.toLowerCase());

    const nameColumn = indexOfHeader(nameHeader);
    const priceColumn = indexOfHeader(priceHeader);

    const bodyRows = Array.from(el.querySelectorAll('tbody tr'));
    const rows = bodyRows.map((tr, index) => {
      const cells = Array.from(tr.querySelectorAll('td'));
      return {
        index,
        name: nameColumn >= 0 ? norm(cells[nameColumn]?.textContent) : '',
        // Giữ NGUYÊN chuỗi giá (chỉ gộp khoảng trắng): mọi việc bóc tách con số đều
        // thuộc về admin-price.ts. Chuẩn hoá sớm ở đây sẽ giấu mất các lỗi định dạng.
        priceText: priceColumn >= 0 ? norm(cells[priceColumn]?.textContent) : '',
        cellCount: cells.length,
      };
    });

    return { rowCount: bodyRows.length, headers, nameColumn, priceColumn, rows };
  }, [NAME_HEADER, PRICE_HEADER] as const);
}

/**
 * Rút gọn snapshot thành dạng so sánh được bằng expect(...).toEqual(...).
 *
 * Tách riêng khỏi readAdminTable vì hai phép so sánh khác nhau cần hai hình chiếu khác nhau:
 *   - so NỘI DUNG  -> sắp xếp theo tên, bỏ index đi (thứ tự hiển thị do server quyết định
 *                     và có thể đổi hợp lệ, không nên làm đỏ một assertion về dữ liệu).
 *   - so THỨ TỰ    -> giữ nguyên index, dùng một assertion riêng.
 * Gộp hai thứ này vào một phép so là cách chắc chắn nhất để một fail về thứ tự bị đọc nhầm
 * thành một fail về dữ liệu.
 */
export function projectByName(
  snapshot: AdminTableSnapshot,
  priceKeyOf: (priceText: string) => string,
): Array<{ name: string; price: string }> {
  return snapshot.rows
    .map((row) => ({ name: row.name, price: priceKeyOf(row.priceText) }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Hình chiếu chỉ-thứ-tự: dãy tên theo đúng trình tự hiển thị. */
export function projectOrder(snapshot: AdminTableSnapshot): string[] {
  return snapshot.rows.map((row) => row.name);
}

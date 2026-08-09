/**
 * Số học tiền tệ cho FR-09 — TOÀN BỘ bằng BigInt, không có một phép toán dấu phẩy động nào.
 *
 * ------------------------------------------------------------------------------
 * Vì sao cần một đơn vị nội bộ riêng thay vì "đồng"?
 *
 * Đặc tả cho công thức percent: discount = total * discount_value / 100. Với total = 300001
 * và value = 10, kết quả đúng là 30000.1 — KHÔNG phải số nguyên đồng. Đặc tả im lặng hoàn toàn
 * về việc làm tròn, nên test không được phép tự chế một quy ước (dù là cắt hay làm tròn nửa lên);
 * làm vậy là biến giả định của người viết test thành ràng buộc lên SUT.
 *
 * Hệ quả: oracle phải biểu diễn được phần thập phân một cách CHÍNH XÁC. Giải pháp là quy mọi số
 * tiền về số nguyên mili-đồng (1 đồng = 1000 mili-đồng) rồi chỉ làm việc trên BigInt.
 *
 * Vì sao thang 3 chữ số là đủ và không dư:
 *   - Number.prototype.toLocaleString('vi-VN') mặc định hiển thị tối đa 3 chữ số thập phân,
 *     nên 3 chữ số phủ trọn mọi thứ SUT có thể hiện ra màn hình.
 *   - Phần trăm của một số nguyên đồng có tối đa 2 chữ số thập phân, nên 3 chữ số biểu diễn
 *     giá trị chính xác mà không mất mát.
 * Gặp chữ số thập phân thứ 4 nghĩa là một giả định ở trên đã sai — lúc đó phải NÉM LỖI để lộ ra,
 * chứ không được cắt bớt âm thầm.
 * ------------------------------------------------------------------------------
 */

/** 1 đồng = 1000 mili-đồng. Mọi hàm trong file này trả về/nhận vào mili-đồng. */
export const ONE_DONG = 1000n;

/** Số chữ số thập phân tối đa mà biểu diễn mili-đồng chứa được. */
const FRACTION_DIGITS = 3;

/**
 * Khoảng trắng không ngắt mà Intl chèn trước ký hiệu tiền tệ.
 * U+00A0 (NBSP) và U+202F (narrow NBSP) trông y hệt dấu cách thường trong HTML report,
 * nên nếu không chuẩn hoá, một so sánh chuỗi sẽ thất bại vì lý do vô hình.
 */
const NBSP = /[  ]/g;

/** Dấu trừ Unicode U+2212 — một số locale dùng nó thay cho '-' ASCII. */
const UNICODE_MINUS = /−/g;

/**
 * Chuỗi tiền hợp lệ theo vi-VN sau khi đã gỡ ký hiệu tiền tệ:
 * phần nguyên có thể phân nhóm bằng dấu chấm hoặc không, phần thập phân sau dấu PHẨY.
 */
const VN_MONEY = /^-?(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d+)?$/;

/** Chuỗi tiền trong file dữ liệu: dấu chấm là dấu thập phân, không phân nhóm nghìn. */
const PLAIN_MONEY = /^-?\d+(?:\.\d+)?$/;

/** Phần nguyên đã phân nhóm hàng nghìn đúng kiểu vi-VN. */
const VN_GROUPED = /^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/;

/**
 * Ghép phần nguyên + phần thập phân thành mili-đồng.
 *
 * Điểm dễ sai nhất nằm ở đây: phần thập phân phải được đệm '0' sang PHẢI, không phải sang trái.
 * "1" sau dấu thập phân nghĩa là 0.1 tức 100 mili-đồng, chứ không phải 1 mili-đồng.
 */
function toMilli(intPart: string, fracPart: string, negative: boolean, raw: string): bigint {
  if (fracPart.length > FRACTION_DIGITS) {
    throw new Error(
      `[money] "${raw}" có ${fracPart.length} chữ số thập phân, vượt thang ${FRACTION_DIGITS} ` +
        `chữ số của biểu diễn mili-đồng. Không cắt bớt âm thầm vì như vậy oracle sẽ sai mà không ai biết.`,
    );
  }
  const padded = fracPart.padEnd(FRACTION_DIGITS, '0');
  const magnitude = BigInt(intPart) * ONE_DONG + BigInt(padded);
  return negative ? -magnitude : magnitude;
}

/** Gỡ ký hiệu tiền tệ, khoảng trắng và chuẩn hoá dấu trừ. Không đụng tới chữ số. */
function stripCurrency(text: string): string {
  return text
    .replace(NBSP, ' ')
    .replace(UNICODE_MINUS, '-')
    .replace(/₫|VND|đ/gi, '')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * Bóc số tiền từ chuỗi HIỂN THỊ trên giao diện (định dạng vi-VN).
 * Ví dụ: "40.000 ₫" -> 40000000n; "30.000,1 ₫" -> 30000100n; "-50.000 ₫" -> -50000000n.
 *
 * Vì sao ném lỗi thay vì trả null: phiên bản trước trả null khi gặp phần thập phân, và hậu quả
 * là BT3/BT7 đỏ với thông báo "expected null" — tức test đỏ vì bộ bóc tách của chính nó chứ
 * không phải vì SUT sai. Một ngoại lệ có thông điệp rõ ràng thì chẩn đoán được ngay.
 */
export function parseVndDisplay(text: string): bigint {
  const cleaned = stripCurrency(text);
  if (!VN_MONEY.test(cleaned)) {
    throw new Error(`[money] Không đọc được số tiền vi-VN từ "${text}" (sau chuẩn hoá: "${cleaned}").`);
  }

  const negative = cleaned.startsWith('-');
  const body = negative ? cleaned.slice(1) : cleaned;

  // Dấu PHẨY là dấu thập phân trong vi-VN; dấu CHẤM chỉ là phân nhóm nghìn nên xoá sạch.
  const [intRaw, fracRaw = ''] = body.split(',');
  return toMilli(intRaw.replace(/\./g, ''), fracRaw, negative, text);
}

/**
 * Bóc số tiền từ FILE DỮ LIỆU, nơi dấu chấm là dấu thập phân và không có phân nhóm nghìn.
 * Ví dụ: "30000.1" -> 30000100n.
 *
 * Cố ý tách khỏi parseVndDisplay thay vì dùng chung một hàm có cờ: dấu chấm mang hai nghĩa
 * trái ngược nhau ở hai định dạng, gộp lại là mời gọi đúng loại lỗi mà cả file này sinh ra để tránh.
 */
export function parseDecimalData(text: string): bigint {
  const cleaned = text.trim();
  if (!PLAIN_MONEY.test(cleaned)) {
    throw new Error(`[money] Giá trị trong file dữ liệu không phải số thập phân hợp lệ: "${text}".`);
  }
  const negative = cleaned.startsWith('-');
  const body = negative ? cleaned.slice(1) : cleaned;
  const [intRaw, fracRaw = ''] = body.split('.');
  return toMilli(intRaw, fracRaw, negative, text);
}

/**
 * Giá trị giảm giá CHÍNH XÁC theo công thức đặc tả, tính hoàn toàn bằng số nguyên.
 *
 * Với percent: total * value / 100 (đồng) đúng bằng total * value * 10 (mili-đồng).
 * Nhờ đó không tồn tại phép chia nào trong đường tính oracle — không chia thì không có chỗ nào
 * để một quy ước làm tròn lẻn vào mà người đọc không nhận ra.
 */
export function exactDiscountMilli(
  type: 'percent' | 'fixed',
  discountValue: string,
  orderTotal: string,
): bigint {
  if (type === 'fixed') {
    return parseDecimalData(discountValue);
  }
  return BigInt(orderTotal) * BigInt(discountValue) * 10n;
}

/** Trị tuyệt đối cho BigInt (không có Math.abs cho BigInt). */
export function absMilli(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/**
 * Đổi mili-đồng về chuỗi thập phân để ghi log / annotation.
 * Dùng dấu chấm làm dấu thập phân vì đây là chuỗi cho người đọc kỹ thuật, không phải chuỗi
 * để so sánh với giao diện — mọi so sánh đều diễn ra trên BigInt.
 */
export function milliToPlain(value: bigint): string {
  const negative = value < 0n;
  const magnitude = absMilli(value);
  const intPart = magnitude / ONE_DONG;
  const fracPart = (magnitude % ONE_DONG).toString().padStart(FRACTION_DIGITS, '0').replace(/0+$/, '');
  const sign = negative ? '-' : '';
  return fracPart.length > 0 ? `${sign}${intPart}.${fracPart}` : `${sign}${intPart}`;
}

/** Giá trị có rơi đúng vào một số nguyên đồng hay không — quyết định oracle dùng luật nào. */
export function isWholeDong(milli: bigint): boolean {
  return milli % ONE_DONG === 0n;
}

/**
 * Phần nguyên có được phân nhóm hàng nghìn theo vi-VN hay không.
 *
 * Tách riêng khỏi bộ bóc tách: parseVndDisplay cố tình DỄ DÃI với việc phân nhóm để một lỗi
 * định dạng không bị báo cáo nhầm thành lỗi tính toán. Việc khẳng định định dạng là một loại
 * assertion khác, thuộc về spec, và chỉ có ý nghĩa với số đủ lớn (BT7).
 */
export function isVnGrouped(text: string): boolean {
  return VN_GROUPED.test(stripCurrency(text));
}

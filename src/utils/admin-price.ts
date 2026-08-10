/**
 * Bộ đọc GIÁ cho FR-15 — CỐ Ý TÁCH KHỎI src/utils/money.ts.
 *
 * ------------------------------------------------------------------------------
 * Vì sao KHÔNG tái dùng parseVndDisplay của FR-09
 *
 * money.ts được viết cho chuỗi do Intl / toLocaleString('vi-VN') sinh ra, nơi:
 *     dấu CHẤM  = phân nhóm hàng nghìn
 *     dấu PHẨY  = dấu thập phân
 * Bảng Quản lý Sản phẩm của Web Admin KHÔNG đi qua bộ định dạng nào. Nó render
 * `{p.price} ₫`, tức là String(number) thô:
 *     300000  -> "300000 ₫"     (không có dấu phân nhóm nào)
 *     0.1     -> "0.1 ₫"        (dấu CHẤM ở đây là dấu THẬP PHÂN)
 *     1e23    -> "1e+23 ₫"      (ký hiệu khoa học)
 *
 * Ném "0.1 ₫" vào parseVndDisplay sẽ cho ra 1 đồng thay vì 0,1 đồng — vì hàm đó coi
 * dấu chấm là phân nhóm nên xoá đi và đọc thành "01". Sai lệch gấp 10 lần, KHÔNG có
 * ngoại lệ nào được ném, và sai theo hướng làm test vẫn XANH nếu SUT cũng lệch cùng
 * chiều. Đây đúng là loại lỗi mà một bộ oracle sinh ra để bắt, chứ không phải để mắc.
 *
 * Vì vậy file này định nghĩa một bộ đọc riêng, và chỉ mượn lại từ money.ts hai thứ
 * TRUNG LẬP VỚI LOCALE: hằng số thang mili-đồng và hàm in mili-đồng ra chuỗi kỹ thuật.
 * ------------------------------------------------------------------------------
 * Vì sao trả về một union có nhãn thay vì ném lỗi hoặc trả number
 *
 * Có ba dạng chuỗi mà "cố parse cho bằng được" đều là sai lầm:
 *   - "1e+23"      : ký hiệu khoa học. Number.MAX_SAFE_INTEGER đã bị vượt từ lâu, mọi
 *                    con số ta bịa ra ở đây đều là con số bịa.
 *   - "0.0001"     : vượt thang 3 chữ số của mili-đồng.
 *   - "300,000"    : có dấu phân nhóm — nghĩa là ai đó ĐÃ định dạng, trái với hành vi
 *                    quan sát được của bảng admin.
 * Ném lỗi thì test đỏ ở stack trace của bộ đọc, người đọc report tưởng lỗi ở test.
 * Ép về number thì test xanh trong khi dữ liệu vô nghĩa.
 * Nên: trả về `kind` mô tả đúng thứ đọc được, và để assertion ở tầng spec so sánh
 * `kind` trước `milli`. Khi đỏ, thông điệp nói thẳng nguyên nhân.
 * ------------------------------------------------------------------------------
 */
import { ONE_DONG, milliToPlain } from './money';

/** Phân loại thứ đọc được. Chỉ 'plain' mới có `milli` khác null. */
export type PriceKind =
  /** Số thập phân thông thường, biểu diễn chính xác được bằng mili-đồng. */
  | 'plain'
  /** Ký hiệu khoa học ("1e+23"). KHÔNG parse — xem chú thích đầu file. */
  | 'scientific'
  /** Nhiều hơn 3 chữ số thập phân có nghĩa — vượt thang mili-đồng. */
  | 'sub-milli'
  /** Có dấu phân nhóm hàng nghìn (',' hoặc nhiều hơn một '.'). */
  | 'grouped'
  /** Đúng dạng số nhưng không phải dạng chuẩn tắc của String(Number) — chỉ xét ở DOM admin. */
  | 'non-canonical'
  /** Rỗng sau khi gỡ ký hiệu tiền tệ. */
  | 'empty'
  /** Không phải số: "NaN", "undefined", chữ, null, object... */
  | 'non-numeric';

/** Nguồn của giá trị — đi vào annotation để report nói rõ ai bất đồng với ai. */
export type PriceSource = 'admin-cell' | 'api-list' | 'api-detail' | 'data-file';

/** Kiểu nguyên thuỷ JS của giá trị TRƯỚC khi chuẩn hoá (yêu cầu T3). */
export type PrimitiveType =
  | 'number'
  | 'string'
  | 'bigint'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'object';

export interface PriceReading {
  /** Nguồn đọc được giá trị này. */
  source: PriceSource;
  /**
   * Biểu diễn THÔ, đúng như nguồn đưa ra. Chỉ dùng cho THÔNG ĐIỆP LỖI — nó là bằng chứng.
   * TUYỆT ĐỐI không dùng để so sánh: chuỗi thô phía bảng luôn kèm " ₫" còn phía API thì không,
   * nên so trên nó sẽ cho dương tính giả ở mọi kind không đọc được ra số.
   */
  raw: string;
  /**
   * Chuỗi đã CHUẨN HOÁ: bỏ ký hiệu tiền tệ, bỏ mọi khoảng trắng (kể cả khoảng trắng không ngắt).
   * Đây là thứ duy nhất được phép đi vào khoá so sánh.
   */
  normalized: string;
  /**
   * Kiểu nguyên thuỷ đọc được từ nguồn.
   * GET /api/products và GET /api/products/:id có thể trả `price` ở hai kiểu khác nhau
   * cho cùng một bản ghi (số ở endpoint này, chuỗi ở endpoint kia). Đó là dữ kiện phải
   * báo cáo, nên nó được ghi lại tại đây chứ không bị `Number()` nuốt mất.
   */
  primitiveType: PrimitiveType;
  kind: PriceKind;
  /** Giá trị theo thang mili-đồng (1 đồng = 1000). null với mọi kind khác 'plain'. */
  milli: bigint | null;
  /** Ô bảng có ký hiệu '₫' hay không. null khi nguồn là API (không áp dụng). */
  hasCurrencySymbol: boolean | null;
  /** Câu giải thích ngắn, dùng thẳng làm message của assertion. */
  note: string;
}

/** Thang mili-đồng chứa được tối đa 3 chữ số thập phân. */
const FRACTION_DIGITS = 3;

/** Ký hiệu khoa học do String(number) sinh ra khi |x| >= 1e21 hoặc < 1e-6. */
const SCIENTIFIC = /^-?\d+(?:\.\d+)?[eE][+-]?\d+$/;

/** Số thập phân dùng dấu CHẤM, không phân nhóm — đúng dạng String(number) sinh ra. */
const DECIMAL = /^-?\d+(?:\.\d+)?$/;

/** Khoảng trắng không ngắt: trông y hệt dấu cách nên phải chuẩn hoá trước khi so. */
const NBSP = /[  ]/g;

interface Classified {
  kind: PriceKind;
  milli: bigint | null;
  note: string;
}

/**
 * Lõi phân loại — HÀM DUY NHẤT mà mọi nguồn (DOM admin, hai endpoint API, file dữ liệu)
 * đều phải đi qua. Đây chính là yêu cầu T3: nếu mỗi nguồn có đường chuẩn hoá riêng thì
 * việc "hai nguồn khớp nhau" không còn kiểm được — ta sẽ đang so hai phép biến đổi khác
 * nhau chứ không phải so hai giá trị.
 *
 * @param enforceCanonical Chỉ bật cho DOM admin. Ô giá của bảng admin là String(number),
 *   mà String(number) không bao giờ sinh ra số 0 thừa ở đầu phần nguyên hay ở cuối phần
 *   thập phân. Chuỗi lệch khỏi dạng chuẩn tắc đó nghĩa là đã có một bộ định dạng chen vào
 *   — điển hình là "300.000" (phân nhóm) trá hình thành "300.0 đồng". Với API thì không bật,
 *   vì cột DECIMAL của CSDL trả "300000.00" là hợp lệ và không nói lên điều gì bất thường.
 */
function classify(body: string, enforceCanonical: boolean): Classified {
  if (body === '') {
    return { kind: 'empty', milli: null, note: 'Không có chữ số nào sau khi gỡ ký hiệu tiền tệ.' };
  }

  if (SCIENTIFIC.test(body)) {
    return {
      kind: 'scientific',
      milli: null,
      note:
        `"${body}" là ký hiệu khoa học. Cố đọc nó thành số nguyên mili-đồng sẽ tạo ra một ` +
        'con số bịa (giá trị đã vượt Number.MAX_SAFE_INTEGER từ lâu), nên bộ đọc dừng tại đây. ' +
        'Đặc tả FR-15 nói giá KHÔNG có cận trên, nên bản thân việc nhập số lớn là hợp lệ; ' +
        'điều đáng báo cáo là SUT hiển thị nó ở dạng người dùng không đọc được.',
    };
  }

  // Kiểm tra phân nhóm TRƯỚC khi kết luận "không phải số", để "300,000" được gọi đúng tên
  // thay vì bị gộp chung vào rổ 'non-numeric' vô nghĩa.
  const dotCount = body.split('.').length - 1;
  if (body.includes(',') || dotCount > 1) {
    return {
      kind: 'grouped',
      milli: null,
      note:
        `"${body}" chứa dấu phân nhóm hàng nghìn. Bảng admin render {price} thô nên lẽ ra ` +
        'không bao giờ có dấu phân nhóm. Sự xuất hiện của nó là thay đổi hành vi hiển thị, ' +
        'phải báo cáo chứ không phải chuẩn hoá cho qua.',
    };
  }

  if (!DECIMAL.test(body)) {
    return {
      kind: 'non-numeric',
      milli: null,
      note: `"${body}" không phải một số thập phân (có thể là NaN / undefined / chuỗi chữ).`,
    };
  }

  const negative = body.startsWith('-');
  const magnitude = negative ? body.slice(1) : body;
  const [intPart, fracRaw = ''] = magnitude.split('.');

  if (enforceCanonical) {
    if (intPart.length > 1 && intPart.startsWith('0')) {
      return {
        kind: 'non-canonical',
        milli: null,
        note: `"${body}" có số 0 thừa ở đầu — String(Number) không sinh ra dạng này.`,
      };
    }
    if (fracRaw.length > 0 && fracRaw.endsWith('0')) {
      return {
        kind: 'non-canonical',
        milli: null,
        note:
          `"${body}" có số 0 thừa ở cuối phần thập phân — String(Number) không sinh ra dạng này. ` +
          'Khả năng cao dấu chấm ở đây là dấu phân nhóm chứ không phải dấu thập phân, và ' +
          'đoán bừa một trong hai nghĩa là đúng thứ file này tồn tại để không làm.',
      };
    }
  }

  // Số 0 ở cuối phần thập phân không mang thông tin, nên cắt trước khi xét thang.
  // "0.1000" vẫn là 0,1 đồng chứ không phải giá trị dưới mili-đồng.
  const frac = fracRaw.replace(/0+$/, '');
  if (frac.length > FRACTION_DIGITS) {
    return {
      kind: 'sub-milli',
      milli: null,
      note:
        `"${body}" có ${frac.length} chữ số thập phân có nghĩa, vượt thang ${FRACTION_DIGITS} ` +
        'chữ số của biểu diễn mili-đồng. Cắt bớt ở đây sẽ làm oracle sai mà không ai biết.',
    };
  }

  // Đệm sang PHẢI: "1" sau dấu thập phân là 0,1 đồng = 100 mili-đồng, không phải 1 mili-đồng.
  const padded = frac.padEnd(FRACTION_DIGITS, '0');
  const value = BigInt(intPart) * ONE_DONG + BigInt(padded);

  return {
    kind: 'plain',
    milli: negative ? -value : value,
    note: '',
  };
}

/** typeof có một lỗ lịch sử: typeof null === 'object'. Tách null ra thành nhãn riêng. */
function primitiveTypeOf(value: unknown): PrimitiveType {
  if (value === null) return 'null';
  const t = typeof value;
  return t === 'function' || t === 'symbol' ? 'object' : t;
}

/**
 * Đọc giá từ MỘT Ô của bảng Quản lý Sản phẩm (Web Admin 5174).
 *
 * Ô có dạng `{price} ₫`. Hàm gỡ ký hiệu tiền tệ và khoảng trắng không ngắt, ghi lại việc
 * ký hiệu có mặt hay không (mất ký hiệu '₫' cũng là một thay đổi hiển thị đáng báo cáo),
 * rồi đưa phần còn lại qua đúng lõi phân loại mà API dùng.
 */
export function readAdminCellPrice(cellText: string): PriceReading {
  const normalized = cellText.replace(NBSP, ' ');
  const hasCurrencySymbol = /₫/.test(normalized);
  const body = normalized.replace(/₫/g, '').replace(/\s+/g, '').trim();
  const classified = classify(body, true);

  return {
    source: 'admin-cell',
    raw: cellText.trim(),
    normalized: body,
    // Giá trị đọc từ DOM luôn là chuỗi; ghi lại để đối xứng với nhánh API.
    primitiveType: 'string',
    kind: classified.kind,
    milli: classified.milli,
    hasCurrencySymbol,
    note: classified.note,
  };
}

/**
 * Đọc giá từ MỘT TRƯỜNG của phản hồi API — dùng cho CẢ HAI endpoint.
 *
 * Không được giả định `price` cùng kiểu ở hai endpoint. GET /api/products có thể trả số
 * trong khi GET /api/products/:id trả chuỗi (hoặc ngược lại), tuỳ driver CSDL và tuỳ chỗ
 * nào trong backend có JSON.stringify chen vào. Hàm này ghi lại kiểu nguyên thuỷ đọc được
 * và KHÔNG ép kiểu im lặng, để tầng spec quyết định có báo cáo hay không.
 */
export function readApiPrice(source: 'api-list' | 'api-detail', value: unknown): PriceReading {
  const primitiveType = primitiveTypeOf(value);

  if (primitiveType !== 'number' && primitiveType !== 'string' && primitiveType !== 'bigint') {
    return {
      source,
      raw: String(value),
      normalized: String(value).replace(/\s+/g, ''),
      primitiveType,
      kind: 'non-numeric',
      milli: null,
      hasCurrencySymbol: null,
      note: `Trường giá có kiểu ${primitiveType}, không phải số cũng không phải chuỗi số.`,
    };
  }

  // String(number) là đúng cùng phép biến đổi mà React dùng khi render {p.price},
  // nên nhánh API và nhánh DOM nhìn thấy CÙNG một chuỗi cho cùng một giá trị.
  const raw = typeof value === 'string' ? value.trim() : String(value);
  // Gỡ luôn ký hiệu tiền tệ ở nhánh API: đa số API trả số trần, nhưng nếu một endpoint nào đó
  // trả "300000 ₫" thì hai nguồn vẫn phải quy về cùng một chuỗi trước khi so.
  const normalized = raw.replace(NBSP, ' ').replace(/₫/g, '').replace(/\s+/g, '');
  const classified = classify(normalized, false);

  return {
    source,
    raw,
    normalized,
    primitiveType,
    kind: classified.kind,
    milli: classified.milli,
    hasCurrencySymbol: null,
    note: classified.note,
  };
}

/**
 * Đọc giá KỲ VỌNG từ file trong /data.
 * Vẫn đi qua đúng lõi trên, để giá trị kỳ vọng và giá trị thực tế được so trên cùng một
 * biểu diễn — nếu không, một khác biệt về phép chuẩn hoá sẽ bị đọc nhầm thành lỗi của SUT.
 */
export function readExpectedPrice(text: string): PriceReading {
  const raw = text.trim();
  const normalized = raw.replace(NBSP, ' ').replace(/₫/g, '').replace(/\s+/g, '');
  const classified = classify(normalized, false);
  return {
    source: 'data-file',
    raw,
    normalized,
    primitiveType: 'string',
    kind: classified.kind,
    milli: classified.milli,
    hasCurrencySymbol: null,
    note: classified.note,
  };
}

/**
 * Khoá so sánh dùng trong snapshot / diff.
 *
 * Trả về CHUỖI chứ không phải bigint vì hai lý do:
 *   1. bigint không JSON-serialize được, mà snapshot còn phải đi vào annotation và attachment.
 *   2. Mọi kind không đọc được vẫn có khoá riêng, nên chúng tham gia được vào phép
 *      expect(...).toEqual(...) trên toàn bảng. Khi đỏ, diff hiện thẳng
 *      "scientific:1e+23" cạnh "plain:300000" — đọc là biết nguyên nhân, không cần mở trace.
 *
 * ------------------------------------------------------------------------------
 * LỖI ĐÃ MẮC VÀ ĐÃ SỬA — ghi lại để không tái diễn.
 *
 * Phiên bản đầu dùng `reading.raw` cho mọi kind khác 'plain'. Với 'plain' thì không sao vì khoá
 * dựng từ giá trị mili-đồng, tức ký hiệu tiền đã bị bóc từ trước. Nhưng với các kind còn lại,
 * chuỗi thô phía BẢNG luôn kèm " ₫" còn phía API thì không, nên phép đối chiếu chéo cho ra:
 *      DT8:  BẢNG [scientific:1e+23 ₫]  |  API [scientific:1e+23]
 *      DT6:  BẢNG [empty:₫]             |  API [empty:]
 * Bốn ca (DT6, DT7, DT8, BT10) đỏ vì lỗi của bộ test chứ không phải của SUT. Tệ hơn: nếu SUT
 * THẬT SỰ hiển thị sai ở đúng những ca đó thì dương tính giả và dương tính thật trông y hệt nhau.
 *
 * Nay khoá luôn dựng từ `normalized`. `raw` vẫn được giữ trong thông điệp lỗi — nó là bằng chứng
 * về thứ người dùng thật nhìn thấy — nhưng không bao giờ tham gia so sánh.
 * ------------------------------------------------------------------------------
 */
export function priceKey(reading: PriceReading): string {
  if (reading.kind === 'plain' && reading.milli !== null) {
    return `plain:${milliToPlain(reading.milli)}`;
  }
  return `${reading.kind}:${reading.normalized}`;
}

/** Mô tả một lần đọc, dùng làm message của assertion. */
export function describePrice(reading: PriceReading): string {
  const head = `[${reading.source}] raw=${JSON.stringify(reading.raw)} typeof=${reading.primitiveType} kind=${reading.kind}`;
  return reading.note ? `${head} — ${reading.note}` : head;
}

/**
 * Đối chiếu KIỂU NGUYÊN THUỶ giữa hai lần đọc của cùng một bản ghi.
 * Trả về null khi hai bên đồng thuận, hoặc một câu mô tả khi bất đồng.
 *
 * Cố ý KHÔNG assert bên trong file này: quy ước repo cấm expect nằm ngoài spec, và quan
 * trọng hơn, việc bất đồng kiểu nên được BÁO CÁO ở mọi ca (qua annotation) nhưng chỉ nên
 * làm ĐỎ ở ca dành riêng cho nó — nếu không, một điểm bất thường sẽ làm hỏng 24 ca và che
 * mất những lỗi khác.
 */
export function comparePrimitiveTypes(a: PriceReading, b: PriceReading): string | null {
  if (a.primitiveType === b.primitiveType) return null;
  return (
    `Hai nguồn bất đồng KIỂU cho cùng một trường giá: ${a.source} trả ${a.primitiveType} ` +
    `(${JSON.stringify(a.raw)}) còn ${b.source} trả ${b.primitiveType} (${JSON.stringify(b.raw)}). ` +
    'Giá trị sau chuẩn hoá có thể vẫn bằng nhau, nhưng bản thân sự bất đồng kiểu là một ' +
    'hợp đồng API không nhất quán — client nào dùng === hoặc toFixed() sẽ vỡ.'
  );
}

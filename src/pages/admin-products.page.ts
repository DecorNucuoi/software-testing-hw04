/**
 * Page object cho tab "Quản lý Sản phẩm" của Web Admin (127.0.0.1:5174).
 *
 * ------------------------------------------------------------------------------
 * KHÔNG CÓ expect TRONG FILE NÀY. Page object cung cấp LOCATOR và DỮ KIỆN; việc phán xét
 * thuộc về spec. Hệ quả kéo theo: mọi hàm đọc ở đây đều trả về giá trị "không đọc được" một
 * cách tường minh (null / chuỗi lỗi) thay vì ném, để spec quyết định điều đó có nghĩa là gì.
 *
 * HAI VÙNG, KHÔNG NEO VÀO TOÀN TRANG
 * Màn hình có 3 khối theo thứ tự: khối Import CSV (thuộc FR-16), form sản phẩm, bảng sản phẩm.
 * Khối Import CŨNG có <button> và CÓ THỂ có <table> xem trước. Vì vậy mọi locator trong file
 * này đều xuất phát từ `productForm` hoặc `productTable`, không bao giờ từ `page` trực tiếp —
 * trừ ba ngoại lệ được đánh dấu rõ: sidebar, tiêu đề trang, và các locator của khối Import
 * (được expose CHỈ để spec chứng minh mình không đụng nhầm vào chúng).
 * ------------------------------------------------------------------------------
 */
import { URLS } from '../config';
import type { Locator, Page } from '../fixtures';
import { readAdminTable, type AdminTableSnapshot } from '../utils/admin-table';

/** Giá trị đọc được của một hàng. priceRaw giữ NGUYÊN chuỗi hiển thị, chưa chuẩn hoá. */
export interface RowReading {
  name: string;
  priceRaw: string;
}

/** Kết quả điền MỘT ô. Mọi trường đều là dữ kiện, không có trường nào là phán xét. */
export interface FieldFillReport {
  field: 'name' | 'price' | 'imageUrl' | 'description' | 'category';
  requested: string;
  /** Đường đã dùng để đặt giá trị. 'keyboard' nghĩa là fill() đã bị từ chối và ta gõ từng phím. */
  strategy: 'fill' | 'keyboard' | 'select' | 'failed';
  /** NGUYÊN VĂN lỗi của Playwright nếu thao tác bị khung từ chối. Đây là hành vi của công cụ. */
  frameworkError: string | null;
  /** Giá trị THỰC TẾ còn trong ô sau khi điền. null nghĩa là không đọc được. */
  actualValue: string | null;
  readError: string | null;
}

export interface FormFillReport {
  fields: FieldFillReport[];
}

/**
 * Trạng thái hợp lệ theo TRÌNH DUYỆT, đọc trước khi bấm Lưu.
 *
 * Vì sao cần: ô "Tên sản phẩm" có thuộc tính `required`, ô "Giá tiền" thì KHÔNG. Hai ô hành xử
 * khác nhau ở tầng trình duyệt, nên một ca "bị từ chối" có thể bị chặn ở tầng trình duyệt
 * (form không gửi đi) hoặc ở tầng ứng dụng (form gửi đi rồi server/JS từ chối). Hai thứ đó có
 * ý nghĩa kiểm thử hoàn toàn khác nhau và báo cáo phải phân biệt được.
 *
 * Đọc bằng `element.validity.valid` chứ KHÔNG gọi `checkValidity()`: checkValidity phát sự kiện
 * `invalid` lên các control, tức là phép đo tự làm thay đổi thứ nó đang đo.
 */
export interface NativeValidityReport {
  formValid: boolean | null;
  invalidFields: Array<{ placeholder: string; validationMessage: string }>;
  error: string | null;
}

export interface SubmitReport {
  nativeValidityBefore: NativeValidityReport;
  /** Có request ghi nào rời trình duyệt không. false = bị chặn trước khi ra khỏi trình duyệt. */
  requestSent: boolean;
  requestMethod: string | null;
  requestUrl: string | null;
  responseStatus: number | null;
  /** Lỗi khung khi bấm nút, nếu có. */
  frameworkError: string | null;
  /** Trần thời gian đã dùng để CHỜ BẰNG CHỨNG, không phải cơ chế đồng bộ. */
  evidenceTimeoutMs: number;
}

export interface ProductFormInput {
  /** undefined = KHÔNG đụng tới ô này. Chuỗi rỗng = cố tình xoá trắng ô. */
  name?: string;
  price?: string;
  imageUrl?: string;
  description?: string;
  /** value của <option>, thường là category_id dạng chuỗi. */
  categoryId?: string;
}

export class AdminProductsPage {
  readonly page: Page;

  /* --- Ngoại lệ 1: sidebar. Neo vào <ul> chứa "Đăng xuất" — mục chỉ sidebar mới có. --- */
  readonly sidebar: Locator;
  readonly menuProducts: Locator;

  /* --- Ngoại lệ 2: tiêu đề trang, để spec chốt đã mở đúng tab. --- */
  readonly pageHeading: Locator;

  /* --- VÙNG FORM --- */
  readonly productForm: Locator;
  readonly formHeading: Locator;
  readonly nameInput: Locator;
  readonly priceInput: Locator;
  readonly imageUrlInput: Locator;
  readonly descriptionInput: Locator;
  readonly categorySelect: Locator;
  readonly saveButton: Locator;
  /** Chỉ tồn tại khi form đang ở chế độ Sửa — là tín hiệu quan sát được của trạng thái. */
  readonly cancelEditButton: Locator;

  /* --- VÙNG BẢNG --- */
  readonly productTable: Locator;

  /* --- Ngoại lệ 3: khối Import CSV (FR-16). Expose để spec chứng minh KHÔNG đụng vào. --- */
  readonly importFileInput: Locator;

  constructor(page: Page) {
    this.page = page;

    this.sidebar = page.locator('ul').filter({ hasText: 'Đăng xuất' });
    // Neo bằng regex ^...$ và phân biệt hoa/thường: chuỗi "Sản phẩm" còn là chuỗi con của
    // "Quản lý Sản phẩm" (h2), của "Import N sản phẩm" (nút) và của placeholder "Tên sản phẩm".
    this.menuProducts = this.sidebar.locator('li').filter({ hasText: /^\s*Sản phẩm\s*$/ });

    this.pageHeading = page.getByRole('heading', { name: 'Quản lý Sản phẩm' });

    // Form được neo bằng tiêu đề của chính nó — thứ duy nhất phân biệt nó với form khác.
    // Regex phủ cả hai trạng thái vì tiêu đề đổi khi chuyển sang chế độ Sửa.
    this.productForm = page
      .locator('form')
      .filter({ has: page.getByRole('heading', { name: /^(Thêm sản phẩm mới|Sửa sản phẩm)$/ }) });

    this.formHeading = this.productForm.getByRole('heading');
    this.nameInput = this.productForm.getByPlaceholder('Tên sản phẩm', { exact: true });
    this.priceInput = this.productForm.getByPlaceholder('Giá tiền', { exact: true });
    this.imageUrlInput = this.productForm.getByPlaceholder('URL Ảnh', { exact: true });
    this.descriptionInput = this.productForm.getByPlaceholder('Mô tả', { exact: true });
    this.categorySelect = this.productForm.locator('select');
    this.saveButton = this.productForm.getByRole('button', { name: 'Lưu sản phẩm', exact: true });
    this.cancelEditButton = this.productForm.getByRole('button', { name: 'Hủy sửa', exact: true });

    // Bảng quản lý được neo bằng cột "Hành động" — cột mà bảng xem trước của khối Import
    // không thể có, vì nó chỉ hiển thị dữ liệu đọc từ file chứ không có nút thao tác.
    this.productTable = page
      .locator('table')
      .filter({ has: page.getByRole('columnheader', { name: 'Hành động', exact: true }) });

    this.importFileInput = page.locator('input[type="file"]');
  }

  /* =========================== ĐIỀU HƯỚNG =========================== */

  /**
   * Mở tab "Sản phẩm". Mục sidebar là <li>, không phải <a> cũng không phải <button>, nên
   * getByRole không dùng được — phải lọc theo văn bản trong phạm vi sidebar.
   *
   * Không chờ và không khẳng định gì sau khi bấm: spec chốt bằng expect(pageHeading) hoặc
   * expect(productTable), nơi phép chốt đó hiện ra trong report như một bước có thật.
   */
  async gotoProductsTab(): Promise<void> {
    if (!this.page.url().startsWith(URLS.admin)) {
      await this.page.goto(URLS.admin);
    }
    await this.menuProducts.click();
  }

  /* =========================== ĐIỀN FORM =========================== */

  /**
   * Đặt giá trị cho một ô văn bản, có đường lui khi khung từ chối.
   *
   * VÌ SAO CẦN ĐƯỜNG LUI (đã gặp ở FR-06): ô "Giá tiền" là <input type="number">. Khi ca DT6
   * cần nhập "abc", Playwright TỪ CHỐI ngay ở tầng khung với lỗi
   * "Cannot type text into input[type=number]" — SUT không hề được hỏi ý kiến. Đó là hành vi
   * của công cụ, KHÔNG phải hành vi của đặc tả, nên:
   *   1. lỗi được ghi NGUYÊN VĂN vào report thay vì bị nuốt;
   *   2. ta thử tiếp bằng cách gõ từng phím như người dùng thật — con đường này đi qua đúng
   *      lớp lọc của trình duyệt mà người dùng thật gặp;
   *   3. giá trị THỰC TẾ còn lại trong ô được đọc lại và đưa vào oracle.
   * Việc khung có ném hay không TUYỆT ĐỐI không được thành assertion — nó nói về Playwright,
   * không nói gì về SUT.
   */
  private async setTextField(
    field: FieldFillReport['field'],
    locator: Locator,
    value: string,
  ): Promise<FieldFillReport> {
    const report: FieldFillReport = {
      field,
      requested: value,
      strategy: 'fill',
      frameworkError: null,
      actualValue: null,
      readError: null,
    };

    try {
      await locator.fill(value);
    } catch (error) {
      report.frameworkError = (error as Error).message;
      report.strategy = 'keyboard';
      try {
        await locator.click();
        // Xoá nội dung cũ mà không dùng fill(): chọn hết rồi xoá, đúng thao tác của người dùng.
        await locator.press('ControlOrMeta+a');
        await locator.press('Delete');
        // delay nhỏ là NHỊP GÕ của người dùng, không phải chờ đồng bộ. Không có waitForTimeout.
        await this.page.keyboard.type(value, { delay: 20 });
      } catch (typeError) {
        report.frameworkError = `${report.frameworkError} || keyboard: ${(typeError as Error).message}`;
        report.strategy = 'failed';
      }
    }

    // Đọc lại giá trị thực tế. Bọc catch vì ở nhánh 'failed' ta không có gì bảo đảm ô còn đó.
    try {
      report.actualValue = await locator.inputValue();
    } catch (error) {
      report.readError = (error as Error).message;
    }

    return report;
  }

  /**
   * Điền form. Trường vắng mặt (undefined) = KHÔNG đụng tới; chuỗi rỗng = cố tình xoá trắng.
   * Phân biệt này là bắt buộc cho các ca Update chỉ đổi một trường (DT13).
   */
  async fillProductForm(input: ProductFormInput): Promise<FormFillReport> {
    const fields: FieldFillReport[] = [];

    if (input.name !== undefined) {
      fields.push(await this.setTextField('name', this.nameInput, input.name));
    }
    if (input.price !== undefined) {
      fields.push(await this.setTextField('price', this.priceInput, input.price));
    }
    if (input.imageUrl !== undefined) {
      fields.push(await this.setTextField('imageUrl', this.imageUrlInput, input.imageUrl));
    }
    if (input.description !== undefined) {
      fields.push(await this.setTextField('description', this.descriptionInput, input.description));
    }
    if (input.categoryId !== undefined) {
      fields.push(await this.selectCategory(input.categoryId));
    }

    return { fields };
  }

  /** Chọn danh mục theo value của <option>. Giá trị value do tầng gọi giải từ GET /api/categories. */
  async selectCategory(value: string): Promise<FieldFillReport> {
    const report: FieldFillReport = {
      field: 'category',
      requested: value,
      strategy: 'select',
      frameworkError: null,
      actualValue: null,
      readError: null,
    };
    try {
      await this.categorySelect.selectOption({ value });
    } catch (error) {
      report.frameworkError = (error as Error).message;
      report.strategy = 'failed';
    }
    try {
      report.actualValue = await this.categorySelect.inputValue();
    } catch (error) {
      report.readError = (error as Error).message;
    }
    return report;
  }

  /**
   * ĐỌC value đang được chọn của <select> danh mục — không đặt lại giá trị nào.
   *
   * Tách hẳn khỏi selectCategory() là bắt buộc: bảng KHÔNG có cột danh mục, nên cách duy nhất
   * kiểm "danh mục hiển thị đúng" (DT2) là mở form Sửa rồi ĐỌC. Dùng selectCategory() cho việc
   * này là tự đặt giá trị rồi tự đọc lại chính nó — phép kiểm luôn xanh và không bao giờ đỏ được.
   *
   * Spec phải chốt form đã vào chế độ Sửa trước khi gọi. Trả về null khi không đọc được.
   */
  async readSelectedCategory(): Promise<string | null> {
    try {
      return await this.categorySelect.inputValue();
    } catch {
      return null;
    }
  }

  /**
   * Danh sách value của các <option> danh mục.
   *
   * ĐỌC DOM — spec PHẢI chốt sự tồn tại trước khi tin vào kết quả, ví dụ:
   *     await expect(page.categorySelect.locator('option')).not.toHaveCount(0);
   * Hàm trả về mảng rỗng khi không đọc được, chứ không ném, để nó dùng được cả trong nhánh
   * dựng thông điệp lỗi.
   */
  async categoryOptionValues(): Promise<string[]> {
    try {
      return await this.categorySelect.locator('option').evaluateAll((options) =>
        options.map((o) => (o as HTMLOptionElement).value),
      );
    } catch {
      return [];
    }
  }

  /* =========================== GỬI FORM =========================== */

  /**
   * Trạng thái hợp lệ theo trình duyệt, đo bằng MỘT lời gọi evaluate.
   * Đọc `validity.valid` chứ không gọi checkValidity() để phép đo không phát sự kiện `invalid`.
   */
  async readNativeValidity(): Promise<NativeValidityReport> {
    try {
      const data = await this.productForm.evaluate((form) => {
        const controls = Array.from(
          (form as HTMLFormElement).querySelectorAll('input, select, textarea'),
        ) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

        const invalid = controls
          .filter((el) => el.validity !== undefined && !el.validity.valid)
          .map((el) => ({
            placeholder: (el as HTMLInputElement).placeholder ?? '',
            validationMessage: el.validationMessage ?? '',
          }));

        return { formValid: invalid.length === 0, invalidFields: invalid };
      });
      return { ...data, error: null };
    } catch (error) {
      return { formValid: null, invalidFields: [], error: (error as Error).message };
    }
  }

  /**
   * Bấm "Lưu sản phẩm" và thu thập bằng chứng về việc form có thực sự được gửi đi không.
   *
   * `evidenceTimeoutMs` là TRẦN THỜI GIAN CHỜ BẰNG CHỨNG, không phải cơ chế đồng bộ hoá:
   * nếu hết trần mà không thấy request nào, kết luận là "không có request rời trình duyệt",
   * và đó chính là dữ kiện ta cần cho V3. Mọi phép khẳng định về trạng thái dữ liệu vẫn do
   * spec làm bằng expect có auto-retry, không dựa vào con số này.
   */
  async submitForm(options: { evidenceTimeoutMs?: number } = {}): Promise<SubmitReport> {
    const evidenceTimeoutMs = options.evidenceTimeoutMs ?? 2_000;
    const nativeValidityBefore = await this.readNativeValidity();

    const pendingRequest = this.page
      .waitForRequest(
        (request) =>
          /\/api\/products(\/|$|\?)/.test(request.url()) &&
          ['POST', 'PUT'].includes(request.method()),
        { timeout: evidenceTimeoutMs },
      )
      .catch(() => null);

    let frameworkError: string | null = null;
    try {
      await this.saveButton.click();
    } catch (error) {
      frameworkError = (error as Error).message;
    }

    const request = await pendingRequest;
    let responseStatus: number | null = null;
    if (request !== null) {
      const response = await request.response().catch(() => null);
      responseStatus = response === null ? null : response.status();
    }

    return {
      nativeValidityBefore,
      requestSent: request !== null,
      requestMethod: request === null ? null : request.method(),
      requestUrl: request === null ? null : request.url(),
      responseStatus,
      frameworkError,
      evidenceTimeoutMs,
    };
  }

  /* =========================== BẢNG =========================== */

  /** Mọi hàng trong tbody của ĐÚNG bảng quản lý. */
  getAllRows(): Locator {
    return this.productTable.locator('tbody tr');
  }

  /**
   * Hàng của một sản phẩm cụ thể.
   *
   * Lọc theo Ô TÊN khớp CHÍNH XÁC, không phải hasText trên cả hàng: hasText là so khớp chuỗi
   * con, nên tên "...-01" sẽ khớp luôn hàng "...-011" và strict mode ném lỗi ở một chỗ khó hiểu.
   */
  getRowFor(productName: string): Locator {
    return this.getAllRows().filter({
      has: this.page.getByRole('cell', { name: productName, exact: true }),
    });
  }

  /** Nút Sửa/Xóa của ĐÚNG hàng đó — không bao giờ .first() trên toàn trang. */
  editButtonFor(productName: string): Locator {
    return this.getRowFor(productName).getByRole('button', { name: 'Sửa', exact: true });
  }

  deleteButtonFor(productName: string): Locator {
    return this.getRowFor(productName).getByRole('button', { name: 'Xóa', exact: true });
  }

  async clickEditFor(productName: string): Promise<void> {
    await this.editButtonFor(productName).click();
  }

  /** Nút Xóa xoá thẳng, không có hộp thoại xác nhận — nên không có bước xác nhận nào ở đây. */
  async clickDeleteFor(productName: string): Promise<void> {
    await this.deleteButtonFor(productName).click();
  }

  /**
   * Số hàng hiện có. `count()` trả về 0 khi không có gì khớp thay vì ném, nên nó là phép ĐẾM
   * an toàn chứ không phải phép đọc giá trị — không vi phạm quy tắc "chốt tồn tại trước khi đọc".
   */
  async getRowCount(): Promise<number> {
    return this.getAllRows().count();
  }

  /**
   * Form có đang ở chế độ Sửa không.
   *
   * Dựa trên sự TỒN TẠI của nút "Hủy sửa" (chỉ xuất hiện khi đang sửa), đo bằng count().
   * Ưu tiên dùng locator `cancelEditButton` với expect có auto-retry ở spec; hàm boolean này
   * dành cho nhánh dựng thông điệp và cho logic rẽ nhánh trong fixture, nơi không được ném.
   */
  async isFormInEditMode(): Promise<boolean> {
    return (await this.cancelEditButton.count()) > 0;
  }

  /** Chụp toàn bộ bảng bằng ĐÚNG MỘT lời gọi sang trình duyệt. */
  async readTable(): Promise<AdminTableSnapshot> {
    return readAdminTable(this.productTable);
  }

  /**
   * Đọc một hàng theo tên.
   *
   * Trả về null khi KHÔNG có hàng nào, và cũng null khi có NHIỀU HƠN MỘT hàng cùng tên — trong
   * cả hai trường hợp, thứ cần báo cáo là số lượng, và việc đó thuộc về assertion
   * `expect(getRowFor(name)).toHaveCount(1)` ở spec. Hàm này không bao giờ ném, nên nó dùng
   * được cả trong nhánh catch khi đang dựng thông điệp lỗi.
   */
  async readRow(productName: string): Promise<RowReading | null> {
    const matches = await this.readRows(productName);
    return matches.length === 1 ? matches[0] : null;
  }

  /** Mọi hàng trùng tên — cần cho DT9, nơi một lần bấm lặp có thể sinh nhiều hàng giống hệt. */
  async readRows(productName: string): Promise<RowReading[]> {
    try {
      const snapshot = await this.readTable();
      return snapshot.rows
        .filter((row) => row.name === productName)
        .map((row) => ({ name: row.name, priceRaw: row.priceText }));
    } catch {
      return [];
    }
  }
}

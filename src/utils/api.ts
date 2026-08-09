/**
 * Helper gọi thẳng REST API của SUT.
 *
 * Dùng cho SETUP / TEARDOWN, KHÔNG dùng để thay thế thao tác UI đang được kiểm thử.
 * Ví dụ: muốn test "sửa 1 sản phẩm không ảnh hưởng sản phẩm khác" thì phải tạo sẵn
 * 2 sản phẩm — tạo qua API nhanh và ổn định hơn là click qua form, đồng thời giúp
 * test độc lập với thứ tự chạy.
 */
import type { APIRequestContext } from '@playwright/test';
import { ACCOUNTS, URLS } from '../config';

export interface Product {
  id: number;
  name: string;
  price: number | string;
  description: string;
  imageUrl: string;
  category_id: number;
}

export interface Category {
  id: number;
  name: string;
}

/** Đăng nhập qua API, trả về JWT token (dùng để seed trạng thái đăng nhập cho UI). */
export async function loginViaApi(
  request: APIRequestContext,
  role: keyof typeof ACCOUNTS = 'user',
): Promise<{ token: string; user: { id: number; name: string; email: string; role: string } }> {
  const res = await request.post(`${URLS.api}/api/login`, {
    data: { email: ACCOUNTS[role].email, password: ACCOUNTS[role].password },
  });
  if (!res.ok()) {
    throw new Error(`[api] Đăng nhập ${role} thất bại: HTTP ${res.status()} — ${await res.text()}`);
  }
  return res.json();
}

export async function getProducts(request: APIRequestContext): Promise<Product[]> {
  const res = await request.get(`${URLS.api}/api/products`);
  return res.json();
}

export async function getProductById(request: APIRequestContext, id: number): Promise<Product> {
  const res = await request.get(`${URLS.api}/api/products/${id}`);
  return res.json();
}

export async function getCategories(request: APIRequestContext): Promise<Category[]> {
  const res = await request.get(`${URLS.api}/api/categories`);
  return res.json();
}

/** Tạo sản phẩm phục vụ test, trả về id để teardown xóa đi. */
export async function createProduct(
  request: APIRequestContext,
  product: Omit<Product, 'id'>,
): Promise<number> {
  const res = await request.post(`${URLS.api}/api/products`, { data: product });
  const body = await res.json();
  if (!res.ok() || typeof body.id !== 'number') {
    throw new Error(`[api] Tạo sản phẩm thất bại: ${JSON.stringify(body)}`);
  }
  return body.id;
}

/** Xóa sản phẩm; nuốt lỗi vì teardown không được làm test fail. */
export async function deleteProduct(request: APIRequestContext, id: number): Promise<void> {
  try {
    await request.delete(`${URLS.api}/api/products/${id}`);
  } catch {
    /* teardown best-effort */
  }
}

/** Sinh tên sản phẩm duy nhất để test không đụng nhau giữa các lần chạy / các browser. */
export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

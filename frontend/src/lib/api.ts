// Lightweight API client for the croffy-crush backend.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api";

const TOKEN_KEY = "croffy_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message = (data && data.error) || res.statusText || "request failed";
    throw new ApiError(res.status, message);
  }

  return data as T;
}

// ---- Domain types ----
export type User = {
  id: number;
  username: string;
  full_name: string | null;
  role: "admin" | "cashier" | "kitchen";
  is_active: boolean;
};

export type LoginResponse = {
  token: string;
  user: User;
};

export type MenuItem = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  is_active: boolean;
  display_order: number;
};

export type Addon = {
  id: number;
  name: string;
  price: number;
  is_active: boolean;
};

export type Reward = {
  id: number;
  name: string;
  description: string | null;
  points_cost: number;
  image_url: string | null;
  is_active: boolean;
};

export type AvailableReward = Reward & { affordable: boolean };

export type OrderItemAddon = {
  id: number;
  addon_name: string;
  price: number;
};

export type OrderItem = {
  id: number;
  item_name: string;
  unit_price: number;
  quantity: number;
  addons_total: number;
  line_total: number;
  note: string | null;
  addons: OrderItemAddon[];
};

export type Order = {
  id: number;
  order_number: string;
  order_type: "dine_in" | "takeaway";
  status: "pending" | "in_kitchen" | "done" | "cancelled";
  payment_status: "unpaid" | "paid";
  payment_method: "qr" | "cash" | null;
  subtotal: number;
  discount: number;
  total: number;
  customer_id: number | null;
  created_at: string;
};

export type OrderDetail = Order & {
  customer_phone: string | null;
  items: OrderItem[];
};

export type PayResponse = {
  order_id: number;
  order_number: string;
  loyalty_token: string;
  points: number;
  expires_at: string;
};

export const baht = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(n);

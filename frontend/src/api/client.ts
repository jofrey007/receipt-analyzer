const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export interface ReceiptItem {
  id: number;
  name: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  category: string | null;
  suggested_category: string | null;
}

export interface ReceiptSummary {
  id: string;
  receipt_id: string;
  issue_date: string | null;
  merchant_name: string | null;
  total_amount: number | null;
}

export interface ReceiptDetail extends ReceiptSummary {
  items: ReceiptItem[];
}

export interface StatsRow {
  category: string;
  total: number;
}

export interface StatsResponse {
  month: number;
  year: number;
  totals: StatsRow[];
}

export interface FetchReceiptPayload {
  receipt_id?: string;
  qr_code?: string;
  payload?: Record<string, unknown>;
}

export const api = {
  getReceipts(limit = 50) {
    return request<ReceiptSummary[]>(`/receipts?limit=${limit}`);
  },
  getReceipt(receiptId: string) {
    return request<ReceiptDetail>(`/receipts/${receiptId}`);
  },
  fetchReceipt(payload: FetchReceiptPayload) {
    return request<ReceiptDetail>(`/receipts/fetch`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  getStats(year: number, month: number) {
    const params = new URLSearchParams({ year: year.toString(), month: month.toString() });
    return request<StatsResponse>(`/stats?${params.toString()}`);
  },
};

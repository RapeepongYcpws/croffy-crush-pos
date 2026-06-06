"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, RefreshCw } from "lucide-react";
import { apiFetch, type OrderDetail } from "@/lib/api";

export default function KitchenPage() {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<OrderDetail[]>("/orders/kitchen")
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000); // auto refresh ทุก 10 วิ
    return () => clearInterval(t);
  }, [load]);

  const markDone = async (id: number) => {
    try {
      await apiFetch(`/orders/${id}/status`, { method: "PATCH", body: { status: "done" } });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ครัว</h1>
          <p className="text-sm text-gray-500">ออเดอร์ที่ต้องทำ ({orders.length})</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-gray-100">
          <RefreshCw size={16} /> รีเฟรช
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {orders.length === 0 && <p className="text-gray-400">ไม่มีออเดอร์ค้างอยู่ 🎉</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.map((o) => (
          <div key={o.id} className="bg-white rounded-xl shadow-sm p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-gray-800">{o.order_number}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  o.order_type === "dine_in" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                }`}
              >
                {o.order_type === "dine_in" ? "ทานที่ร้าน" : "กลับบ้าน"}
              </span>
            </div>
            <ul className="text-sm space-y-1 flex-1">
              {o.items.map((it) => (
                <li key={it.id}>
                  <span className="font-medium">{it.quantity}x {it.item_name}</span>
                  {it.addons.length > 0 && (
                    <span className="text-gray-500"> ({it.addons.map((a) => a.addon_name).join(", ")})</span>
                  )}
                  {it.note && <span className="block text-xs text-amber-600">หมายเหตุ: {it.note}</span>}
                </li>
              ))}
            </ul>
            <button
              onClick={() => markDone(o.id)}
              className="mt-3 flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700"
            >
              <Check size={18} /> เสร็จแล้ว
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

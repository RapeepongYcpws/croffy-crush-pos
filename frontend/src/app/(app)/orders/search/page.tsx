"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { apiFetch, baht, type Order } from "@/lib/api";

const today = () => new Date().toISOString().slice(0, 10);

const statusLabel: Record<string, string> = {
  pending: "รอทำ",
  in_kitchen: "กำลังทำ",
  done: "เสร็จ",
  cancelled: "ยกเลิก",
};

export default function SearchOrdersPage() {
  const [date, setDate] = useState(today());
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<Order[]>(`/orders/search?date=${d}`);
      setOrders(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    search(today());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">ค้นหาออเดอร์</h1>
        <p className="text-sm text-gray-500">เลือกวันที่เพื่อดูออเดอร์</p>
      </div>

      <div className="flex gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input max-w-xs" />
        <button
          onClick={() => search(date)}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700"
        >
          <Search size={18} /> ค้นหา
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b">
              <th className="px-4 py-3">เลขออเดอร์</th>
              <th className="px-4 py-3">เวลา</th>
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">ชำระเงิน</th>
              <th className="px-4 py-3 text-right">ยอดรวม</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{o.order_number}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(o.created_at).toLocaleTimeString("th-TH")}</td>
                <td className="px-4 py-3">{o.order_type === "dine_in" ? "ทานที่ร้าน" : "กลับบ้าน"}</td>
                <td className="px-4 py-3">{statusLabel[o.status]}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      o.payment_status === "paid" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {o.payment_status === "paid" ? "จ่ายแล้ว" : "ยังไม่จ่าย"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">{baht(o.total)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/orders/${o.id}`} className="text-brand-700 hover:underline">
                    ดูรายละเอียด
                  </Link>
                </td>
              </tr>
            ))}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  ไม่พบออเดอร์ในวันที่เลือก
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

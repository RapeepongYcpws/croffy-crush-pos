"use client";

import { useEffect, useState } from "react";
import { apiFetch, baht } from "@/lib/api";

type Bucket = { label: string; orders: number; sales: number };
type MenuRow = { item_name: string; qty: number; total: number };
type ReportResp = { period: string; buckets: Bucket[]; menus: MenuRow[]; total: number };

const PERIODS = [
  { key: "daily", label: "รายวัน" },
  { key: "weekly", label: "รายสัปดาห์" },
  { key: "monthly", label: "รายเดือน" },
] as const;

export default function ReportsPage() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [data, setData] = useState<ReportResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ReportResp>(`/reports?period=${period}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [period]);

  const maxSales = data ? Math.max(1, ...data.buckets.map((b) => b.sales)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">รายงาน</h1>
          <p className="text-sm text-gray-500">ยอดขายและเมนูที่ขายได้</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium ${
                period === p.key ? "bg-white shadow text-brand-700" : "text-gray-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {/* Trend */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-4">แนวโน้มยอดขาย</h2>
        <div className="space-y-2">
          {data?.buckets.map((b) => (
            <div key={b.label} className="flex items-center gap-3 text-sm">
              <span className="w-24 text-gray-500 shrink-0">{b.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className="bg-brand-500 h-full rounded-full"
                  style={{ width: `${(b.sales / maxSales) * 100}%` }}
                />
              </div>
              <span className="w-28 text-right font-medium">{baht(b.sales)}</span>
              <span className="w-16 text-right text-gray-400">{b.orders} ออเดอร์</span>
            </div>
          ))}
          {data && data.buckets.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีข้อมูล</p>}
        </div>
      </div>

      {/* Menu breakdown */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-800">เมนูที่ขายได้ (ช่วงปัจจุบัน)</h2>
          <span className="font-bold text-brand-700">รวม {data ? baht(data.total) : "—"}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b">
              <th className="py-2">เมนู</th>
              <th className="py-2 text-right">จำนวน</th>
              <th className="py-2 text-right">ยอดขาย</th>
            </tr>
          </thead>
          <tbody>
            {data?.menus.map((m) => (
              <tr key={m.item_name} className="border-b last:border-0">
                <td className="py-2">{m.item_name}</td>
                <td className="py-2 text-right">{m.qty}</td>
                <td className="py-2 text-right font-medium">{baht(m.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.menus.length === 0 && <p className="text-sm text-gray-400 mt-2">ยังไม่มียอดขาย</p>}
      </div>
    </div>
  );
}

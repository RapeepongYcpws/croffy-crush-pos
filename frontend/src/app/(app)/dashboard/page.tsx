"use client";

import { useEffect, useState } from "react";
import { Banknote, ReceiptText, ChefHat, TrendingUp } from "lucide-react";
import { apiFetch } from "@/lib/api";

type KitchenOrder = {
  id: number;
  order_number: string;
  order_type: "dine_in" | "takeaway";
  status: "pending" | "in_kitchen";
};

type TopMenu = { item_name: string; qty: number };

type Summary = {
  sales: number;
  order_count: number;
  kitchen_count: number;
  kitchen_orders: KitchenOrder[];
  top_menus: TopMenu[];
};

const baht = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(n);

export default function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Summary>("/dashboard/summary")
      .then(setData)
      .catch((e) => setError(e.message ?? "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">แดชบอร์ด</h1>
        <p className="text-sm text-gray-500">ภาพรวมของวันนี้</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Banknote className="text-green-600" />}
          label="ยอดขายวันนี้"
          value={data ? baht(data.sales) : "—"}
        />
        <MetricCard
          icon={<ReceiptText className="text-brand-600" />}
          label="จำนวนออเดอร์"
          value={data ? String(data.order_count) : "—"}
        />
        <MetricCard
          icon={<ChefHat className="text-amber-600" />}
          label="ค้างในครัว"
          value={data ? String(data.kitchen_count) : "—"}
        />
        <MetricCard
          icon={<TrendingUp className="text-blue-600" />}
          label="เมนูขายดี (อันดับ 1)"
          value={data && data.top_menus.length > 0 ? data.top_menus[0].item_name : "—"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Kitchen queue */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3">รายการที่ค้างในครัว</h2>
          {data && data.kitchen_orders.length === 0 && (
            <p className="text-sm text-gray-400">ไม่มีออเดอร์ค้างอยู่</p>
          )}
          <ul className="divide-y">
            {data?.kitchen_orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{o.order_number}</span>
                <span className="text-gray-500">
                  {o.order_type === "dine_in" ? "ทานที่ร้าน" : "กลับบ้าน"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">
                  {o.status === "pending" ? "รอทำ" : "กำลังทำ"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Best sellers */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3">เมนูขายดีวันนี้</h2>
          {data && data.top_menus.length === 0 && (
            <p className="text-sm text-gray-400">ยังไม่มียอดขาย</p>
          )}
          <ul className="space-y-2">
            {data?.top_menus.map((m, i) => (
              <li key={m.item_name} className="flex items-center justify-between text-sm">
                <span>
                  <span className="text-gray-400 mr-2">{i + 1}.</span>
                  {m.item_name}
                </span>
                <span className="font-semibold text-brand-700">{m.qty} ชิ้น</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
      <div className="h-11 w-11 rounded-lg bg-gray-50 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

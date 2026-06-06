"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";
import { apiFetch, baht, type OrderDetail } from "@/lib/api";

const PHONE_RE = /^0[0-9]{9}$/;

const statusLabel: Record<string, string> = {
  pending: "รอทำ",
  in_kitchen: "กำลังทำ",
  done: "เสร็จ",
  cancelled: "ยกเลิก",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // admin add phone
  const [phone, setPhone] = useState("");
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch<OrderDetail>(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  };
  useEffect(load, [id]);

  const addPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!PHONE_RE.test(phone)) {
      setPhoneMsg("เบอร์โทรไม่ถูกต้อง (10 หลัก ขึ้นต้นด้วย 0)");
      return;
    }
    setSaving(true);
    setPhoneMsg(null);
    try {
      const res = await apiFetch<{ total_points: number }>(`/orders/${id}/loyalty/claim`, {
        method: "POST",
        body: { phone },
      });
      setPhoneMsg(`สำเร็จ! ลูกค้ามีคะแนนรวม ${res.total_points}`);
      load();
    } catch (err: any) {
      setPhoneMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (error) return <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>;
  if (!order) return <p className="text-gray-400">กำลังโหลด...</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> กลับ
      </button>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{order.order_number}</h1>
            <p className="text-sm text-gray-500">
              {new Date(order.created_at).toLocaleString("th-TH")} ·{" "}
              {order.order_type === "dine_in" ? "ทานที่ร้าน" : "กลับบ้าน"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">{statusLabel[order.status]}</p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                order.payment_status === "paid" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {order.payment_status === "paid"
                ? `จ่ายแล้ว (${order.payment_method === "qr" ? "QR" : "เงินสด"})`
                : "ยังไม่จ่าย"}
            </span>
          </div>
        </div>

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-gray-400 border-b">
              <th className="py-2">รายการ</th>
              <th className="py-2 text-center">จำนวน</th>
              <th className="py-2 text-right">ราคา</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id} className="border-b last:border-0 align-top">
                <td className="py-2">
                  {it.item_name}
                  {it.addons.length > 0 && (
                    <span className="block text-xs text-gray-500">
                      + {it.addons.map((a) => a.addon_name).join(", ")}
                    </span>
                  )}
                  {it.note && <span className="block text-xs text-amber-600">หมายเหตุ: {it.note}</span>}
                </td>
                <td className="py-2 text-center">{it.quantity}</td>
                <td className="py-2 text-right">{baht(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>ยอดรวมย่อย</span>
            <span>{baht(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>ส่วนลด</span>
            <span>-{baht(order.discount)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg text-gray-800">
            <span>ยอดสุทธิ</span>
            <span className="text-brand-700">{baht(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Loyalty section */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Phone size={18} /> สะสมคะแนน
        </h2>
        {order.customer_phone ? (
          <p className="text-sm text-gray-600">
            ลูกค้า: <b>{order.customer_phone}</b> (สะสมคะแนนแล้ว)
          </p>
        ) : (
          <form onSubmit={addPhone} className="space-y-2">
            <p className="text-sm text-gray-500">
              ลูกค้ายังไม่ได้สะสมคะแนน — ใส่เบอร์โทรเพื่อสะสมให้ (ใช้ได้ภายใน 5 นาทีหลังออก QR)
            </p>
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="08xxxxxxxx"
                className="input max-w-xs"
              />
              <button
                type="submit"
                disabled={saving}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-60"
              >
                บันทึก
              </button>
            </div>
            {phoneMsg && <p className="text-sm text-gray-600">{phoneMsg}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

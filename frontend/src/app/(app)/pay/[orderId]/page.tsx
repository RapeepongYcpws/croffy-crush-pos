"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Banknote, CheckCircle2 } from "lucide-react";
import { apiFetch, baht, type OrderDetail, type PayResponse } from "@/lib/api";

export default function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [method, setMethod] = useState<"qr" | "cash">("qr");
  const [provider, setProvider] = useState<"thaiqr" | "promptpay">("thaiqr");
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState<PayResponse | null>(null);

  useEffect(() => {
    apiFetch<OrderDetail>(`/orders/${orderId}`).then(setOrder).catch((e) => setError(e.message));
  }, [orderId]);

  // โหลด QR payload ใหม่ทุกครั้งที่เปลี่ยนวิธีจ่าย/ผู้ให้บริการ QR
  useEffect(() => {
    if (method === "qr" && !paid) {
      setQrPayload(null);
      apiFetch<{ payload: string }>(`/orders/${orderId}/qr?provider=${provider}`)
        .then((d) => setQrPayload(d.payload))
        .catch(() => {});
    }
  }, [method, provider, orderId, paid]);

  const confirmPaid = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await apiFetch<PayResponse>(`/orders/${orderId}/pay`, {
        method: "POST",
        body: method === "qr" ? { method, provider } : { method },
      });
      setPaid(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPaying(false);
    }
  };

  if (paid) {
    const loyaltyUrl =
      typeof window !== "undefined" ? `${window.location.origin}/loyalty/${paid.loyalty_token}` : "";
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm p-6 text-center space-y-4">
        <CheckCircle2 className="mx-auto text-green-600" size={48} />
        <h1 className="text-xl font-bold text-gray-800">ชำระเงินสำเร็จ</h1>
        <p className="text-sm text-gray-500">
          ออเดอร์ {paid.order_number} · ลูกค้าจะได้รับ <b>{paid.points}</b> คะแนน
        </p>
        <div className="border-t pt-4">
          <p className="text-sm text-gray-600 mb-3">ให้ลูกค้าสแกน QR นี้เพื่อสะสมคะแนน (หมดอายุใน 5 นาที)</p>
          <div className="flex justify-center">
            <QRCodeSVG value={loyaltyUrl} size={200} includeMargin />
          </div>
          <p className="text-xs text-gray-400 mt-2 break-all">{loyaltyUrl}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/order")}
            className="flex-1 bg-brand-600 text-white py-2.5 rounded-lg font-semibold hover:bg-brand-700"
          >
            ออเดอร์ถัดไป
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-semibold"
          >
            แดชบอร์ด
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">ชำระเงิน</h1>
      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-500">{order?.order_number}</span>
          <span className="text-2xl font-bold text-brand-700">{order ? baht(order.total) : "—"}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            onClick={() => setMethod("qr")}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg font-medium ${
              method === "qr" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            <QrCode size={18} /> QR PromptPay
          </button>
          <button
            onClick={() => setMethod("cash")}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg font-medium ${
              method === "cash" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            <Banknote size={18} /> เงินสด
          </button>
        </div>

        {method === "qr" && (
          <div className="flex flex-col items-center mb-5">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 w-full">
              <button
                onClick={() => setProvider("thaiqr")}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium ${
                  provider === "thaiqr" ? "bg-white shadow text-brand-700" : "text-gray-500"
                }`}
              >
                Thai QR (ถุงเงิน)
              </button>
              <button
                onClick={() => setProvider("promptpay")}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium ${
                  provider === "promptpay" ? "bg-white shadow text-brand-700" : "text-gray-500"
                }`}
              >
                PromptPay
              </button>
            </div>
            {qrPayload ? (
              <QRCodeSVG value={qrPayload} size={220} includeMargin />
            ) : (
              <p className="text-sm text-gray-400">กำลังสร้าง QR...</p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              {provider === "thaiqr"
                ? "สแกนด้วยแอปถุงเงิน / โมบายแบงก์กิ้งเพื่อชำระเงิน"
                : "สแกนด้วยแอปธนาคาร (PromptPay) เพื่อชำระเงิน"}
            </p>
          </div>
        )}

        <button
          onClick={confirmPaid}
          disabled={paying}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-60"
        >
          {paying ? "กำลังบันทึก..." : "ลูกค้าชำระเงินแล้ว"}
        </button>
      </div>
    </div>
  );
}

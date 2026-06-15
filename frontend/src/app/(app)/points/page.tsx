"use client";

import { useState } from "react";
import { Gift, Search, Sparkles, ArrowLeft } from "lucide-react";
import { apiFetch, type AvailableReward } from "@/lib/api";
import Modal from "@/components/Modal";

type PointsResult = {
  customer_id: number;
  phone: string;
  total_points: number;
};

const PHONE_RE = /^0[0-9]{9}$/;

// Card ต้องอยู่นอก component หลัก ไม่งั้นจะถูกสร้างใหม่ทุก render
// ทำให้ input ถูก remount และ focus หลุดทุกครั้งที่พิมพ์
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-sm p-6">{children}</div>
  );
}

export default function PointsPage() {
  const [phone, setPhone] = useState("");
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PointsResult | null>(null);

  // rewards modal
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [rewards, setRewards] = useState<AvailableReward[]>([]);
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);
  const [confirmReward, setConfirmReward] = useState<AvailableReward | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!PHONE_RE.test(phone)) {
      setPhoneErr("กรุณากรอกเบอร์โทร 10 หลัก ขึ้นต้นด้วย 0");
      return;
    }
    setPhoneErr(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<PointsResult>(`/loyalty/points?phone=${phone}`);
      setResult(res);
    } catch (err: any) {
      setPhoneErr(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setPhone("");
    setPhoneErr(null);
    setRedeemMsg(null);
  };

  const openRewards = async () => {
    if (!result) return;
    setRedeemMsg(null);
    try {
      const list = await apiFetch<AvailableReward[]>(
        `/rewards/available?points=${result.total_points}`
      );
      setRewards(list);
      setRewardsOpen(true);
    } catch {
      /* ignore */
    }
  };

  const redeem = async () => {
    if (!result || !confirmReward) return;
    setRedeeming(true);
    try {
      const res = await apiFetch<{ total_points: number; redeemed: string }>("/rewards/redeem", {
        method: "POST",
        body: { customer_id: result.customer_id, reward_id: confirmReward.id },
      });
      setResult({ ...result, total_points: res.total_points });
      setRedeemMsg(`แลก "${res.redeemed}" สำเร็จ!`);
      const list = await apiFetch<AvailableReward[]>(
        `/rewards/available?points=${res.total_points}`
      );
      setRewards(list);
    } catch (e: any) {
      setRedeemMsg(e.message);
    } finally {
      setRedeeming(false);
      setConfirmReward(null);
    }
  };

  // Points + rewards state
  if (result) {
    return (
      <Card>
        <div className="text-center space-y-3">
          <Sparkles className="mx-auto text-brand-500" size={44} />
          <h1 className="text-xl font-bold text-gray-800">คะแนนสะสมของลูกค้า</h1>
          <p className="text-sm text-gray-500">{result.phone}</p>
          <div className="bg-brand-50 rounded-xl py-3">
            <p className="text-sm text-gray-500">คะแนนสะสมทั้งหมด</p>
            <p className="text-3xl font-bold text-brand-700">{result.total_points}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={openRewards}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-600 text-white py-2.5 rounded-lg font-semibold hover:bg-brand-700"
            >
              <Gift size={18} /> แลกของรางวัล
            </button>
            <button
              onClick={reset}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-semibold"
            >
              <ArrowLeft size={18} /> เช็คเบอร์อื่น
            </button>
          </div>
        </div>

        <Modal open={rewardsOpen} title="แลกของรางวัล" onClose={() => setRewardsOpen(false)}>
          {redeemMsg && (
            <div className="mb-3 rounded-lg bg-green-50 text-green-700 px-3 py-2 text-sm">{redeemMsg}</div>
          )}
          <p className="text-sm text-gray-500 mb-3">คะแนนของลูกค้า: {result.total_points}</p>
          <div className="space-y-2">
            {rewards.map((rw) => (
              <div key={rw.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">{rw.name}</p>
                  <p className="text-xs text-gray-500">{rw.points_cost} คะแนน</p>
                </div>
                <button
                  disabled={!rw.affordable}
                  onClick={() => setConfirmReward(rw)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-brand-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {rw.affordable ? "แลก" : "คะแนนไม่พอ"}
                </button>
              </div>
            ))}
            {rewards.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีของรางวัล</p>}
          </div>
        </Modal>

        <Modal
          open={confirmReward !== null}
          title="ยืนยันการแลกของรางวัล"
          onClose={() => !redeeming && setConfirmReward(null)}
        >
          {confirmReward && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                ต้องการแลก <b>{confirmReward.name}</b> ใช้ <b>{confirmReward.points_cost}</b> คะแนนใช่หรือไม่?
              </p>
              <p className="text-xs text-gray-400">
                คะแนนคงเหลือหลังแลก: {result.total_points - confirmReward.points_cost}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmReward(null)}
                  disabled={redeeming}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-semibold disabled:opacity-60"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={redeem}
                  disabled={redeeming}
                  className="flex-1 bg-brand-600 text-white py-2.5 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-60"
                >
                  {redeeming ? "กำลังแลก..." : "ยืนยันแลก"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </Card>
    );
  }

  // Phone input state
  return (
    <Card>
      <div className="flex flex-col items-center mb-4">
        <div className="h-12 w-12 rounded-2xl bg-brand-500 flex items-center justify-center text-white mb-2">
          <Search size={24} />
        </div>
        <h1 className="text-lg font-bold text-brand-700">เช็คคะแนนสะสม</h1>
        <p className="text-sm text-gray-500">กรอกเบอร์โทรเพื่อดูคะแนนและแลกของรางวัล</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
          <input
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="08xxxxxxxx"
            className="input"
          />
          {phoneErr && <p className="text-sm text-red-600 mt-1">{phoneErr}</p>}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-2.5 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-60"
        >
          <Search size={18} />
          {submitting ? "กำลังค้นหา..." : "เช็คคะแนน"}
        </button>
      </form>
    </Card>
  );
}

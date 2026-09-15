"use client";

import { useState, useTransition } from "react";
import { runSync } from "@/lib/sync-action";
import { NGUON_DONG_BO } from "@/lib/nhan";

export function SyncButton() {
  const [pending, start] = useTransition();
  // Nguồn nào đang chạy — để chỉ nút đó đổi nhãn, nút kia chỉ mờ đi.
  const [dangChay, setDangChay] = useState<string | null>(null);
  const [ketQua, setKetQua] = useState<{ ok: boolean; message: string } | null>(null);

  const bam = (nguon: string) =>
    start(async () => {
      setDangChay(nguon);
      setKetQua(null);
      setKetQua(await runSync(nguon));
      setDangChay(null);
    });

  return (
    <div>
      <p className="actions">
        {Object.entries(NGUON_DONG_BO).map(([k, ten]) => (
          <button
            key={k}
            type="button"
            className="primary"
            disabled={pending}
            onClick={() => bam(k)}
          >
            {dangChay === k ? `Đang kéo ${ten}...` : `Đồng bộ ${ten}`}
          </button>
        ))}
      </p>

      {ketQua && (
        <pre className={ketQua.ok ? "ket-qua" : "ket-qua loi"}>{ketQua.message}</pre>
      )}
    </div>
  );
}

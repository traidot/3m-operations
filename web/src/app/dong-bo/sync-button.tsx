"use client";

import { useState, useTransition } from "react";
import { runSync } from "@/lib/sync-action";

export function SyncButton() {
  const [pending, start] = useTransition();
  const [ketQua, setKetQua] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div>
      <button
        type="button"
        className="primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setKetQua(null);
            setKetQua(await runSync());
          })
        }
      >
        {pending ? "Đang kéo dữ liệu..." : "Đồng bộ ngay"}
      </button>

      {ketQua && (
        <pre className={ketQua.ok ? "ket-qua" : "ket-qua loi"}>{ketQua.message}</pre>
      )}
    </div>
  );
}

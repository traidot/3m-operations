/**
 * Ghép từng giao dịch sao kê với từng khoản thu bên phần mềm.
 *
 * Đơn vị bên phần mềm KHÔNG phải một đợt mà là một "lần thu": các đợt cùng hợp
 * đồng, cùng ngày thu, tức một lần khách nộp. Khách hay đóng gộp mấy kỳ một
 * lần — 473 lần thu gộp, 1.152 đợt, hơn hai triệu — nên nếu chỉ so từng đợt
 * với từng giao dịch thì cả nhóm đó không bao giờ khớp.
 *
 * Một giao dịch ghép đúng một khoản, và một đợt chỉ nằm trong một cặp. Lần
 * trước thiếu ràng buộc này nên một khoản 1.100 bị gán cho cả ba kỳ 10, 11, 12
 * của cùng hợp đồng — nhìn thì khớp mà cộng lại sai gấp ba.
 *
 * Ghép theo bậc, bậc chặt chạy trước và giữ chỗ:
 *   1. mã hợp đồng + số tiền + cùng tài khoản + ngày lệch ≤ 5
 *   2. mã hợp đồng + số tiền + ngày lệch ≤ 15 (khác tài khoản vẫn nhận, vì kế
 *      toán có thể ghi nhầm tài khoản)
 *   3. mã hợp đồng + số tiền, bất kể ngày
 *   4. số tiền + cùng tài khoản + ngày lệch ≤ 5 (dành cho giao dịch không có
 *      mã hợp đồng trên sao kê)
 *
 * Trong mỗi bậc, cặp nào lệch ngày ít hơn thì ghép trước; hoà nhau thì khoản
 * gom được nhiều đợt hơn thắng, để không băm một lần nộp thành nhiều mảnh.
 */

export type GiaoDich = {
  id: number;
  tai_khoan: string;
  ngay: string | null;
  tien_vao: number;
  ma_hd: string | null;
};

export type Dot = {
  source_id: string;
  tai_khoan: string;
  ngay_thu: string | null;
  so_tien: number;
  ma_hd: string | null;
};

/** Một lần khách nộp: một đợt lẻ, hoặc nhiều đợt cùng hợp đồng cùng ngày thu. */
export type Khoan = {
  id: string;
  tai_khoan: string;
  ngay_thu: string | null;
  so_tien: number;
  ma_hd: string | null;
  dot: Dot[];
};

export type Cap = {
  gd: GiaoDich;
  khoan: Khoan;
  bac: number;
  lech_ngay: number;
};

export type KetQua = {
  cap: Cap[];
  gd_le: GiaoDich[];
  dot_le: Dot[];
};

const NGAY = 86_400_000;

/** Số ngày lệch; thiếu ngày một bên thì coi như vô cùng để bậc có hạn loại ra. */
function lech(a: string | null, b: string | null): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.abs(Date.parse(a) - Date.parse(b)) / NGAY;
}

/**
 * Dựng tập khoản ứng viên: mỗi đợt một khoản lẻ, và mỗi lần thu nhiều đợt thêm
 * một khoản gộp. Hai loại cùng dự thi — khách nộp gộp thì khoản gộp khớp, khách
 * nộp lẻ từng kỳ thì khoản lẻ khớp.
 */
export function dungKhoan(dots: readonly Dot[]): Khoan[] {
  const le: Khoan[] = dots.map((d) => ({
    id: `dot:${d.source_id}`, tai_khoan: d.tai_khoan, ngay_thu: d.ngay_thu,
    so_tien: d.so_tien, ma_hd: d.ma_hd, dot: [d],
  }));

  const lan = new Map<string, Dot[]>();
  for (const d of dots) {
    if (!d.ma_hd || !d.ngay_thu) continue;
    const k = `${d.ma_hd}|${d.ngay_thu}`;
    const cu = lan.get(k);
    if (cu) cu.push(d);
    else lan.set(k, [d]);
  }

  const gop: Khoan[] = [];
  for (const [k, ds] of lan) {
    if (ds.length < 2) continue;
    gop.push({
      id: `lan:${k}`, tai_khoan: ds[0]!.tai_khoan, ngay_thu: ds[0]!.ngay_thu,
      so_tien: ds.reduce((t, d) => t + d.so_tien, 0), ma_hd: ds[0]!.ma_hd, dot: ds,
    });
  }
  return [...gop, ...le];
}

type Bac = {
  so: number;
  /** Khoá gom nhóm; chỉ so các cặp cùng khoá cho khỏi quét chéo cả bảng. */
  khoa: (g: { ma_hd: string | null; tai_khoan: string; tien: number }) => string | null;
  toi_da: number;
};

const BAC: Bac[] = [
  { so: 1, khoa: (g) => (g.ma_hd ? `${g.ma_hd}|${g.tai_khoan}|${g.tien}` : null), toi_da: 5 },
  { so: 2, khoa: (g) => (g.ma_hd ? `${g.ma_hd}|${g.tien}` : null), toi_da: 15 },
  { so: 3, khoa: (g) => (g.ma_hd ? `${g.ma_hd}|${g.tien}` : null), toi_da: Number.POSITIVE_INFINITY },
  { so: 4, khoa: (g) => `${g.tai_khoan}|${g.tien}`, toi_da: 5 },
];

export function ghep(gds: readonly GiaoDich[], dots: readonly Dot[]): KetQua {
  const khoans = dungKhoan(dots);
  const daDungGd = new Set<number>();
  const daDungDot = new Set<string>();
  const cap: Cap[] = [];

  const conTrong = (k: Khoan) => k.dot.every((d) => !daDungDot.has(d.source_id));

  for (const bac of BAC) {
    const theoKhoa = new Map<string, Khoan[]>();
    for (const k of khoans) {
      if (!conTrong(k)) continue;
      const kh = bac.khoa({ ma_hd: k.ma_hd, tai_khoan: k.tai_khoan, tien: k.so_tien });
      if (kh === null) continue;
      const cu = theoKhoa.get(kh);
      if (cu) cu.push(k);
      else theoKhoa.set(kh, [k]);
    }

    // Dựng mọi cặp ứng viên rồi xếp theo lệch ngày tăng dần — cặp sát ngày
    // nhất được chọn trước, không phụ thuộc thứ tự dòng trong file.
    const ungVien: Cap[] = [];
    for (const g of gds) {
      if (daDungGd.has(g.id)) continue;
      const kh = bac.khoa({ ma_hd: g.ma_hd, tai_khoan: g.tai_khoan, tien: g.tien_vao });
      if (kh === null) continue;
      for (const k of theoKhoa.get(kh) ?? []) {
        const l = lech(g.ngay, k.ngay_thu);
        if (l <= bac.toi_da) ungVien.push({ gd: g, khoan: k, bac: bac.so, lech_ngay: l });
      }
    }
    ungVien.sort(
      (a, b) =>
        a.lech_ngay - b.lech_ngay ||
        b.khoan.dot.length - a.khoan.dot.length ||
        a.gd.id - b.gd.id,
    );

    for (const c of ungVien) {
      if (daDungGd.has(c.gd.id) || !conTrong(c.khoan)) continue;
      daDungGd.add(c.gd.id);
      for (const d of c.khoan.dot) daDungDot.add(d.source_id);
      cap.push(c);
    }
  }

  return {
    cap,
    gd_le: gds.filter((g) => !daDungGd.has(g.id)),
    dot_le: dots.filter((d) => !daDungDot.has(d.source_id)),
  };
}

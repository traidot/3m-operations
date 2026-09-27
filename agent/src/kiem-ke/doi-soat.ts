import ExcelJS from "exceljs";
import { pool, q } from "../db.js";
import { MAU, NEN_NHOM, TIEN, datFont, dauTrang, gio } from "../excel.js";
import { banKeTiep } from "../ten-file.js";

/**
 * Đối soát biên bản kiểm kê với kho telecom.
 *
 *   npm run kiem-ke:doi-soat
 *
 * Một mã có thể nằm ở ba chỗ bên phần mềm, tra theo thứ tự:
 *   v_telecom_may            — đã từng gán thuê bao, biết đang ở khách nào
 *   device_snapshot          — có trong sổ thiết bị nhưng chưa gán ai
 *   provider_device_snapshot — mới chỉ nằm ở kho nhà cung cấp
 * Chỉ tra v_telecom_may rồi kết luận "phần mềm không có" là oan: hơn một nghìn
 * mã nằm ở hai bảng sau.
 *
 * Mã sim và IMEI đi hai đường khác nhau bên nguồn, nên tách riêng khi đếm chứ
 * không gộp thành một con số "không khớp".
 */

const O_DAU = `
  case
    when exists (select 1 from v_telecom_may t where t.imei = m.ma) then 'v_telecom_may'
    when exists (select 1 from device_snapshot d where d.source='TELECOM' and d.imei = m.ma) then 'device_snapshot'
    when exists (select 1 from provider_device_snapshot p where p.device_code = m.ma) then 'kho_ncc'
    else 'khong_co'
  end`;

const KIEM_KE = `kiem_ke_may m join kiem_ke_import i on i.id = m.import_id and i.dang_dung`;

const NHAN_KHOI: Record<string, string> = {
  dang_dung: "Đang ở ngoài (khách, đại lý, chờ lắp, chờ kích hoạt, cần thu hồi)",
  kho: "Trong kho (VN, Takanoba, Ibaraki)",
  khac: "Khác (sim trả nhà mạng, đã huỷ, đối tác, xuất đại lý, hỏng)",
};

type Lech = {
  ma_nhom: string; ten: string; mau: string; loc: string; viec: string;
};

/** Các kiểu lệch, mỗi kiểu là một mệnh đề where trên kiem_ke_may. */
const LECH: Lech[] = [
  {
    ma_nhom: "kho-ma-dang-thue", mau: MAU.do,
    ten: "Kiểm kê thấy trong KHO, phần mềm ghi ĐANG CHO THUÊ",
    viec: "Máy nằm trong kho mà sổ vẫn tính là ở khách — đóng lượt thuê trên CMS",
    loc: `m.khoi = 'kho' and exists (select 1 from v_telecom_may t where t.imei = m.ma and t.trang_thai = 'RENTING')`,
  },
  {
    ma_nhom: "da-huy-ma-dang-thue", mau: MAU.vang,
    ten: "Kiểm kê xếp ĐÃ HUỶ / TRẢ NHÀ MẠNG, phần mềm ghi ĐANG CHO THUÊ",
    viec: "Sim đã huỷ mà sổ chưa đóng — kiểm lại trước khi còn tính cước",
    loc: `m.khoi = 'khac' and exists (select 1 from v_telecom_may t where t.imei = m.ma and t.trang_thai = 'RENTING')`,
  },
  {
    ma_nhom: "dang-dung-ma-da-tra", mau: MAU.vang,
    ten: "Kiểm kê thấy ĐANG Ở NGOÀI, phần mềm ghi ĐÃ TRẢ",
    viec: "Máy còn ở khách mà sổ đã đóng — mở lại lượt thuê hoặc sửa kiểm kê",
    loc: `m.khoi = 'dang_dung' and exists (select 1 from v_telecom_may t where t.imei = m.ma and t.trang_thai = 'RETURNED')`,
  },
  {
    ma_nhom: "dang-dung-khong-dau-vet", mau: MAU.do,
    ten: "Kiểm kê thấy ĐANG Ở NGOÀI, phần mềm KHÔNG CÓ dấu vết nào",
    viec: "Máy ở khách mà sổ không có — nhập vào CMS, không thì mất hẳn",
    loc: `m.khoi = 'dang_dung' and ${O_DAU} = 'khong_co'`,
  },
  {
    ma_nhom: "kho-khong-dau-vet", mau: MAU.tim,
    ten: "Kiểm kê thấy TRONG KHO, phần mềm KHÔNG CÓ dấu vết nào",
    viec: "Hàng có thật trong kho mà chưa nhập sổ",
    loc: `m.khoi = 'kho' and ${O_DAU} = 'khong_co'`,
  },
];

const n = (v: unknown) => Number(v ?? 0);

async function main() {
  const [lan] = await q<{ ten_file: string; chot_ngay: string; so_dong: string; nhap_luc: string }>(
    `select ten_file, chot_ngay::text, so_dong::text, nhap_luc::text
       from kiem_ke_import where dang_dung`);
  if (!lan) throw new Error("Chưa nhập biên bản kiểm kê nào — chạy kiem-ke:nhap trước");
  const [dongBo] = await q<{ luc: string }>(
    `select max(finished_at)::text as luc from sync_run where source = 'TELECOM' and status = 'OK'`);

  const wb = new ExcelJS.Workbook();
  const moc =
    `Nguồn 1 — KIỂM KÊ: ${lan.ten_file}, chốt ${lan.chot_ngay}, ${lan.so_dong} mã, nhập lúc ${gio(lan.nhap_luc)}. ` +
    `Nguồn 2 — PHẦN MỀM wifi cầm tay, đồng bộ lúc ${gio(dongBo?.luc ?? null)}. ` +
    `File xuất lúc ${new Date().toLocaleString("vi-VN")}.`;

  // ── Trang 1: bảng chéo ────────────────────────────────────────────────────
  const cheo = await q<{ khoi: string; loai: string; o_dau: string; so: string }>(`
    select m.khoi,
           case when m.ma ~ '^[0-9]{15}$' then 'IMEI' else 'mã sim' end as loai,
           ${O_DAU} as o_dau, count(*)::text as so
      from ${KIEM_KE} group by 1, 2, 3`);

  const ws1 = wb.addWorksheet("Đối soát");
  const COT_O_DAU = ["v_telecom_may", "device_snapshot", "kho_ncc", "khong_co"];
  const NHAN_O_DAU: Record<string, string> = {
    v_telecom_may: "có, đã gán thuê bao",
    device_snapshot: "có ở sổ thiết bị",
    kho_ncc: "có ở kho nhà cung cấp",
    khong_co: "KHÔNG CÓ",
  };
  ws1.columns = [
    { header: "Kiểm kê xếp vào", key: "khoi", width: 58 },
    { header: "Loại mã", key: "loai", width: 10 },
    ...COT_O_DAU.map((c) => ({ header: NHAN_O_DAU[c]!, key: c, width: 20 })),
    { header: "Tổng", key: "tong", width: 10 },
  ];
  const o = new Map(cheo.map((r) => [`${r.khoi}|${r.loai}|${r.o_dau}`, n(r.so)]));
  for (const khoi of ["dang_dung", "kho", "khac"])
    for (const loai of ["IMEI", "mã sim"]) {
      const d = Object.fromEntries(COT_O_DAU.map((c) => [c, o.get(`${khoi}|${loai}|${c}`) ?? 0]));
      const tong = COT_O_DAU.reduce((s, c) => s + n(d[c]), 0);
      if (tong === 0) continue;
      const h = ws1.addRow({ khoi: NHAN_KHOI[khoi] ?? khoi, loai, ...d, tong });
      if (n(d.khong_co) > 0)
        h.getCell("khong_co").fill = { type: "pattern", pattern: "solid", fgColor: { argb: MAU.do } };
    }
  dauTrang(ws1, "Kiểm kê đặt cạnh phần mềm — mã nào tra ra ở đâu", moc, 7, [
    { ten: "", tu: 1, den: 2, mau: "FFFFFFFF" },
    { ten: "TÌM THẤY Ở ĐÂU TRONG PHẦN MỀM", tu: 3, den: 6, mau: NEN_NHOM.phanMem },
    { ten: "", tu: 7, den: 7, mau: NEN_NHOM.chenh },
  ]);

  // ── Trang 2: các kiểu lệch ────────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Chỗ lệch");
  ws2.columns = [
    { header: "Kiểu lệch", key: "ten", width: 62 },
    { header: "Số mã", key: "so", width: 10 },
    { header: "Việc cần làm", key: "viec", width: 70 },
  ];
  const demLech: Record<string, number> = {};
  for (const l of LECH) {
    const [r] = await q<{ so: string }>(
      `select count(*)::text as so from ${KIEM_KE} where ${l.loc}`);
    demLech[l.ma_nhom] = n(r?.so);
    const h = ws2.addRow({ ten: l.ten, so: n(r?.so), viec: l.viec });
    for (let c = 1; c <= 3; c++)
      h.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: l.mau } };
  }
  const [nguoc] = await q<{ so: string }>(`
    select count(*)::text as so from v_telecom_may t
     where t.trang_thai = 'RENTING'
       and not exists (select 1 from ${KIEM_KE} where m.ma = t.imei)`);
  ws2.addRow({
    ten: "Phần mềm ghi ĐANG CHO THUÊ mà kiểm kê không nhắc mã nào",
    so: n(nguoc?.so),
    viec: "Máy sổ nói đang ở khách nhưng người kiểm kê không thấy — soát trước",
  }).eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MAU.do } };
  });
  dauTrang(ws2, "Các kiểu lệch giữa kiểm kê và phần mềm", moc, 3);

  // ── Trang 3..: danh sách từng kiểu ────────────────────────────────────────
  for (const l of LECH) {
    if (demLech[l.ma_nhom] === 0) continue;
    const ds = await q<Record<string, string | null>>(`
      select m.trang, m.dong::text, m.trang_thai, m.nhom, m.san_pham, m.ma,
             m.khach, m.ma_kh, m.ma_dvkh, m.kho, m.tinh_trang, m.ghi_chu,
             t.trang_thai as pm_trang_thai, t.khach as pm_khach,
             t.thue_bao_hien_tai as pm_thue_bao, t.ngay_thue::text as pm_ngay_thue
        from ${KIEM_KE}
        left join v_telecom_may t on t.imei = m.ma
       where ${l.loc}
       order by m.trang, m.dong`);
    const ws = wb.addWorksheet(l.ma_nhom.slice(0, 31));
    ws.columns = [
      { header: "Trang kiểm kê", key: "trang", width: 22 },
      { header: "Dòng", key: "dong", width: 7 },
      { header: "Nhóm", key: "nhom", width: 14 },
      { header: "Sản phẩm", key: "san_pham", width: 26 },
      { header: "Mã", key: "ma", width: 20 },
      { header: "Khách (kiểm kê)", key: "khach", width: 26 },
      { header: "Mã KH", key: "ma_kh", width: 12 },
      { header: "Mã DVKH", key: "ma_dvkh", width: 12 },
      { header: "Kho", key: "kho", width: 20 },
      { header: "Tình trạng", key: "tinh_trang", width: 14 },
      { header: "Ghi chú", key: "ghi_chu", width: 30 },
      { header: "PM · trạng thái", key: "pm_trang_thai", width: 16 },
      { header: "PM · khách", key: "pm_khach", width: 26 },
      { header: "PM · thuê bao", key: "pm_thue_bao", width: 16 },
      { header: "PM · ngày thuê", key: "pm_ngay_thue", width: 14 },
    ];
    for (const r of ds) ws.addRow(r);
    dauTrang(ws, l.ten, moc, 15, [
      { ten: "THEO BIÊN BẢN KIỂM KÊ", tu: 1, den: 11, mau: NEN_NHOM.saoKe },
      { ten: "THEO PHẦN MỀM", tu: 12, den: 15, mau: NEN_NHOM.phanMem },
    ]);
  }

  // ── Trang cuối: máy phần mềm có mà kiểm kê không nhắc ─────────────────────
  const ds2 = await q<Record<string, string | null>>(`
    select t.imei, t.model, t.nhom_may, t.trang_thai, t.khach, t.ma_khach,
           t.thue_bao_hien_tai, t.ngay_thue::text, t.so_luot_thue::text
      from v_telecom_may t
     where t.trang_thai = 'RENTING'
       and not exists (select 1 from ${KIEM_KE} where m.ma = t.imei)
     order by t.ngay_thue desc nulls last`);
  const ws9 = wb.addWorksheet("PM có, kiểm kê không");
  ws9.columns = [
    { header: "IMEI", key: "imei", width: 20 },
    { header: "Model", key: "model", width: 18 },
    { header: "Nhóm máy", key: "nhom_may", width: 14 },
    { header: "Trạng thái", key: "trang_thai", width: 14 },
    { header: "Khách", key: "khach", width: 28 },
    { header: "Mã khách", key: "ma_khach", width: 12 },
    { header: "Thuê bao", key: "thue_bao_hien_tai", width: 16 },
    { header: "Ngày thuê", key: "ngay_thue", width: 13 },
    { header: "Số lượt thuê", key: "so_luot_thue", width: 13 },
  ];
  for (const r of ds2) ws9.addRow(r);
  dauTrang(ws9, "Phần mềm ghi đang cho thuê mà biên bản kiểm kê không nhắc", moc, 9);

  datFont(wb, "Consolas");
  const ra = process.argv[2] ?? banKeTiep("../data", `doi-soat-kiem-ke-${lan.chot_ngay}`);
  await wb.xlsx.writeFile(ra);

  console.log(`Đã ghi ${ra}`);
  for (const l of LECH) console.log(`  ${String(demLech[l.ma_nhom]).padStart(5)} · ${l.ten}`);
  console.log(`  ${String(n(nguoc?.so)).padStart(5)} · Phần mềm ghi đang cho thuê mà kiểm kê không nhắc`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

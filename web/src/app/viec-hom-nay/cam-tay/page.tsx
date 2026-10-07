import Link from "next/link";
import { BangChoMuon } from "../../hom-nay/cho-muon";
import { ChiTietCanTru, ChiTietMayVe } from "../../hom-nay/chi-tiet-cho-muon";
import { LuatDocSo, MucHangDoi, NganKeoHangDoi, viecCua } from "../hang-doi";
import {
  getChoMuonDangGiu,
  getChoMuonThang,
  getViecHomNay,
} from "@/lib/queries";
import { VIEC_HOM_NAY } from "@/lib/nhan";
import { NoiDungThuCuoc } from "../../thu-cuoc/noi-dung";
import { NoiDungXemXetHuy } from "../../xem-xet-huy/noi-dung";
import { NoiDungCoc } from "../../cam-tay/coc/noi-dung";

export const dynamic = "force-dynamic";

const n = (v: string | number | null) =>
  v === null ? "—" : Math.round(Number(v)).toLocaleString("vi-VN");

type Tham = Record<string, string | string[] | undefined>;
const mot = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Ba (bốn) loại việc, tách tab chứ không xếp chồng một trang.
 *
 * "Hàng đợi" là việc đóng được từng dòng. "Công nợ" và "Dự kiến huỷ" là hai
 * góc nhìn vào cùng đống nợ: một bên hỏi đòi ai trước, một bên hỏi nên cắt
 * dịch vụ của ai — cùng dữ liệu nhưng hành động ngược nhau, nên không gộp.
 */
const VIEC_TAB = [
  { ma: "hang-doi", ten: "Hàng đợi" },
  { ma: "cong-no", ten: "Công nợ" },
  { ma: "du-kien-huy", ten: "Dự kiến huỷ" },
  { ma: "coc", ten: "Cọc" },
] as const;

const HE = "cam_tay";
const DUONG_DAN = "/viec-hom-nay/cam-tay";

/**
 * Hàng đợi việc phải làm của mảng Wifi cầm tay.
 *
 * Mỗi dòng là một việc ĐÓNG ĐƯỢC: có mã để tra, tên để nhận ra, tuổi để biết
 * cái nào gấp, link sang thẳng CMS. Không biểu đồ, không so tháng trước.
 *
 * Cuối trang là phần cho mượn máy — việc dính cả hai mảng nên nằm ở cả hai
 * màn, không thuộc riêng bên nào.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Tham>;
}) {
  const [rows, choMuon, choMuonGiu, sp] = await Promise.all([
    getViecHomNay(),
    getChoMuonThang(),
    getChoMuonDangGiu(),
    searchParams,
  ]);

  const cuaHe = rows.filter((r) => r.he === HE);
  const cua = (viec: string) => cuaHe.filter((r) => r.viec === viec);
  const cacViec = viecCua(HE);

  // Loại việc của mảng này mà chưa khai nhãn thì vẫn phải lộ ra, kẻo thêm hàng
  // đợi bên SQL rồi tưởng đã lên màn hình.
  const laDu = [...new Set(cuaHe.map((r) => r.viec))].filter(
    (v) => VIEC_HOM_NAY[v] === undefined,
  );

  const moViec = mot(sp.mo);
  const tab = VIEC_TAB.some((t) => t.ma === mot(sp.tab))
    ? mot(sp.tab)
    : "hang-doi";
  const soKia = rows.filter((r) => r.he !== HE).length;

  return (
    <main>
      <h1>Việc hôm nay · Wifi cầm tay</h1>
      <p className="muted">
        <b>{n(cuaHe.length)} việc</b> đang chờ người làm trên {cacViec.length}{" "}
        hàng đợi. Đây không phải báo cáo để đọc: mỗi dòng là một việc đóng được,
        già nhất lên đầu, bấm <b>làm →</b> là sang thẳng CMS. Làm xong thì danh
        sách ngắn lại. Bên cố định còn{" "}
        <Link href="/viec-hom-nay/co-dinh">{n(soKia)} việc nữa →</Link>
      </p>
      <div className="nhom-loc">
        <div className="muted nhan-nhom">Loại việc</div>
        <p className="actions">
          {VIEC_TAB.map((t) => (
            <Link key={t.ma} href={`${DUONG_DAN}?tab=${t.ma}`}>
              <button
                type="button"
                className={tab === t.ma ? "primary" : undefined}
              >
                {t.ten}
              </button>
            </Link>
          ))}
        </p>
      </div>

      {tab === "cong-no" && (
        <NoiDungThuCuoc
          moTai="/viec-hom-nay/cam-tay?tab=cong-no"
          searchParams={Promise.resolve(sp)}
          khoaNguon="TELECOM"
        />
      )}
      {tab === "du-kien-huy" && (
        <NoiDungXemXetHuy
          searchParams={Promise.resolve(sp)}
          khoaNguon="TELECOM"
        />
      )}
      {tab === "coc" && <NoiDungCoc searchParams={Promise.resolve(sp)} />}

      {tab === "hang-doi" && (
        <>
          <LuatDocSo khac="khách" />

          {laDu.length > 0 && (
            <p className="tag critical">
              {laDu.length} loại việc chưa có nhãn ở nhan.ts: {laDu.join(", ")}
            </p>
          )}

          {cacViec.map((viec) => (
            <MucHangDoi
              key={viec}
              viec={viec}
              ds={cua(viec)}
              moTai={DUONG_DAN}
            />
          ))}
        </>
      )}

      <h2 className="dau-he">Dính cả hai mảng</h2>
      <p className="muted">
        Phần dưới nằm ở cả hai màn vì nó không thuộc bên nào. Không dựng được
        hàng đợi từng dòng ở đây: hai hệ thống <b>không có khoá nối</b> giữa máy
        cho mượn và hợp đồng cố định, nên không chỉ ra được máy nào đã về mà
        chưa ai cấn trừ — chỉ đối chiếu được theo tháng.
      </p>
      <BangChoMuon ds={choMuon} giu={choMuonGiu} moTai={DUONG_DAN} />

      {VIEC_HOM_NAY[moViec] !== undefined &&
        VIEC_HOM_NAY[moViec]!.he === HE && (
          <NganKeoHangDoi viec={moViec} ds={cua(moViec)} dongLai={DUONG_DAN} />
        )}
      {(() => {
        // "<tháng>.may" hoặc "<tháng>.coc" — hai đầu của cùng một việc.
        const [ky, loai] = mot(sp.muon).split(".");
        if (!ky || loai === undefined) return null;
        return loai === "may" ? (
          <ChiTietMayVe ky={ky} dongLai={DUONG_DAN} />
        ) : (
          <ChiTietCanTru ky={ky} dongLai={DUONG_DAN} />
        );
      })()}
    </main>
  );
}

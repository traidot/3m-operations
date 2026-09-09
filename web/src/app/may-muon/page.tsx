import { createLoan, returnLoan } from "@/lib/actions";
import { getLoans } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
  const loans = await getLoans();
  const dangMuon = loans.filter((l) => l.returned_on === null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main>
      <h1>Máy cho mượn</h1>
      <p className="muted">
        Máy pocket giao cho khách dùng tạm trong lúc chờ lắp internet. Không sinh cước
        nhưng vẫn tốn data đầu vào và chiếm một suất tồn kho.
      </p>
      <p>
        Đây là nơi nhập tay duy nhất của hệ thống giám sát. Mọi thứ khác đọc từ hai
        phần mềm — nếu thấy có người bắt đầu nhập thứ khác vào đây thì phần đó nên
        được đưa về hệ thống vận hành thật.
      </p>

      <h2>Giao máy</h2>
      <form action={createLoan}>
        <div className="formgrid">
          <label>
            IMEI
            <input name="device_imei" required inputMode="numeric" placeholder="35000000000001" />
          </label>
          <label>
            Mã đơn lắp
            <input name="install_ref" placeholder="không bắt buộc" />
          </label>
          <label>
            Ngày giao
            <input type="date" name="issued_on" required defaultValue={today} />
          </label>
          <label>
            Hạn thu hồi
            <input type="date" name="due_on" required />
          </label>
          <label>
            Người giao
            <input name="by" required placeholder="tên nhân viên" />
          </label>
          <button type="submit" className="primary">
            Lưu phiếu
          </button>
        </div>
      </form>

      <h2>Đang cho mượn ({dangMuon.length})</h2>
      {dangMuon.length === 0 ? (
        <p className="empty">Không có máy nào đang ngoài kho.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>IMEI</th>
              <th>Đơn lắp</th>
              <th>Giao</th>
              <th>Hạn</th>
              <th>Quá hạn</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {dangMuon.map((l) => (
              <tr key={l.id}>
                <td className="mono">{l.device_imei}</td>
                <td className="mono">{l.install_ref ?? "—"}</td>
                <td className="mono">{l.issued_on}</td>
                <td className="mono">{l.due_on}</td>
                <td className={l.ngay_qua_han > 0 ? "mono" : "mono muted"}>
                  {l.ngay_qua_han > 0 ? `${l.ngay_qua_han} ngày` : "—"}
                </td>
                <td>
                  <form action={returnLoan} className="inline">
                    <input type="hidden" name="id" value={l.id} />
                    <button type="submit">Đã nhận lại</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

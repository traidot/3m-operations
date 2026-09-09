import { mergeParties, rejectMerge } from "@/lib/actions";
import { getMergeCandidates } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
  const candidates = await getMergeCandidates();

  return (
    <main>
      <h1>Duyệt trùng khách</h1>
      <p className="muted">
        Những cặp chỉ giống tên, chưa nối được bằng điện thoại hay giấy tờ. Trùng số
        điện thoại thì hệ thống đã tự gộp, không hiện ở đây.
      </p>
      <p>
        Gộp sai tệ hơn không gộp — ghép nhầm hai người là cộng nhầm công nợ của họ vào
        nhau, và người nợ thật thì không bị đòi. Không chắc thì bấm bác.
      </p>

      {candidates.length === 0 ? (
        <p className="empty">Không có cặp nào chờ duyệt.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Hồ sơ A</th>
              <th>Hồ sơ B</th>
              <th>Giống</th>
              <th>Quyết định</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={`${c.party_a}-${c.party_b}`}>
                <td>
                  {c.ten_a}
                  <br />
                  <span className="mono muted">{c.dien_thoai_a ?? "không có số"}</span>
                </td>
                <td>
                  {c.ten_b}
                  <br />
                  <span className="mono muted">{c.dien_thoai_b ?? "không có số"}</span>
                </td>
                <td className="mono">{c.do_giong}</td>
                <td>
                  <div className="actions">
                    <form action={mergeParties} className="inline">
                      <input type="hidden" name="keep" value={c.party_a} />
                      <input type="hidden" name="drop" value={c.party_b} />
                      <button type="submit" className="primary">
                        Gộp vào A
                      </button>
                    </form>
                    <form action={rejectMerge} className="inline">
                      <input type="hidden" name="a" value={c.party_a} />
                      <input type="hidden" name="b" value={c.party_b} />
                      <button type="submit">Không phải một người</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

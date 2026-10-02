-- Mã combini dùng để thu cái gì: cước, hay cọc cục TP Link.
--
-- Hai nguồn dấu hiệu, không cái nào đủ một mình:
--
--  · Ô "Loại" lúc tạo mã (1 = cước, 2 = cọc). Đúng về chủ ý nhưng người tạo
--    gõ nhầm: 2 lần tạo ghi chú rõ "Cọc TP Link" mà vẫn để ô Loại là cước.
--  · Ghi chú tự do. Nói rõ hơn ("tplink", "Cọc TP LINK", "cọc tp link"…)
--    nhưng 47 lần tạo loại Cọc bỏ trống ghi chú.
--
-- Lấy ghi chú làm chuẩn khi nó có nói, còn lại theo ô Loại. Ba nhóm:
--   cuoc        — tiền cước hàng tháng
--   coc_tplink  — ghi chú nói TP Link
--   coc_khac    — ô Loại là Cọc nhưng không ghi gì, nên không dám khẳng định
--                 là cọc TP Link dù số tiền đều rơi đúng mức 2.000-3.000
--
-- Không gộp coc_khac vào coc_tplink: suy luận từ số tiền thì hợp lý nhưng vẫn
-- là suy luận, mà đây là bảng người ta dùng để đi đòi tiền.

create or replace view v_fixed_gmo_lan as
select coalesce(g.batch_id, g.source_id)                     as lan,
       max(g.contract_id)                                    as contract_id,
       max(g.amount)                                         as tien,
       bool_or(g.status = 'PAYSUCCESS')                       as da_tra,
       max(g.loai)                                           as loai,
       bool_or(g.phieu_coc_id is not null)                    as co_phieu_coc,
       min(g.created_at_src)                                 as tao_luc,
       max(g.han_tra)                                        as han_tra,
       max(coalesce(d.paid_at, g.updated_at_src))
         filter (where g.status = 'PAYSUCCESS')               as tra_luc,
       max(g.ky_cuoc)                                        as ky_cuoc,
       case
         when bool_or(g.ghi_chu ~* 'tp ?-?link') then 'coc_tplink'
         when max(g.loai) = 2                    then 'coc_khac'
         else 'cuoc'
       end                                                   as nhom_tien,
       max(g.ghi_chu)                                        as ghi_chu
  from gmo_payment_snapshot g
  left join deposit_allocation_snapshot d
    on d.source = 'FIXED' and d.source_id = g.phieu_coc_id
 where g.source = 'FIXED'
 group by coalesce(g.batch_id, g.source_id);

comment on view v_fixed_gmo_lan is
  'Mỗi dòng một lần tạo mã combini (gộp bốn mã cùng batch); ngày trả lấy từ phiếu cọc, nhom_tien phân biệt cước với cọc TP Link';

-- Mã combini theo thứ đang thu và tình trạng.
create or replace view v_fixed_gmo_loai as
select nhom_tien,
       case nhom_tien
         when 'cuoc'       then 'Cước hàng tháng'
         when 'coc_tplink' then 'Cọc cục TP Link'
         else 'Cọc, không ghi rõ'
       end                                                   as ten,
       count(*)                                              as lan,
       count(*) filter (where da_tra)                        as da_tra,
       count(*) filter (where not da_tra and han_tra < now()) as chet,
       count(*) filter (where not da_tra and (han_tra is null or han_tra >= now()))
                                                             as dang_cho,
       sum(tien) filter (where da_tra)                       as tien_tra,
       count(distinct contract_id) filter (where not da_tra and han_tra < now())
                                                             as hop_dong_hong,
       case
         when count(*) filter (where da_tra or han_tra < now()) = 0 then null
         else round(100.0 * count(*) filter (where not da_tra and han_tra < now())
                    / count(*) filter (where da_tra or han_tra < now()), 1)
       end                                                   as ty_le_chet
  from v_fixed_gmo_lan
 group by 1;

comment on view v_fixed_gmo_loai is
  'Mã combini chia theo thứ đang thu: cước, cọc TP Link, cọc không ghi rõ';

-- Nhóm "cọc không ghi rõ" có bao nhiêu cái mang dấu hiệu TP Link từ chỗ khác:
-- hợp đồng đang ghi lý do chờ TP Link, hoặc chính hợp đồng đó có mã TP Link
-- khác. Không dùng để tự động xếp lại nhóm — chỉ để người đọc biết nhóm này
-- nghiêng về đâu mà không phải tự đoán.
create or replace view v_fixed_gmo_coc_mo as
select count(*)                                              as lan,
       count(*) filter (
         where e.ly_do_chua_lap_xong ~* 'tp ?-?link'
            or exists (select 1 from v_fixed_gmo_lan l2
                        where l2.contract_id = k.contract_id
                          and l2.nhom_tien = 'coc_tplink')) as co_dau_hieu_tplink
  from v_fixed_gmo_lan k
  left join fixed_contract_extra e
    on e.source = 'FIXED' and e.source_id = k.contract_id
 where k.nhom_tien = 'coc_khac';

comment on view v_fixed_gmo_coc_mo is
  'Nhóm cọc không ghi rõ: bao nhiêu cái có dấu hiệu TP Link từ lý do hợp đồng hoặc mã khác cùng hợp đồng';

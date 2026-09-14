-- Dòng cước theo tháng — mảnh còn thiếu để dựng lại đúng báo cáo của CMS.
--
-- Hoá đơn bên cầm tay KHÔNG mang kỳ của nó ở một chỗ. Một hoá đơn năm 26.136
-- yên được tách thành 12 dòng tháng, và hai bảng khác nhau giữ hai loại:
--
--   invoice_item          dòng tháng của hoá đơn cước (invoiceType SUBSCRIPTION)
--   subscription_billing  dòng tháng của hoá đơn đơn hàng (invoiceType ORDER)
--
-- Hàm rpt_subscription_fee_monthly_summary của CMS gộp đúng hai nguồn này, nên
-- gom theo period_start như mình đang làm là ra số khác. Kéo cả hai về thành
-- một bảng phẳng, giữ nguyên năm/tháng của nguồn.

create table if not exists fee_line_snapshot (
  source                 source_system  not null,
  source_id              text           not null,
  kind                   text           not null,
  invoice_source_id      text,
  subscription_source_id text,
  nam                    int            not null,
  thang                  int            not null,
  amount                 numeric(14,2),
  start_on               date,
  end_on                 date,
  synced_at              timestamptz    not null default now(),
  primary key (source, source_id)
);

create index if not exists fee_line_ky on fee_line_snapshot (source, nam, thang);
create index if not exists fee_line_sub on fee_line_snapshot (source, subscription_source_id);
create index if not exists fee_line_inv on fee_line_snapshot (source, invoice_source_id);

comment on table fee_line_snapshot is
  'Dòng cước từng tháng: invoice_item cho hoá đơn cước, subscription_billing cho hoá đơn đơn hàng';
comment on column fee_line_snapshot.kind is
  'SUBSCRIPTION đến từ invoice_item; ORDER đến từ subscription_billing';

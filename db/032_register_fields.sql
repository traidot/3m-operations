-- Báo cáo tổng hợp bên CMS tách đăng ký lần đầu với đăng ký lại, và tách huỷ
-- theo ba mốc. Ba trường quyết định điều đó nằm sẵn bên nguồn mà kho chưa kéo
-- về: isRenewal, cancellationTiming, và INSTALLATION_FAILED.
--
-- Ánh xạ cũ gộp INSTALLATION_FAILED chung với huỷ lịch thành 'CANCELLED', nên
-- lắp thất bại không đếm riêng được. Tách thành 'FAILED'.

alter table subscription_snapshot
  add column if not exists is_renewal     boolean,
  add column if not exists cancel_timing  text;

comment on column subscription_snapshot.is_renewal is
  'Địa chỉ này đăng ký lại, không phải lần đầu';
comment on column subscription_snapshot.cancel_timing is
  'BEFORE_SCHEDULE | AFTER_SCHEDULE — mốc huỷ so với lịch lắp';

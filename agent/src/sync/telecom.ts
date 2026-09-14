/**
 * Ánh xạ hệ thống telecom (PostgreSQL, RDS) sang kho số liệu.
 *
 * Đây là chỗ duy nhất biết lược đồ bên nguồn. Khác hẳn hệ wifi cố định:
 *  - Có khách hàng thật, 3.799 hồ sơ, nên phải nối vào bảng party.
 *  - Có hoá đơn thật, nên công nợ đọc thẳng chứ không phải suy từ sổ thu.
 *  - Quản lý thiết bị cho thuê và tiền cọc.
 *
 * Tên cột bên nguồn viết kiểu camelCase nên phải bọc nháy kép.
 */

export const CUSTOMER = `
  select
    c.id::text                                   as source_customer_id,
    nullif(btrim(c.name), '')                    as name,
    (select cc.value from customer_contact cc
      where cc."customerId" = c.id and cc."deletedAt" is null
        and cc."contactType" = 'PHONE'
      order by cc.id limit 1)                    as phone,
    (select cc.value from customer_contact cc
      where cc."customerId" = c.id and cc."deletedAt" is null
        and cc."contactType" = 'EMAIL'
      order by cc.id limit 1)                    as email,
    -- Mã nghiệp vụ cho người đọc (KH03901), không phải giấy tờ tuỳ thân.
    c.code                                       as customer_code,
    null                                         as id_document,
    c."customerType"::text                       as customer_type,
    g.name                                       as customer_group,
    c."createdAt"                                as created_at_src,
    c."authorId"::text                           as created_by_src
  from customer c
  left join customer_group g on g.id = c."customerGroupId"
  where c."deletedAt" is null
`;

export const SUBSCRIPTION = `
  select
    s.id::text                                   as source_id,
    s."customerId"::text                         as source_customer_id,
    coalesce(p.type::text, 'POCKET_WIFI')        as service_type,
    pk.name                                      as plan_name,
    case s.status::text
      when 'ACTIVE'                   then 'ACTIVE'
      when 'CANCELLED'                then 'TERMINATED'
      when 'SUSPENDED'                then 'SUSPENDED'
      when 'WAITING_FOR_CANCELLATION' then 'ACTIVE'
      else 'PENDING'
    end                                          as status,
    s."packagePrice"                             as monthly_price,
    null                                         as monthly_cost,
    s."activationDate"                           as activated_on,
    coalesce(s."cancelDate", s."expirationDate") as terminated_on,
    extract(day from s."activationDate")::int    as anchor_day,
    s."activationDate"                           as fee_start_on,
    coalesce(s."cancelDate", s."expirationDate") as fee_end_on,
    s."orderId"::text                            as order_ref,
    s."deviceCode"                               as device_ref,
    null                                         as sim_ref,
    false                                        as is_renewal,
    null                                         as cancel_timing,
    null                                         as cancel_reason,
    false                                        as is_difficult_debt,
    s."createdAt"                                as created_at_src,
    s."updatedAt"                                as updated_at_src,
    s."authorId"::text                           as created_by_src
  from subscription s
  left join product p on p.id = s."productId"
  left join package pk on pk.id = s."packageId"
  where s."deletedAt" is null
`;

/**
 * Hoá đơn. expiredDate là hạn thanh toán; thiếu thì lấy luôn ngày lập để quy
 * tắc quá hạn không bỏ sót hoá đơn không ghi hạn.
 */
export const INVOICE = `
  select
    i.id::text                                   as source_id,
    i."customerId"::text                         as source_customer_id,
    i."subscriptionId"::text                     as subscription_source_id,
    i.code                                       as number,
    i."invoiceType"::text                        as invoice_type,
    i."orderId"::text                            as order_id,
    coalesce(i."invoiceDate", i."createdAt"::date) as issued_on,
    coalesce(i."expiredDate", i."invoiceDate", i."createdAt"::date) as due_on,
    b.tu                                         as period_start,
    b.den                                        as period_end,
    i.amount                                     as total_amount,
    coalesce(i."paidAmount", 0)                  as paid_amount,
    -- Đưa về từ vựng của kho: các view công nợ tìm 'ISSUED' và bỏ qua 'VOID'.
    -- Giữ riêng UNPAYABLE vì đó là tiền đã xác định không đòi được, khác với
    -- hoá đơn còn đang đòi.
    case i.status::text
      when 'PAID'           then 'PAID'
      when 'UNPAID'         then 'ISSUED'
      when 'PARTIALLY_PAID' then 'ISSUED'
      when 'CANCELLED'      then 'VOID'
      when 'UNPAYABLE'      then 'UNPAYABLE'
      else i.status::text
    end                                          as status,
    i."createdAt"                                as created_at_src,
    i."authorId"::text                           as created_by_src
  from invoice i
  -- Kỳ tính cước thật nằm ở subscription_billing; invoiceDate với expiredDate
  -- chỉ là ngày lập và hạn trả.
  left join lateral (
    select min(sb."startDate") as tu, max(sb."endDate") as den
      from subscription_billing sb
     where sb."invoiceId" = i.id and sb."deletedAt" is null
  ) b on true
  where i."deletedAt" is null
`;

/** Tiền thu. Nối về hoá đơn qua payment_allocation nếu có. */
export const PAYMENT = `
  select
    p.id::text                                   as source_id,
    p."customerId"::text                         as source_customer_id,
    (select i."subscriptionId"::text
       from payment_reconciliation pr
       join invoice i on i.id = pr."invoiceId"
      where pr."paymentId" = p.id and i."subscriptionId" is not null
      order by pr.id limit 1)                    as subscription_source_id,
    (select pr."invoiceId"::text from payment_reconciliation pr
      where pr."paymentId" = p.id order by pr.id limit 1) as invoice_source_id,
    p.amount                                     as amount,
    p."paymentMethod"::text                      as channel,
    p."transactionCode"                          as reference,
    coalesce(p."paymentDate"::timestamptz, p."createdAt") as paid_at,
    p."createdAt"                                as created_at_src,
    p."authorId"::text                           as created_by_src
  from payment p
  where p."deletedAt" is null
`;

export const DEVICE = `
  select
    d.id::text                                   as source_id,
    d."deviceCode"                               as imei,
    di.msn                                       as model,
    d."rentalStatus"::text                       as status,
    (select sd."subscriptionId"::text from subscription_device sd
      where sd."deviceCode" = d."deviceCode" and sd."deletedAt" is null
      order by sd.id desc limit 1)               as subscription_source_id,
    null                                         as location,
    d.deposit                                    as deposit,
    d."returnDepositStatus"::text                as deposit_status,
    d."rentalDate"::date                         as rented_on,
    d."returnDate"::date                         as returned_on,
    d."updatedAt"                                as updated_at_src
  from rental_device d
  left join device_info di on di."deviceCode" = d."deviceCode" and di."deletedAt" is null
  where d."deletedAt" is null
`;

/** Lịch sử gắn máy vào thuê bao — một thuê bao có thể đổi máy giữa chừng. */
export const SUBSCRIPTION_DEVICE = `
  select
    sd.id::text                                  as source_id,
    sd."subscriptionId"::text                    as subscription_source_id,
    sd."deviceCode"                              as imei,
    sd."startDate"::date                         as started_on,
    sd."endDate"::date                           as ended_on,
    sd."createdAt"                               as created_at_src
  from subscription_device sd
  where sd."deletedAt" is null and sd."deviceCode" is not null
`;

export const STAFF = `
  select
    u.id::text                                   as source_id,
    coalesce(nullif(btrim(u."fullName"), ''), u.email, u.username) as display_name,
    u.role::text                                 as role,
    case when u.active then 'ACTIVE' else 'INACTIVE' end as status,
    u."userGroupId"::text                        as team_ref
  from "user" u
  where u."deletedAt" is null
`;

export const QUERIES = {
  staff: STAFF,
  customer: CUSTOMER,
  subscription: SUBSCRIPTION,
  invoice: INVOICE,
  payment: PAYMENT,
  device: DEVICE,
  subscription_device: SUBSCRIPTION_DEVICE,
} as const;

/**
 * Ánh xạ hệ thống wifi cố định (MySQL, database `wifi-api`) sang kho số liệu.
 *
 * Đây là chỗ duy nhất biết về lược đồ bên nguồn. Bên kia đổi cột thì chỉ sửa
 * file này.
 *
 * Hai điều khác giả định ban đầu, đã xác nhận với chủ hệ thống:
 *  - Không có khách hàng cuối. Bảy dòng trong `customers` là nhân viên 3M
 *    đứng tên đăng ký với nhà mạng. Đơn vị nhận diện là hợp đồng và địa chỉ lắp.
 *  - Không có hoá đơn. `contract_fee_payments` chỉ ghi khoản đã thu, nên công
 *    nợ phải suy từ feeStartDate và monthlyFee.
 */

export const SUBSCRIPTION = `
  select
    c.id                                        as source_id,
    c.contractCode                              as source_customer_id,
    'FIXED_INTERNET'                            as service_type,
    c.package                                   as plan_name,
    case c.contractStatus
      when 'ACTIVE'    then 'ACTIVE'
      when 'CANCELLED' then 'TERMINATED'
      else 'PENDING'
    end                                         as status,
    c.monthlyFee                                as monthly_price,
    null                                        as monthly_cost,
    date(coalesce(c.activatedAt, c.installationCompletedDate)) as activated_on,
    date(coalesce(c.cancelDate, c.lineCancellationDate))       as terminated_on,
    day(c.feeStartDate)                         as anchor_day,
    null                                        as device_ref,
    null                                        as sim_ref,
    c.createdAt                                 as created_at_src,
    c.updatedAt                                 as updated_at_src,
    c.createBy                                  as created_by_src
  from contracts c
  where c.deletedAt is null
`;

export const INSTALL_ORDER = `
  select
    c.id            as source_id,
    c.contractCode  as source_customer_id,
    trim(concat_ws(' ', c.postalCode, c.addressLine, c.buildingName)) as address,
    case c.installationStatus
      when 'INSTALLATION_COMPLETED' then 'DONE'
      when 'INSTALLATION_FAILED'    then 'CANCELLED'
      else 'SURVEY'
    end             as status,
    date(c.entryDate)                    as signed_on,
    c.installationDate                   as scheduled_at,
    date(c.installationCompletedDate)    as completed_on,
    c.saleId                             as technician_ref,
    c.createdAt                          as created_at_src,
    c.updatedAt                          as updated_at_src,
    c.createBy                           as created_by_src
  from contracts c
  where c.deletedAt is null
`;

/**
 * Mỗi dòng là một khoản đã thu cho một tháng cước của một hợp đồng.
 * NOTE_ONLY và PENDING_APPROVAL chưa phải tiền thật nên loại ra.
 */
export const PAYMENT = `
  select
    p.id                    as source_id,
    p.contractId            as subscription_source_id,
    p.amount                as amount,
    p.collectionAccount     as channel,
    p.paymentMonth          as reference,
    p.paidAt                as paid_at,
    p.createdAt             as created_at_src,
    p.createBy              as created_by_src
  from contract_fee_payments p
  where p.deletedAt is null
    and p.status = 'APPROVED'
    and p.isFree = 0
`;

export const DEVICE = `
  select
    d.id           as source_id,
    d.serialNumber as imei,
    d.model        as model,
    d.status       as status,
    null           as subscription_source_id,
    null           as location,
    d.updatedAt    as updated_at_src
  from devices d
  where d.deletedAt is null
`;

export const QUERIES = {
  subscription: SUBSCRIPTION,
  install_order: INSTALL_ORDER,
  payment: PAYMENT,
  device: DEVICE,
} as const;

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
    date(c.feeStartDate)                        as fee_start_on,
    date(coalesce(c.feeCollectionEndDate, c.cancelDate, c.lineCancellationDate)) as fee_end_on,
    null                                        as device_ref,
    null                                        as sim_ref,
    c.isRenewal = 1                             as is_renewal,
    c.cancellationTiming                        as cancel_timing,
    nullif(trim(coalesce(c.cancelReasonProvider, c.cancelReasonManager)), '') as cancel_reason,
    c.isDifficultDebt = 1                       as is_difficult_debt,
    -- Cột dùng chung với wifi cầm tay; bên cố định không có khái niệm cho mượn.
    false                                       as cho_muon_cd,
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
      when 'INSTALLATION_FAILED'    then 'FAILED'
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
 * Sổ các tháng cước ĐÃ XỬ LÝ — thu tiền hoặc miễn phí. Tháng nào không có
 * dòng ở đây mới là tháng còn nợ.
 *
 * Đây không phải sổ thu tiền: isFree = 1 nghĩa là tháng đó được khuyến mãi,
 * amount bằng 0 nhưng vẫn coi như đã xong.
 */
export const FEE_PERIOD = `
  select
    p.id                as source_id,
    p.contractId        as subscription_source_id,
    p.paymentMonth      as period,
    p.amount            as amount,
    p.isFree            as is_free,
    p.status            as status,
    p.paidAt            as paid_at,
    p.collectionAccount as channel,
    -- Ba ô đánh dấu trên màn hình "Cập nhật thu cước phí" bên CMS. Thiếu chúng
    -- thì mọi kỳ thu ít hơn giá cước đều bị đọc nhầm là thu thiếu.
    p.isManuallySettled = 1 as tuy_chinh,
    nullif(trim(p.manualSettleNote), '') as ghi_chu_tuy_chinh,
    p.isNoCollection = 1    as khong_thu,
    p.noCollectionReasonId  as ly_do_khong_thu_id,
    p.createdAt         as created_at_src,
    p.createBy          as created_by_src
  from contract_fee_payments p
  where p.deletedAt is null
`;

/** Chỉ tiền thật, để đo dòng tiền. Miễn phí và chưa duyệt không tính. */
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

/** Chỉ lấy tên và vai trò. Không mang mật khẩu hay email sang kho. */
export const STAFF = `
  select
    u.id          as source_id,
    u.displayName as display_name,
    u.type        as role,
    u.status      as status,
    u.teamId      as team_ref
  from user u
`;

/**
 * Tiền khách nộp trước qua GMO (combini), kèm cách phân bổ vào từng tháng cước.
 * Phiếu đã duyệt sinh dòng trong contract_fee_payments nên đừng cộng thêm lần
 * nữa — kho chỉ dùng bảng này để biết phiếu nào còn chờ duyệt.
 */
export const DEPOSIT_ALLOCATION = `
  select
    da.id                as source_id,
    da.contractId        as subscription_source_id,
    da.contractCode      as contract_code,
    da.depositAmount     as amount,
    da.allocationsJson   as allocations,
    da.status            as status,
    da.sourceType        as channel,
    da.collectionAccount as collection_account,
    da.gmoPaymentDate    as paid_at,
    da.approvedAt        as approved_at,
    da.notes             as note,
    da.createdAt         as created_at_src,
    da.createBy          as created_by_src
  from deposit_allocations da
`;


/**
 * Trường phụ của hợp đồng: kéo nguyên về, chưa dùng vào luật nào.
 *
 * `orderId` bên này KHÔNG phải mã đơn hàng — là ô ghi chú tự do, người nhập gõ
 * tiếng Nhật vào đó ("建物名確認", "10月以降エントリー"). Bản xuất Excel của CMS
 * gọi nó là "Mã U" nên giữ tên đó cho dễ đối chiếu.
 */
export const CONTRACT_EXTRA = `
  select
    c.id                              as source_id,
    c.contract_type                   as contract_type,
    date(c.scheduledCutDate)          as lich_huy_du_kien,
    nullif(trim(c.orderId), '')       as ma_u,
    c.provider_status                 as provider_status,
    c.owner                           as owner,
    c.cafNumber                       as caf_number,
    c.billingNumber                   as billing_number,
    c.designated_account              as designated_account,
    c.registrationCount               as so_lan_dang_ky,
    date(c.technicianVisitDate)       as ngay_ky_thuat_den,
    date(c.equipmentShippedDate)      as ngay_gui_thiet_bi,
    nullif(trim(c.installationFailedReason), '')        as ly_do_lap_that_bai,
    nullif(trim(c.installationNotCompletedReason), '')  as ly_do_chua_lap_xong
  from contracts c
  where c.deletedAt is null
`;

/** Danh mục lý do không thu cước — chỉ năm dòng, nhưng là từ điển cho chỗ khác. */
export const NO_COLLECTION_REASON = `
  select
    r.id                          as source_id,
    r.name                        as ten,
    r.status                      as trang_thai,
    r.triggersPendingCancellation = 1 as gay_cho_huy
  from no_collection_reasons r
`;

/**
 * Đợt nộp của một kỳ cước. Một phiếu thu chia được nhiều đợt, nên tổng các đợt
 * mới là tiền khách thực nộp — phiếu chờ duyệt ghi amount 0 mà vẫn có đợt.
 */
export const FEE_INSTALLMENT = `
  select
    i.id                    as source_id,
    i.contractFeePaymentId  as fee_period_id,
    i.contractId            as contract_id,
    i.paymentMonth          as ky,
    i.amount                as amount,
    i.paidAt                as paid_at,
    i.collectionAccount     as channel,
    i.status                as status,
    nullif(trim(i.notes), '') as note,
    i.createdAt             as created_at_src,
    i.createBy              as created_by_src
  from contract_fee_payment_installments i
  -- Bảng này có xoá mềm mà lúc đầu quên lọc, 48 đợt đã xoá lọt vào kho.
  where i.deletedAt is null
`;

/**
 * Mã thanh toán combini qua GMO.
 *
 * Mỗi lần bấm "Tạo mã thanh toán" sinh bốn dòng — Lawson, FamilyMart,
 * Ministop, Seicomart — cùng số tiền và cùng batchId. Khách chỉ trả ở một
 * chỗ, nên chỉ một dòng thành PAYSUCCESS còn ba dòng kia ở nguyên
 * REQSUCCESS. Cộng cột amount của bảng này là ra số gấp bốn lần thật.
 *
 * batchId null ở các dòng tạo trước khi CMS thêm trường đó; lúc gộp phải
 * coalesce về id để mỗi dòng cũ tự thành một lần.
 */
export const GMO_PAYMENT = `
  select
    g.id                      as source_id,
    g.batchId                 as batch_id,
    g.contractId              as contract_id,
    g.storeCode               as store_code,
    g.amount                  as amount,
    g.status                  as status,
    g.type                    as loai,
    g.paymentMonth            as ky_cuoc,
    g.paymentExpiryDateTime   as han_tra,
    g.depositAllocationId     as phieu_coc_id,
    g.note                    as ghi_chu,
    g.createdAt               as created_at_src,
    g.updatedAt               as updated_at_src,
    g.createBy                as created_by_src
  from gmo_convenience_store_payments g
`;

export const QUERIES = {
  subscription: SUBSCRIPTION,
  fee_period: FEE_PERIOD,
  install_order: INSTALL_ORDER,
  payment: PAYMENT,
  device: DEVICE,
  deposit_allocation: DEPOSIT_ALLOCATION,
  staff: STAFF,
  contract_extra: CONTRACT_EXTRA,
  no_collection_reason: NO_COLLECTION_REASON,
  fee_installment: FEE_INSTALLMENT,
  gmo_payment: GMO_PAYMENT,
} as const;

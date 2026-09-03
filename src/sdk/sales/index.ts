/**
 * الواجهة العلنية لمجال المبيعات — PHASE 31 · قسم 51.
 */

// الكيانات وقواعد الحالة.
export {
  canCancelSale,
  canRefundSale,
  outstandingAmount,
  type Sale,
  type SaleLine,
  type SaleStatus,
  type SalePaymentStatus,
  type SaleCustomerRef,
  type Receipt,
  type ReceiptLine,
} from './contracts/sale-contracts';

// الأوامر والاستعلامات ومخططاتها.
export {
  createSaleSchema,
  cancelSaleSchema,
  refundSaleSchema,
  type CreateSaleCommand,
  type CreateSaleLineInput,
  type CancelSaleCommand,
  type RefundSaleCommand,
  type SaleListQuery,
} from './contracts/sale-commands';

// عقد المستودع.
export type { SaleRepository } from './contracts/sale-repository';

// مُصنِّع الفاتورة (نقي).
export {
  buildSale,
  customerRef,
  formatSaleNumber,
  markSaleCancelled,
  markSalePaid,
  markSaleRefunded,
  walkInCustomer,
  type BuildSaleInput,
} from './commands/sale-factory';

// الخدمة.
export {
  createSaleService,
  type SaleService,
  type SaleServiceDependencies,
} from './services/sale-service';

/**
 * الواجهة العلنية لمجال المدفوعات — PHASE 31 · قسم 51.
 */

// الكيانات وقواعدها.
export {
  canRefundPayment,
  refundableAmount,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
  type PaymentSplit,
  toProviderMethod,
  type PaymentProvider,
  type PaymentProviderResult,
  type PaymentAuthorizationRequest,
} from './contracts/payment-contracts';

// الأوامر ومخططاتها.
export {
  processPaymentSchema,
  refundPaymentSchema,
  type ProcessPaymentCommand,
  type RefundPaymentCommand,
  type PaymentListQuery,
} from './contracts/payment-commands';

// عقد المستودع.
export type { PaymentRepository } from './contracts/payment-repository';

// الحسابات النقية.
export {
  AMOUNT_TOLERANCE,
  calculateChange,
  isSufficient,
  paymentSplit,
  requiresProvider,
  requiresTendered,
  splitsCoverTotal,
  splitsShortfall,
  splitsTotal,
  suggestQuickCash,
  zeroAmount,
} from './calculations/payment-calculator';

// الخدمة.
export {
  createPaymentService,
  type PaymentService,
  type PaymentServiceDependencies,
} from './services/payment-service';

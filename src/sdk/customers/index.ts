/**
 * الواجهة العلنية لمجال العملاء — PHASE 31 · قسم 51.
 */

// العقود والدوال النقية والمخططات.
export {
  LOYALTY_THRESHOLDS,
  POINTS_PER_UNIT,
  calculatePoints,
  createCustomerSchema,
  deriveTier,
  updateCustomerSchema,
  type Customer,
  type CustomerKind,
  type CustomerListQuery,
  type CustomerPurchaseRef,
  type CustomerRepository,
  type ContactChannel,
  type CreateCustomerCommand,
  type LoyaltyTier,
  type UpdateCustomerCommand,
} from './contracts/customer-contracts';

// الخدمة.
export {
  createCustomerService,
  type CustomerService,
  type CustomerServiceDependencies,
} from './services/customer-service';

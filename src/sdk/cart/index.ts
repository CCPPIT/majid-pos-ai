/**
 * الواجهة العلنية لمجال السلة — PHASE 31 · قسم 51.
 */

// عقود السلة وحدودها.
export {
  CART_LIMITS,
  type Cart,
  type CartItem,
  type CartTotals,
  type CartErrorReason,
  type Discount,
  type DiscountType,
  type Tax,
  type PricingSnapshot,
} from './contracts/cart-contracts';

// محرّك العمليات النقي.
export {
  createCart,
  createCartItem,
  findItem,
  addItem,
  removeItem,
  updateQuantity,
  applyDiscount,
  removeDiscount,
  clearCart,
} from './commands/cart-engine';

// محرّك الحساب الحتمي.
export {
  calculateTotals,
  lineSubtotal,
  lineTotalAfterDiscount,
  discountAmount,
  cartQuantity,
  isCartEmpty,
} from './calculations/cart-calculator';

// الخدمة عالية المستوى.
export {
  createCartService,
  assertCheckoutReady,
  type CartService,
  type CartServiceDependencies,
} from './services/cart-service';

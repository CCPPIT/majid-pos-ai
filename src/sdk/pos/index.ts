/**
 * الواجهة العلنية لمجال نقطة البيع — PHASE 31 · قسم 51.
 */

// العقود.
export type {
  PosSession,
  PosSessionStatus,
  CheckoutCommand,
  CheckoutResult,
  PosSnapshot,
} from './contracts/pos-contracts';

// الخدمة.
export {
  createPosService,
  openPosSession,
  type PosService,
  type PosServiceDependencies,
} from './services/pos-service';

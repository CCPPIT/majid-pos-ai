/**
 * واجهة مزود الدفع (Payment Provider Port) — PHASE 14.
 * المزود الحقيقي (بوابة بطاقات/M-Pesa/محفظة) يُنفذ هذه الواجهة لاحقًا؛
 * اليوم نستخدم مزودًا محليًا محاكى (Simulated) يكمل الدفعة فورًا.
 * الشاشات تتعامل مع الواجهة فقط (مزود-محايد).
 */
import type { Money } from '@/core/money/money';
import type { PaymentMethod } from './types';

// طلب معالجة دفعة.
export interface ProcessPaymentRequest {
  method: PaymentMethod; // الطريقة.
  amount: Money; // المبلغ المطلوب تحصيله.
  orderNumber: string; // رقم الطلب (مرجع).
}

// واجهة المزود (البورت).
export interface PaymentProvider {
  // معرّف المزود (للسجلات).
  readonly id: string;
  // هل هذه الطريقة مدعومة؟
  supports(method: PaymentMethod): boolean;
  // يعالج الدفعة ويعيد نتيجة (نجاح/فشل) — قد يكون async للبوابة الحقيقية.
  process(request: ProcessPaymentRequest): Promise<{ reference: string } | { errorKey: string }>;
}

/**
 * مزود محاكى (Offline/Simulated) — يكتمل فورًا لكل الطرق.
 * النقدي لا يحتاج بوابة أصلًا؛ البطاقة/QR/المحفظة تُحاكى حتى ربط البوابة.
 */
export class SimulatedPaymentProvider implements PaymentProvider {
  readonly id = 'simulated';

  supports(_method: PaymentMethod): boolean {
    // يدعم كل الطرق في المحاكاة.
    return true;
  }

  async process(request: ProcessPaymentRequest): Promise<{ reference: string } | { errorKey: string }> {
    // مبلغ غير صالح → فشل (حماية مجال).
    if (!(request.amount.amount > 0)) {
      return { errorKey: 'pay.error.invalidAmount' };
    }
    // مرجع وهمي ثابت الشكل (يُستبدل بمرجع البوابة الحقيقية).
    const reference = `SIM-${request.orderNumber}-${Date.now().toString().slice(-6)}`;
    return { reference };
  }
}

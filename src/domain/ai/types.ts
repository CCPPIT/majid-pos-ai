/**
 * أنواع مجال المساعد الذكي / AI Copilot (PHASE 24).
 * Copilot مساعد محادثة محلي صادق: لا خادم ذكاء اصطناعي بعد، فكل الإجابات
 * تُشتق من بيانات المتجر الحقيقية (تقارير/مخزون/منتجات) عبر ذكاء قواعدي
 * على الجهاز (Rule-based NLU). لا نزعم وجود نموذج سحابي.
 */
import type { ISODateString } from '@/core/types/domain';

// نية السؤال (ماذا يريد المستخدم).
export type CopilotIntent =
  | 'greeting' // ترحيب / مساعدة عامة.
  | 'sales_overview' // ملخص مبيعات فترة.
  | 'revenue' // الإيراد فقط.
  | 'orders_count' // عدد الطلبات.
  | 'avg_order' // متوسط قيمة الطلب.
  | 'top_products' // الأكثر مبيعًا.
  | 'payment_methods' // توزيع طرق الدفع.
  | 'low_stock' // المنتجات منخفضة/النافدة.
  | 'product_price' // سعر منتج بالاسم.
  | 'tax_discount' // الضريبة والخصم.
  | 'help' // ما الذي يمكنك فعله.
  | 'unknown'; // لم تُفهم النية.

// الفترة الزمنية المستخرجة من النص.
export type CopilotPeriod = 'today' | 'week' | 'month' | 'all';

// دور الرسالة في المحادثة.
export type CopilotRole = 'user' | 'assistant';

// رسالة محادثة واحدة.
export interface CopilotMessage {
  id: string; // معرف فريد.
  role: CopilotRole; // المستخدم أم المساعد.
  text: string; // النص الكامل (مُترجَم عند المساعد).
  intent?: CopilotIntent; // النية المكتشفة (لرسائل المساعد فقط).
  period?: CopilotPeriod; // الفترة المكتشفة.
  cards?: CopilotCard[]; // بطاقات بيانات مرافقة (أرقام/منتجات).
  suggestions?: string[]; // أسئلة مقترحة للمتابعة.
  createdAt: ISODateString; // لحظة الإنشاء.
}

// بطاقة بيانات تُعرض ضمن إجابة المساعد.
export interface CopilotCard {
  key: string; // مفتاح المحتوى (رقم/منتج/صنف مخزون).
  title: string; // العنوان المُترجَم.
  value: string; // القيمة النصية (مبلغ/كمية) — مُنسّقة.
  tone?: 'neutral' | 'good' | 'warn' | 'bad'; // نبرة لونية.
  meta?: string; // سطر ثانوي اختياري.
}

// نتيجة تحليل نية السؤال (مرحلة فهم اللغة).
export interface CopilotParse {
  intent: CopilotIntent; // النية.
  period: CopilotPeriod; // الفترة (افتراضي اليوم إن لم تُذكر).
  productQuery?: string; // اسم/كلمة منتج (نية سعر منتج).
  confidence: number; // درجة الثقة 0-1.
}

// سياق البيانات الذي يحقنه المستودع عند توليد الإجابة.
export interface CopilotDataContext {
  currency: string; // عملة العرض.
  locale: 'ar' | 'en'; // لغة النص.
}

/**
 * عقود واجهة الـAPI (أساس بلا تنفيذ خادم) — PHASE 32 · أقسام 58–61.
 *
 * نعرّف شكل الطلب والاستجابة وواجهة العميل فقط — لا Backend في هذه
 * المرحلة (قسم 11). الهدف أن يتطوّر الـSDK لاحقًا إلى API v1/v2/v3
 * عبر محوّلات (Adapters) دون لمس المجال أو الواجهة.
 */
import type { ContractErrorShape } from '../result/result';
import type { ResponseMetadata } from '../metadata/metadata';

// طرق HTTP المدعومة.
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// طلب API موصوف بعقود (قسم 59).
export interface APIRequest<TBody = unknown, TQuery = unknown> {
  readonly method: HttpMethod; // الطريقة.
  readonly path: string; // المسار (مثل: /v1/sales).
  readonly headers?: Readonly<Record<string, string>>; // الترويسات.
  readonly query?: TQuery; // معاملات الاستعلام.
  readonly body?: TBody; // الجسم (للأوامر).
  readonly version: string; // نسخة العقد المطلوبة (قسم 11).
  readonly requestId: string; // معرّف الطلب للتتبّع (قسم 68).
  readonly timeoutMs?: number; // مهلة مخصّصة.
}

// استجابة API موصوفة بعقود (قسم 60).
export interface APIResponse<TData = unknown> {
  readonly status: number; // رمز الحالة (200 · 4xx · 5xx).
  readonly data?: TData; // الحمولة عند النجاح.
  readonly error?: ContractErrorShape; // الخطأ عند الفشل (كود ثابت).
  readonly metadata: ResponseMetadata; // بطاقة الإصدار والتتبّع.
  readonly contractVersion: string; // نسخة العقد المنتِجة.
  readonly requestId: string; // معرّف الطلب (يطابق الطلب).
}

/**
 * واجهة عميل الـAPI (قسم 58) — تُنفَّذ لاحقًا فوق الشبكة.
 * التوقيع وحده عقد: الطلب مُحدَّد الأنواع، والنتيجة Result لا رمي.
 */
export interface APIClient {
  // ينفّذ طلبًا ويعيد استجابة مُتحقَّقًا منها.
  request<TData>(request: APIRequest): Promise<import('../result/result').ContractResult<APIResponse<TData>>>;
}

// نسخة واجهة الـAPI التي يتحدث بها هذا الـSDK (قسم 11).
export const DEFAULT_API_VERSION = 'v1' as const;

/**
 * طلب تفاوض النسخ (قسم 61) — أساس مستقبلي بلا خادم الآن.
 * العميل يعلن النسخ التي يفهمها، والخادم (لاحقًا) يختار الأعلى توافقًا.
 */
export interface VersionNegotiationOffer {
  readonly contractName: string; // العقد.
  readonly clientSupported: readonly string[]; // النسخ التي يفهمها العميل.
}

// نتيجة التفاوض المتوقعة (تُملأ من الخادم مستقبلًا).
export interface NegotiatedContract {
  readonly contractName: string; // العقد.
  readonly negotiatedVersion: string; // النسخة المتفق عليها.
  readonly viaAdapter: boolean; // هل لزمت محوّلة (نسخة أقدم)؟
}

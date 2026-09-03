/**
 * خطّافات المراقبة — PHASE 31 · قسم 59 و67.
 * الـSDK لا يرتبط بمزوّد مراقبة واحد: يعرّف عقودًا (Logger · Metrics · Tracer)
 * وينفّذها المضيف كما يشاء. الافتراضي صامت حتى لا يفرض تبعية.
 */
import type { ISODateTime } from '../types/datetime';
import type { OperationTrace } from '../types/common';
import type { TenantId, UserId } from '../identifiers/ids';

// مستويات التسجيل المدعومة.
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// عقد التسجيل: يستقبل رسالة وسياقًا آمنًا للتسجيل.
export interface SDKLogger {
  // يسجّل رسالة بمستوى محدد مع سياق اختياري.
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void;
}

// عقد المقاييس: عدّادات ومدد زمنية لقياس أداء العمليات (قسم 66).
export interface SDKMetrics {
  // يزيد عدّادًا باسم محدد.
  increment(name: string, value?: number, tags?: Record<string, string>): void;
  // يسجّل مدة عملية بالمللي ثانية.
  timing(name: string, milliseconds: number, tags?: Record<string, string>): void;
}

// امتداد زمني واحد داخل التتبّع.
export interface TraceSpan {
  // ينهي الامتداد ويسجّل مدته ونتيجته.
  end(status: 'ok' | 'error', attributes?: Record<string, string | number | boolean>): void;
}

// عقد التتبّع: يبدأ امتدادًا لكل عملية أعمال.
export interface SDKTracer {
  // يبدأ امتدادًا باسم العملية وبيانات التتبّع.
  startSpan(name: string, trace: OperationTrace): TraceSpan;
}

// حزمة المراقبة الكاملة التي يستقبلها عميل الـSDK.
export interface Observability {
  readonly logger: SDKLogger; // التسجيل.
  readonly metrics: SDKMetrics; // المقاييس.
  readonly tracer: SDKTracer; // التتبّع.
}

// مُسجّل صامت (الافتراضي).
export const noopLogger: SDKLogger = {
  // نتجاهل الرسالة عمدًا: المضيف يربط مُسجّله الحقيقي.
  log: () => undefined,
};

// مقاييس صامتة (الافتراضي).
export const noopMetrics: SDKMetrics = {
  // تجاهل زيادة العدّاد.
  increment: () => undefined,
  // تجاهل تسجيل المدة.
  timing: () => undefined,
};

// امتداد تتبّع صامت يُعاد من المتتبّع الافتراضي.
const noopSpan: TraceSpan = {
  // إنهاء بلا أثر.
  end: () => undefined,
};

// متتبّع صامت (الافتراضي).
export const noopTracer: SDKTracer = {
  // يُعيد دائمًا امتدادًا صامتًا.
  startSpan: () => noopSpan,
};

// حزمة المراقبة الافتراضية الصامتة بالكامل.
export const noopObservability: Observability = {
  logger: noopLogger,
  metrics: noopMetrics,
  tracer: noopTracer,
};

// عدّاد داخلي لتوليد معرّفات عمليات فريدة.
let operationCounter = 0;

// يولّد معرّف عملية فريدًا محليًا.
export const nextOperationId = (): string => {
  // نزيد العدّاد مع لفّه لتفادي النمو.
  operationCounter = (operationCounter + 1) % 1_000_000;
  // نركّب المعرّف من الزمن والعدّاد.
  return `op-${Date.now().toString(36)}-${operationCounter.toString(36)}`;
};

// يبني بيانات تتبّع لعملية جديدة (قسم 67).
export const createTrace = (
  operation: string,
  actorId?: UserId,
  tenantId?: TenantId,
  timestamp?: ISODateTime,
): OperationTrace => ({
  // معرّف العملية الفريد.
  operationId: nextOperationId(),
  // معرّف الاستدعاء (يساوي معرّف العملية محليًا؛ يأتي من الخادم لاحقًا).
  requestId: nextOperationId(),
  // لحظة البدء.
  timestamp: timestamp ?? new Date().toISOString(),
  // المنفّذ والمستأجر للربط بالتدقيق.
  actorId,
  tenantId,
  // اسم العملية (products.create…).
  operation,
});

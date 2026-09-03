/**
 * تجريد مصادر البيانات — PHASE 31 · أقسام 31 و32.
 * الـSDK لا يفترض أن البيانات بعيدة: يعرّف عقود مصادر (محلي · بعيد · مُخزَّن
 * مؤقتًا · دون اتصال) بنفس الشكل، فيُستبدل المصدر دون لمس أي مجال أو شاشة.
 * محرّك المزامنة الكامل يأتي في PHASE 35 — ADVANCED OFFLINE ENGINE.
 */
import type { Result } from '../result/result';
import type { ISODateTime } from '../types/datetime';

// نوع المصدر (يُستخدم في التشخيص واختبارات العقود).
export type DataSourceKind = 'local' | 'remote' | 'cached' | 'offline';

// العقد الأساسي لأي مصدر بيانات موجّه بالكيانات.
export interface DataSource<TEntity, TId extends string = string> {
  readonly kind: DataSourceKind; // نوع المصدر.
  readonly name: string; // اسمه (للتشخيص والسجلات).
  // يقرأ كل الكيانات (المصدر لا يفلتر؛ الفلترة مسؤولية المستودع).
  readAll(): Promise<Result<readonly TEntity[]>>;
  // يقرأ كيانًا بالمعرّف (null عند الغياب — ليس خطأً).
  readById(id: TId): Promise<Result<TEntity | null>>;
  // يكتب كيانًا (إنشاء أو تحديث كامل).
  write(entity: TEntity): Promise<Result<TEntity>>;
  // يحذف كيانًا بالمعرّف.
  remove(id: TId): Promise<Result<void>>;
}

// مصدر محلي: يقرأ ويكتب على الجهاز (المصدر الحالي في التطبيق).
export interface LocalDataSource<TEntity, TId extends string = string>
  extends DataSource<TEntity, TId> {
  readonly kind: 'local'; // ثابت النوع.
  // يمسح كل بيانات المصدر (تسجيل خروج/إعادة ضبط).
  clear(): Promise<Result<void>>;
}

// مصدر بعيد: يقرأ ويكتب عبر الشبكة (يُنفَّذ عند توفر MAJID API).
export interface RemoteDataSource<TEntity, TId extends string = string>
  extends DataSource<TEntity, TId> {
  readonly kind: 'remote'; // ثابت النوع.
  // يجلب التغييرات منذ لحظة محددة (أساس المزامنة التزايدية لاحقًا).
  readSince(since: ISODateTime): Promise<Result<readonly TEntity[]>>;
}

// سياسة صلاحية النسخة المؤقتة.
export interface CachePolicy {
  readonly ttlMs: number; // عمر النسخة بالمللي ثانية.
  readonly staleWhileRevalidate: boolean; // هل تُعرض النسخة القديمة أثناء التحديث؟
}

// مصدر مُخزَّن مؤقتًا: يغلّف مصدرًا آخر ويضيف طبقة نسخة مؤقتة.
export interface CachedDataSource<TEntity, TId extends string = string>
  extends DataSource<TEntity, TId> {
  readonly kind: 'cached'; // ثابت النوع.
  readonly policy: CachePolicy; // سياسة الصلاحية.
  // يُبطل النسخة المؤقتة فيُعاد الجلب في القراءة التالية.
  invalidate(): Promise<Result<void>>;
}

// حالة عنصر في طابور الكتابة دون اتصال.
export type PendingWriteStatus = 'pending' | 'inflight' | 'synced' | 'failed';

// عنصر كتابة مؤجّل في الطابور الصادر.
export interface PendingWrite<TPayload = unknown> {
  readonly id: string; // معرّف العنصر.
  readonly entity: string; // اسم الكيان (product · sale…).
  readonly action: 'create' | 'update' | 'delete'; // نوع العملية.
  readonly payload: TPayload; // الحمولة المُرسلة لاحقًا.
  readonly status: PendingWriteStatus; // الحالة.
  readonly attempts: number; // عدد المحاولات.
  readonly createdAt: ISODateTime; // لحظة التسجيل.
}

// مصدر دون اتصال: يخزّن الكتابات محليًا ويصفّها للمزامنة لاحقًا.
export interface OfflineDataSource<TEntity, TId extends string = string>
  extends DataSource<TEntity, TId> {
  readonly kind: 'offline'; // ثابت النوع.
  // يصفّ عملية كتابة للمزامنة المستقبلية.
  enqueue(write: Omit<PendingWrite, 'id' | 'status' | 'attempts' | 'createdAt'>): Promise<Result<PendingWrite>>;
  // يقرأ الطابور الحالي.
  pending(): Promise<Result<readonly PendingWrite[]>>;
}

// اتحاد كل أنواع المصادر (يُستخدم في التركيب والتشخيص).
export type AnyDataSource<TEntity, TId extends string = string> =
  | LocalDataSource<TEntity, TId>
  | RemoteDataSource<TEntity, TId>
  | CachedDataSource<TEntity, TId>
  | OfflineDataSource<TEntity, TId>;

// حارس نوع: هل المصدر محلي؟
export const isLocalSource = <T, I extends string>(
  source: AnyDataSource<T, I>,
): source is LocalDataSource<T, I> => source.kind === 'local';

// حارس نوع: هل المصدر بعيد؟
export const isRemoteSource = <T, I extends string>(
  source: AnyDataSource<T, I>,
): source is RemoteDataSource<T, I> => source.kind === 'remote';

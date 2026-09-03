/**
 * مجال الإشعارات — PHASE 31 · قسم 47.
 * الـSDK لا يرسل إشعارات بنفسه: يعرّف منفذًا تنفّذه طبقة التطبيق
 * (إشعارات محلية اليوم · دفع عن بُعد لاحقًا) بلا تغيير في المجالات.
 */
import type {
  AsyncResult,
  ISODateTime,
  NotificationId,
  TenantScopedFields,
  UserId,
} from '@/sdk/core';

// أهمية الإشعار.
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// فئة الإشعار (تحدد وجهته وسلوكه).
export type NotificationCategory =
  | 'inventory' // تنبيهات المخزون.
  | 'sales' // المبيعات.
  | 'payment' // المدفوعات.
  | 'system' // النظام.
  | 'security' // الأمان.
  | 'ai'; // رؤى الذكاء.

// إشعار موصوف.
export interface AppNotification extends TenantScopedFields {
  readonly id: NotificationId; // المعرّف.
  readonly category: NotificationCategory; // الفئة.
  readonly priority: NotificationPriority; // الأهمية.
  readonly titleKey: string; // مفتاح العنوان.
  readonly bodyKey: string; // مفتاح النص.
  readonly params: Readonly<Record<string, string | number>>; // معاملات الترجمة.
  readonly route?: string; // وجهة الفتح داخل التطبيق.
  readonly readAt?: ISODateTime; // لحظة القراءة.
  readonly createdAt: ISODateTime; // لحظة الإنشاء.
  readonly recipientId?: UserId; // المستلم.
}

// منفذ الإشعارات (Port).
export interface NotificationProviderPort {
  // يعرض إشعارًا فوريًا.
  present(notification: AppNotification): Promise<void>;
  // يجدول إشعارًا لوقت لاحق.
  schedule(notification: AppNotification, at: ISODateTime): Promise<void>;
  // يلغي إشعارًا مجدولًا.
  cancel(id: NotificationId): Promise<void>;
  // هل منح المستخدم إذن الإشعارات؟
  hasPermission(): Promise<boolean>;
}

// مستودع الإشعارات المخزّنة.
export interface NotificationRepository {
  // يسرد إشعارات المستخدم.
  list(recipientId?: UserId): AsyncResult<readonly AppNotification[]>;
  // يعلّم إشعارًا كمقروء.
  markRead(id: NotificationId): AsyncResult<AppNotification>;
  // يعلّم الكل كمقروء.
  markAllRead(): AsyncResult<number>;
  // عدد غير المقروء (شارة التطبيق).
  unreadCount(): AsyncResult<number>;
}

// هل الإشعار غير مقروء؟ (دالة نقية).
export const isUnread = (notification: AppNotification): boolean => notification.readAt === undefined;

// يرتّب الإشعارات بالأهمية ثم بالأحدث (دالة نقية غير مُطفِّرة).
export const sortByPriority = (notifications: readonly AppNotification[]): readonly AppNotification[] => {
  // ترتيب الأهمية تنازليًا.
  const rank: Record<NotificationPriority, number> = { urgent: 3, high: 2, normal: 1, low: 0 };
  // نسخة مرتّبة (لا تعديل على المصدر).
  return [...notifications].sort((a, b) => {
    // الأهمية أولًا.
    const byPriority = rank[b.priority] - rank[a.priority];
    // ثم الأحدث.
    return byPriority !== 0
      ? byPriority
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

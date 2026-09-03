/**
 * مجال الهوية — PHASE 31 · قسم 12.
 * ملفات المستخدمين وأجهزتهم. منفصل عن auth: المصادقة تُثبت "من أنت"،
 * والهوية تصف "ما بياناتك".
 */
import type {
  AsyncResult,
  AuditableFields,
  DeviceId,
  ISODateTime,
  PaginatedResult,
  QueryOptions,
  RoleId,
  TenantScopedFields,
  UserId,
} from '@/sdk/core';

// حالة المستخدم.
export type UserStatus = 'active' | 'suspended' | 'invited' | 'disabled';

// ملف المستخدم (بلا أي بيانات سرية).
export interface UserProfile extends TenantScopedFields, AuditableFields {
  readonly id: UserId; // المعرّف.
  readonly username: string; // اسم الدخول.
  readonly fullName: string; // الاسم الكامل.
  readonly email?: string; // البريد.
  readonly phone?: string; // الهاتف.
  readonly avatarIcon?: string; // أيقونة الصورة الرمزية.
  readonly roleIds: readonly RoleId[]; // الأدوار المسندة.
  readonly status: UserStatus; // الحالة.
  readonly lastLoginAt?: ISODateTime; // آخر دخول.
}

// جهاز مسجّل للمستخدم.
export interface UserDevice {
  readonly id: DeviceId; // معرّف الجهاز.
  readonly userId: UserId; // صاحبه.
  readonly name: string; // اسمه المعروض.
  readonly platform: 'ios' | 'android'; // منصّته.
  readonly trusted: boolean; // هل هو موثوق؟
  readonly lastSeenAt: ISODateTime; // آخر ظهور.
}

// استعلام سرد المستخدمين.
export interface UserListQuery extends QueryOptions {
  readonly status?: UserStatus; // تضييق بالحالة.
  readonly roleId?: RoleId; // تضييق بالدور.
}

// مستودع الهوية.
export interface IdentityRepository {
  // يسرد المستخدمين.
  listUsers(query?: UserListQuery): AsyncResult<PaginatedResult<UserProfile>>;
  // يجلب ملف مستخدم.
  getUser(id: UserId): AsyncResult<UserProfile>;
  // يقرأ ملف المستخدم الحالي من السياق.
  getCurrentUser(): AsyncResult<UserProfile>;
  // يحدّث ملفًا.
  updateProfile(id: UserId, patch: Partial<Pick<UserProfile, 'fullName' | 'email' | 'phone' | 'avatarIcon'>>): AsyncResult<UserProfile>;
  // يسرد أجهزة مستخدم.
  listDevices(userId: UserId): AsyncResult<readonly UserDevice[]>;
}

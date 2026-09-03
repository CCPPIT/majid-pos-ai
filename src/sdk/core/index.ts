/**
 * الواجهة العلنية لنواة الـSDK — PHASE 31 · قسم 51.
 * هذا الملف حاجز التصدير الوحيد للنواة: كل ما يخرج منه عقد علني مستقر،
 * وكل ما لا يُصدَّر تفصيل داخلي قابل للتغيير دون كسر المستهلكين.
 * لا يستورد هذا الملف من أي مجال أعلى (لا دورات — قسم 52 و53).
 */

// ── النتيجة (Result) — قسم 06 ──
export {
  success,
  failure,
  isSuccess,
  isFailure,
  map,
  mapError,
  flatMap,
  flatMapAsync,
  unwrapOr,
  unwrapOrElse,
  attempt,
  attemptAsync,
  combine,
  toLegacyResult,
  fromLegacyResult,
  type Result,
  type AsyncResult,
  type Success,
  type Failure,
} from './result/result';

// ── نظام الأخطاء — قسم 07 ──
export {
  SDKError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  NetworkError,
  OfflineError,
  TimeoutError,
  RateLimitError,
  PaymentError,
  InventoryError,
  BusinessRuleError,
  ContextError,
  UnknownError,
  toSDKError,
  isSDKErrorCode,
  type SDKErrorCode,
  type SDKErrorOptions,
} from './errors/sdk-error';

// ── المعرّفات المُوسَمة — قسم 08 ──
export {
  asUserId,
  asTenantId,
  asOrganizationId,
  asBranchId,
  asStoreId,
  asWarehouseId,
  asRoleId,
  asPermissionId,
  asProductId,
  asProductVariantId,
  asCategoryId,
  asSaleId,
  asSaleLineId,
  asCartId,
  asCartItemId,
  asPaymentId,
  asRefundId,
  asStockMovementId,
  asCustomerId,
  asSupplierId,
  asPurchaseOrderId,
  asPurchaseRequestId,
  asEmployeeId,
  asAccountId,
  asTransactionId,
  asDeviceId,
  asOperationId,
  asRequestId,
  asAIRequestId,
  asNotificationId,
  asEventId,
  idToString,
  idEquals,
  isValidId,
  type Brand,
  type UserId,
  type TenantId,
  type OrganizationId,
  type BranchId,
  type StoreId,
  type WarehouseId,
  type RoleId,
  type PermissionId,
  type ProductId,
  type ProductVariantId,
  type CategoryId,
  type SaleId,
  type SaleLineId,
  type CartId,
  type CartItemId,
  type PaymentId,
  type RefundId,
  type StockMovementId,
  type CustomerId,
  type SupplierId,
  type PurchaseOrderId,
  type PurchaseRequestId,
  type EmployeeId,
  type AccountId,
  type TransactionId,
  type DeviceId,
  type OperationId,
  type RequestId,
  type AIRequestId,
  type NotificationId,
  type EventId,
} from './identifiers/ids';

// ── المال — قسم 16 ──
export {
  SUPPORTED_CURRENCIES,
  CURRENCY_REGISTRY,
  isCurrencyCode,
  toCurrencyCode,
  money,
  tryMoney,
  zeroMoney,
  addMoney,
  subtractMoney,
  multiplyMoney,
  percentageOf,
  sumMoney,
  toMinorUnits,
  compareMoney,
  moneyEquals,
  isZeroMoney,
  isNegativeMoney,
  isPositiveMoney,
  fromRawMoney,
  toRawMoney,
  type Money,
  type MoneyAmount,
  type CurrencyCode,
  type CurrencyInfo,
} from './types/money';

// ── التاريخ والوقت — قسم 49 ──
export {
  systemClock,
  fixedClock,
  isISODateTime,
  parseISODateTime,
  toDateKey,
  makeDateRange,
  isWithinRange,
  resolvePreset,
  type ISODateTime,
  type ISODate,
  type TimeZoneId,
  type Timestamp,
  type DateRange,
  type DateRangePreset,
  type Clock,
} from './types/datetime';

// ── الأنواع المشتركة — أقسام 43 و56 ──
export type {
  AuditableFields,
  TenantScopedFields,
  ScopeFilter,
  QueryOptions,
  OperationOutcome,
  MutationEnvelope,
  OperationTrace,
  DeepPartial,
  RequireFields,
  RawRecord,
} from './types/common';

// ── السياق — أقسام 09 و10 ──
export {
  EMPTY_CONTEXT,
  createContext,
  mergeContext,
  requireContext,
  hasTenant,
  hasStore,
  isAuthenticated,
  createContextStore,
  type SDKContext,
  type SDKContextRequirement,
  type SDKContextStore,
  type SDKLocale,
} from './context/sdk-context';

// ── التحقق (جسر Zod ↔ أخطاء الـSDK) — قسم 42 ──
export { toValidationError, validateWith } from './validation/validate';

// ── الترقيم — قسم 46 ──
export {
  MIN_PAGE_SIZE,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  pageRequest,
  validatePagination,
  encodeCursor,
  decodeCursor,
  paginate,
  emptyPage,
  isCursorRequest,
  type Cursor,
  type PageRequest,
  type CursorRequest,
  type Pagination,
  type PageInfo,
  type PaginatedResult,
} from './pagination/pagination';

// ── الفلترة — قسم 47 ──
export {
  filter,
  and,
  or,
  isFilterGroup,
  readField,
  evaluateFilter,
  evaluateFilterGroup,
  applyFilters,
  type Filter,
  type FilterOperator,
  type FilterValue,
  type FilterGroup,
  type FilterCombinator,
} from './filters/filters';

// ── الترتيب — قسم 48 ──
export {
  sort,
  NEWEST_FIRST,
  compareValues,
  comparatorFor,
  applySort,
  type Sort,
  type SortDirection,
} from './sorting/sorting';

// ── أحداث المجال — قسم 40 ──
export {
  SDK_DOMAIN_EVENTS,
  createDomainEvent,
  createEventCollector,
  noopEventPublisher,
  type SDKDomainEvent,
  type SDKDomainEventName,
  type EventMetadata,
  type EventPublisher,
  type EventCollector,
} from './events/domain-events';

// ── التدقيق — قسم 41 ──
export {
  createAuditEvent,
  noopAuditLogger,
  createInMemoryAuditLogger,
  type AuditEvent,
  type AuditEventInput,
  type AuditResult,
  type AuditLogger,
} from './audit/audit-contract';

// ── المراقبة — أقسام 59 و67 ──
export {
  noopLogger,
  noopMetrics,
  noopTracer,
  noopObservability,
  nextOperationId,
  createTrace,
  type LogLevel,
  type SDKLogger,
  type SDKMetrics,
  type SDKTracer,
  type TraceSpan,
  type Observability,
} from './observability/observability';

// ── الإصدارات — قسم 64 ──
export {
  SDK_VERSION,
  API_VERSION,
  CONTRACT_VERSION,
  SDK_PHASE,
  parseVersion,
  compareVersions,
  isCompatibleWith,
  sdkVersionInfo,
  type SemanticVersion,
  type SDKVersionInfo,
} from './config/versioning';

// ── المزوّدات — قسم 39 ──
export type {
  AuthProvider,
  AuthTokens,
  AuthPrincipal,
  AuthCredentials,
  AuthSession,
  StorageProvider,
  NetworkProvider,
  NetworkRequest,
  NetworkResponse,
  HttpMethod,
  ConnectivityStatus,
  PaymentProvider,
  PaymentMethodKind,
  PaymentAuthorizationRequest,
  PaymentProviderResult,
  NotificationProvider,
  NotificationMessage,
  NotificationChannel,
  AIProvider,
  AIGenerationRequest,
  AIGenerationResponse,
  AnalyticsProvider,
  AnalyticsEvent,
  BiometricProvider,
  BiometricOutcome,
  DeviceProvider,
  DeviceInfo,
  PlatformProviderPorts,
  AuthorizationGate,
} from './client/providers';

// ── مصادر البيانات — أقسام 31 و32 ──
export {
  isLocalSource,
  isRemoteSource,
  type DataSource,
  type DataSourceKind,
  type LocalDataSource,
  type RemoteDataSource,
  type CachedDataSource,
  type CachePolicy,
  type OfflineDataSource,
  type PendingWrite,
  type PendingWriteStatus,
  type AnyDataSource,
} from './client/data-source';

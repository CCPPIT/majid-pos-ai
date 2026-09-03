/**
 * الحاجز العلني لنواة العقود — PHASE 32 · أقسام 44 و74 و76.
 *
 * كل ما يُصدَّر من هنا عقد مستقر ومُنسَّخ. النواة لا تستورد أي مجال
 * ولا React/RN/Zustand (اتجاه التبعية: UI → Feature → SDK → Contracts →
 * Domain — أقسام 75 و76). لا دورات استيراد.
 */

// ── الإصدار الدلالي — قسم 07 ──
export {
  parseSemVer,
  tryParseSemVer,
  isSemVer,
  formatSemVer,
  compareSemVer,
  semVerEquals,
  semVerGreaterThan,
  semVerLessThanOrEqual,
  bumpKind,
  isSemVerCompatible,
  isWithinRange,
  type SemVer,
  type BumpKind,
} from './versioning/semver';

// ── إصدارات الـSDK والمجالات — أقسام 09 و10 و11 ──
export {
  SDK_VERSION,
  SDK_PHASE,
  API_VERSION,
  API_SEMVER,
  CONTRACTS_VERSION,
  DOMAIN_CONTRACT_VERSIONS,
  DOMAIN_NAMES,
  CONTRACT_NAMESPACE,
  domainContractVersion,
  contractName,
  type DomainName,
} from './versioning/versions';

// ── سجلّ العقود — أقسام 12 و13 ──
export {
  ContractVersionRegistry,
  contractRegistry,
  type RegisteredContract,
  type RegisterContractOptions,
  type VersionSupport,
  type ContractKind,
} from './versioning/registry';

// ── التوافق — قسم 14 ──
export {
  checkCompatibility,
  negotiateVersion,
  SDK_API_COMPATIBILITY,
  type CompatibilityContext,
  type CompatibilityResult,
} from './compatibility/compatibility';

// ── الإهمال — أقسام 19 و20 و70 ──
export {
  deprecationRegistry,
  type DeprecationNotice,
  type DeprecationLifecycle,
  type DeprecatedUsage,
} from './deprecation/deprecation';

// ── محرّك الترحيل — أقسام 17 و21 ──
export {
  MigrationRegistry,
  migrationRegistry,
  registerMigration,
  migrateContract,
  type MigrationStep,
  type MigrationResult,
} from './migration/migrations';

// ── فارق العقود — أقسام 16 و51 و52 ──
export {
  diffContracts,
  assertVersionPolicy,
  type ContractShape,
  type FieldSpec,
  type ContractDiff,
  type ContractChange,
  type DiffChangeKind,
} from './diff/contract-diff';

// ── البيانات الوصفية — أقسام 08 و28 و42 و65–70 ──
export {
  defineContractMetadata,
  type ContractMetadata,
  type StabilityLevel,
  type PrivacyLevel,
  type TenantScope,
  type OperationTrace,
  type PrivacyMetadata,
  type ResponseMetadata,
  type SDKResponse,
  type ISODateTime,
} from './metadata/metadata';

// ── المعرّفات المُوسَمة — قسم 42 ──
export {
  brandId,
  idToString,
  idEquals,
  isValidId,
  type Branded,
  type TenantId,
  type OrganizationId,
  type BranchId,
  type StoreId,
  type UserId,
  type ProductId,
  type ProductVariantId,
  type CategoryId,
  type SaleId,
  type PaymentId,
  type CartId,
  type CustomerId,
  type InventoryItemId,
  type EmployeeId,
  type AIRequestId,
  type CommandId,
  type EventId,
} from './primitives/ids';

// ── نتيجة العقود — قسم 77 ──
export {
  ok,
  fail,
  isOk,
  isErr,
  mapOk,
  type ContractResult,
  type ContractSuccess,
  type ContractFailure,
  type ContractErrorShape,
} from './result/result';

// ── أكواد الأخطاء المستقرة — أقسام 29 و30 ──
export {
  ERROR_CODES,
  ERROR_NAMESPACES,
  getErrorDefinition,
  defineContractError,
  type ErrorCode,
} from './errors/error-codes';

// ── الأحداث المُنسَّخة — أقسام 33 و34 ──
export {
  buildEvent,
  generateEventId,
  eventUpcasters,
  EventUpcasterRegistry,
  type VersionedDomainEvent,
  type EventEnvelopeInput,
  type EventUpcaster,
} from './events/event-contract';

// ── الأوامر غير المتصلة — أقسام 39 و40 و41 ──
export {
  createOfflineCommand,
  transitionOfflineCommand,
  generateCommandId,
  LOCAL_STORAGE_SCHEMA_VERSION,
  type OfflineCommandEnvelope,
  type CreateOfflineCommandInput,
  type OfflineCommandStatus,
} from './offline/offline-command';

// ── أساس الـAPI (بلا خادم) — أقسام 58–61 ──
export {
  DEFAULT_API_VERSION,
  type APIClient,
  type APIRequest,
  type APIResponse,
  type HttpMethod,
  type VersionNegotiationOffer,
  type NegotiatedContract,
} from './api/api-contract';

// ── القدرات — أقسام 62–64 ──
export {
  CAPABILITIES,
  CapabilityRegistry,
  type Capability,
  type CapabilityName,
  type CapabilityStatus,
  type CapabilityDiscovery,
} from './capability/capabilities';

// ── التحقّق وقت التشغيل — أقسام 22–24 ──
export {
  validateContract,
  validateAIOutput,
  toContractValidationError,
  trimmedString,
  idString,
  isoDateTime,
  nonnegativeNumber,
  type ContractValidationError,
  type ContractValidationIssue,
} from './validation/contract-validation';

// ── فصل DTO الإصدارات — قسم 38 ──
export {
  DtoVersionAdapter,
  apiDtoSchema,
  parseAndAdaptDto,
  type ApiDTO,
  type ApiDtoVersion,
} from './dto/dto-versioning';
